// 웹 서비스 "기획 도우미"에서 옮겨 온 프롬프트 — 지금은 이 킷이 정본이다. 고친 뒤 `node --test` 로 확인한다.
// 기반 선택(카탈로그 + 프로젝트 선택)을 글로 만드는 순수 함수들.
// 프롬프트와 내보내기(README·CLAUDE.md)가 **같은 함수**를 쓴다 —
// 그래야 AI 가 본 것과 사람이 내려받는 것이 어긋나지 않는다. server-only 를 import 하지 말 것.
//
// 원칙: 저장된 문서 본문에는 이 블록을 넣지 않는다. 생성할 때는 AI 입력에, 보여 주거나
// 내보낼 때는 그 시점의 선택으로 매번 만든다(선택을 바꿔도 옛 링크가 본문에 남지 않게).
/** 선택을 카탈로그에 비춰 분류 순서대로 펼친다. 카탈로그에 없는 id 는 조용히 뺀다. */
export function resolveSelection(catalog, selection, target) {
    if (!selection?.items?.length)
        return [];
    const out = [];
    const cats = [...catalog].sort((a, b) => a.sort - b.sort);
    for (const category of cats) {
        if (target && !category.applies_to.includes(target))
            continue;
        const items = [...category.items].sort((a, b) => a.sort - b.sort);
        for (const item of items) {
            const pick = selection.items.find((p) => p.item_id === item.id);
            if (!pick)
                continue;
            const options = item.options
                .filter((o) => pick.option_keys.includes(o.key))
                .sort((a, b) => a.sort - b.sort);
            const archived = !category.active || !item.active || options.some((o) => !o.active);
            out.push({ category, item, options, archived });
        }
    }
    return out;
}
function fill(text, item, option) {
    return text
        .replaceAll("{option}", option?.key ?? "")
        .replaceAll("{url}", option?.url ?? item.url ?? "");
}
/** 항목 지침 + 선택지 지침. {option} 이 있으면 선택지마다 한 번씩 펼친다. */
export function guidanceLines(p) {
    const lines = [];
    const g = p.item.guidance?.trim();
    if (g) {
        if (g.includes("{option}") && p.options.length > 0) {
            for (const o of p.options)
                lines.push(fill(g, p.item, o));
        }
        else if (!g.includes("{option}")) {
            lines.push(fill(g, p.item));
        }
    }
    for (const o of p.options) {
        const og = o.guidance?.trim();
        if (og)
            lines.push(fill(og, p.item, o));
    }
    return lines;
}
function choiceLabel(p) {
    const opts = p.options.map((o) => o.label).join(", ");
    return opts ? `${p.item.name} — ${opts}` : p.item.name;
}
/**
 * 생성 프롬프트의 사용자 메시지 끝에 붙이는 블록. 선택이 없으면 "" (원본 프롬프트 그대로).
 * 시스템 프롬프트는 건드리지 않는다.
 */
export function renderFoundationPrompt(catalog, selection, target) {
    const picks = resolveSelection(catalog, selection, target);
    if (!picks.length)
        return "";
    const body = picks
        .map((p) => {
        const head = `- ${p.category.name}: ${choiceLabel(p)}${p.item.url ? ` (${p.item.url})` : ""}`;
        const g = guidanceLines(p).map((l) => l.split("\n").map((x) => `    ${x}`).join("\n"));
        return [head, ...g].join("\n");
    })
        .join("\n");
    return ("\n\n[선택된 기반 — 표준·레퍼런스]\n" +
        "이 프로젝트는 아래 기반을 쓰기로 확정했습니다. 문서는 이 선택을 전제로 작성하고, " +
        "관련 내용을 다루는 곳에 해당 주소(링크)를 그대로 적어 참고하도록 지정하세요. " +
        "목록에 없는 다른 기술·디자인을 새로 고르지 마세요.\n" +
        body);
}
/** 내보내기(CLAUDE.md·README)용 마크다운 섹션. 선택이 없으면 "". */
export function renderFoundationMarkdown(catalog, selection, opts = {}) {
    const picks = resolveSelection(catalog, selection);
    if (!picks.length)
        return "";
    const h = "#".repeat(opts.level ?? 2);
    const esc = (s) => s.replaceAll("|", "\\|");
    const rows = picks.map((p) => {
        const ref = p.item.url ? `[${esc(p.item.url.replace(/^https?:\/\//, ""))}](${p.item.url})` : "";
        return `| ${esc(p.category.name)} | ${esc(choiceLabel(p))}${p.archived ? " (보관됨)" : ""} | ${ref} |`;
    });
    const guide = picks
        .map((p) => {
        const lines = guidanceLines(p);
        if (!lines.length)
            return null;
        return `- **${choiceLabel(p)}**\n${lines.map((l) => l.split("\n").map((x) => `  ${x}`).join("\n")).join("\n")}`;
    })
        .filter(Boolean);
    return [
        `${h} ${opts.heading ?? "기반 선택 (참조 리소스)"}`,
        "",
        "| 분류 | 선택 | 참조 |",
        "|---|---|---|",
        ...rows,
        ...(guide.length ? ["", `${h}# 적용 지침`, "", ...guide] : []),
        "",
    ].join("\n");
}
/** 분류 규칙(single/multi·required·max_select)과 항목 선택지 규칙 검사. 서버·화면 공용. */
export function validateSelection(catalog, selection) {
    const issues = [];
    const itemIndex = new Map();
    for (const cat of catalog)
        for (const item of cat.items)
            itemIndex.set(item.id, { cat, item });
    const seen = new Set();
    for (const p of selection.items) {
        if (seen.has(p.item_id))
            issues.push({ category_id: null, item_id: p.item_id, message: "같은 항목이 두 번 선택됐습니다." });
        seen.add(p.item_id);
        const hit = itemIndex.get(p.item_id);
        if (!hit) {
            issues.push({ category_id: null, item_id: p.item_id, message: "카탈로그에 없는 항목입니다." });
            continue;
        }
        const { item } = hit;
        const valid = new Set(item.options.map((o) => o.key));
        const unknown = p.option_keys.filter((k) => !valid.has(k));
        if (unknown.length)
            issues.push({ category_id: item.category_id, item_id: item.id, message: `${item.name}: 없는 선택지 ${unknown.join(", ")}` });
        if (item.option_mode === "none" && p.option_keys.length)
            issues.push({ category_id: item.category_id, item_id: item.id, message: `${item.name}: 선택지가 없는 항목입니다.` });
        if (item.option_mode === "single" && p.option_keys.length > 1)
            issues.push({ category_id: item.category_id, item_id: item.id, message: `${item.name}: ${item.option_label ?? "선택지"}는 하나만 고를 수 있습니다.` });
        if (item.option_mode !== "none" && item.option_required && p.option_keys.length === 0)
            issues.push({ category_id: item.category_id, item_id: item.id, message: `${item.name}: ${item.option_label ?? "선택지"}를 고르세요.` });
    }
    for (const cat of catalog) {
        if (!cat.active)
            continue;
        const n = selection.items.filter((p) => itemIndex.get(p.item_id)?.cat.id === cat.id).length;
        if (cat.required && n === 0)
            issues.push({ category_id: cat.id, item_id: null, message: `${cat.name}: 하나 이상 고르세요.` });
        if (cat.select_mode === "single" && n > 1)
            issues.push({ category_id: cat.id, item_id: null, message: `${cat.name}: 하나만 고를 수 있습니다.` });
        if (cat.max_select && n > cat.max_select)
            issues.push({ category_id: cat.id, item_id: null, message: `${cat.name}: 최대 ${cat.max_select}개까지 고를 수 있습니다.` });
    }
    return issues;
}
/** 새 프로젝트·처음 진입 시의 초기 선택: 활성 항목 중 is_default, 그 선택지 중 is_default. */
export function defaultSelection(catalog) {
    const items = [];
    for (const cat of catalog) {
        if (!cat.active)
            continue;
        const defs = cat.items.filter((i) => i.active && i.is_default).sort((a, b) => a.sort - b.sort);
        for (const item of cat.select_mode === "single" ? defs.slice(0, 1) : defs) {
            const opts = item.options.filter((o) => o.active && o.is_default).map((o) => o.key);
            items.push({ item_id: item.id, option_keys: item.option_mode === "single" ? opts.slice(0, 1) : opts });
        }
    }
    return { items, confirmed: false };
}
