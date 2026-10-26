---
description: 개발 명세서를 만든다 — 개발자·AI 코딩 도구가 바로 구현할 수 있는 수준 (6단계)
argument-hint: "[고칠 점 — 있으면 수정 요청으로 처리]"
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:dev [고칠 점]

6단계. 앞 단계 문서 전부와 확정한 기반을 바탕으로 `docs/DEV_SPEC.md` 를 만든다.
시작할 때 "관리자 페이지 포함"을 골랐다면 관리자 페이지가 따로 들어간다.
사용자에게는 쉬운 한국어로만 말한다. 엔진은 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" …` (매번 전체 명령).

`$ARGUMENTS` 가 있으면 **수정 요청**이다 → `${CLAUDE_PLUGIN_ROOT}/commands/revise.md` 를 Read 해서 단계 `dev`, 요청 `$ARGUMENTS` 로 따르고 끝낸다.

## 1. 선행 조건

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

- 기획이 없으면 "/ph:start 로 먼저 시작하세요" 하고 멈춘다.
- 화면 설계가 없으면 "화면 설계가 먼저 있어야 해요 — /ph:design" 하고 멈춘다.
- **기반이 확정되지 않았으면** AskUserQuestion — header `기반 선택`,
  question "기반(디자인·기술·배포)을 아직 확정하지 않았어요. 확정하면 고른 기술 스택·배포 방식이 개발 명세서에 반영돼요.":
  `기반 먼저 정하기`(→ `${CLAUDE_PLUGIN_ROOT}/commands/foundation.md` 절차를 마친 뒤 여기로) / `그냥 진행`.
- 관리자 페이지 포함 여부를 한 줄로 보여 준다. 바꾸고 싶다고 하면
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" set needs_admin_page true|false`.

## 2. 이미 개발 명세서가 있으면

status 경고를 먼저 알린다 — 화면 설계가 더 나중에 바뀌었거나 **기반 선택이 이 문서보다 나중에 바뀌었으면**
"지금 문서는 이전 내용으로 만들어졌어요 — 다시 만드는 걸 권해요".
그다음 AskUserQuestion — header `개발 명세서`, question "개발 명세서가 이미 있어요(<N>자). 어떻게 할까요?":
`새로 만들기`(지금 문서는 백업) / `고칠 점 알려 주기` / `그대로 두기`.
`고칠 점 알려 주기` → 무엇을 고칠지 묻고 revise.md 절차(단계 `dev`)로.

## 3. 생성

"개발 명세서를 쓰고 있어요. 가장 긴 문서라 3~6분 걸릴 수 있어요." 라고 알린 뒤:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt dev` → stdout JSON `{"system","user","out"}` (모두 절대경로). `warnings` 가 있으면 쉬운 말로 알린다.
2. `rm -f planning/.work/dev.gen.txt`.
3. 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
4. `test -s planning/.work/dev.gen.txt` 실패 시 한 번만 다시. 또 실패하면 알리고 멈춘다.
5. 백업:
   ```bash
   [ -f docs/DEV_SPEC.md ] && mkdir -p planning/.work/backup && cp docs/DEV_SPEC.md "planning/.work/backup/DEV_SPEC.$(date +%Y%m%d-%H%M%S).md"
   ```
6. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save dev planning/.work/dev.gen.txt`

## 4. 결과 보여 주기

```bash
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");let f=false;for(const l of s.split(/\r?\n/)){if(/^```/.test(l))f=!f;else if(!f&&/^#{1,2} /.test(l))console.log(l)}console.log("chars="+s.length)' docs/DEV_SPEC.md
```

```
개발 명세서를 만들었습니다 — docs/DEV_SPEC.md (<N>자)
목차: <# · ## 제목들, 많으면 앞 12개>
다음: /ph:check  (문서끼리 빠진 것·어긋난 것 점검)  →  /ph:publish  (저장소에 올리기)
```

문서 끝이 중간에 끊긴 것처럼 보이면(마지막 줄이 문장 중간, 닫히지 않은 코드블록) 알리고
"/ph:revise dev 빠진 뒷부분을 이어서 완성해 줘" 처럼 나눠 보완하는 방법을 안내한다.

