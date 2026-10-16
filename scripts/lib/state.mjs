// 작업 폴더 상태: planning/project.json + 문서 파일(정본) + 기반 카탈로그.
// 문서 본문은 json 에 넣지 않는다 — 파일이 정본이다 (docs/CONTRACT.md 2장).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export class CliError extends Error {}

/** 필드 ↔ 파일 (작업 폴더 기준 상대 경로). */
export const FIELD_FILES = {
  task_definition: "planning/input/task_definition.md",
  requirements: "planning/input/requirements.md",
  prd: "docs/PRD.md",
  feature_spec: "docs/FEATURES.md",
  design_spec: "docs/DESIGN.md",
  dev_spec: "docs/DEV_SPEC.md",
  consistency_report: "docs/CONSISTENCY.md",
};

export const PROJECT_FILE = "planning/project.json";
export const WORK_DIR = "planning/.work";
export const FOUNDATION_FILE = "docs/FOUNDATION.md";
export const CATALOG_OVERRIDE = "planning/foundation-catalog.json";
export const CATALOG_DEFAULT = join(KIT_ROOT, "catalog", "foundation-catalog.json");

/** 웹 StepDoc 의 FIELD_ORDER — stale 판정 순서. */
export const DOC_ORDER = ["prd", "feature_spec", "design_spec", "dev_spec"];
export const DOC_LABEL = {
  task_definition: "과제 정의서",
  requirements: "요구사항",
  prd: "PRD",
  feature_spec: "기능 정리",
  design_spec: "화면 설계(IA)",
  dev_spec: "개발 명세서",
  consistency_report: "일관성 점검",
  foundation: "기반 선택",
};
/** 기반 선택이 반영되는 문서 (웹 lib/export/markdown.ts FOUNDATION_TARGET). */
export const FOUNDATION_TARGET = { design_spec: "design", dev_spec: "dev" };

const BOM = /^﻿/;

/** UTF-8, BOM 제거, CRLF → LF (브라우저 textarea 와 같은 값). */
export function readText(path) {
  return readFileSync(path, "utf8").replace(BOM, "").replace(/\r\n?/g, "\n");
}

export function writeText(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export const isBlank = (s) => !s || !s.trim();

// ── project.json ────────────────────────────────────────────────────────────

export function newProject(name, needsAdmin) {
  const now = new Date().toISOString();
  return {
    version: 1,
    name,
    needs_admin_page: !!needsAdmin,
    current_step: 1,
    questions: [],
    summary: null,
    foundation: { items: [], confirmed: false, recommendation: null },
    doc_timestamps: {},
    created_at: now,
    updated_at: now,
  };
}

export function projectPath(dir) {
  return join(dir, PROJECT_FILE);
}

export function loadProject(dir) {
  const path = projectPath(dir);
  if (!existsSync(path)) throw new CliError(`${PROJECT_FILE} 이 없습니다. 먼저 init 하세요 (/ph:start).`);
  let p;
  try {
    p = JSON.parse(readText(path));
  } catch (err) {
    throw new CliError(`${PROJECT_FILE} 을 읽지 못했습니다: ${err instanceof Error ? err.message : err}`);
  }
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new CliError(`${PROJECT_FILE} 형식이 아닙니다.`);
  // 빠진 필드는 기본값으로 (손으로 고친 파일 대비).
  p.questions = Array.isArray(p.questions) ? p.questions : [];
  p.doc_timestamps = p.doc_timestamps && typeof p.doc_timestamps === "object" ? p.doc_timestamps : {};
  const f = p.foundation && typeof p.foundation === "object" ? p.foundation : {};
  p.foundation = {
    items: Array.isArray(f.items) ? f.items : [],
    confirmed: !!f.confirmed,
    recommendation: f.recommendation ?? null,
  };
  p.current_step = Math.max(1, Math.min(6, Number(p.current_step) || 1));
  p.needs_admin_page = !!p.needs_admin_page;
  return p;
}

export function saveProject(dir, p) {
  p.updated_at = new Date().toISOString();
  const path = projectPath(dir);
  const tmp = `${path}.tmp`;
  writeText(tmp, `${JSON.stringify(p, null, 2)}\n`);
  renameSync(tmp, path);
}

export function bumpStep(p, step) {
  p.current_step = Math.max(p.current_step, Math.min(6, step));
}

export function stamp(p, key) {
  p.doc_timestamps[key] = new Date().toISOString();
}

// ── 문서 파일 ───────────────────────────────────────────────────────────────

export function fieldPath(dir, field) {
  return join(dir, FIELD_FILES[field]);
}

/** 파일이 없으면 "" (웹의 null 과 같게 취급된다: `|| "(없음)"`). */
export function readField(dir, field) {
  const path = fieldPath(dir, field);
  return existsSync(path) ? readText(path) : "";
}

/** 프롬프트 입력용: 모든 필드 + project.json 값. */
export function projectView(dir, p) {
  const view = { ...p };
  for (const f of Object.keys(FIELD_FILES)) view[f] = readField(dir, f);
  return view;
}

/**
 * 결과가 통째로 ```markdown (또는 ```md) 펜스에 싸여 있으면 벗긴다.
 * 첫 줄이 여는 펜스, 마지막 줄이 닫는 펜스일 때만.
 */
export function unwrapMarkdownFence(text) {
  const t = text.trim();
  const lines = t.split("\n");
  if (lines.length < 2) return text;
  if (!/^```(markdown|md)\s*$/i.test(lines[0])) return text;
  if (!/^```\s*$/.test(lines[lines.length - 1])) return text;
  return lines.slice(1, -1).join("\n");
}

/** 문서 요약: 제목(첫 `# `), `## ` 섹션 수, 글자 수. 코드펜스 안은 세지 않는다. */
export function docStats(text) {
  let title = null;
  let sections = 0;
  let fenced = false;
  for (const line of (text ?? "").split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    if (!title && /^# /.test(line)) title = line.slice(2).trim();
    if (/^## /.test(line)) sections++;
  }
  return { title, sections, chars: [...(text ?? "")].length };
}

export const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ── stale ───────────────────────────────────────────────────────────────────

/** 웹 StepDoc 의 isStale·foundationStale + 일관성 점검이 문서보다 오래됐는지. */
export function staleWarnings(dir, p) {
  const ts = p.doc_timestamps ?? {};
  const has = (f) => !isBlank(readField(dir, f));
  const later = (a, b) => !!ts[a] && !!ts[b] && new Date(ts[a]) > new Date(ts[b]);
  const out = [];
  for (let i = 1; i < DOC_ORDER.length; i++) {
    const cur = DOC_ORDER[i];
    const prev = DOC_ORDER[i - 1];
    if (has(cur) && later(prev, cur)) {
      out.push({ field: cur, cause: prev, message: `${DOC_LABEL[cur]}: 앞 단계(${DOC_LABEL[prev]})가 바뀜 — 재생성 고려` });
    }
  }
  for (const cur of Object.keys(FOUNDATION_TARGET)) {
    if (has(cur) && later("foundation", cur)) {
      out.push({ field: cur, cause: "foundation", message: `${DOC_LABEL[cur]}: 기반 선택이 바뀜 — 재생성 고려` });
    }
  }
  if (has("consistency_report")) {
    const changed = DOC_ORDER.filter((f) => later(f, "consistency_report"));
    if (changed.length) {
      out.push({
        field: "consistency_report",
        cause: changed[0],
        message: `일관성 점검: 이후 ${changed.map((f) => DOC_LABEL[f]).join("·")}이(가) 바뀜 — 다시 점검 고려`,
      });
    }
  }
  return out;
}

// ── 기반 카탈로그 ───────────────────────────────────────────────────────────

/**
 * 카탈로그 스냅숏(id 없음)을 웹 FoundationCatalog 형태로 채운다.
 * category.id = key, item.id = "<cat.key>/<item.key>", option.item_id = item.id, active = true(명시적 false 는 유지).
 */
export function normalizeCatalog(raw) {
  const cats = Array.isArray(raw) ? raw : raw?.categories;
  if (!Array.isArray(cats)) throw new CliError("기반 카탈로그 형식이 아닙니다 ({categories:[...]}).");
  return cats.map((c, ci) => {
    if (!c?.key) throw new CliError(`기반 카탈로그: ${ci + 1}번째 분류에 key 가 없습니다.`);
    const catId = c.key;
    return {
      id: catId,
      key: c.key,
      name: c.name ?? c.key,
      description: c.description ?? null,
      select_mode: c.select_mode === "single" ? "single" : "multi",
      required: !!c.required,
      max_select: c.max_select ?? null,
      applies_to: Array.isArray(c.applies_to) ? c.applies_to : [],
      sort: c.sort ?? ci,
      active: c.active !== false,
      items: (c.items ?? []).map((i, ii) => {
        if (!i?.key) throw new CliError(`기반 카탈로그: ${c.key} 의 ${ii + 1}번째 항목에 key 가 없습니다.`);
        const itemId = `${c.key}/${i.key}`;
        return {
          id: itemId,
          category_id: catId,
          key: i.key,
          name: i.name ?? i.key,
          description: i.description ?? null,
          url: i.url ?? null,
          guidance: i.guidance ?? null,
          option_mode: i.option_mode ?? "none",
          option_required: !!i.option_required,
          option_label: i.option_label ?? null,
          is_default: !!i.is_default,
          source: null,
          sort: i.sort ?? ii,
          active: i.active !== false,
          options: (i.options ?? []).map((o, oi) => ({
            id: `${itemId}/${o.key}`,
            item_id: itemId,
            key: o.key,
            label: o.label ?? o.key,
            description: o.description ?? null,
            url: o.url ?? null,
            guidance: o.guidance ?? null,
            is_default: !!o.is_default,
            sort: o.sort ?? oi,
            active: o.active !== false,
          })),
        };
      }),
    };
  });
}

/** planning/foundation-catalog.json 이 있으면 그것, 없으면 플러그인 스냅숏. 보관(active=false) 포함. */
export function loadCatalog(dir) {
  const override = join(dir, CATALOG_OVERRIDE);
  const path = existsSync(override) ? override : CATALOG_DEFAULT;
  let raw;
  try {
    raw = JSON.parse(readText(path));
  } catch (err) {
    throw new CliError(`기반 카탈로그를 읽지 못했습니다 (${path}): ${err instanceof Error ? err.message : err}`);
  }
  return normalizeCatalog(raw);
}

/** 활성만 (웹 loadCatalog({includeArchived:false})). */
export function activeCatalog(catalog) {
  return catalog
    .filter((c) => c.active)
    .map((c) => ({
      ...c,
      items: c.items.filter((i) => i.active).map((i) => ({ ...i, options: i.options.filter((o) => o.active) })),
    }));
}

/** 웹 lib/foundation.ts foundationItemsKey — 항목·선택지가 바뀌었는지 비교용. */
export function foundationItemsKey(sel) {
  const items = sel?.items;
  if (!Array.isArray(items)) return "[]";
  return JSON.stringify(
    items
      .map((p) => ({ item_id: p.item_id, option_keys: [...(p.option_keys ?? [])].sort() }))
      .sort((a, b) => a.item_id.localeCompare(b.item_id)),
  );
}
