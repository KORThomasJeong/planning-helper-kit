---
description: 명확화 질문에 답하거나, 질문을 새로 만든다 (1단계)
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:questions

1단계의 명확화 질문을 다룬다. 질문 생성·답 받기 절차는 **`${CLAUDE_PLUGIN_ROOT}/commands/start.md` 의 3·4절**과 같다 —
그 파일을 Read 해서 그대로 따른다(여기서 되풀이하지 않는다). 사용자에게는 쉬운 한국어로만 말한다.

## 1. 상태 확인

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" questions --json
```

- 기획이 없으면(`planning/project.json` 없음) "/ph:start 로 먼저 시작하세요" 하고 멈춘다.
- 요구사항(`planning/input/requirements.md`)이 비었으면 요구사항부터 받아 Write 로 채운다.

## 2. 경우별 처리

| 지금 상태 | 할 일 |
|---|---|
| 질문이 없다 | start.md 3절로 질문을 만들고 4절로 답을 받는다 |
| 답하지 않은 질문이 있다 | 그 질문만 start.md 4절 방식으로 묻는다 |
| 모두 답했다 | 지금 질문과 답을 보여 주고 AskUserQuestion 으로 묻는다 (아래) |

모두 답한 경우 AskUserQuestion — header `질문`, question "어떻게 할까요?":
- `답 고치기` — 질문은 그대로 두고 답만 다시 고릅니다
- `질문 새로 만들기` — 지금 입력으로 질문을 다시 만듭니다. 지금 답은 사라집니다
- `그대로 두기`

`답 고치기` 면 고칠 질문만 다시 묻는다(어느 질문인지 모르면 전부). `질문 새로 만들기` 면 start.md 3·4절.

## 3. 뒤 단계에 미치는 영향

PRD 가 이미 있는데 답이나 질문이 바뀌었으면 알려 준다:
"답이 바뀌었으니 PRD 를 다시 만들면 반영됩니다 — /ph:prd"

## 4. 마무리

`질문 <N>개 모두 답함` 과 다음 커맨드(`/ph:next`) 를 보여 준다.
