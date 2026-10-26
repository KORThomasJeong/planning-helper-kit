// 엔진 CLI 전 과정: init → 질문 → 답 → PRD → 요약 → 기능 → 기반 → 화면·개발 → 수정 → 점검 → 내보내기 → stale.
// 실행: node --test tests/

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PH = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "ph.mjs");

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "ph-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (...args) => {
    const r = spawnSync(process.execPath, [PH, ...args], { cwd: dir, encoding: "utf8" });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const ok = (...args) => {
    const r = run(...args);
    assert.equal(r.code, 0, `ph ${args.join(" ")} 실패: ${r.err}`);
    assert.equal(r.err, "", `ph ${args.join(" ")} stderr: ${r.err}`);
    return r.out;
  };
  const bad = (...args) => {
    const r = run(...args);
    assert.equal(r.code, 1, `ph ${args.join(" ")} 가 실패해야 함: ${r.out}`);
    return r;
  };
  const put = (rel, text) => writeFileSync(join(dir, rel), text, "utf8");
  const read = (rel) => readFileSync(join(dir, rel), "utf8");
  const project = () => JSON.parse(read("planning/project.json"));
  const prompt = (...args) => {
    const res = JSON.parse(ok("prompt", ...args));
    return { ...res, systemText: readFileSync(res.system, "utf8"), userText: readFileSync(res.user, "utf8") };
  };
  return { dir, run, ok, bad, put, read, project, prompt };
}

const QUESTIONS_OUT = `질문을 만들었습니다.
[
  {"question": "이 도구는 누가 쓰나요?", "options": ["혼자", "팀원 여럿", "역할별로 나뉨", "직접 입력"], "type": "select"},
  {"question": "결과는 어떻게 확인하나요?", "options": ["목록", "건별 상세", "직접 입력"], "type": "select"}
]`;

const PRD_OUT = "```markdown\n# 구매 요청 도우미 PRD\n\n## 한 줄 정의\n구매 요청서를 자동으로 정리한다.\n\n## 배경\n수작업이 많다.\n\n```mermaid\nsequenceDiagram\nA->>B: x\n```\n\n## 핵심 기능 목록\n- 요청서 업로드\n```\n";

test("전 과정", async (t) => {
  const h = setup(t);

  // ── init / set ────────────────────────────────────────────────────────────
  assert.match(h.ok("init", "--name", "구매 요청 도우미"), /초기화/);
  assert.equal(h.read("planning/input/requirements.md"), "");
  assert.ok(!existsSync(join(h.dir, ".gitignore")), "루트 .gitignore 를 만들지 않는다");
  const again = h.bad("init", "--name", "다시");
  assert.match(again.err, /^오류: .*이미 있습니다/);
  assert.equal(again.err.trim().split("\n").length, 1, "오류는 한 줄");
  h.bad("set", "needs_admin_page", "yes");
  h.ok("set", "needs_admin_page", "true");
  h.ok("set", "name", "구매 요청 도우미");
  assert.equal(h.project().needs_admin_page, true);

  // ── 질문 ──────────────────────────────────────────────────────────────────
  assert.match(h.bad("prompt", "questions").err, /요구사항을 먼저 입력하세요/);
  h.put("planning/input/task_definition.md", "﻿과제: 구매 요청 자동화\r\n담당: 구매팀\r\n");
  h.put("planning/input/requirements.md", "요청서 PDF 를 올리면 항목을 뽑아 준다");
  const qp = h.prompt("questions");
  assert.ok(qp.systemText.startsWith("당신은 IT 서비스 기획 전문가입니다."));
  assert.equal(qp.userText, "과제 정의서:\n과제: 구매 요청 자동화\n담당: 구매팀\n\n\n요구사항:\n요청서 PDF 를 올리면 항목을 뽑아 준다");
  assert.ok(qp.out.endsWith("planning/.work/questions.gen.txt"));
  assert.equal(h.read("planning/.work/.gitignore"), "*\n");

  h.put("bad.json", "질문 없음");
  assert.match(h.bad("save", "questions", "bad.json").err, /해석하지 못했습니다/);
  h.put("planning/.work/questions.gen.txt", QUESTIONS_OUT);
  assert.match(h.ok("save", "questions", "planning/.work/questions.gen.txt"), /질문 2개/);
  const qs = h.project().questions;
  assert.equal(qs.length, 2);
  assert.match(qs[0].id, /^q\d+_0$/);
  assert.deepEqual([qs[0].answer, qs[0].custom], [null, ""]);
  assert.equal(JSON.parse(h.ok("questions", "--json")).length, 2);

  h.ok("answer", qs[0].id, "팀원 여럿");
  assert.equal(h.project().current_step, 1);
  h.bad("answer", "2", "직접 입력");
  h.ok("answer", "2", "엑셀로", "받고", "싶어요");
  const answered = h.project();
  assert.deepEqual([answered.questions[0].answer, answered.questions[0].custom], ["팀원 여럿", ""]);
  assert.deepEqual([answered.questions[1].answer, answered.questions[1].custom], [null, "엑셀로 받고 싶어요"]);
  assert.equal(answered.current_step, 2);
  assert.match(h.ok("questions"), /직접 입력: 엑셀로 받고 싶어요/);

  // ── PRD ───────────────────────────────────────────────────────────────────
  const pp = h.prompt("prd");
  assert.match(pp.userText, /명확화 질문 답변:\nQ1\. 이 도구는 누가 쓰나요\?\n답변: 팀원 여럿\n\nQ2\. 결과는 어떻게 확인하나요\?\n답변: 엑셀로 받고 싶어요$/);
  h.bad("prompt", "prd", "--revise", "nope.md");
  h.put("rev.md", "리스크를 더 써 주세요");
  assert.match(h.bad("prompt", "prd", "--revise", "rev.md").err, /수정할 문서가 없습니다/);
  assert.match(h.bad("prompt", "features").err, /PRD를 먼저 생성하세요/);

  h.put("planning/.work/prd.gen.txt", PRD_OUT);
  const savedPrd = h.ok("save", "prd", "planning/.work/prd.gen.txt");
  assert.match(savedPrd, /docs\/PRD\.md/);
  assert.match(savedPrd, /펜스 벗김/);
  assert.match(savedPrd, /섹션 3개/);
  const prd = h.read("docs/PRD.md");
  assert.ok(prd.startsWith("# 구매 요청 도우미 PRD\n"), "```markdown 펜스를 벗긴다");
  assert.ok(prd.includes("```mermaid\nsequenceDiagram"), "안쪽 펜스는 남긴다");
  assert.ok(prd.endsWith("- 요청서 업로드"));
  assert.equal(h.project().current_step, 3);
  assert.ok(h.project().doc_timestamps.prd);

  // ── 요약 ──────────────────────────────────────────────────────────────────
  const sp = h.prompt("summary");
  assert.equal(sp.systemText, "");
  assert.ok(sp.userText.startsWith("아래 PRD를 읽고, 이 서비스를 한 문장(40자 이내)으로 설명하세요."));
  h.put("planning/.work/oneline.gen.txt", "\n  구매 요청서를 자동 정리하는\n서비스  \n");
  h.ok("save", "summary", "planning/.work/oneline.gen.txt");
  assert.equal(h.project().summary, "구매 요청서를 자동 정리하는 서비스");

  // ── 기능 정리 ─────────────────────────────────────────────────────────────
  const fp = h.prompt("features");
  assert.ok(fp.userText.startsWith(`PRD:\n${prd}\n\n과제 정의서:\n`));
  h.put("planning/.work/features.gen.txt", "# 기능 정리\n\n## 기능 목록\n- 업로드\n\n## 시퀀스\n```mermaid\nsequenceDiagram\nU->>S: 업로드\n```\n");
  h.ok("save", "features", "planning/.work/features.gen.txt");
  assert.equal(h.project().current_step, 4);
  // 기반 확정은 전제조건이 아니다 — 경고만.
  const early = h.prompt("design");
  assert.equal(early.warnings.length, 1);
  assert.ok(!early.userText.includes("[선택된 기반"), "선택이 없으면 기본 프롬프트 그대로");

  // ── 기반 선택 ─────────────────────────────────────────────────────────────
  const fdp = h.prompt("foundation");
  assert.ok(fdp.userText.includes('<document name="prd">'));
  assert.ok(fdp.userText.includes('"id": "design/design-lookbook"'), "카탈로그 항목 id 는 <cat>/<item>");
  h.put(
    "planning/.work/foundation.gen.txt",
    "```json\n" +
      JSON.stringify({
        picks: [
          { item_id: "env/aws-baseline", option_keys: [], reason: "AWS 공통 전제" },
          { item_id: "design/design-lookbook", option_keys: ["7-quartz"], reason: "관리자 콘솔 성격" },
          { item_id: "frontend/nextjs", option_keys: [], reason: "표준" },
          { item_id: "made/up", option_keys: [] },
        ],
        summary: "AWS 기본값 위주로 골랐습니다.",
      }) +
      "\n```",
  );
  const savedF = h.ok("save", "foundation", "planning/.work/foundation.gen.txt");
  assert.match(savedF, /기반 추천 3개 항목/);
  assert.match(savedF, /버린 값 1개/);
  let f = h.project().foundation;
  assert.equal(f.confirmed, false);
  assert.equal(f.recommendation.reasons["design/design-lookbook"], "관리자 콘솔 성격");
  assert.ok(f.recommendation.issues.length > 0, "필수 분류(backend 등)가 빠져 규칙 위반");
  assert.ok(h.project().doc_timestamps.foundation);
  assert.match(h.ok("foundation", "list"), /추천 이유: 관리자 콘솔 성격/);
  const listed = JSON.parse(h.ok("foundation", "list", "--json"));
  assert.equal(listed.categories.find((c) => c.id === "design").items[0].options.find((o) => o.key === "7-quartz").selected, true);

  // validate 실패 → confirm 거부
  const v1 = h.run("foundation", "validate");
  assert.equal(v1.code, 1);
  assert.match(v1.out, /백엔드|backend|하나 이상 고르세요/);
  assert.match(h.bad("foundation", "confirm").err, /확정할 수 없습니다/);

  // pick / unpick
  h.bad("foundation", "pick", "design/design-lookbook", "1-frost,2-steel");
  h.bad("foundation", "pick", "made/up");
  h.ok("foundation", "pick", "frontend/react-vite");
  f = h.project().foundation;
  assert.ok(!f.items.some((x) => x.item_id === "frontend/nextjs"), "single 분류는 기존 항목을 교체");
  h.ok("foundation", "pick", "frontend/nextjs");
  h.ok("foundation", "pick", "design/design-lookbook", "3-jelly");
  h.ok("foundation", "pick", "backend/express");
  h.ok("foundation", "pick", "backend/nextjs-route-handlers");
  h.ok("foundation", "pick", "auth/cognito");
  h.ok("foundation", "pick", "deploy/ecs-fargate");
  h.ok("foundation", "pick", "ai/bedrock-claude");
  h.ok("foundation", "unpick", "ai/bedrock-claude");
  h.bad("foundation", "unpick", "ai/bedrock-claude");
  f = h.project().foundation;
  assert.deepEqual(
    f.items.map((x) => x.item_id).sort(),
    ["auth/cognito", "backend/nextjs-route-handlers", "deploy/ecs-fargate", "design/design-lookbook", "env/aws-baseline", "frontend/nextjs"],
  );
  assert.deepEqual(f.items.find((x) => x.item_id === "design/design-lookbook").option_keys, ["3-jelly"]);
  assert.match(h.ok("foundation", "validate"), /규칙 위반 없음/);
  assert.match(h.ok("foundation", "confirm"), /docs\/FOUNDATION\.md/);
  assert.equal(h.project().foundation.confirmed, true);
  assert.equal(h.project().current_step, 5);
  const fmd = h.read("docs/FOUNDATION.md");
  assert.ok(fmd.startsWith("## 기반 선택 (참조 리소스)\n\n| 분류 | 선택 | 참조 |"));
  assert.ok(fmd.includes("3 Jelly"));

  // ── 화면 설계 / 개발 명세 ─────────────────────────────────────────────────
  const dp = h.prompt("design");
  assert.equal(dp.warnings, undefined);
  assert.ok(dp.userText.includes("\n\n[선택된 기반 — 표준·레퍼런스]\n"));
  assert.ok(dp.userText.includes("디자인 레퍼런스"));
  assert.ok(!dp.userText.includes("- 백엔드"), "design 블록에는 applies_to=dev 전용 분류가 없다");
  assert.match(h.bad("prompt", "dev").err, /화면 설계\(IA\)를 먼저 생성하세요/);
  h.put("planning/.work/design.gen.txt", "# 화면 설계\n\n## 화면 목록\n- 홈\n");
  h.ok("save", "design", "planning/.work/design.gen.txt");
  assert.equal(h.project().current_step, 6);

  const vp = h.prompt("dev");
  assert.ok(vp.userText.includes("[관리자 페이지 포함 요청]"));
  assert.ok(vp.userText.includes("[선택된 기반 — 표준·레퍼런스]"));
  assert.ok(vp.userText.includes("Next.js") || vp.userText.includes("nextjs"));
  h.put(
    "planning/.work/dev.gen.txt",
    "# 개발 명세서\n\n## 화면별 개발 요청\n- 홈\n\n---\n\n## 📎 참고 자료\n\n<details>\n<summary>📄 PRD 원문</summary>\n\n옛 PRD\n</details>",
  );
  h.ok("save", "dev", "planning/.work/dev.gen.txt");

  // ── 수정 모드 ─────────────────────────────────────────────────────────────
  h.put("rev.md", "\n관리자 화면을 더 자세히\n");
  const rv = h.prompt("dev", "--revise", "rev.md");
  assert.ok(rv.userText.startsWith("아래 개발 명세서를 수정 요청 사항에 맞게 수정해주세요.\n\n수정 요청:\n관리자 화면을 더 자세히\n\n현재 개발 명세서:\n# 개발 명세서"));
  assert.ok(!rv.userText.includes("📎 참고 자료"), "수정 모드 current 는 stripReferences");
  assert.ok(rv.userText.includes("[선택된 기반"), "수정 모드에도 기반 블록");
  const rp = h.prompt("prd", "--revise", "rev.md");
  assert.ok(rp.userText.startsWith("아래 PRD를 수정 요청 사항에 맞게 수정해주세요."));
  assert.ok(rp.userText.includes(`현재 PRD:\n${prd}\n\n원본 과제 정의서:`));
  assert.match(h.bad("prompt", "consistency", "--revise", "rev.md").err, /수정 모드가 없습니다/);

  // ── 일관성 점검 ───────────────────────────────────────────────────────────
  const cp = h.prompt("consistency");
  assert.ok(cp.userText.includes('<document name="foundation">\n## 기반 선택 (참조 리소스)'));
  assert.ok(!cp.userText.includes("📎 참고 자료"));
  h.put("planning/.work/consistency.gen.txt", "# 일관성 점검\n\n## 요약\n문제 없음\n");
  h.ok("save", "consistency", "planning/.work/consistency.gen.txt");
  assert.equal(h.project().current_step, 6);

  // ── 내보내기 ──────────────────────────────────────────────────────────────
  assert.match(h.ok("export"), /README\.md, CLAUDE\.md/);
  const readme = h.read("README.md");
  assert.ok(readme.startsWith("# 구매 요청 도우미\n\n구매 요청서를 자동 정리하는 서비스\n\n## 문서\n\n- [PRD](docs/PRD.md)\n"));
  assert.ok(readme.includes("- [CLAUDE.md](CLAUDE.md) — AI 코딩 도구용 개발 안내"));
  assert.ok(readme.includes("## 기반 선택 (참조 리소스) — 구현 전에 반드시 읽을 것"));
  assert.ok(readme.includes("planning-helper-kit 으로 생성"));
  assert.ok(!readme.includes("원본 링크"));
  const claude = h.read("CLAUDE.md");
  assert.ok(claude.includes("planning-helper-kit"));
  assert.ok(!claude.includes("원본:"));
  assert.ok(claude.includes("## 개발 명세서\n\n# 개발 명세서"));
  assert.ok(!claude.includes("📎 참고 자료"), "내보내기도 stripReferences");
  assert.ok(claude.includes("`docs/PRD.md`, `docs/FEATURES.md`, `docs/DESIGN.md`"));

  // ── status / stale ────────────────────────────────────────────────────────
  let st = JSON.parse(h.ok("status", "--json"));
  assert.deepEqual(st.warnings, []);
  assert.equal(st.next.action, "publish");
  assert.ok(st.steps.every((s) => s.done));

  await new Promise((r) => setTimeout(r, 5));
  h.put("planning/.work/prd.gen.txt", "# 구매 요청 도우미 PRD v2\n\n## 한 줄 정의\n바뀜\n");
  h.ok("save", "prd", "planning/.work/prd.gen.txt");
  st = JSON.parse(h.ok("status", "--json"));
  assert.deepEqual(st.warnings.map((w) => w.field), ["feature_spec", "consistency_report"]);
  assert.equal(st.next.action, "check");
  const text = h.ok("status");
  assert.match(text, /경고: 기능 정리: 앞 단계\(PRD\)가 바뀜 — 재생성 고려/);
  assert.match(text, /^다음: /m);

  await new Promise((r) => setTimeout(r, 5));
  h.ok("foundation", "pick", "design/design-lookbook", "7-quartz");
  st = JSON.parse(h.ok("status", "--json"));
  assert.ok(st.warnings.some((w) => w.field === "design_spec" && w.cause === "foundation"));
  assert.ok(st.warnings.some((w) => w.field === "dev_spec" && w.cause === "foundation"));
  assert.equal(h.project().foundation.confirmed, false, "선택을 바꾸면 미확정으로");
  assert.equal(st.next.action, "foundation");
});

test("카탈로그 덮어쓰기와 오류 처리", (t) => {
  const h = setup(t);
  assert.match(h.bad("status").err, /init/);
  h.bad("nope");
  h.bad("init");
  h.ok("init", "--name", "x");
  h.bad("prompt", "unknown");
  h.bad("save", "prd", "missing.md");
  h.put("empty.md", "  \n");
  assert.match(h.bad("save", "prd", "empty.md").err, /비어 있습니다/);
  h.put(
    "planning/foundation-catalog.json",
    JSON.stringify({
      categories: [
        { key: "only", name: "유일", select_mode: "single", required: true, applies_to: ["design"], sort: 1, items: [{ key: "a", name: "A", option_mode: "none", is_default: true, sort: 1 }] },
      ],
    }),
  );
  const list = JSON.parse(h.ok("foundation", "list", "--json"));
  assert.deepEqual(list.categories.map((c) => c.id), ["only"]);
  assert.equal(h.run("foundation", "validate").code, 1);
  assert.match(h.ok("foundation", "default"), /only\/a/);
  h.ok("foundation", "confirm");
  // CLAUDE.md 는 기반 선택이 있으면 만든다
  h.ok("export");
  assert.ok(existsSync(join(h.dir, "CLAUDE.md")));
  assert.ok(h.read("README.md").includes("- (아직 작성된 문서가 없습니다)"));
});
