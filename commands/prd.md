---
description: PRD(제품 요구사항 문서)를 만든다 — 한 줄 요약도 함께 (2단계)
argument-hint: "[고칠 점 — 있으면 수정 요청으로 처리]"
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:prd [고칠 점]

2단계. 과제 정의서·요구사항·질문 답을 바탕으로 `docs/PRD.md` 를 만들고, 이어서 한 줄 요약을 만든다.
사용자에게는 쉬운 한국어로만 말한다. 엔진은 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" …` (매번 전체 명령).

`$ARGUMENTS` 가 있으면 **수정 요청**이다 → `${CLAUDE_PLUGIN_ROOT}/commands/revise.md` 를 Read 해서 단계 `prd`, 요청 `$ARGUMENTS` 로 그 절차를 따르고 끝낸다.

## 1. 선행 조건

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

- 기획이 없으면 "/ph:start 로 먼저 시작하세요" 하고 멈춘다.
- 요구사항이 비었으면 멈추고 요구사항부터 받는다(`planning/input/requirements.md`).
- 답하지 않은 질문이 있으면 AskUserQuestion — `먼저 답하기`(→ /ph:questions 절차) / `그냥 진행`.

## 2. 이미 PRD 가 있으면

앞 단계(입력·질문)가 PRD 보다 나중에 바뀌었다는 경고가 status 에 있으면 그것부터 알린다.
그다음 AskUserQuestion — header `PRD`, question "PRD 가 이미 있어요(<N>자). 어떻게 할까요?":
- `새로 만들기` — 처음부터 다시 씁니다. 지금 문서는 백업해 둡니다
- `고칠 점 알려 주기` — 지금 문서를 바탕으로 원하는 부분만 고칩니다
- `그대로 두기`

`고칠 점 알려 주기` → 무엇을 고칠지 묻고 revise.md 절차(단계 `prd`)로. `그대로 두기` → 멈춘다.

## 3. 생성

"PRD 를 쓰고 있어요. 1~3분 걸릴 수 있어요." 라고 알린 뒤:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt prd` → stdout JSON `{"system","user","out"}` (모두 절대경로). `warnings` 가 있으면 쉬운 말로 알린다.
2. `rm -f planning/.work/prd.gen.txt`.
3. 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
4. `test -s planning/.work/prd.gen.txt` 가 실패하면 2~3을 한 번만 다시. 또 실패하면 알리고 멈춘다.
5. 기존 문서 백업:
   ```bash
   [ -f docs/PRD.md ] && mkdir -p planning/.work/backup && cp docs/PRD.md "planning/.work/backup/PRD.$(date +%Y%m%d-%H%M%S).md"
   ```
6. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save prd planning/.work/prd.gen.txt`

## 4. 한 줄 요약 (PRD 를 저장할 때마다)

PRD 가 바뀌면 요약도 다시 만든다.

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt summary` — 요약은 시스템 프롬프트가 없어 `system` 파일이 비어 있다.
2. `rm -f planning/.work/oneline.gen.txt` 후 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
3. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save summary planning/.work/oneline.gen.txt`
   요약이 실패해도 PRD 는 이미 저장됐다 — "요약은 나중에 /ph:prd 를 다시 하면 만들어집니다" 정도로만 알린다.

## 5. 결과 보여 주기

```bash
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");let f=false;for(const l of s.split(/\r?\n/)){if(/^```/.test(l))f=!f;else if(!f&&/^#{1,3} /.test(l))console.log(l)}console.log("chars="+s.length)' docs/PRD.md
```

```
PRD 를 만들었습니다 — docs/PRD.md (<N>자)
요약: <한 줄 요약>
목차: <## 제목들을 한 줄씩, 많으면 앞 10개>
다음: /ph:next  (기능 정리)
```

뒤 단계 문서(기능 정리 등)가 이미 있었다면 "PRD 가 바뀌었으니 뒤 단계도 다시 만드는 걸 권합니다"라고 덧붙인다.

