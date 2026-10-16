---
description: 다음 단계 하나를 진행한다 — 지금 어디까지 했는지 보고 알아서 이어 간다
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:next

기획 흐름에서 **다음 단계 하나만** 실행한다. 사용자는 순서를 몰라도 `/ph:next` 만 반복하면 된다.
사용자에게는 쉬운 한국어로만 말한다.

## 1. 어디까지 했는지

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

`planning/project.json` 이 없으면(엔진 오류) "아직 시작한 기획이 없어요 — /ph:start 로 시작하세요" 하고 멈춘다.

## 2. 다음 단계 고르기

엔진이 `current_step` 과 산출물을 보고 정한 `next.action` 을 따른다(앞 단계가 빠져 있으면 엔진이 그 단계를 고른다):

| `next.action` | 단계 | 따를 절차 (`${CLAUDE_PLUGIN_ROOT}/` 기준) |
|---|---|---|
| `input` | 요구사항 입력 | `commands/questions.md` (요구사항부터 받는다) |
| `questions`, `answer` | 1. 명확화 질문 | `commands/questions.md` |
| `prd` | 2. PRD | `commands/prd.md` |
| `summary` | PRD 한 줄 요약만 | `commands/prd.md` 의 **4절만** |
| `features` | 3. 기능 정리 | `commands/features.md` |
| `foundation` | 4. 기반 선택 | `commands/foundation.md` |
| `design` | 5. 화면 설계 | `commands/design.md` |
| `dev` | 6. 개발 명세서 | `commands/dev.md` |
| `check` | 일관성 점검 | `commands/check.md` |
| `publish` | 모두 끝남 | 아래 3절 |

"이번에는 <단계>를 할게요" 라고 한 줄 알리고, 그 파일을 Read 해서 **그 절차를 처음부터 그대로** 따른다.
그 파일에 쓰인 `$ARGUMENTS` 는 비어 있는 것으로 본다(수정 요청 없음). 여기서 절차를 따로 요약하거나 줄이지 않는다.

## 3. 모두 끝났을 때 (`publish`)

`warnings` 에 "앞 단계가 바뀜" 경고가 남아 있으면 그 문서를 다시 만들지 먼저 묻는다
(AskUserQuestion: `다시 만들기` → 해당 단계 절차 / `그대로 두기`).
경고가 없으면 자동으로 올리지 말고 안내만 한다:

```
6단계를 모두 마쳤어요.
- 저장소에 올리기: /ph:publish
- 문서 고치기: /ph:revise <prd|features|design|dev> <고칠 점>
- 다시 점검: /ph:check
```

## 4. 단계가 끝난 뒤

실행한 절차의 결과 요약(제목 목록·글자 수)을 보여 준 다음, `status --json` 을 한 번 더 보고
`다음: /ph:next  (<next.message 를 쉬운 말로>)` 로 끝낸다. 한 번에 두 단계를 연달아 실행하지 않는다.
