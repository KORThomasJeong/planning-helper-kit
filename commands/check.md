---
description: 문서 일관성 점검 — 문서끼리 빠진 것·어긋난 것·모호한 표현을 찾아 점수와 함께 보여 준다
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:check

과제 정의서·요구사항·PRD·기능 정리·기반 선택·화면 설계·개발 명세서를 서로 대조해 `docs/CONSISTENCY.md` 를 만든다.
없는 문서는 결함으로 세지 않고 "문서 없음"으로 표시된다. 사용자에게는 쉬운 한국어로만 말한다.
엔진은 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" …` (매번 전체 명령).

## 1. 선행 조건

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

- 기획이 없으면 "/ph:start 로 먼저 시작하세요" 하고 멈춘다.
- PRD 가 없으면 "점검할 문서가 아직 없어요 — /ph:next" 하고 멈춘다.
- 아직 없는 단계가 있으면 "지금 있는 문서끼리만 점검해요(없는 문서: ○○)"라고 한 줄 알린다.
- 이전 점검 결과가 있으면 따로 묻지 않고 새로 점검한다(이전 것은 백업).

## 2. 점검

"문서들을 서로 맞춰 보고 있어요. 2~4분 걸릴 수 있어요." 라고 알린 뒤:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt consistency` → stdout JSON `{"system","user","out"}` (모두 절대경로). `warnings` 가 있으면 쉬운 말로 알린다.
2. `rm -f planning/.work/consistency.gen.txt`. 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
3. `test -s` 실패 시 한 번만 다시. 백업 후 저장:
   ```bash
   [ -f docs/CONSISTENCY.md ] && mkdir -p planning/.work/backup && cp docs/CONSISTENCY.md "planning/.work/backup/CONSISTENCY.$(date +%Y%m%d-%H%M%S).md"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save consistency planning/.work/consistency.gen.txt
   ```

## 3. 결과 보여 주기

`docs/CONSISTENCY.md` 를 Read 해서 아래만 뽑아 보여 준다(보고서 전체를 붙여넣지 않는다):

```
점검 결과 — <양호 / 보완 필요 / 재작성 필요> · <점수>/100
<판정 이유 한 줄>

- 빠진 기능(커버리지 표의 ❌): <N>개   일부만 반영(⚠️): <N>개
- 누락 <N>건 · 어긋남 <N>건 · 모호한 표현 <N>건

먼저 고칠 것 (권장 조치 상위 3개)
1. ...
2. ...
3. ...

전체 보고서: docs/CONSISTENCY.md
```

## 4. 고치기 안내

권장 조치마다 바로 쓸 수 있는 커맨드로 바꿔 보여 준다. 예:
`/ph:revise features 'PRD 의 알림 기능이 빠졌어요 — 기능 정리에 추가해 줘'`

그다음 AskUserQuestion — header `다음`, question "지금 고칠까요?":
- `1번부터 고치기` — 권장 조치 1번을 `${CLAUDE_PLUGIN_ROOT}/commands/revise.md` 절차로 바로 반영합니다
- `나중에` — 보고서만 남겨 둡니다

`1번부터 고치기`면 한 건씩 반영하고, 건마다 계속할지 묻는다. 다 고쳤으면 "/ph:check 로 다시 점검해 보세요".
점수가 괜찮으면 `다음: /ph:publish (저장소에 올리기)` 를 안내한다.

