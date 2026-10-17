# 기획 도우미 킷 (planning-helper-kit)

과제 정의서에서 개발 명세서까지의 기획을 **Claude Code 안에서** 끝내는 플러그인입니다.
프롬프트는 웹 서비스 "기획 도우미"에서 가져왔습니다.

과제 정의서와 요구사항만 있으면, AI 가 아래 문서를 하나씩 만들어 줍니다.

1. 명확화 질문 — 빠진 정보를 2~3개 물어봅니다
2. PRD — 무엇을 왜 만드는지 (한 줄 요약도 함께)
3. 기능 정리 — 기능별 처리 흐름 다이어그램 포함
4. 기반 선택 — AWS 환경·디자인 프리셋·기술 스택·데이터베이스·로그인·배포 방식·AI 를 AI 추천으로 고르기
5. 화면 설계 — 화면 구성과 메뉴 구조
6. 개발 명세서 — 개발자나 AI 코딩 도구가 바로 구현할 수 있는 수준

그리고 **일관성 점검**(문서끼리 빠지거나 어긋난 곳 찾기)과 **저장소에 올리기**(GitHub)까지 됩니다.

문서를 쓰는 AI 는 지금 쓰고 있는 Claude Code 입니다. 별도 계정·API 키가 필요 없습니다.

## 설치

Claude Code 에서 두 줄:

```
/plugin marketplace add KORThomasJeong/planning-helper-kit
/plugin install ph@planning-helper-kit
```

- 첫 줄은 전체 주소 `https://github.com/KORThomasJeong/planning-helper-kit` 로 써도 됩니다.
- 설치 후 Claude Code 를 다시 시작하면 `/ph:` 로 시작하는 커맨드가 보입니다.
- 업데이트: `/plugin marketplace update planning-helper-kit`

## 5분 따라 하기

기획 하나에 폴더 하나를 씁니다. 빈 폴더를 만들고 그 폴더에서 Claude Code 를 여세요.

```
mkdir 안전점검-에이전트
cd 안전점검-에이전트
claude
```

| 순서 | 입력 | 일어나는 일 |
|---|---|---|
| 1 | `/ph:start` | 프로젝트명·과제 정의서(붙여넣기 또는 파일)·요구사항을 물어봅니다. 관리자 페이지 포함 여부를 고르면 명확화 질문이 선택지와 함께 나옵니다. 고르거나 직접 쓰면 됩니다 |
| 2 | `/ph:next` | PRD 를 만듭니다 → `docs/PRD.md` |
| 3 | `/ph:next` | 기능 정리 → `docs/FEATURES.md` |
| 4 | `/ph:next` | 기반 선택 — AI 가 추천과 이유를 보여 줍니다. "이대로 확정"하거나 말로 바꾸면 됩니다 → `docs/FOUNDATION.md` |
| 5 | `/ph:next` | 화면 설계 → `docs/DESIGN.md` |
| 6 | `/ph:next` | 개발 명세서 → `docs/DEV_SPEC.md` |
| + | `/ph:check` | 일관성 점검 — 점수와 먼저 고칠 것 3가지 → `docs/CONSISTENCY.md` |
| + | `/ph:publish` | GitHub 에 비공개 저장소를 만들어 올립니다 |

순서를 몰라도 `/ph:next` 만 반복하면 됩니다. 지금 어디까지 했는지는 `/ph:status`.

문서가 마음에 들지 않으면 말로 고칩니다:

```
/ph:revise prd 성공 기준에 처리 시간 목표(건당 30초 이내)를 넣어 줘
/ph:features 알림 기능은 빼 줘          ← 단계 커맨드 뒤에 고칠 점을 붙여도 같아요
```

## 커맨드

| 커맨드 | 하는 일 |
|---|---|
| `/ph:start [프로젝트명]` | 새 기획 시작 — 입력 받기, 명확화 질문 만들고 답 받기 |
| `/ph:next` | 다음 단계 하나를 알아서 진행 |
| `/ph:questions` | 명확화 질문에 답하기·답 고치기·질문 새로 만들기 |
| `/ph:prd [고칠 점]` | PRD (+ 한 줄 요약) |
| `/ph:features [고칠 점]` | 기능 정리 |
| `/ph:foundation` | 기반 선택 — AI 추천 → 확인·수정 → 확정 |
| `/ph:design [고칠 점]` | 화면 설계 (IA) |
| `/ph:dev [고칠 점]` | 개발 명세서 |
| `/ph:revise <단계> <고칠 점>` | 만든 문서 고치기 (단계: prd·features·design·dev) |
| `/ph:check` | 문서 일관성 점검 |
| `/ph:status` | 진행 현황, 다시 만들어야 할 문서 |
| `/ph:publish` | `README.md`·`CLAUDE.md` 를 만들고 저장소에 올리기 |
| `/ph:help` | 커맨드 목록과 순서 |

이미 있는 문서를 다시 만들 때는 덮어쓸지 먼저 묻고, 이전 버전은 `planning/.work/backup/` 에 남깁니다.
앞 단계 문서가 뒤 단계보다 나중에 바뀌면 "다시 만들기 권장"이 표시됩니다(웹의 경고와 같습니다).

## 작업 폴더 구조

```
<기획 폴더>/
├─ README.md                  /ph:publish 가 만듦 — 문서 목록·요약·기반 선택
├─ CLAUDE.md                  /ph:publish 가 만듦 — AI 코딩 도구용 개발 안내 (개발 명세서·기반 선택이 있을 때)
├─ docs/
│  ├─ PRD.md                  2단계
│  ├─ FEATURES.md             3단계
│  ├─ FOUNDATION.md           4단계 (확정한 기반)
│  ├─ DESIGN.md               5단계
│  ├─ DEV_SPEC.md             6단계
│  └─ CONSISTENCY.md          일관성 점검
└─ planning/
   ├─ project.json            진행 상태 (이름, 단계, 질문·답, 요약, 기반 선택)
   ├─ input/
   │  ├─ task_definition.md   과제 정의서 — 직접 고쳐도 됩니다
   │  └─ requirements.md      요구사항 — 직접 고쳐도 됩니다
   ├─ foundation-catalog.json (선택) 이 프로젝트만 쓸 기반 카탈로그
   └─ .work/                  AI 에게 넘긴 프롬프트·결과·백업 (저장소에 올라가지 않음)
```

문서 파일이 정본입니다. `docs/` 의 파일을 직접 고쳐도 되고, 고친 내용은 다음 단계 생성에 그대로 쓰입니다.
단, 직접 고친 것은 "다시 만들기 권장" 표시에 잡히지 않으니 뒤 단계는 스스로 판단해 다시 만드세요.

## 웹 서비스와의 관계

- 이 킷은 웹 서비스 없이 혼자 동작합니다. 웹 서비스는 프롬프트의 출처일 뿐, 접속하거나 계정을 만들 필요가 없습니다.
- 프롬프트는 웹 서비스에서 옮겨 왔지만, 지금은 이 저장소에서 따로 관리합니다(웹과 같게 맞추지 않습니다).
- 다른 점
  - AI: 웹은 Amazon Bedrock(Claude Sonnet), 킷은 지금 쓰는 Claude Code 세션의 모델이 직접 작성
  - 저장: 웹은 DB, 킷은 이 폴더의 파일. 버전 기록 대신 `planning/.work/backup/`, 공유 대신 git 저장소
  - 혼자 쓰는 도구입니다 — 그룹 프로젝트·읽기 전용 공유·사용량 한도·관리자 화면은 없습니다
  - 웹의 "원본 링크" 대신 내보낸 문서에는 "planning-helper-kit 으로 생성"이라고 적힙니다

### 기반 카탈로그

기반 선택에 쓰는 카탈로그는 이 저장소에서 관리하는 **일반 AWS 환경 기본 카탈로그(2026-10-16 스냅숏)** 입니다
(`catalog/foundation-catalog.json`). 들어 있는 분류:

| 분류 | 내용 |
|---|---|
| 환경 | AWS 기본 구성 — 서울 리전(ap-northeast-2), GitHub + Actions(OIDC), IaC, Secrets Manager, CloudWatch, ECR |
| 디자인 | [design-lookbook](https://github.com/KORThomasJeong/design-lookbook) 프리셋 16종 |
| 프론트엔드·백엔드 | 기술 스택 |
| 데이터베이스 | RDS PostgreSQL(기본) / DynamoDB / 없음 |
| 로그인 | Cognito(기본) / 자체 아이디·비밀번호 / 없음 |
| 배포 | ECS Fargate(기본) / App Runner / S3 + CloudFront |
| AI | Amazon Bedrock Claude(권장), 외부 AI API |

카탈로그를 바꾸려면:

- **내 프로젝트에만 다른 카탈로그 쓰기** — `catalog/foundation-catalog.json` 을 복사해 고친 뒤
  `planning/foundation-catalog.json` 으로 두면 그것이 우선합니다. 회사·팀 전용 항목을 직접 만들어 넣어도 됩니다
  (형식: 분류 `key` → 항목 `key` → 선택지 `key`).
- **킷 전체 갱신(관리자)** — 이 저장소의 `catalog/foundation-catalog.json` 을 직접 고치고 `snapshot` 날짜와
  이 문서의 날짜를 올려 새 버전으로 배포합니다(`CLAUDE.md` 참고). 이미 있는 `key` 를 바꾸면 기존 사용자의 선택이 깨집니다.

## 필요한 것

| 항목 | 용도 |
|---|---|
| Claude Code | 플러그인 실행 |
| Node.js 18 이상 | 엔진(`scripts/ph.mjs`). 따로 설치할 패키지는 없습니다 |
| git | `/ph:publish` |
| GitHub CLI(`gh`) + `gh auth login` | `/ph:publish` 로 GitHub 에 올릴 때. Windows 설치: `winget install --id GitHub.cli`. 로그인은 `gh auth login` 이 브라우저로 처리합니다 — **토큰을 대화창에 붙여넣지 마세요** |

Windows 에서는 Git for Windows(Git Bash)가 있어야 합니다 — Claude Code 가 셸 명령을 Git Bash 로 실행합니다.

## 문의

- 프롬프트·기획 의도: 원 개발자 juyeon.sim@sk.com
- 킷 운영: AI Innovation (coffee@sk.com) · 이슈는 GitHub Issues(https://github.com/KORThomasJeong/planning-helper-kit/issues)
