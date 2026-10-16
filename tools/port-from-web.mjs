// 웹 서비스(planning-helper)의 프롬프트·기반 렌더·내보내기 코드를 플러그인 .mjs 로 옮긴다.
//
//   node tools/port-from-web.mjs <웹 저장소 경로>
//
// <웹 저장소 경로> = 기획 도우미 웹 서비스 소스를 받아 둔 폴더(node_modules 설치 필요).
//
// 손으로 옮기지 않는다 — TypeScript 컴파일러(웹 저장소의 node_modules/typescript)로 타입만 제거하므로
// 템플릿 문자열은 바이트 그대로 남는다. 웹 프롬프트가 바뀌면 이 스크립트를 다시 돌리고
// `npx -y tsx tools/verify-prompts.mjs <웹 경로>` 로 확인한다. 개발용 — 런타임 의존 아님.

import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = process.argv[2];
if (!web) {
  console.error("사용법: node tools/port-from-web.mjs <planning-helper 경로>");
  process.exit(1);
}
const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(resolve(web), "package.json"));
const ts = require("typescript");

const PROMPTS = ["questions", "prd", "summary", "features", "design", "dev", "consistency", "foundation"];

function strip(src, file) {
  const out = ts.transpileModule(src, {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      verbatimModuleSyntax: false,
      isolatedModules: true,
    },
    reportDiagnostics: false,
  });
  return out.outputText.replace(/\r\n/g, "\n");
}

/** 상대 import 에 .mjs 를 붙인다 (Node ESM 은 확장자를 요구한다). */
function fixImports(js) {
  return js.replace(/from "(\.{1,2}\/[^"]+)"/g, (_, p) => `from "${p}.mjs"`);
}

function header(src) {
  return `// 자동 생성 — tools/port-from-web.mjs 가 planning-helper/${src} 에서 타입만 제거했다. 직접 고치지 말 것.\n`;
}

function write(rel, content) {
  const path = join(KIT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  console.log(`wrote ${rel}`);
}

const read = (rel) => readFileSync(join(web, rel), "utf8").replace(/\r\n/g, "\n");

for (const name of PROMPTS) {
  const rel = `lib/prompts/${name}.ts`;
  write(`scripts/lib/prompts/${name}.mjs`, header(rel) + fixImports(strip(read(rel), rel)));
}

{
  const rel = "lib/foundation-render.ts";
  write("scripts/lib/foundation-render.mjs", header(rel) + fixImports(strip(read(rel), rel)));
}

// buildExportFiles: gitlab.ts 에서 "export file set" 구간만 떼어 오고, 웹 링크 두 줄을 바꾼다.
{
  const rel = "lib/gitlab.ts";
  const src = read(rel);
  const start = src.indexOf("export interface ExportFile");
  const endMark = "function ensureNewline(s: string): string {";
  const endAt = src.indexOf(endMark);
  if (start < 0 || endAt < 0) throw new Error("gitlab.ts: buildExportFiles 구간을 찾지 못했습니다");
  const close = src.indexOf("\n}\n", endAt);
  let body = src.slice(start, close + 3);

  const replace = (from, to) => {
    if (!body.includes(from)) throw new Error(`gitlab.ts: 바꿀 문구가 없습니다: ${from}`);
    body = body.replace(from, to);
  };
  replace(
    'export function projectLink(p: Pick<ProjectView, "id">): string {\n  return `${APP_URL}/project/${p.id}`;\n}\n\n',
    "",
  );
  replace(
    "`AI FAB 기획 도우미에서 생성됨 · 원본 링크 ${projectLink(p)}`",
    '"planning-helper-kit 으로 생성 (AI FAB 기획 도우미의 프롬프트를 Claude Code 에서 실행)"',
  );
  replace(
    "`> 이 파일은 AI FAB 기획 도우미가 만든 개발 안내서입니다. 원본: ${projectLink(p)}`",
    '"> 이 파일은 planning-helper-kit(AI FAB 기획 도우미 Claude Code 플러그인)으로 만든 개발 안내서입니다."',
  );
  if (body.includes("projectLink") || body.includes("APP_URL")) throw new Error("gitlab.ts: 웹 링크가 남았습니다");

  const prelude =
    'import { stripReferences } from "./prompts/dev";\n' +
    'import { renderFoundationMarkdown } from "./foundation-render";\n' +
    'import type { FoundationCatalog, ProjectView } from "./types";\n\n';
  const js = fixImports(strip(prelude + body, "export.ts"));
  write("scripts/lib/export.mjs", header(`${rel} (buildExportFiles 구간)`) + js);
}
