#!/usr/bin/env node
// planning-helper-kit 엔진 CLI. 커맨드 md 가 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" <sub> ...` 로 부른다.
// 계약: docs/CONTRACT.md 3장. 오류는 stderr 한 줄 + exit 1, 성공 출력은 stdout.

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import * as questionsPrompt from "./lib/prompts/questions.mjs";
import * as prdPrompt from "./lib/prompts/prd.mjs";
import * as summaryPrompt from "./lib/prompts/summary.mjs";
import * as featuresPrompt from "./lib/prompts/features.mjs";
import * as designPrompt from "./lib/prompts/design.mjs";
import * as devPrompt from "./lib/prompts/dev.mjs";
import * as consistencyPrompt from "./lib/prompts/consistency.mjs";
import * as foundationPrompt from "./lib/prompts/foundation.mjs";
import { defaultSelection, renderFoundationMarkdown, validateSelection } from "./lib/foundation-render.mjs";
import { buildExportFiles } from "./lib/export.mjs";
import {
  CliError,
  DOC_LABEL,
  FIELD_FILES,
  FOUNDATION_FILE,
  FOUNDATION_TARGET,
  PROJECT_FILE,
  WORK_DIR,
  activeCatalog,
  bumpStep,
  docStats,
  fieldPath,
  fmt,
  foundationItemsKey,
  isBlank,
  loadCatalog,
  loadProject,
  newProject,
  projectPath,
  projectView,
  readField,
  readText,
  saveProject,
  stamp,
  staleWarnings,
  unwrapMarkdownFence,
  writeText,
} from "./lib/state.mjs";

const STEPS = ["questions", "prd", "summary", "features", "foundation", "design", "dev", "consistency"];
/** save 대상 문서 단계 → 필드, 저장 후 올라갈 current_step. */
const DOC_STEPS = {
  prd: { field: "prd", next: 3 },
  features: { field: "feature_spec", next: 4 },
  design: { field: "design_spec", next: 6 },
  dev: { field: "dev_spec", next: 6 },
  consistency: { field: "consistency_report", next: null },
};
const REVISABLE = new Set(["prd", "features", "design", "dev"]);

// ── args ────────────────────────────────────────────────────────────────────

const VALUE_FLAGS = new Set(["--dir", "--name", "--revise"]);
const BOOL_FLAGS = new Set(["--json", "--admin"]);

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.has(a)) {
      if (i + 1 >= argv.length) throw new CliError(`${a} 에 값이 필요합니다.`);
      flags[a.slice(2)] = argv[++i];
    } else if (BOOL_FLAGS.has(a)) {
      flags[a.slice(2)] = true;
    } else if (a.startsWith("--") && a.length > 2) {
      throw new CliError(`알 수 없는 옵션: ${a}`);
    } else {
      pos.push(a);
    }
  }
  return { pos, flags };
}

const out = (s) => process.stdout.write(`${s}\n`);
const json = (v) => out(JSON.stringify(v, null, 2));
/** 커맨드 md 가 그대로 넘기기 좋게 슬래시 경로로. */
const slash = (p) => p.replace(/\\/g, "/");

/** 프롬프트 모듈의 console.error(파싱 실패 로그)를 모아 오류 한 줄에 붙인다. */
function quietly(fn) {
  const logs = [];
  const orig = console.error;
  console.error = (...a) => logs.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(" "));
  try {
    return { value: fn(), logs };
  } finally {
    console.error = orig;
  }
}

// ── init / set ──────────────────────────────────────────────────────────────

function cmdInit(dir, { flags }) {
  const name = (flags.name ?? "").trim();
  if (!name) throw new CliError("--name <프로젝트명> 이 필요합니다.");
  if (existsSync(projectPath(dir))) throw new CliError(`${PROJECT_FILE} 이 이미 있습니다. 기존 기획을 이어서 하세요 (/ph:status).`);
  mkdirSync(join(dir, "planning", "input"), { recursive: true });
  for (const f of ["task_definition", "requirements"]) {
    const path = fieldPath(dir, f);
    if (!existsSync(path)) writeText(path, "");
  }
  saveProject(dir, newProject(name, flags.admin));
  out(`초기화: ${PROJECT_FILE} (이름 "${name}", 관리자 페이지 ${flags.admin ? "포함" : "미포함"}) · 입력: ${FIELD_FILES.task_definition}, ${FIELD_FILES.requirements}`);
}

function cmdSet(dir, { pos }) {
  const [field, ...rest] = pos;
  const value = rest.join(" ").trim();
  const p = loadProject(dir);
  if (field === "name") {
    if (!value) throw new CliError("이름이 비어 있습니다.");
    p.name = value;
  } else if (field === "needs_admin_page") {
    if (value !== "true" && value !== "false") throw new CliError("needs_admin_page 는 true 또는 false 입니다.");
    p.needs_admin_page = value === "true";
  } else {
    throw new CliError(`바꿀 수 없는 필드: ${field ?? "(없음)"} — name, needs_admin_page 만 됩니다.`);
  }
  saveProject(dir, p);
  out(`${field} = ${JSON.stringify(p[field])}`);
}

// ── status ──────────────────────────────────────────────────────────────────

const NEXT_COMMAND = {
  input: "/ph:start",
  questions: "/ph:questions",
  answer: "/ph:questions",
  prd: "/ph:prd",
  summary: "/ph:prd",
  features: "/ph:features",
  foundation: "/ph:foundation",
  design: "/ph:design",
  dev: "/ph:dev",
  check: "/ph:check",
  publish: "/ph:publish",
};

function computeStatus(dir) {
  const p = loadProject(dir);
  const v = projectView(dir, p);
  const qs = p.questions;
  const answered = qs.filter((q) => q.answer || (q.custom || "").trim()).length;
  const doc = (field) => {
    const text = v[field];
    return { field, file: FIELD_FILES[field], exists: !isBlank(text), ...docStats(text), updated_at: p.doc_timestamps[field] ?? null };
  };
  const steps = [
    {
      step: 1,
      key: "input",
      label: "입력·명확화 질문",
      done: !isBlank(v.requirements) && qs.length > 0 && answered === qs.length,
      task_definition: doc("task_definition"),
      requirements: doc("requirements"),
      questions: { total: qs.length, answered },
    },
    { step: 2, key: "prd", label: "PRD", done: !isBlank(v.prd), doc: doc("prd"), summary: p.summary },
    { step: 3, key: "features", label: "기능 정리", done: !isBlank(v.feature_spec), doc: doc("feature_spec") },
    {
      step: 4,
      key: "foundation",
      label: "기반 선택",
      done: p.foundation.confirmed,
      items: p.foundation.items.length,
      confirmed: p.foundation.confirmed,
      file: FOUNDATION_FILE,
    },
    { step: 5, key: "design", label: "화면 설계(IA)", done: !isBlank(v.design_spec), doc: doc("design_spec") },
    { step: 6, key: "dev", label: "개발 명세서", done: !isBlank(v.dev_spec), doc: doc("dev_spec") },
  ];
  const consistency = doc("consistency_report");
  const warnings = staleWarnings(dir, p);

  let next;
  if (isBlank(v.requirements)) next = { action: "input", message: `요구사항을 입력하세요 (${FIELD_FILES.requirements})` };
  else if (!qs.length) next = { action: "questions", message: "명확화 질문을 생성하세요" };
  else if (answered < qs.length) next = { action: "answer", message: `명확화 질문에 답하세요 (미답변 ${qs.length - answered}개)` };
  else if (isBlank(v.prd)) next = { action: "prd", message: "PRD 를 생성하세요" };
  else if (isBlank(p.summary)) next = { action: "summary", message: "PRD 한 줄 요약을 생성하세요" };
  else if (isBlank(v.feature_spec)) next = { action: "features", message: "기능 정리를 생성하세요" };
  else if (!p.foundation.confirmed) next = { action: "foundation", message: "기반을 선택하고 확정하세요" };
  else if (isBlank(v.design_spec)) next = { action: "design", message: "화면 설계(IA)를 생성하세요" };
  else if (isBlank(v.dev_spec)) next = { action: "dev", message: "개발 명세서를 생성하세요" };
  else if (!consistency.exists || warnings.some((w) => w.field === "consistency_report")) next = { action: "check", message: "문서 일관성을 점검하세요" };
  else next = { action: "publish", message: "저장소로 내보내세요" };
  next.command = NEXT_COMMAND[next.action];

  return {
    name: p.name,
    needs_admin_page: p.needs_admin_page,
    current_step: p.current_step,
    steps,
    consistency,
    warnings,
    next,
  };
}

function cmdStatus(dir, { flags }) {
  const s = computeStatus(dir);
  if (flags.json) return json(s);
  const mark = (b) => (b ? "[v]" : "[ ]");
  const docLine = (d) => (d.exists ? `${d.file} ${fmt(d.chars)}자, 섹션 ${d.sections}개` : `${d.file} 없음`);
  out(`프로젝트: ${s.name} · 관리자 페이지 ${s.needs_admin_page ? "포함" : "미포함"} · 현재 단계 ${s.current_step}/6`);
  for (const st of s.steps) {
    let detail;
    if (st.key === "input") {
      detail = `과제 정의서 ${fmt(st.task_definition.chars)}자 · 요구사항 ${fmt(st.requirements.chars)}자 · 질문 ${st.questions.answered}/${st.questions.total} 답변`;
    } else if (st.key === "foundation") {
      detail = `${st.items}개 선택 · ${st.confirmed ? `확정 (${st.file})` : "미확정"}`;
    } else {
      detail = docLine(st.doc);
      if (st.key === "prd" && st.doc.exists) detail += ` · 요약: ${st.summary ?? "(없음)"}`;
    }
    out(`${mark(st.done)} ${st.step}. ${st.label} — ${detail}`);
  }
  out(`${mark(s.consistency.exists)} +. 일관성 점검 — ${docLine(s.consistency)}`);
  for (const w of s.warnings) out(`경고: ${w.message}`);
  out(`다음: ${s.next.message} (${s.next.command})`);
}

// ── prompt ──────────────────────────────────────────────────────────────────

function requireDoc(v, field, message) {
  if (isBlank(v[field])) throw new CliError(message);
}

/** 단계별 선행조건과 프롬프트 조립. */
function buildPrompt(dir, step, reviseFile) {
  const p = loadProject(dir);
  const v = projectView(dir, p);
  const warnings = [];

  let revision = null;
  if (reviseFile) {
    if (!REVISABLE.has(step)) throw new CliError(`${step} 단계는 수정 모드가 없습니다 (prd, features, design, dev 만).`);
    const path = resolve(dir, reviseFile);
    if (!existsSync(path)) throw new CliError(`수정 요청 파일이 없습니다: ${reviseFile}`);
    const request = readText(path).trim();
    if (!request) throw new CliError("수정 요청이 비어 있습니다.");
    const field = DOC_STEPS[step].field;
    const raw = v[field] ?? "";
    const current = step === "dev" ? devPrompt.stripReferences(raw) : raw;
    if (isBlank(current)) throw new CliError("수정할 문서가 없습니다. 먼저 생성하세요.");
    revision = { request, current };
  }

  switch (step) {
    case "questions":
      requireDoc(v, "requirements", "요구사항을 먼저 입력하세요.");
      return {
        system: questionsPrompt.SYSTEM,
        user: questionsPrompt.userPrompt({ task_definition: v.task_definition, requirements: v.requirements }),
        warnings,
      };
    case "prd":
      if (!revision) requireDoc(v, "requirements", "요구사항을 먼저 입력하세요.");
      return {
        system: prdPrompt.SYSTEM,
        user: prdPrompt.userPrompt({
          task_definition: v.task_definition,
          requirements: v.requirements,
          questions: p.questions,
          revision_request: revision?.request,
          current_content: revision?.current,
        }),
        warnings,
      };
    case "summary":
      requireDoc(v, "prd", "PRD를 먼저 생성하세요.");
      return { system: "", user: summaryPrompt.userPrompt(v.prd), warnings };
    case "features":
      requireDoc(v, "prd", "PRD를 먼저 생성하세요.");
      return {
        system: featuresPrompt.SYSTEM,
        user: featuresPrompt.userPrompt({
          prd: v.prd,
          task_definition: v.task_definition,
          requirements: v.requirements,
          revision_request: revision?.request,
          current_content: revision?.current,
        }),
        warnings,
      };
    case "foundation": {
      requireDoc(v, "prd", "PRD를 먼저 생성하세요.");
      const catalog = activeCatalog(loadCatalog(dir));
      if (!catalog.some((c) => c.items.length > 0)) throw new CliError("기반 카탈로그가 비어 있습니다.");
      return {
        system: foundationPrompt.SYSTEM,
        user: foundationPrompt.userPrompt({ prd: v.prd, feature_spec: v.feature_spec, task_definition: v.task_definition }, catalog),
        warnings,
      };
    }
    case "design": {
      requireDoc(v, "prd", "PRD를 먼저 생성하세요.");
      requireDoc(v, "feature_spec", "기능 정리를 먼저 생성하세요.");
      if (!p.foundation.confirmed) warnings.push("기반 선택이 확정되지 않았습니다 — 현재 선택으로 생성합니다.");
      const user = foundationPrompt.withFoundation(
        designPrompt.userPrompt({
          prd: v.prd,
          feature_spec: v.feature_spec,
          task_definition: v.task_definition,
          requirements: v.requirements,
          revision_request: revision?.request,
          current_content: revision?.current,
        }),
        loadCatalog(dir),
        p.foundation,
        "design",
      );
      return { system: designPrompt.SYSTEM, user, warnings };
    }
    case "dev": {
      if (!revision) {
        requireDoc(v, "prd", "PRD를 먼저 생성하세요.");
        requireDoc(v, "feature_spec", "기능 정리를 먼저 생성하세요.");
        requireDoc(v, "design_spec", "화면 설계(IA)를 먼저 생성하세요.");
      }
      if (!p.foundation.confirmed) warnings.push("기반 선택이 확정되지 않았습니다 — 현재 선택으로 생성합니다.");
      const user = foundationPrompt.withFoundation(
        devPrompt.userPrompt({
          prd: v.prd,
          feature_spec: v.feature_spec,
          design_spec: v.design_spec,
          task_definition: v.task_definition,
          requirements: v.requirements,
          needs_admin_page: p.needs_admin_page ?? false,
          revision_request: revision?.request,
          current_content: revision?.current,
        }),
        loadCatalog(dir),
        p.foundation,
        "dev",
      );
      return { system: devPrompt.SYSTEM, user, warnings };
    }
    case "consistency":
      requireDoc(v, "prd", "PRD가 있어야 일관성 점검을 할 수 있습니다.");
      return {
        system: consistencyPrompt.SYSTEM,
        user: consistencyPrompt.userPrompt({
          task_definition: v.task_definition,
          requirements: v.requirements,
          prd: v.prd,
          feature_spec: v.feature_spec,
          foundation: renderFoundationMarkdown(loadCatalog(dir), p.foundation),
          design_spec: v.design_spec,
          dev_spec: v.dev_spec ? devPrompt.stripReferences(v.dev_spec) : v.dev_spec,
        }),
        warnings,
      };
    default:
      throw new CliError(`알 수 없는 단계: ${step ?? "(없음)"} — ${STEPS.join(", ")}`);
  }
}

/** planning/.work 는 스스로 git 에서 빠진다 (루트 .gitignore 는 건드리지 않는다). */
function ensureWorkDir(dir) {
  const work = join(dir, WORK_DIR);
  mkdirSync(work, { recursive: true });
  const ignore = join(work, ".gitignore");
  if (!existsSync(ignore)) writeText(ignore, "*\n");
  return work;
}

// 결과 파일은 .txt · 중립 이름 — Claude Code 가 서브에이전트의 "summary/report" 류 .md 쓰기를 막는 경우가 있다.
function outName(step) {
  return `${step === "summary" ? "oneline" : step}.gen.txt`;
}

function cmdPrompt(dir, { pos, flags }) {
  const step = pos[0];
  if (!STEPS.includes(step)) throw new CliError(`알 수 없는 단계: ${step ?? "(없음)"} — ${STEPS.join(", ")}`);
  const built = buildPrompt(dir, step, flags.revise);
  const work = ensureWorkDir(dir);
  const system = join(work, `${step}.system.md`);
  const user = join(work, `${step}.user.md`);
  writeText(system, built.system);
  writeText(user, built.user);
  const res = { system: slash(system), user: slash(user), out: slash(join(work, outName(step))) };
  if (built.warnings.length) res.warnings = built.warnings;
  out(JSON.stringify(res));
}

// ── save ────────────────────────────────────────────────────────────────────

function cmdSave(dir, { pos }) {
  const [step, file] = pos;
  if (!STEPS.includes(step)) throw new CliError(`알 수 없는 단계: ${step ?? "(없음)"} — ${STEPS.join(", ")}`);
  if (!file) throw new CliError("저장할 결과 파일 경로가 필요합니다.");
  const src = resolve(dir, file);
  if (!existsSync(src)) throw new CliError(`결과 파일이 없습니다: ${file}`);
  const text = readText(src);
  if (isBlank(text)) throw new CliError("결과가 비어 있습니다.");
  const p = loadProject(dir);

  if (step === "questions") {
    const { value: qs, logs } = quietly(() => questionsPrompt.parseQuestions(text));
    if (!qs) throw new CliError(`질문 생성 결과를 해석하지 못했습니다 (JSON 배열 [{question, options, type}] 이 아님${logs.length ? `: ${logs[0]}` : ""}). 다시 생성하세요.`);
    if (!qs.length) throw new CliError("질문이 하나도 없습니다. 다시 생성하세요.");
    p.questions = qs;
    saveProject(dir, p);
    return out(`저장: 질문 ${qs.length}개 → ${PROJECT_FILE} (기존 질문·답변은 바뀜)`);
  }

  if (step === "summary") {
    const summary = text.trim().split(/\s*\n\s*/).filter(Boolean).join(" ");
    p.summary = summary;
    saveProject(dir, p);
    return out(`저장: 요약 "${summary}" (${[...summary].length}자)`);
  }

  if (step === "foundation") {
    const full = loadCatalog(dir);
    const { value: rec, logs } = quietly(() => foundationPrompt.parseRecommendation(text, activeCatalog(full)));
    if (!rec) throw new CliError(`기반 추천 결과를 해석하지 못했습니다 (JSON {picks, summary} 가 아님${logs.length ? `: ${logs[0]}` : ""}). 다시 생성하세요.`);
    const issues = validateSelection(full, { items: rec.items, confirmed: true });
    const before = foundationItemsKey(p.foundation);
    p.foundation = {
      items: rec.items,
      confirmed: false,
      recommendation: { reasons: rec.reasons, summary: rec.summary, issues, dropped: rec.dropped, created_at: new Date().toISOString() },
    };
    if (foundationItemsKey(p.foundation) !== before) stamp(p, "foundation");
    saveProject(dir, p);
    return out(
      `저장: 기반 추천 ${rec.items.length}개 항목 (규칙 위반 ${issues.length}건, 카탈로그 밖이라 버린 값 ${rec.dropped.length}개) — 확정 전` +
        (rec.summary ? ` · ${rec.summary}` : ""),
    );
  }

  const { field, next } = DOC_STEPS[step];
  const body = unwrapMarkdownFence(text);
  if (isBlank(body)) throw new CliError("결과가 비어 있습니다.");
  writeText(fieldPath(dir, field), body);
  stamp(p, field);
  if (next) bumpStep(p, next);
  saveProject(dir, p);
  const st = docStats(body);
  out(
    `저장: ${FIELD_FILES[field]} (${st.title ? `"${st.title}", ` : ""}${fmt(st.chars)}자, 섹션 ${st.sections}개)` +
      `${body !== text ? " · 마크다운 펜스 벗김" : ""} · 현재 단계 ${p.current_step}/6`,
  );
}

// ── questions / answer ──────────────────────────────────────────────────────

function findQuestion(p, qid) {
  if (!qid) throw new CliError("질문 id 가 필요합니다 (questions 로 확인, 순번 1.. 도 됩니다).");
  let q = p.questions.find((x) => x.id === qid);
  if (!q && /^\d+$/.test(qid)) q = p.questions[Number(qid) - 1];
  if (!q) throw new CliError(`질문이 없습니다: ${qid}`);
  return q;
}

function cmdAnswer(dir, { pos }) {
  const [qid, ...rest] = pos;
  const p = loadProject(dir);
  const q = findQuestion(p, qid);
  const text = rest.join(" ").trim();
  if (!text) throw new CliError("답이 비어 있습니다.");
  if (text === "직접 입력") throw new CliError("'직접 입력' 대신 답 내용을 적어 주세요.");
  const isOption = q.options.includes(text);
  q.answer = isOption ? text : null;
  q.custom = isOption ? "" : text;
  const answered = p.questions.filter((x) => x.answer || (x.custom || "").trim()).length;
  if (answered === p.questions.length) bumpStep(p, 2);
  saveProject(dir, p);
  out(`답변 저장: ${q.id} = ${text} (${isOption ? "선택지" : "직접 입력"}) · ${answered}/${p.questions.length} 답변`);
}

function cmdQuestions(dir, { flags }) {
  const p = loadProject(dir);
  if (flags.json) return json(p.questions);
  if (!p.questions.length) return out("질문이 없습니다. 먼저 질문을 생성하세요 (/ph:questions).");
  p.questions.forEach((q, i) => {
    const ans = q.answer ? q.answer : (q.custom || "").trim() ? `직접 입력: ${q.custom}` : "(미답변)";
    out(`${i + 1}. [${q.id}] ${q.question}`);
    out(`   선택지: ${q.options.join(" / ")}`);
    out(`   답변: ${ans}`);
  });
}

// ── foundation ──────────────────────────────────────────────────────────────

function sortBy(arr) {
  return [...arr].sort((a, b) => a.sort - b.sort);
}

function setFoundationItems(p, items) {
  const before = foundationItemsKey(p.foundation);
  p.foundation.items = items;
  p.foundation.confirmed = false;
  if (foundationItemsKey(p.foundation) !== before) stamp(p, "foundation");
}

function selectionIssuesLine(catalog, p) {
  const issues = validateSelection(catalog, { items: p.foundation.items, confirmed: true });
  return issues.length ? `규칙 위반 ${issues.length}건 (foundation validate 로 확인)` : "규칙 위반 없음";
}

function cmdFoundation(dir, { pos, flags }) {
  const [sub, ...args] = pos;
  const p = loadProject(dir);
  const catalog = loadCatalog(dir);
  const active = activeCatalog(catalog);
  const picked = new Map(p.foundation.items.map((x) => [x.item_id, x]));
  const reasons = p.foundation.recommendation?.reasons ?? {};

  switch (sub) {
    case "list": {
      if (flags.json) {
        return json({
          confirmed: p.foundation.confirmed,
          selection: p.foundation.items,
          recommendation: p.foundation.recommendation,
          categories: sortBy(active).map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            select_mode: c.select_mode,
            required: c.required,
            max_select: c.max_select,
            applies_to: c.applies_to,
            items: sortBy(c.items).map((i) => ({
              id: i.id,
              name: i.name,
              description: i.description,
              url: i.url,
              option_mode: i.option_mode,
              option_required: i.option_required,
              option_label: i.option_label,
              is_default: i.is_default,
              selected: picked.has(i.id),
              reason: reasons[i.id] ?? null,
              options: sortBy(i.options).map((o) => ({
                key: o.key,
                label: o.label,
                description: o.description,
                is_default: o.is_default,
                selected: !!picked.get(i.id)?.option_keys.includes(o.key),
              })),
            })),
          })),
        });
      }
      const rec = p.foundation.recommendation;
      out(`기반 선택: ${p.foundation.items.length}개 · ${p.foundation.confirmed ? "확정" : "미확정"}${rec?.summary ? ` · 추천 요약: ${rec.summary}` : ""}`);
      for (const c of sortBy(active)) {
        const rule = [c.select_mode === "single" ? "하나" : "여러 개", c.required ? "필수" : "선택", c.max_select ? `최대 ${c.max_select}` : null, `적용: ${c.applies_to.join("·")}`]
          .filter(Boolean)
          .join(", ");
        out(`\n[${c.name}] ${c.id} (${rule})`);
        for (const i of sortBy(c.items)) {
          const sel = picked.get(i.id);
          out(`  ${sel ? "[x]" : "[ ]"} ${i.id} — ${i.name}${i.is_default ? " (기본)" : ""}${i.description ? ` · ${i.description}` : ""}`);
          if (reasons[i.id]) out(`      추천 이유: ${reasons[i.id]}`);
          if (i.option_mode !== "none") {
            out(`      ${i.option_label ?? "선택지"} (${i.option_mode === "single" ? "하나" : "여러 개"}${i.option_required ? ", 필수" : ""}):`);
            for (const o of sortBy(i.options)) {
              const on = !!sel?.option_keys.includes(o.key);
              out(`        ${on ? "*" : "-"} ${o.key} — ${o.label}${o.is_default ? " (기본)" : ""}${o.description ? ` · ${o.description}` : ""}`);
            }
          }
        }
      }
      return;
    }
    case "default": {
      const sel = defaultSelection(active);
      setFoundationItems(p, sel.items);
      saveProject(dir, p);
      return out(`기본값으로 선택: ${sel.items.map((x) => x.item_id + (x.option_keys.length ? `[${x.option_keys.join(",")}]` : "")).join(", ")} · ${selectionIssuesLine(catalog, p)}`);
    }
    case "pick": {
      const [itemId, ...optArgs] = args;
      if (!itemId) throw new CliError("항목 id 가 필요합니다 (예: design/design-lookbook).");
      const cat = active.find((c) => c.items.some((i) => i.id === itemId));
      const item = cat?.items.find((i) => i.id === itemId);
      if (!item) throw new CliError(`카탈로그에 없는 항목입니다: ${itemId} (foundation list 로 확인)`);
      let keys = optArgs.join(",").split(",").map((s) => s.trim()).filter(Boolean);
      if (!keys.length && item.option_mode !== "none") {
        // 선택지를 안 주면: 이미 고른 값 유지, 처음이면 기본 선택지.
        keys = picked.get(itemId)?.option_keys ?? item.options.filter((o) => o.is_default).map((o) => o.key);
        if (item.option_mode === "single") keys = keys.slice(0, 1);
      }
      const valid = new Set(item.options.map((o) => o.key));
      const unknown = keys.filter((k) => !valid.has(k));
      if (unknown.length) throw new CliError(`${item.name}: 없는 선택지 ${unknown.join(", ")}`);
      if (item.option_mode === "none" && keys.length) throw new CliError(`${item.name}: 선택지가 없는 항목입니다.`);
      if (item.option_mode === "single" && keys.length > 1) throw new CliError(`${item.name}: ${item.option_label ?? "선택지"}는 하나만 고를 수 있습니다.`);
      keys = [...new Set(keys)];
      // single 분류는 같은 분류의 기존 항목을 교체한다.
      const sameCat = new Set(cat.items.map((i) => i.id));
      const items = p.foundation.items.filter((x) => x.item_id !== itemId && !(cat.select_mode === "single" && sameCat.has(x.item_id)));
      const replaced = p.foundation.items.filter((x) => x.item_id !== itemId && !items.includes(x)).map((x) => x.item_id);
      items.push({ item_id: itemId, option_keys: keys });
      setFoundationItems(p, items);
      saveProject(dir, p);
      return out(
        `선택: ${itemId}${keys.length ? ` [${keys.join(",")}]` : ""}${replaced.length ? ` (교체: ${replaced.join(", ")})` : ""} · 미확정 · ${selectionIssuesLine(catalog, p)}`,
      );
    }
    case "unpick": {
      const [itemId] = args;
      if (!itemId) throw new CliError("항목 id 가 필요합니다.");
      if (!picked.has(itemId)) throw new CliError(`선택되지 않은 항목입니다: ${itemId}`);
      setFoundationItems(p, p.foundation.items.filter((x) => x.item_id !== itemId));
      saveProject(dir, p);
      return out(`선택 해제: ${itemId} · 미확정 · ${selectionIssuesLine(catalog, p)}`);
    }
    case "validate": {
      const issues = validateSelection(catalog, { items: p.foundation.items, confirmed: true });
      if (!issues.length) return out("규칙 위반 없음 — 확정할 수 있습니다.");
      for (const i of issues) out(`- ${i.message}`);
      process.exitCode = 1;
      return;
    }
    case "confirm": {
      const issues = validateSelection(catalog, { items: p.foundation.items, confirmed: true });
      if (issues.length) throw new CliError(`확정할 수 없습니다: ${issues.map((i) => i.message).join(" / ")}`);
      p.foundation.confirmed = true;
      bumpStep(p, 5);
      const md = renderFoundationMarkdown(catalog, p.foundation) || "## 기반 선택 (참조 리소스)\n\n(선택 없음)\n";
      writeText(join(dir, FOUNDATION_FILE), md);
      saveProject(dir, p);
      return out(`확정: 기반 ${p.foundation.items.length}개 → ${FOUNDATION_FILE} · 현재 단계 ${p.current_step}/6`);
    }
    default:
      throw new CliError(`foundation 하위 명령: list, default, pick, unpick, validate, confirm (받은 값: ${sub ?? "(없음)"})`);
  }
}

// ── export ──────────────────────────────────────────────────────────────────

function cmdExport(dir) {
  const p = loadProject(dir);
  const v = projectView(dir, p);
  const files = buildExportFiles(
    { name: p.name, summary: p.summary, prd: v.prd, feature_spec: v.feature_spec, design_spec: v.design_spec, dev_spec: v.dev_spec, foundation: p.foundation },
    loadCatalog(dir),
  );
  // docs/*.md 는 이미 정본 파일이 그 자리에 있다 — README.md·CLAUDE.md 만 쓴다.
  const written = [];
  for (const f of files) {
    if (f.path !== "README.md" && f.path !== "CLAUDE.md") continue;
    writeText(join(dir, f.path), f.content);
    written.push(f.path);
  }
  const docs = files.filter((f) => f.path.startsWith("docs/")).map((f) => f.path);
  out(
    `내보냄: ${written.join(", ")} · 문서 ${docs.length}개 링크${written.includes("CLAUDE.md") ? "" : " · CLAUDE.md 없음(개발 명세서·기반 선택이 없음)"}`,
  );
}

// ── main ────────────────────────────────────────────────────────────────────

const COMMANDS = {
  init: cmdInit,
  set: cmdSet,
  status: cmdStatus,
  prompt: cmdPrompt,
  save: cmdSave,
  answer: cmdAnswer,
  questions: cmdQuestions,
  foundation: cmdFoundation,
  export: cmdExport,
};

function main(argv) {
  const [sub, ...rest] = argv;
  const fn = COMMANDS[sub];
  if (!fn) throw new CliError(`사용법: ph.mjs <${Object.keys(COMMANDS).join("|")}> ... [--dir <작업 폴더>]`);
  const args = parseArgs(rest);
  const dir = resolve(args.flags.dir ?? process.cwd());
  fn(dir, args);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  const msg = err instanceof CliError ? err.message : `내부 오류: ${err instanceof Error ? err.message : String(err)}`;
  process.stderr.write(`오류: ${msg.replace(/\s*\n\s*/g, " ")}\n`);
  if (!(err instanceof CliError) && process.env.PH_DEBUG) console.error("[ph]", err?.stack ?? err);
  process.exitCode = 1;
}
