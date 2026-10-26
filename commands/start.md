---
description: 새 기획을 시작한다 — 프로젝트명·과제 정의서·요구사항을 받아 명확화 질문까지
argument-hint: "[프로젝트명]"
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:start [프로젝트명]

기획 도우미의 **1단계(입력 & 명확화 질문)** 를 이 폴더에서 한다.
쓰는 사람은 IT 비전문 현업 담당자다. 사용자에게 보이는 말은 **쉬운 한국어**로, 개발 용어(JSON, CLI, 커밋 등)는 쓰지 않는다.

엔진 호출은 항상 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" <서브커맨드>` 이다(아래에서 `PH` 로 줄여 쓴다 —
셸 변수로 만들지 말고 매번 전체 명령을 쓴다). 엔진이 exit 1 이면 stderr 한 줄을 쉬운 말로 바꿔 전하고 멈춘다.

## 0. 이미 시작한 기획이 있는지

```bash
ls planning/project.json 2>/dev/null && node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status
```

- 있으면 새로 만들지 않는다. 진행 현황을 보여 주고 "이어서 하려면 /ph:next, 질문을 다시 만들려면 /ph:questions" 라고 안내하고 멈춘다.
  다른 기획을 새로 하려면 **새 폴더를 만들어 거기서 Claude Code 를 열라**고 안내한다(기획 하나 = 폴더 하나).
- 지금 폴더가 사용자 홈 폴더나 드라이브 최상위(`C:\` 등)처럼 기획 전용 폴더가 아닌 것 같으면, 계속하기 전에
  "이 기획용 새 폴더에서 시작하는 걸 권합니다"라고 한 번 묻는다.

## 1. 입력 받기

`$ARGUMENTS` 가 있으면 그것을 프로젝트명으로 쓴다. 나머지는 한 번에 물어본다(채팅 메시지로 묻고 답을 기다린다):

> 기획을 시작할게요. 아래 세 가지를 알려 주세요.
> 1. **프로젝트명** — 예: 현장 안전 점검 AI 에이전트
> 2. **과제 정의서** (선택) — 수행계획서 내용을 그대로 붙여넣거나, 파일 위치를 알려 주세요(.md .txt .pdf)
> 3. **요구사항** (필수) — 꼭 필요한 기능과 제약을 적어 주세요. 200자 이상이면 결과가 더 좋아요.
>    예: - 핵심 기능 1 / - 핵심 기능 2 / - 제약사항

- 파일 위치를 받으면 Read 로 읽어 내용을 쓴다(.pdf 도 Read 가 읽는다). .docx·.hwp 처럼 못 읽는 형식이면 내용을 복사해 붙여 달라고 한다.
- 요구사항이 비었으면 다시 묻는다. 200자 미만이면 "짧으면 질문이 많아지고 결과가 일반적일 수 있어요"라고 한 번 알리고 그대로 진행해도 된다.

그다음 AskUserQuestion 하나로 관리자 페이지 여부를 묻는다:
- header `관리자 화면`, question "PoC 검증용 관리자 페이지도 개발 명세서에 포함할까요?"
- options: `포함` (결과 확인·사용자 관리 같은 관리자 화면을 별도로 설계합니다) / `포함 안 함`

## 2. 프로젝트 만들기

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" init --name '<프로젝트명>'          # 관리자 페이지 포함이면 끝에 --admin
```

작은따옴표 안에 `'` 가 있으면 `'\''` 로 바꾼다. 그다음 Write 로 입력 파일을 채운다(UTF-8, 받은 내용 그대로 — 고치거나 요약하지 않는다):
- `planning/input/task_definition.md` ← 과제 정의서 (없으면 빈 파일 그대로)
- `planning/input/requirements.md` ← 요구사항

## 3. 명확화 질문 만들기

사용자에게 "질문을 만들고 있어요(30초 정도)"라고 알리고:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt questions` → stdout JSON `{"system","user","out"}` (모두 절대경로).
2. `rm -f planning/.work/questions.gen.txt`
3. 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
4. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save questions planning/.work/questions.gen.txt`
   - 형식이 어긋나 저장이 거부되면 2~4를 **한 번만** 다시 한다. 또 실패하면 "질문을 만들지 못했어요. /ph:questions 로 다시 시도해 주세요"라고 하고 멈춘다.

## 4. 질문에 답 받기

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" questions --json
```

AskUserQuestion 한 번에 질문을 최대 4개까지 묶어 묻는다(보통 2~3개라 한 번이면 된다). 질문마다:
- `header`: `질문 1`, `질문 2` …
- `question`: 질문 문구 그대로
- `options`: 선택지에서 **"직접 입력"을 뺀 나머지**를 문구 그대로 `label` 로(최대 4개 — 넘치면 앞의 4개). "직접 입력"은 넣지 않는다 —
  도구가 자동으로 붙이는 "기타(Other)" 칸이 그 역할을 한다. 남는 선택지가 2개 미만이면 그 질문은 채팅으로 따로 묻는다.
- `multiSelect: false`

답마다 저장한다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" answer <qid> '<답>'
```

- 선택지를 골랐으면 `<답>` 은 **원래 선택지 문구 그대로**(엔진이 선택지와 같은지 비교한다).
- 기타 칸에 직접 쓴 답이면 그 글 그대로.
- 마지막에 `questions` 로 모두 답했는지 확인한다.

## 5. 마무리

짧게 정리한다:

```
기획을 시작했습니다 — <프로젝트명>
- 과제 정의서 <N>자 · 요구사항 <N>자
- 명확화 질문 <N>개 모두 답함
다음: /ph:next  (PRD 를 만듭니다)
```

입력을 나중에 고치고 싶으면 `planning/input/` 의 두 파일을 직접 고치거나 "요구사항에 ○○ 추가해 줘"라고 말하면 된다고 한 줄 덧붙인다.

