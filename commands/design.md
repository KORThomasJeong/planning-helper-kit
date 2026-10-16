---
description: 화면 설계(IA) 문서를 만든다 — 확정한 기반이 반영된다 (5단계)
argument-hint: "[고칠 점 — 있으면 수정 요청으로 처리]"
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:design [고칠 점]

5단계. PRD·기능 정리와 확정한 기반(디자인 레퍼런스 등)을 바탕으로 `docs/DESIGN.md`(화면 구성·메뉴 구조)를 만든다.
사용자에게는 쉬운 한국어로만 말한다. 엔진은 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" …` (매번 전체 명령).

`$ARGUMENTS` 가 있으면 **수정 요청**이다 → `${CLAUDE_PLUGIN_ROOT}/commands/revise.md` 를 Read 해서 단계 `design`, 요청 `$ARGUMENTS` 로 따르고 끝낸다.

## 1. 선행 조건

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

- 기획이 없으면 "/ph:start 로 먼저 시작하세요" 하고 멈춘다.
- 기능 정리가 없으면 "기능 정리가 먼저 있어야 해요 — /ph:features" 하고 멈춘다.
- **기반이 확정되지 않았으면**(막지는 않고 안내만 한다) AskUserQuestion — header `기반 선택`,
  question "기반(디자인·기술)을 아직 확정하지 않았어요. 확정하면 고른 디자인 레퍼런스가 화면 설계에 반영돼요.":
  `기반 먼저 정하기`(→ `${CLAUDE_PLUGIN_ROOT}/commands/foundation.md` 절차를 마친 뒤 여기로 돌아온다) / `그냥 진행`.

## 2. 이미 화면 설계가 있으면

status 경고를 먼저 알린다 — 기능 정리가 더 나중에 바뀌었거나, **기반 선택이 이 문서보다 나중에 바뀌었으면**
"지금 문서는 이전 내용으로 만들어졌어요 — 다시 만드는 걸 권해요".
그다음 AskUserQuestion — header `화면 설계`, question "화면 설계가 이미 있어요(<N>자). 어떻게 할까요?":
`새로 만들기`(지금 문서는 백업) / `고칠 점 알려 주기` / `그대로 두기`.
`고칠 점 알려 주기` → 무엇을 고칠지 묻고 revise.md 절차(단계 `design`)로.

## 3. 생성

"화면 설계를 쓰고 있어요. 2~4분 걸릴 수 있어요." 라고 알린 뒤:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt design` → stdout JSON `{"system","user","out"}` (모두 절대경로). `warnings` 가 있으면 쉬운 말로 알린다. (확정한 기반은 엔진이 user 프롬프트 끝에 붙인다)
2. `rm -f planning/.work/design.gen.txt`.
3. 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
4. `test -s planning/.work/design.gen.txt` 실패 시 한 번만 다시. 또 실패하면 알리고 멈춘다.
5. 백업:
   ```bash
   [ -f docs/DESIGN.md ] && mkdir -p planning/.work/backup && cp docs/DESIGN.md "planning/.work/backup/DESIGN.$(date +%Y%m%d-%H%M%S).md"
   ```
6. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save design planning/.work/design.gen.txt`

## 4. 결과 보여 주기

```bash
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");let f=false;for(const l of s.split(/\r?\n/)){if(/^```/.test(l))f=!f;else if(!f&&/^#{1,3} /.test(l))console.log(l)}console.log("chars="+s.length)' docs/DESIGN.md
```

```
화면 설계를 만들었습니다 — docs/DESIGN.md (<N>자)
목차: <## 제목들, 많으면 앞 10개>
다음: /ph:next  (개발 명세서)
```

개발 명세서가 이미 있었다면 다시 만드는 걸 권한다.

