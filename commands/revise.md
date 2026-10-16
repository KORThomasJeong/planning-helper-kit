---
description: 이미 만든 문서를 원하는 대로 고친다 (PRD·기능 정리·화면 설계·개발 명세서)
argument-hint: "<prd|features|design|dev> <고칠 점>"
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:revise <단계> <고칠 점>

지금 문서를 바탕으로 요청한 부분을 고친 새 버전을 만든다(처음부터 다시 쓰는 게 아니다).
사용자에게는 쉬운 한국어로만 말한다. 엔진은 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" …` (매번 전체 명령).

## 1. 인자 해석

`$ARGUMENTS` 의 첫 낱말이 단계, 나머지가 고칠 점이다. 단계는 아래 이름을 모두 받는다:

| 단계 | 받는 이름 | 문서 |
|---|---|---|
| `prd` | prd, PRD, 기획서 | `docs/PRD.md` |
| `features` | features, 기능, 기능정리 | `docs/FEATURES.md` |
| `design` | design, 화면, 화면설계, IA | `docs/DESIGN.md` |
| `dev` | dev, 개발, 개발명세, 개발명세서 | `docs/DEV_SPEC.md` |

- 단계를 알 수 없으면 AskUserQuestion(header `어느 문서`)으로 네 문서 중 고르게 한다.
- 고칠 점이 비었으면 "어떻게 고칠까요? 예: '목표 수치를 더 구체적으로', '알림 기능 빼 줘'" 라고 묻고 답을 기다린다.
- 다른 커맨드(/ph:prd 등)에서 단계와 요청을 넘겨받아 왔으면 이 절은 건너뛴다.

## 2. 선행 조건

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

그 문서가 아직 없으면 "고칠 문서가 아직 없어요 — /ph:<단계> 로 먼저 만드세요" 하고 멈춘다.

## 3. 수정본 만들기

1. 요청 글을 Write 로 `planning/.work/revise-<단계>.txt` 에 그대로 쓴다(UTF-8. 다듬거나 덧붙이지 않는다).
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt <단계> --revise planning/.work/revise-<단계>.txt` → stdout JSON `{"system","user","out"}` (모두 절대경로). `warnings` 가 있으면 쉬운 말로 알린다.
   (엔진이 지금 문서 파일을 current_content 로 넣어 수정 모드 프롬프트를 만든다)
3. "요청하신 대로 고치고 있어요. 1~4분 걸릴 수 있어요." 알리고, `rm -f planning/.work/<단계>.gen.txt` 후
   작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
4. `test -s planning/.work/<단계>.gen.txt` 실패 시 한 번만 다시. 또 실패하면 알리고 멈춘다.
5. 백업 후 저장:
   ```bash
   mkdir -p planning/.work/backup && cp docs/<문서>.md "planning/.work/backup/<문서>.$(date +%Y%m%d-%H%M%S).md"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save <단계> planning/.work/<단계>.gen.txt
   ```
6. 단계가 `prd` 면 `${CLAUDE_PLUGIN_ROOT}/commands/prd.md` 의 **4절(한 줄 요약)** 도 한다.

## 4. 결과

```bash
git diff --no-index --stat "$(ls -t planning/.work/backup/<문서>.*.md | head -1)" docs/<문서>.md
```

```
<문서명>을 고쳤습니다 — docs/<문서>.md (<이전 글자수> → <새 글자수>자)
바뀐 곳: <바뀐 ## 제목들 또는 한두 줄 요약>
이전 버전: planning/.work/backup/<문서>.<시각>.md
```

뒤 단계 문서가 있으면 "앞 문서가 바뀌었으니 뒤 단계도 다시 만들거나 /ph:check 로 어긋난 곳을 확인해 보세요"라고 덧붙인다.
결과가 마음에 들지 않으면 "되돌려 줘"라고 하면 된다고 알려 준다. 되돌릴 때는 복사가 아니라
`node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save <단계> <백업 파일>` 로 저장한다(진행 기록·시각이 같이 맞춰진다).

