// 웹 서비스 "기획 도우미"에서 옮겨 온 프롬프트 — 지금은 이 킷이 정본이다. 고친 뒤 `node --test` 로 확인한다.
import { stripReferences } from "./prompts/dev.mjs";
import { renderFoundationMarkdown } from "./foundation-render.mjs";
const DOCS = [
    { field: "prd", path: "docs/PRD.md", title: "PRD" },
    { field: "feature_spec", path: "docs/FEATURES.md", title: "기능 정리" },
    { field: "design_spec", path: "docs/DESIGN.md", title: "디자인 명세서" },
    { field: "dev_spec", path: "docs/DEV_SPEC.md", title: "개발 명세서" },
];
const has = (s) => !!s && s.trim().length > 0;
export const FOUNDATION_EXPORT_HEADING = "기반 선택 (참조 리소스) — 구현 전에 반드시 읽을 것";
/**
 * README.md, docs/*.md (non-empty only), CLAUDE.md (when a dev spec or a foundation selection exists).
 * `catalog` = 보관 포함 카탈로그 — 프로젝트가 고른 보관 항목도 이름·링크를 보여 준다.
 */
export function buildExportFiles(input, catalog) {
    // Dev specs imported from the original service may still carry the
    // "참고 자료" copies of PRD/IA at the end; docs/ already has those files.
    const p = input.dev_spec ? { ...input, dev_spec: stripReferences(input.dev_spec) } : input;
    const present = DOCS.filter((d) => has(p[d.field]));
    const files = [];
    // 기반 섹션은 그 시점의 선택으로 매번 만든다 (저장 문서 본문에는 넣지 않는다).
    const foundation = renderFoundationMarkdown(catalog, p.foundation, { heading: FOUNDATION_EXPORT_HEADING, level: 2 });
    const dev = has(p.dev_spec) ? p.dev_spec.trim() : null;
    const withClaude = dev !== null || has(foundation);
    const readme = [
        `# ${p.name}`,
        "",
        has(p.summary) ? `${p.summary.trim()}\n` : null,
        "## 문서",
        "",
        ...(present.length ? present.map((d) => `- [${d.title}](${d.path})`) : ["- (아직 작성된 문서가 없습니다)"]),
        withClaude ? "- [CLAUDE.md](CLAUDE.md) — AI 코딩 도구용 개발 안내" : null,
        "",
        has(foundation) ? foundation : null,
        "---",
        "",
        "planning-helper-kit 으로 생성 (기획 도우미 프롬프트를 Claude Code 에서 실행)",
        "",
    ]
        .filter((l) => l !== null)
        .join("\n");
    files.push({ path: "README.md", content: readme });
    for (const d of present)
        files.push({ path: d.path, content: ensureNewline(p[d.field]) });
    if (withClaude) {
        const readFirst = present.filter((d) => d.field !== "dev_spec").map((d) => `\`${d.path}\``);
        const claude = [
            `# ${p.name}`,
            "",
            "> 이 파일은 planning-helper-kit(기획 도우미 Claude Code 플러그인)으로 만든 개발 안내서입니다.",
            "",
            "## 프로젝트 개요",
            "",
            has(p.summary) ? p.summary.trim() : `${p.name} — 기획 도우미에서 작성한 기획 문서를 바탕으로 구현하는 프로젝트입니다.`,
            "",
            "## 작업 규칙",
            "",
            `- 구현 전 docs/ 의 PRD·FEATURES·DESIGN 을 먼저 읽는다${readFirst.length ? ` (${readFirst.join(", ")})` : ""}.`,
            has(foundation)
                ? "- 아래 '기반 선택'의 링크(디자인 프리셋·표준 모듈·배포 선례 등)를 먼저 열어 읽고 그 지침을 따른다. 목록에 없는 기술·디자인을 새로 고르지 않는다."
                : null,
            dev ? "- 아래 개발 명세서(`docs/DEV_SPEC.md` 와 같은 내용)를 기준으로 구현한다." : null,
            "- 명세와 다르게 구현해야 하면 이유를 남기고 해당 문서도 함께 고친다.",
            "",
            has(foundation) ? foundation : null,
            ...(dev ? ["## 개발 명세서", "", dev, ""] : []),
        ]
            .filter((l) => l !== null)
            .join("\n");
        files.push({ path: "CLAUDE.md", content: claude });
    }
    return files;
}
function ensureNewline(s) {
    return s.endsWith("\n") ? s : `${s}\n`;
}
