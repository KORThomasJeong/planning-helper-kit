# CLAUDE.md — planning-helper-kit 유지보수 안내

이 저장소는 Claude Code 플러그인 `ph`(마켓플레이스 `planning-helper-kit`)다. 웹 서비스 **기획 도우미**에서 나온
6단계 기획 흐름과 프롬프트를 Claude Code 안에서 돌린다. 2026-10-17 부터 웹과 따로 가며, 프롬프트도 이 저장소가 정본이다. 설계 계약은 **`docs/CONTRACT.md`** 가 정본이다 — 구조나 CLI 형태를 바꾸면 그 파일부터 고친다.

## 구성

| 경로 | 내용 |
|---|---|
| `.claude-plugin/plugin.json`, `marketplace.json` | 플러그인·마켓플레이스 메타 (버전 두 군데) |
| `commands/*.md` | `/ph:*` 슬래시 커맨드 — 사용자 대화 흐름 |
| `scripts/ph.mjs` | 엔진 CLI (init·status·prompt·save·answer·questions·foundation·export) |
| `scripts/lib/prompts/*.mjs`, `foundation-render.mjs`, `export.mjs` | 프롬프트·렌더러 (웹에서 옮겨 왔고, 지금은 이 저장소가 정본) |
| `catalog/foundation-catalog.json` | 기반 카탈로그 — 이 저장소에서 관리하는 일반 AWS 기본값 (스냅숏 2026-10-16) |
| `tests/*.test.mjs` | 전 과정 테스트 (`node --test`) |

## 규칙

### 프롬프트는 한 곳에서만
- 문서의 역할·형식·품질 기준은 `scripts/lib/prompts/*.mjs` 의 SYSTEM·userPrompt 가 전부 정한다. 바꾸려면 이 파일들을 직접 고친다.
- 커맨드의 "작성" 절차에 품질·형식 지시를 덧붙이지 않는다. 같은 규칙이 두 곳에 생기면 어느 쪽이 맞는지 알 수 없게 된다.
- `foundation-render.mjs` 의 블록 머리(`[선택된 기반 — 표준·레퍼런스]`)는 테스트가 확인한다 — 바꾸면 `tests/flow.test.mjs` 도 같이 고친다.

### 고친 뒤에는 반드시
```sh
node --test   # 엔진 전 과정 (tests/*.test.mjs)
```
`node --test tests/` 는 Node 22 이상에서 디렉터리 인자를 받지 않는다 — 인자 없이 `node --test` 를 쓴다(Node 18·20 에선 둘 다 된다).
통과해야 배포한다. 프롬프트 문구를 바꿨다면 바꾼 이유를 커밋 메시지에 남긴다.

### 런타임 의존성 0
- 사용자 PC 에서 `npm install` 없이 돌아야 한다. `scripts/` 는 Node 18 내장 모듈만 쓰는 ESM `.mjs`.
- `package.json`·`node_modules` 를 만들지 않는다. 개발 도구가 필요하면 `npx` 로 빌려 쓴다.

### 커맨드 md
- 사용자는 IT 비전문 현업 담당자다. 화면에 나가는 말은 쉬운 한국어, 개발 용어는 피한다.
- 엔진 호출은 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" <sub>` 형태로만. 상태 판단은 `status --json` 을 근거로 한다.
- 생성 절차는 모든 단계가 같다: `prompt <step>` → 이 세션이 system·user 파일을 읽고 응답 본문만 `out` 에 Write → `save <step> <out>`.
- **서브에이전트로 작성하지 않는다.** Claude Code 가 서브에이전트의 보고서류 파일 쓰기를 내용에 따라 막는다(2026-10-08 실측: summary·consistency·design 에서 간헐 거부). 우회하면 메인이 본문을 옮겨 적다가 바꾸는 문제가 생긴다.
- 긴 절차를 커맨드끼리 복사하지 않는다 — `next.md`·`questions.md` 처럼 다른 커맨드 파일을 Read 해서 따르게 한다.
- 토큰은 환경변수로만. 대화창에 붙여넣게 하거나 원격 URL·`.git/config` 에 넣는 절차를 만들지 않는다.
- Windows Git Bash: 한글 요청 본문은 UTF-8 파일 + `--data-binary @file`. 슬래시로 시작하는 단독 인자는 경로로 바뀐다.

### 카탈로그 갱신
카탈로그의 정본은 이 저장소다. `catalog/foundation-catalog.json`
(`{ "snapshot": "<YYYY-MM-DD>", "source": "...", "categories": [...] }`)을 직접 고친다.
id 는 엔진이 `<분류 key>/<항목 key>` 로 만든다(노드에 id 를 넣지 않는다) — **key 를 바꾸면 기존 사용자 선택이 깨진다.**
고친 뒤 `snapshot` 날짜와 README 의 스냅숏 날짜를 같이 올리고, 아래 배포 절차로 새 버전을 낸다.
사용자는 프로젝트별로 `planning/foundation-catalog.json` 을 두어 덮어쓸 수 있다(그것이 우선).

## 배포

1. `.claude-plugin/plugin.json` 의 `version` 과 `.claude-plugin/marketplace.json` 의 `plugins[0].version` 을 **둘 다** 올린다.
2. `node --test` 통과 확인 → 커밋 → GitHub 의 `main`(기본 브랜치)에 푸시.
3. 사용자는 `/plugin marketplace update planning-helper-kit` 로 받는다.

저장소: https://github.com/KORThomasJeong/planning-helper-kit (public). 설치는 `/plugin marketplace add KORThomasJeong/planning-helper-kit`.
