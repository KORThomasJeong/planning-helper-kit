# planning-helper-kit — 구현 계약 (에이전트 공용)

웹 서비스 "기획 도우미"(소스 `<웹 저장소>` — 이 문서에서 웹 소스 checkout 경로를 이렇게 적는다)에서 나온
6단계 기획 흐름을 **웹 서비스 없이 Claude Code 안에서** 끝내는 설치형 플러그인.
AI 생성은 Bedrock 이 아니라 **Claude Code 자신(서브에이전트)** 이 한다. 프롬프트는 웹에서 옮겨 왔고, 2026-10-17 부터 이 저장소가 정본이다(9장).

- 저장소: `https://github.com/KORThomasJeong/planning-helper-kit` (public, 기본 브랜치 `main`)
- 설치: `/plugin marketplace add KORThomasJeong/planning-helper-kit` (또는 전체 https 주소) → `/plugin install ph@planning-helper-kit`, 업데이트 `/plugin marketplace update planning-helper-kit`
- 플러그인 이름 `ph` → 커맨드는 `/ph:<name>`
- 런타임: Node ≥ 18, **외부 의존성 0** (npm install 없이 동작). 모든 스크립트는 ESM `.mjs`.
- 문서·메시지는 한국어. 코드 주석은 짧게.

## 1. 6단계

| # | 단계 | 산출물 (사용자 작업 폴더 기준) | 프롬프트 |
|---|---|---|---|
| 1 | 입력 & 명확화 질문 | `planning/input/task_definition.md`, `planning/input/requirements.md`, `planning/project.json` 의 `questions` | questions |
| 2 | PRD (+ 한 줄 요약) | `docs/PRD.md`, `project.json.summary` | prd, summary |
| 3 | 기능 정리 (mermaid 시퀀스 포함) | `docs/FEATURES.md` | features |
| 4 | 기반 선택 | `project.json.foundation`, `docs/FOUNDATION.md` (렌더 결과) | foundation (AI 추천) |
| 5 | 화면 설계 (IA) | `docs/DESIGN.md` | design + 기반 블록(target=design) |
| 6 | 개발 명세서 | `docs/DEV_SPEC.md` | dev + 기반 블록(target=dev) |
| + | 일관성 점검 | `docs/CONSISTENCY.md` | consistency |
| + | 내보내기 | 루트 `README.md`, `CLAUDE.md` → git push (GitHub) | — |

## 2. 상태 파일 `planning/project.json`

```json
{
  "version": 1,
  "name": "프로젝트명",
  "needs_admin_page": false,
  "current_step": 1,
  "questions": [{"id":"q1","question":"...","options":["..","직접 입력"],"type":"select","answer":null,"custom":""}],
  "summary": null,
  "foundation": {"items":[{"item_id":"design/design-lookbook","option_keys":["3-jelly"]}], "confirmed": false, "recommendation": null},
  "doc_timestamps": {"prd":"2026-10-08T00:00:00.000Z"},
  "created_at": "...", "updated_at": "..."
}
```
- 문서 본문은 json 에 넣지 않는다 — 파일이 정본. 필드 ↔ 파일:
  `task_definition`↔`planning/input/task_definition.md`, `requirements`↔`planning/input/requirements.md`,
  `prd`↔`docs/PRD.md`, `feature_spec`↔`docs/FEATURES.md`, `design_spec`↔`docs/DESIGN.md`,
  `dev_spec`↔`docs/DEV_SPEC.md`, `consistency_report`↔`docs/CONSISTENCY.md`.
- 기반 항목 id 는 웹의 uuid 대신 **`<category.key>/<item.key>`** 문자열.
- `current_step` 1..6. 문서를 저장하면 `max(current_step, 다음 단계)` 로 올린다.
- stale: 앞 단계 문서의 timestamp 가 뒤 단계보다 나중이면 status 에 "앞 단계가 바뀜 — 재생성 고려" 경고.

## 3. 엔진 CLI `scripts/ph.mjs` (에이전트 A 담당)

커맨드 md 는 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" <sub> ...` 로 부른다. cwd = 사용자 작업 폴더.
`--dir <path>` 로 작업 폴더 지정 가능(기본 cwd). 오류는 stderr 한 줄 + exit 1. 성공 출력은 stdout.

| 서브커맨드 | 동작 |
|---|---|
| `init --name <s> [--admin]` | `planning/` 생성, project.json 초기화(이미 있으면 거부, `--force` 로 덮기 금지 — 그냥 거부). input 파일 빈 파일 생성. `.gitignore` 없으면 만들지 않음 |
| `set <field> <value>` | `name`, `needs_admin_page`(true/false) 변경 |
| `status [--json]` | 단계별 완료 여부·글자수·stale 경고·다음 할 일 한 줄 |
| `prompt <step> [--revise <file>]` | **생성에 쓸 프롬프트를 파일로 만든다.** step ∈ questions,prd,summary,features,foundation,design,dev,consistency. `planning/.work/<step>.system.md` 와 `<step>.user.md` 를 쓰고 두 경로를 stdout 에 JSON `{"system":"...","user":"..."}` 로 출력. `--revise <file>` 은 수정 요청 텍스트 파일 → 수정 모드 템플릿 (current_content = 현재 문서 파일). summary 는 system 이 없으므로 system 파일은 빈 문자열. 입력 문서가 비어 있어야 하는 단계 선행조건이 안 맞으면 오류(예: prd 는 requirements 필수, features 는 prd 필수, design 은 feature_spec 필수, dev 는 design_spec 필수) |
| `save <step> <file>` | 생성 결과 파일을 정본 위치로 저장. questions → parseQuestions 로 검증해 project.json.questions 에(id 는 `q<epoch>_<i>`), summary → project.json.summary(trim, 1줄), foundation → parseRecommendation 으로 검증해 `foundation.items`/`recommendation`(confirmed=false), 나머지 → docs 파일. 마크다운 결과가 통째로 ```markdown 펜스에 싸여 있으면 벗긴다. timestamp·current_step 갱신. 결과 요약 한 줄 출력 |
| `answer <qid> <text>` | 질문 답. text 가 options 중 하나면 answer, 아니면 custom |
| `questions [--json]` | 질문과 현재 답 출력 |
| `foundation list [--json]` | 카탈로그(분류→항목→선택지, 기본값 표시, 현재 선택 표시) |
| `foundation default` | defaultSelection 을 현재 선택으로 |
| `foundation pick <item_id> [opt,...]` / `foundation unpick <item_id>` | 선택 편집 (single 분류는 같은 분류 기존 항목을 교체) |
| `foundation validate` | validateSelection issues 출력, 있으면 exit 1 |
| `foundation confirm` | validate 통과 시 confirmed=true, `docs/FOUNDATION.md` 렌더, current_step≥5 |
| `export` | 루트 `README.md`, `CLAUDE.md` 생성 (웹 `buildExportFiles` 포팅, "원본 링크" 줄 대신 "planning-helper-kit 으로 생성") |

카탈로그: `catalog/foundation-catalog.json` (이 저장소에서 관리하는 일반 AWS 기본 카탈로그, `{snapshot, source, categories:[...]}`, 각 노드에 id 없음 → 로더가 `id` 를 `<cat>/<item>` 로, category id = key 로 채움. active 는 전부 true). 사용자가 `planning/foundation-catalog.json` 을 두면 그것을 우선 사용.

### 포팅 원본 (처음 옮겨 온 곳 — 지금은 동기화하지 않는다, 9장)
- `<웹 저장소>/lib/prompts/{questions,prd,summary,features,design,dev,consistency,foundation}.ts` → `scripts/lib/prompts/*.mjs` (SYSTEM 문자열과 userPrompt 함수, 타입만 제거)
- `<웹 저장소>/lib/foundation-render.ts` → `scripts/lib/foundation-render.mjs`
- `<웹 저장소>/lib/gitlab.ts` 의 `buildExportFiles` → `scripts/lib/export.mjs` (웹 소스 파일 이름 그대로)
- design/dev 의 사용자 프롬프트 = 원본 userPrompt + `renderFoundationPrompt(catalog, selection, target)` (웹 `withFoundation` 과 동일)
- consistency 의 foundation 입력 = `renderFoundationMarkdown(catalog, selection)` (웹 라우트 확인 후 동일하게)
- dev_spec 은 consistency·revise 입력 전에 stripReferences.

테스트: `tests/*.test.mjs` (`node --test`), 임시 폴더에서 init→prompt→save→foundation→export 전 과정.

## 4. 플러그인 셸 (에이전트 B 담당)

- `.claude-plugin/plugin.json` (name `ph`), `.claude-plugin/marketplace.json` (marketplace name `planning-helper-kit`, plugin `ph`, source `./`) — Claude Code 플러그인 마켓플레이스 표준 형식. author `AI Innovation` / `coffee@sk.com`, homepage·repository 는 GitHub 저장소 주소.
- `agents/ph-writer.md` — 문서 생성 전용 서브에이전트. 입력: system 파일 경로, user 파일 경로, 출력 파일 경로. system 파일 내용을 **자신의 역할·규칙으로 그대로 채택**하고 user 파일 내용에 대한 응답 **본문만** 출력 파일에 쓴다(머리말·맺음말·설명 금지, 문서 전체를 코드펜스로 감싸지 않음). 도구: Read, Write. 웹 서비스 출력과 품질이 같아야 하므로 지시를 추가로 덧붙이지 않는다.
- `commands/*.md` (frontmatter `description`, `allowed-tools`, 필요 시 `argument-hint`):
  - `start` — 새 기획 시작: 이름·과제 정의서(붙여넣기 또는 파일 경로)·요구사항·관리자 페이지 여부를 받아 init → 질문 생성 → **AskUserQuestion 으로 질문마다 선택지 제시**(마지막 "직접 입력"은 Other 로) → answer 저장 → "다음: /ph:next"
  - `next` — current_step 을 보고 다음 단계 하나를 실행(아래 단계 커맨드와 같은 절차). 끝나면 산출물 요약(제목·섹션 수·글자수)과 다음 커맨드 안내
  - `questions`, `prd`, `features`, `foundation`, `design`, `dev` — 단계별 실행(재생성 포함). 이미 문서가 있으면 덮어쓸지 확인
  - `foundation` — AI 추천(prompt foundation → ph-writer → save foundation) 후 추천 이유와 함께 선택을 보여 주고, AskUserQuestion 으로 확정/수정. 필수 분류 누락 없이 `foundation confirm`
  - `revise <step> <요청>` — 수정 모드 생성 (prd/features/design/dev)
  - `check` — 일관성 점검 → `docs/CONSISTENCY.md`, 요약·점수 보여 주기
  - `status` — 진행 현황
  - `publish` — export 후 **GitHub 에만** 올린다. 올릴 계정·조직(owner)·저장소 이름·공개 범위(private 기본) 확인 → 저장소 생성 → git init/commit/push.
    - `gh` CLI 와 로그인(`gh auth status`)이 전제. 없으면 설치(`winget install --id GitHub.cli`)와 `gh auth login` 을 안내한다. 토큰을 대화에 붙여넣게 하지 않는다.
    - 생성: `gh repo create <owner>/<name> --private --source . --remote origin --push`.
    - 이미 origin 이 있으면 새로 만들지 않고 commit+push 만. 이후 push 인증은 `gh auth setup-git`(gh 를 git credential helper 로) — 토큰을 URL·`.git/config` 에 넣지 않는다.
    - 강제 push 하지 않는다.
  - `help` — 커맨드 목록과 흐름
- 생성 절차(모든 단계 공통): `node ph.mjs prompt <step>` → Agent(subagent_type `ph:ph-writer`)에 경로 3개 전달, 출력은 `planning/.work/<step>.gen.txt` → `node ph.mjs save <step> planning/.work/<step>.gen.txt` → status.
- `README.md` (설치·흐름·커맨드 표·작업 폴더 구조·웹 서비스와의 관계·카탈로그 스냅숏 갱신 방법), `CLAUDE.md` (이 저장소를 고치는 사람용 규칙: 프롬프트는 한 곳에서만, 외부 의존 금지), `.gitignore`.

## 5. 구현 메모 (엔진)

에이전트 A 가 3장을 구현하면서 정한 세부와 계약에서 벗어난 점. 커맨드 md 는 이 동작을 전제로 한다.

### 포팅 방식
- `scripts/lib/prompts/*.mjs`·`foundation-render.mjs`·`export.mjs` 는 **손으로 옮기지 않았다.**
  `node tools/port-from-web.mjs <웹 저장소 경로>` 가 웹 저장소의 TypeScript 컴파일러로 타입만 지워 생성한다
  (템플릿 문자열은 바이트 그대로). 웹 프롬프트가 바뀌면 이 스크립트 → `npx -y tsx tools/verify-prompts.mjs <웹 저장소 경로>` 순서로 돈다.
  생성 파일 첫 줄에 "자동 생성 — 직접 고치지 말 것" 주석이 있다.
- `export.mjs` 는 `gitlab.ts` 의 "export file set" 구간을 떼어 오면서 `projectLink`(웹 URL) 를 지우고 두 줄만 바꾼다:
  README 끝 줄 → `planning-helper-kit 으로 생성 (AI FAB 기획 도우미의 프롬프트를 Claude Code 에서 실행)`,
  CLAUDE.md 머리 인용 → `> 이 파일은 planning-helper-kit(AI FAB 기획 도우미 Claude Code 플러그인)으로 만든 개발 안내서입니다.`
- `tools/verify-prompts.mjs` 는 모듈 비교에 더해 **CLI 비교**도 한다: 임시 폴더에서 `ph.mjs prompt <step>`(생성·수정 모드,
  기반 선택 유무)이 쓴 파일을 웹 라우트(`app/api/generate/*`) 조립 방식대로 웹 모듈로 만든 값과 비교. 120 케이스.
  `buildExportFiles` 는 웹 쪽이 `server-only`·DB 를 import 해서 직접 비교하지 않는다(포팅 스크립트가 구간 복사 + 문구 치환 검사).

### CLI 세부
- `prompt` 출력은 `{"system","user","out"}` (+ 경고가 있을 때만 `"warnings":[...]`). 모두 절대경로, 슬래시(`/`) 구분.
  `out` = `planning/.work/<step>.gen.txt` (ph-writer 가 쓸 곳). design·dev 에서 기반 미확정이면 warnings 에
  "기반 선택이 확정되지 않았습니다 — 현재 선택으로 생성합니다." (웹과 같이 확정은 전제조건이 아니다).
- `--revise <file>`: 파일 내용을 trim 해서 쓴다(웹 `revision_request.trim()`). 비면 오류. prd·features·design·dev 만 — 그 외 단계는 오류.
  current_content 는 현재 문서 파일(dev 는 `stripReferences`). 현재 문서가 비면 "수정할 문서가 없습니다. 먼저 생성하세요."
- 선행조건은 웹 라우트 그대로: questions·prd(생성)=requirements, summary·features·foundation·consistency=prd,
  design=prd+feature_spec(수정 모드도), dev(생성)=prd+feature_spec+design_spec, dev(수정)=없음.
- 카탈로그: design·dev·consistency·export·validate 는 보관 포함 전체, foundation 추천·`list`·`default`·`pick` 은 활성만
  (웹 `loadCatalog({includeArchived})` 와 같게). 스냅숏에 `"active": false` 를 명시하면 보관으로 취급한다(기본 true).
  옵션 id 는 `<cat>/<item>/<opt>`.
- 파일 읽기: UTF-8, BOM 제거, CRLF → LF (브라우저 textarea 값과 같게). 파일이 없으면 빈 문자열(웹 null 과 같은 결과).
  쓰기: UTF-8, 내용 그대로(끝 줄바꿈을 붙이지 않는다 — 다음 프롬프트 입력이 웹과 바이트 동일하도록).
- `save`:
  - questions → `parseQuestions`, 0개면 오류. 기존 질문·답변을 통째로 바꾼다(웹 동작). 출력 `저장: 질문 N개 → planning/project.json ...`
  - summary → trim 후 줄바꿈을 공백 하나로 합쳐 1줄. 출력 `저장: 요약 "..." (N자)`
  - foundation → `parseRecommendation`(활성 카탈로그) → `foundation = {items, confirmed:false, recommendation:{reasons, summary, issues, dropped, created_at}}`.
    issues = `validateSelection(confirmed:true)`. 출력 `저장: 기반 추천 N개 항목 (규칙 위반 M건, 카탈로그 밖이라 버린 값 K개) — 확정 전 · <요약>`
  - 문서(prd·features·design·dev·consistency) → 첫 줄 ```` ```markdown ````/```` ```md ```` + 마지막 줄 ```` ``` ```` 일 때만 펜스를 벗긴다.
    출력 `저장: docs/PRD.md ("제목", N자, 섹션 M개) · 마크다운 펜스 벗김 · 현재 단계 3/6` (벗기지 않았으면 그 조각 없음)
  - 파싱 실패 시 포팅 모듈의 console.error 는 삼키고 오류 한 줄에 붙인다.
- current_step: 모든 질문에 답하면 2, prd 저장 3, features 4, `foundation confirm` 5, design·dev 6. questions·summary·foundation 추천·consistency 저장은 그대로.
- doc_timestamps: prd·feature_spec·design_spec·dev_spec·consistency_report 저장 때, foundation 은 **항목·선택지가 바뀔 때만**
  (웹 `foundationItemsKey` 비교 — confirm 만으로는 안 찍힘). 손으로 고친 문서 파일은 시각에 반영되지 않는다(mtime 은 clone 때 흔들려 쓰지 않음).
- stale 경고(status): 웹 StepDoc 과 같은 "앞 문서 > 뒤 문서" (prd→features→design→dev), 기반 선택 > design/dev,
  그리고 추가로 "일관성 점검보다 나중에 바뀐 문서"가 있으면 경고.
- `status --json`: `{name, needs_admin_page, current_step, steps:[{step,key,label,done,...}], consistency, warnings:[{field,cause,message}], next:{action,message,command}}`.
  각 문서는 `{field,file,exists,title,sections,chars,updated_at}`. step1 은 `task_definition`·`requirements`·`questions:{total,answered}`,
  step4 는 `items`·`confirmed`. `next.action` ∈ input, questions, answer, prd, summary, features, foundation, design, dev, check, publish
  (내용 기준으로 계산 — current_step 이 아니라 실제 빈 산출물을 본다). 1단계 done = 요구사항 있음 + 질문 ≥1 + 전부 답변.
- `answer <qid> <text...>`: qid 대신 1부터의 순번도 된다. 나머지 인자를 공백으로 이어 붙인다. text 가 "직접 입력" 이면 오류.
  options 중 하나면 `answer`, 아니면 `custom` (웹 Step1 과 같게 다른 쪽은 null/"").
- `foundation pick <id> [opt,...]`: 선택지는 쉼표 또는 공백 구분. 선택지를 안 주면 이미 고른 값 유지, 처음이면 기본(is_default) 선택지.
  선택지 규칙 위반(none 인데 줌, single 인데 2개, 없는 키)은 즉시 오류. 분류 규칙(필수 누락 등)은 경고 문구만 — `validate` 로 확인.
  pick·unpick·default 는 confirmed=false 로 되돌린다(웹 FoundationStep 과 같게).
- `foundation list`: 텍스트는 분류별 `[x]/[ ]` 항목, `*`/`-` 선택지, 기본값 `(기본)`, 추천 이유. `--json` 은 `{confirmed, selection, recommendation, categories:[...selected/reason 포함]}`.
- `foundation confirm`: `docs/FOUNDATION.md` = `renderFoundationMarkdown(catalog, selection)` (기본 제목 `## 기반 선택 (참조 리소스)`).
- `export`: README.md·CLAUDE.md 만 쓴다(docs/*.md 는 이미 정본 위치). CLAUDE.md 는 웹과 같게 개발 명세서나 기반 선택이 있을 때만.
  기존 README.md·CLAUDE.md 는 덮어쓴다. 출력 `내보냄: README.md, CLAUDE.md · 문서 N개 링크`.
- `planning/.work/` 를 처음 만들 때 그 안에 `.gitignore`(`*`) 를 둔다 — 루트 `.gitignore` 는 만들지 않는다는 계약을 지키면서 프롬프트 사본이 push 되지 않게.
- 오류는 `오류: <메시지>` 한 줄 + exit 1. `foundation validate` 위반은 stdout 에 `- <메시지>` 줄들 + exit 1. 내부 예외 스택은 `PH_DEBUG=1` 일 때만.

### 테스트
- `node --test tests/` 는 **Node 22 이상에서 디렉터리 인자를 받지 않는다**(글롭으로 해석). `node --test` (인자 없음) 또는
  `node --test "tests/*.test.mjs"` 를 쓴다. Node 18·20 에서는 `node --test tests/` 도 된다.

## 6. 구현 메모 (셸)

에이전트 B 가 4장을 구현하면서 정한 세부. 엔진 동작은 5장을 전제로 한다.

### 엔진에 기대는 것 (계약 3장 밖, 5장에서 확인됨)
- `prompt` 출력의 `out` 경로를 그대로 ph-writer 의 `OUT` 으로 쓴다(셸이 경로를 조립하지 않음). `warnings` 는 사용자에게 쉬운 말로 전달.
- `/ph:next` 는 `status --json` 의 `next.action` 으로 분기한다(current_step 직접 해석 안 함). `summary` 는 `commands/prd.md` 4절만 실행.
- `/ph:foundation` 은 `foundation list --json` 의 `categories[].items[].selected/reason`, `options[].selected`, `recommendation.{summary,issues,dropped}` 로 추천을 보여 준다.
- `answer <qid> <text>` 에 선택지 문구를 **그대로** 넘겨 answer/custom 을 엔진이 가르게 한다. AskUserQuestion 의 "기타" 입력은 custom.
- `planning/.work/.gitignore`(`*`) 덕에 publish 가 루트 `.gitignore` 를 건드리지 않는다.

### 셸 쪽 결정
- **ph-writer**: `tools: Read, Write`, `model: inherit`. 본문 지시는 "system 파일 = 역할, user 파일에 대한 응답 본문만 OUT 에, 펜스로 감싸지 말 것, 한 줄 확인" 뿐.
  summary 처럼 system 파일이 비면 시스템 프롬프트 없이 진행. 품질 관련 지시는 넣지 않는다.
- **백업**: 문서를 다시 만들거나 고치기 전에 셸이 `cp docs/X.md planning/.work/backup/X.<YYYYmmdd-HHMMSS>.md`. 되돌리기는 `save <step> <백업>` (timestamp 도 맞춰짐).
- **결과 요약**: `node -e` 한 줄로 코드펜스 밖 `#`~`###` 제목과 `chars=`(UTF-16 길이 = 웹 `.length`)를 뽑는다.
- **덮어쓰기 확인**: 단계 커맨드는 문서가 있으면 AskUserQuestion `새로 만들기 / 고칠 점 알려 주기(→revise) / 그대로 두기`. 단계 커맨드 인자(`/ph:prd <고칠 점>`)는 revise 로 처리.
- **PRD 수정 모드에서도 요약 재생성**(웹은 prd 완료마다 요약을 만든다).
- **design/dev 기반 미확정**: 막지 않고 AskUserQuestion `기반 먼저 정하기 / 그냥 진행` (웹 안내와 같은 취지).
- **start 질문**: AskUserQuestion 한 번에 최대 4문항, 문항당 "직접 입력"을 뺀 선택지 최대 4개(넘치면 앞 4개), "기타"가 직접 입력 역할. 남는 선택지가 2개 미만이면 채팅으로 묻는다.
- **publish**
  - `export` 전에 루트 `README.md`/`CLAUDE.md` 가 있는데 `planning-helper-kit` 글자가 없으면 덮어쓸지 묻고 백업(엔진 export 는 무조건 덮어씀).
  - 기본으로 `README.md CLAUDE.md .gitignore docs planning` 만 add(`ls -d` 로 있는 것만). 그 밖의 파일이 있으면 "기획 문서만 / 폴더 전체" 를 묻는다.
  - **인증은 `gh auth login` 한 번**(브라우저 로그인). 토큰 환경변수를 요구하지 않는다. `gh auth status` 가 실패하면 사용자에게
    `! gh auth login` 을 직접 실행하게 안내하고, 끝나면 다시 확인한다.
  - 저장소 생성은 `gh repo create <owner>/<name> --private --source . --remote origin --push`. owner 후보는 `gh api user --jq .login` 과
    `gh api user/orgs --jq '.[].login'`. 이후 push 는 `gh auth setup-git` 으로 git 이 gh 자격 증명을 쓰게 한다 — 토큰은 URL·`.git/config` 에 남지 않는다.
  - 커밋 메시지는 `planning/.work/commit-msg.txt` 에 Write → `git commit -F`. user.name/email 이 없으면 그 저장소에만 설정.
  - 원격이 앞서 있으면 강제 push 하지 않고 `pull --rebase` 여부를 묻는다.

### 엔진에 있으면 좋은 것 (막히진 않음)
1. `save` 가 기존 문서를 `planning/.work/backup/` 에 스스로 백업 — 지금은 셸이 `cp` 한다(이름 규칙 `<FILE>.<YYYYmmdd-HHMMSS>.md`).
2. `answer --file <path>` (또는 stdin) — 답이 `--` 로 시작하면 parseArgs 가 "알 수 없는 옵션"으로 거부하고, 따옴표가 섞인 긴 답은 셸 인용이 번거롭다.
3. `export --check` (또는 기존 README/CLAUDE.md 에 킷 표식이 없으면 거부) — 지금은 셸이 확인한다.
4. 손으로 고친 문서 감지 — save 때 내용 해시를 `doc_hashes` 에 남기고 status 가 다르면 "직접 수정됨"으로 보고 stale 계산에 반영.
5. `export` 조건이 사라졌을 때(개발 명세서·기반 선택 둘 다 없음) 예전 CLAUDE.md 가 남는다 — 지우거나 경고 한 줄.
6. (선택) `outline <step>` — 제목 목록·글자수를 엔진이 내 주면 커맨드의 `node -e` 한 줄을 없앨 수 있다.

## 7. 변경 (통합, 2026-10-08)

- **ph-writer 서브에이전트 폐기.** 실제 Claude Code 에서 서브에이전트의 Write 가 내용에 따라 간헐적으로 거부됐다
  ("보고서 파일을 쓰지 말고 텍스트로 반환" — summary·consistency·design 에서 재현). 대신 커맨드를 실행하는 세션이 직접
  system·user 파일을 읽고 응답 본문만 `out` 에 Write 한다. 4장의 ph-writer 관련 서술은 이 항목으로 대체된다.
- 결과 파일 이름: `planning/.work/<step>.gen.txt` (summary 는 `oneline.gen.txt`).

## 8. 변경 (일반 AWS·GitHub 이전, 2026-10-16)

- 배포·설치 저장소를 GitHub(`KORThomasJeong/planning-helper-kit`)로 옮겼다. 버전 0.2.0.
- `/ph:publish` 는 GitHub 전용(`gh` CLI). 4장·6장의 publish 서술은 GitHub 흐름으로 대체됐다.
- 기반 카탈로그는 이 저장소가 정본인 일반 AWS 기본 카탈로그(스냅숏 2026-10-16)다. 웹에서 받아 오는 절차는 없다.
  항목 id 는 그대로 `<분류 key>/<항목 key>` — key 를 바꾸면 기존 사용자 선택이 깨진다.
- 프롬프트 파일은 이때 바꾸지 않았다 — 9장에서 정리.

## 9. 변경 (웹과 분리, 2026-10-17)

- 프롬프트 바이트 동일 규칙을 없앴다. `scripts/lib/prompts/*.mjs`·`foundation-render.mjs`·`export.mjs` 는 이 저장소가 정본이고 직접 고친다.
- `tools/port-from-web.mjs`·`tools/verify-prompts.mjs` 를 지웠다(웹 소스 없이는 돌지 않는다). 3장 "포팅 원본"과 5장 "포팅 방식"은 기록으로만 남긴다.
- 문구 정리: 기반 추천 SYSTEM·일관성 점검의 "사내", 기반 블록 머리 `[선택된 기반 — 사내 표준·레퍼런스]` → `[선택된 기반 — 표준·레퍼런스]`,
  "(GitLab 링크)" → "(링크)", 기반 추천 SYSTEM 의 "표준 모듈" 제거, 내보내기 두 줄의 "AI FAB" 제거.
