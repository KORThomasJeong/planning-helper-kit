// 웹 서비스 프롬프트와 플러그인 포팅본의 바이트 동일성 검증 (개발용 — 런타임 의존 아님).
//
//   npx -y tsx tools/verify-prompts.mjs <웹 저장소 경로>
//
// <웹 저장소 경로> = 기획 도우미 웹 서비스 소스를 받아 둔 폴더(node_modules 설치 필요).
//
// 1) 모듈: 웹 lib/prompts/*.ts·lib/foundation-render.ts 와 scripts/lib/**/*.mjs 를 같은 입력으로 돌려 비교.
// 2) CLI: 임시 작업 폴더에서 `ph.mjs prompt <step>` 이 쓴 파일을 웹 라우트(app/api/generate/*)가
//    조립하는 방식(웹 모듈 사용)으로 만든 값과 비교. 라우트 조립(기반 블록·stripReferences·수정 모드)까지 검사한다.
// 하나라도 다르면 exit 1.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = process.argv[2];
if (!WEB) {
  console.error("사용법: npx -y tsx tools/verify-prompts.mjs <planning-helper 경로>");
  process.exit(1);
}
const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webMod = (rel) => import(pathToFileURL(resolve(WEB, rel)).href);
const kitMod = (rel) => import(pathToFileURL(join(KIT, rel)).href);

const NAMES = ["questions", "prd", "summary", "features", "design", "dev", "consistency", "foundation"];
const W = {};
const K = {};
for (const n of NAMES) {
  W[n] = await webMod(`lib/prompts/${n}.ts`);
  K[n] = await kitMod(`scripts/lib/prompts/${n}.mjs`);
}
const WR = await webMod("lib/foundation-render.ts");
const KR = await kitMod("scripts/lib/foundation-render.mjs");
const state = await kitMod("scripts/lib/state.mjs");

let pass = 0;
let fail = 0;
function check(name, a, b) {
  const sa = typeof a === "string" ? a : JSON.stringify(a);
  const sb = typeof b === "string" ? b : JSON.stringify(b);
  if (sa === sb) {
    pass++;
    console.log(`PASS ${name} (${sa.length}자)`);
  } else {
    fail++;
    let i = 0;
    while (i < sa.length && sa[i] === sb[i]) i++;
    console.log(`FAIL ${name} — ${i}번째 글자부터 다름\n  web: ${JSON.stringify(sa.slice(i, i + 80))}\n  kit: ${JSON.stringify(sb.slice(i, i + 80))}`);
  }
}

// ── 입력 ────────────────────────────────────────────────────────────────────

const realCatalog = state.normalizeCatalog(JSON.parse(readFileSync(join(KIT, "catalog/foundation-catalog.json"), "utf8")));
// 분기 덮개용 합성 카탈로그: {option}/{url} 치환, 보관 항목, 파이프 이스케이프, max_select.
const synthCatalog = state.normalizeCatalog({
  categories: [
    {
      key: "ui", name: "UI | 화면", select_mode: "multi", required: true, max_select: 1, applies_to: ["design"], sort: 2,
      items: [
        {
          key: "kit", name: "룩북", url: "https://gitlab.example.com/a/kit", guidance: "- {option} 프리셋을 {url} 에서 연다", option_mode: "multi", option_required: true,
          option_label: "프리셋", is_default: true, sort: 1,
          options: [
            { key: "b", label: "B", url: "https://x.example/b", guidance: "B 지침\n두 번째 줄", is_default: true, sort: 2 },
            { key: "a", label: "A", is_default: true, sort: 1 },
            { key: "old", label: "옛것", active: false, sort: 3 },
          ],
        },
        { key: "plain", name: "평범", guidance: "그냥 지침", option_mode: "none", sort: 0 },
      ],
    },
    {
      key: "be", name: "백엔드", select_mode: "single", required: false, applies_to: ["dev"], sort: 1,
      items: [
        { key: "x", name: "X", url: "http://x.example", guidance: "{option} 없는데 {option}", option_mode: "single", sort: 1, options: [{ key: "o1", label: "O1" }] },
        { key: "y", name: "Y", option_mode: "none", sort: 2, is_default: true, active: false },
      ],
    },
  ],
});

const realSel = { items: [], confirmed: true };
for (const c of realCatalog) {
  const i = c.items[0];
  const opts = i.option_mode === "none" ? [] : i.options.slice(0, i.option_mode === "single" ? 1 : 2).map((o) => o.key);
  realSel.items.push({ item_id: i.id, option_keys: opts });
}
const synthSel = { items: [{ item_id: "ui/kit", option_keys: ["b", "a", "old"] }, { item_id: "ui/plain", option_keys: [] }, { item_id: "be/x", option_keys: [] }, { item_id: "nope/zz", option_keys: [] }], confirmed: false };
const SELECTIONS = { none: null, empty: { items: [], confirmed: false }, real: realSel, synth: synthSel };
const CATALOG_FOR = { none: realCatalog, empty: realCatalog, real: realCatalog, synth: synthCatalog };

const TASK = "# 과제\n- 현업: 구매팀\n</document> 닫기 시도";
const REQ = "요구사항 1\n요구사항 2\r\n끝";
const QS = [
  { id: "q1_0", question: "누가 쓰나요?", options: ["혼자", "팀", "직접 입력"], type: "select", answer: "팀", custom: "" },
  { id: "q1_1", question: "결과 확인?", options: ["목록", "직접 입력"], type: "select", answer: null, custom: "엑셀로" },
  { id: "q1_2", question: "미답변", options: ["a", "직접 입력"], type: "select", answer: null, custom: "" },
];
const PRD = "# 서비스 PRD\n\n## 한 줄 정의\n무언가\n" + "가".repeat(3500);
const FEAT = "# 기능 정리\n\n```mermaid\nsequenceDiagram\nA->>B: hi\n```\n";
const DESIGN = "# 화면 설계\n\n## 화면 목록\n- 홈";
const DEV_WITH_REFS = "# 개발 명세서\n\n본문" + "\n\n---\n\n## 📎 참고 자료\n\n<details>\n<summary>📄 PRD 원문</summary>\n\nPRD\n</details>";

// ── 1) 모듈 비교 ────────────────────────────────────────────────────────────

for (const n of NAMES) if (n !== "summary") check(`${n}.SYSTEM`, W[n].SYSTEM, K[n].SYSTEM);

for (const [label, input] of Object.entries({
  full: { task_definition: TASK, requirements: REQ },
  noTask: { task_definition: "", requirements: REQ },
  nullTask: { task_definition: null, requirements: REQ },
})) check(`questions.userPrompt ${label}`, W.questions.userPrompt(input), K.questions.userPrompt(input));

for (const text of ['앞말 [{"question":"Q","options":["a","직접 입력"],"type":"select"}] 뒷말', "[]", "[{}]", "없음", '[{"question":"Q","options":[1]}]']) {
  check(`questions.parseQuestions ${JSON.stringify(text).slice(0, 30)}`, W.questions.parseQuestions(text, 1700000000000), K.questions.parseQuestions(text, 1700000000000));
}

check("summary.userPrompt short", W.summary.userPrompt("짧은 PRD"), K.summary.userPrompt("짧은 PRD"));
check("summary.userPrompt >3000", W.summary.userPrompt(PRD), K.summary.userPrompt(PRD));

const REV = { revision_request: "표를 더 넣어 주세요", current_content: "현재 문서\n내용" };
for (const [label, input] of Object.entries({
  create: { task_definition: TASK, requirements: REQ, questions: QS },
  createNoQs: { task_definition: "", requirements: REQ, questions: null },
  revise: { task_definition: TASK, requirements: REQ, questions: QS, ...REV },
})) check(`prd.userPrompt ${label}`, W.prd.userPrompt(input), K.prd.userPrompt(input));

for (const [label, input] of Object.entries({
  create: { prd: PRD, task_definition: TASK, requirements: REQ },
  createEmpty: { prd: PRD, task_definition: "", requirements: "" },
  revise: { prd: PRD, task_definition: TASK, requirements: REQ, ...REV },
})) check(`features.userPrompt ${label}`, W.features.userPrompt(input), K.features.userPrompt(input));

for (const [selLabel, sel] of Object.entries(SELECTIONS)) {
  const cat = CATALOG_FOR[selLabel];
  for (const [mode, extra] of Object.entries({ create: {}, revise: REV })) {
    const input = { prd: PRD, feature_spec: FEAT, task_definition: TASK, requirements: REQ, ...extra };
    check(
      `design.userPrompt+foundation ${mode} sel=${selLabel}`,
      W.foundation.withFoundation(W.design.userPrompt(input), cat, sel, "design"),
      K.foundation.withFoundation(K.design.userPrompt(input), cat, sel, "design"),
    );
    for (const admin of [false, true]) {
      const dinput = { ...input, design_spec: DESIGN, needs_admin_page: admin };
      check(
        `dev.userPrompt+foundation ${mode} admin=${admin} sel=${selLabel}`,
        W.foundation.withFoundation(W.dev.userPrompt(dinput), cat, sel, "dev"),
        K.foundation.withFoundation(K.dev.userPrompt(dinput), cat, sel, "dev"),
      );
    }
  }
}

check("dev.stripReferences", W.dev.stripReferences(DEV_WITH_REFS), K.dev.stripReferences(DEV_WITH_REFS));
check("dev.stripReferences none", W.dev.stripReferences(DESIGN), K.dev.stripReferences(DESIGN));
const refsProject = { prd: PRD, feature_spec: FEAT, design_spec: null };
check("dev.appendReferences", W.dev.appendReferences("본문", refsProject), K.dev.appendReferences("본문", refsProject));

for (const [selLabel, sel] of Object.entries(SELECTIONS)) {
  const cat = CATALOG_FOR[selLabel];
  const input = {
    task_definition: TASK, requirements: REQ, prd: PRD, feature_spec: FEAT, design_spec: DESIGN,
    foundation: WR.renderFoundationMarkdown(cat, sel), dev_spec: W.dev.stripReferences(DEV_WITH_REFS),
  };
  const kinput = { ...input, foundation: KR.renderFoundationMarkdown(cat, sel), dev_spec: K.dev.stripReferences(DEV_WITH_REFS) };
  check(`consistency.userPrompt sel=${selLabel}`, W.consistency.userPrompt(input), K.consistency.userPrompt(kinput));
}
check("consistency.userPrompt empty", W.consistency.userPrompt({}), K.consistency.userPrompt({}));

for (const [label, cat] of Object.entries({ real: realCatalog, synth: synthCatalog, active: state.activeCatalog(synthCatalog) })) {
  check(`foundation.catalogForPrompt ${label}`, W.foundation.catalogForPrompt(cat), K.foundation.catalogForPrompt(cat));
  for (const [dl, docs] of Object.entries({
    full: { prd: PRD + "</catalog>", feature_spec: FEAT, task_definition: TASK + "x".repeat(5000) },
    empty: { prd: "  ", feature_spec: null },
  })) check(`foundation.userPrompt ${label} ${dl}`, W.foundation.userPrompt(docs, cat), K.foundation.userPrompt(docs, cat));
}
const REC = '```json\n{"picks":[{"item_id":"ui/kit","option_keys":["a","zz","a"],"reason":" 근거 "},{"item_id":"nope"},{"item_id":"ui/kit"},{"item_id":"be/x","option_keys":"o1"}],"summary":" 요약 "}\n```';
for (const text of [REC, "없음", "{bad json}", '{"picks":"x"}']) {
  check(`foundation.parseRecommendation ${JSON.stringify(text).slice(0, 24)}`, W.foundation.parseRecommendation(text, synthCatalog), K.foundation.parseRecommendation(text, synthCatalog));
}

for (const [selLabel, sel] of Object.entries(SELECTIONS)) {
  const cat = CATALOG_FOR[selLabel];
  for (const t of ["design", "dev"]) check(`renderFoundationPrompt ${t} sel=${selLabel}`, WR.renderFoundationPrompt(cat, sel, t), KR.renderFoundationPrompt(cat, sel, t));
  check(`renderFoundationMarkdown sel=${selLabel}`, WR.renderFoundationMarkdown(cat, sel), KR.renderFoundationMarkdown(cat, sel));
  const opts = { heading: "기반 선택 (참조 리소스) — 구현 전에 반드시 읽을 것", level: 2 };
  check(`renderFoundationMarkdown export sel=${selLabel}`, WR.renderFoundationMarkdown(cat, sel, opts), KR.renderFoundationMarkdown(cat, sel, opts));
  check(`renderFoundationMarkdown level3 sel=${selLabel}`, WR.renderFoundationMarkdown(cat, sel, { level: 3 }), KR.renderFoundationMarkdown(cat, sel, { level: 3 }));
  if (sel) check(`validateSelection sel=${selLabel}`, WR.validateSelection(cat, sel), KR.validateSelection(cat, sel));
}
const badSel = { items: [{ item_id: "ui/kit", option_keys: [] }, { item_id: "ui/kit", option_keys: ["q"] }, { item_id: "ui/plain", option_keys: ["a"] }, { item_id: "be/x", option_keys: ["o1", "o1"] }], confirmed: true };
check("validateSelection bad", WR.validateSelection(synthCatalog, badSel), KR.validateSelection(synthCatalog, badSel));
check("defaultSelection real", WR.defaultSelection(realCatalog), KR.defaultSelection(realCatalog));
check("defaultSelection synth", WR.defaultSelection(synthCatalog), KR.defaultSelection(synthCatalog));

// ── 2) CLI 비교: ph.mjs prompt 가 쓴 파일 = 웹 라우트 조립 결과 ───────────────

const PH = join(KIT, "scripts", "ph.mjs");
const work = mkdtempSync(join(tmpdir(), "ph-verify-"));
const ph = (...args) => execFileSync(process.execPath, [PH, ...args, "--dir", work], { encoding: "utf8" });
const put = (rel, text) => {
  mkdirSync(dirname(join(work, rel)), { recursive: true });
  writeFileSync(join(work, rel), text, "utf8");
};
try {
  ph("init", "--name", "검증", "--admin");
  put("planning/input/task_definition.md", TASK);
  put("planning/input/requirements.md", REQ);
  put("docs/PRD.md", PRD);
  put("docs/FEATURES.md", FEAT);
  put("docs/DESIGN.md", DESIGN);
  put("docs/DEV_SPEC.md", DEV_WITH_REFS);
  const pj = JSON.parse(readFileSync(join(work, "planning/project.json"), "utf8"));
  pj.questions = QS;
  pj.foundation = { ...realSel, confirmed: true, recommendation: null };
  writeFileSync(join(work, "planning/project.json"), JSON.stringify(pj, null, 2), "utf8");
  put("planning/.revise.md", "  표를 더 넣어 주세요\n");

  // 웹은 CRLF 를 받지 않는다 (textarea) — 플러그인은 읽을 때 LF 로 바꾼다.
  const p = { task_definition: TASK, requirements: REQ.replace(/\r\n/g, "\n"), questions: QS, prd: PRD, feature_spec: FEAT, design_spec: DESIGN, dev_spec: DEV_WITH_REFS, needs_admin_page: true, foundation: pj.foundation };
  const revision = { request: "표를 더 넣어 주세요" };
  const webBuild = {
    questions: () => [W.questions.SYSTEM, W.questions.userPrompt({ task_definition: p.task_definition, requirements: p.requirements })],
    prd: (r) => [W.prd.SYSTEM, W.prd.userPrompt({ task_definition: p.task_definition, requirements: p.requirements, questions: p.questions, revision_request: r?.request, current_content: r && p.prd })],
    summary: () => ["", W.summary.userPrompt(p.prd)],
    features: (r) => [W.features.SYSTEM, W.features.userPrompt({ prd: p.prd, task_definition: p.task_definition, requirements: p.requirements, revision_request: r?.request, current_content: r && p.feature_spec })],
    foundation: () => [W.foundation.SYSTEM, W.foundation.userPrompt({ prd: p.prd, feature_spec: p.feature_spec, task_definition: p.task_definition }, state.activeCatalog(realCatalog))],
    design: (r) => [W.design.SYSTEM, W.foundation.withFoundation(W.design.userPrompt({ prd: p.prd, feature_spec: p.feature_spec, task_definition: p.task_definition, requirements: p.requirements, revision_request: r?.request, current_content: r && p.design_spec }), realCatalog, p.foundation, "design")],
    dev: (r) => [W.dev.SYSTEM, W.foundation.withFoundation(W.dev.userPrompt({ prd: p.prd, feature_spec: p.feature_spec, design_spec: p.design_spec, task_definition: p.task_definition, requirements: p.requirements, needs_admin_page: p.needs_admin_page, revision_request: r?.request, current_content: r && W.dev.stripReferences(p.dev_spec) }), realCatalog, p.foundation, "dev")],
    consistency: () => [W.consistency.SYSTEM, W.consistency.userPrompt({ task_definition: p.task_definition, requirements: p.requirements, prd: p.prd, feature_spec: p.feature_spec, foundation: WR.renderFoundationMarkdown(realCatalog, p.foundation), design_spec: p.design_spec, dev_spec: W.dev.stripReferences(p.dev_spec) })],
  };
  for (const [step, build] of Object.entries(webBuild)) {
    const modes = ["prd", "features", "design", "dev"].includes(step) ? [null, revision] : [null];
    for (const r of modes) {
      const res = JSON.parse(ph("prompt", step, ...(r ? ["--revise", "planning/.revise.md"] : [])));
      const [sys, user] = build(r);
      const label = `cli prompt ${step}${r ? " --revise" : ""}`;
      check(`${label} system`, sys, readFileSync(res.system, "utf8"));
      check(`${label} user`, user, readFileSync(res.user, "utf8"));
    }
  }
  // 기반 선택 없음 → 원본 프롬프트와 바이트 동일
  pj.foundation = { items: [], confirmed: false, recommendation: null };
  writeFileSync(join(work, "planning/project.json"), JSON.stringify(pj, null, 2), "utf8");
  for (const step of ["design", "dev"]) {
    const res = JSON.parse(ph("prompt", step));
    const plain =
      step === "design"
        ? W.design.userPrompt({ prd: p.prd, feature_spec: p.feature_spec, task_definition: p.task_definition, requirements: p.requirements })
        : W.dev.userPrompt({ prd: p.prd, feature_spec: p.feature_spec, design_spec: p.design_spec, task_definition: p.task_definition, requirements: p.requirements, needs_admin_page: true });
    check(`cli prompt ${step} no-foundation user`, plain, readFileSync(res.user, "utf8"));
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(`\n${fail ? "FAIL" : "PASS"}: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
