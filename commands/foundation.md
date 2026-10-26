---
description: 기반 선택 — 어떤 디자인·기술·배포 방식으로 만들지 AI 추천을 받아 확정한다 (4단계)
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:foundation

4단계. **기반 카탈로그**(디자인 레퍼런스·기술 스택·인증·배포 방식 등)에서 이 서비스에 맞는 것을 고른다.
고른 내용은 화면 설계·개발 명세서를 만들 때 AI 에게 함께 전달되고, 내보낸 `README.md`·`CLAUDE.md` 에 참조 링크로 들어간다.

쓰는 사람은 현업 담당자다. "프론트엔드·백엔드" 같은 분류 이름은 카탈로그 그대로 보여 주되,
**"잘 모르시면 AI 추천 그대로 확정해도 됩니다. 개발 담당자가 나중에 바꿀 수 있어요"** 라고 안심시킨다.
엔진은 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" …` (매번 전체 명령).

## 1. 선행 조건

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

- 기획이 없으면 "/ph:start 로 먼저 시작하세요" 하고 멈춘다.
- PRD 가 없으면 "PRD 가 먼저 있어야 추천할 수 있어요 — /ph:prd" 하고 멈춘다.
- 기능 정리가 없으면 "기능 정리까지 있으면 추천이 더 정확해요(/ph:features)" 라고 알리고 AskUserQuestion `먼저 기능 정리` / `그냥 진행`.

## 2. 이미 기반을 골랐으면

`foundation list` 로 지금 선택을 보여 준 뒤 AskUserQuestion — header `기반 선택`, question "이미 고른 기반이 있어요<확정됨이면 '(확정됨)'>. 어떻게 할까요?":
- `그대로 두기` — (확정 전이면 이 선택으로 확정까지 진행 → 5절)
- `AI 추천 다시 받기` → 3절
- `직접 고치기` → 4절

## 3. AI 추천 받기

"PRD·기능 정리를 읽고 어울리는 기반을 고르고 있어요(1분 정도)" 라고 알린 뒤:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt foundation` → stdout JSON `{"system","user","out"}` (모두 절대경로). `warnings` 가 있으면 쉬운 말로 알린다.
2. `rm -f planning/.work/foundation.gen.txt`. 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
3. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save foundation planning/.work/foundation.gen.txt`
   - 형식 오류로 거부되면 2~3을 한 번만 다시. 또 실패하면 `foundation default`(카탈로그 기본값)로 채우고 "AI 추천 대신 기본값을 넣었어요"라고 알린다.
4. 추천을 보여 준다. `foundation list --json` 의 `categories[].items[]` 중 `selected` 인 것(고른 선택지는 `options[].selected`), 항목별 `reason`, 전체 요약 `recommendation.summary` 를 쓴다:

   ```
   AI 추천 — <요약 1~2문장>

   | 분류 | 고른 것 | 이유 |
   | 디자인 레퍼런스 | <항목명> — <선택지 이름> | <이유 한 문장> |
   ...
   ```
   `recommendation.dropped`(카탈로그에 없어 버린 값)는 한 줄로만 알린다. `recommendation.issues`(필수 분류 누락 등 규칙 위반)가 있으면 5절에서 함께 고친다고 미리 알린다.

## 4. 확정 또는 고치기

AskUserQuestion — header `확정`, question "이대로 확정할까요?":
- `이대로 확정` → 5절
- `일부 바꾸기` — 바꿀 곳을 말로 알려 주세요 (예: "디자인을 좀 더 밝은 걸로", "로그인은 Cognito 로")
- `기본값으로` — 카탈로그 기본 선택으로 되돌립니다

`일부 바꾸기`:
- `foundation list --json` 으로 카탈로그(분류 → 항목 → 선택지, 설명 포함)를 읽고, 사용자 말에 맞는 `item_id`·선택지 key 를 찾는다.
- 후보가 여럿이면 AskUserQuestion 으로 고르게 한다(선택지 최대 4개 — 그 이상이면 설명이 가장 가까운 3~4개를 보여 주고 나머지는 "기타"에 이름을 쓰게 한다. 디자인 룩북처럼 선택지가 많으면 특히 그렇게 한다). label 은 카탈로그 이름, description 은 카탈로그 설명 한 줄.
- 반영:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" foundation pick <item_id> [opt1,opt2]
  node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" foundation unpick <item_id>
  ```
  한 개만 고르는 분류는 pick 이 같은 분류의 기존 항목을 바꿔 준다.
- 바뀐 선택을 다시 보여 주고 이 4절을 반복한다.

`기본값으로` → `foundation default` 후 선택을 보여 주고 4절 반복.

## 5. 확정

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" foundation validate
```

문제가 나오면(exit 1) 쉬운 말로 바꿔 보여 주고("배포 방식을 하나 골라야 해요" 등) 4절로 돌아가 같이 고친다.
필수 분류를 조용히 임의로 채우지 않는다 — 사용자에게 고르게 하거나, AI 추천 이유를 들어 제안하고 동의를 받는다.

통과하면:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" foundation confirm
```

## 6. 결과

```
기반을 확정했습니다 — docs/FOUNDATION.md
<분류: 고른 것 — 한 줄씩>
다음: /ph:next  (화면 설계)
```

화면 설계·개발 명세서가 **이미 있으면**: "기반이 바뀌었으니 화면 설계(/ph:design)·개발 명세서(/ph:dev)를 다시 만드는 걸 권해요."

