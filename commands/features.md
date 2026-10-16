---
description: 기능 정리 문서를 만든다 — 화면 흐름 다이어그램 포함 (3단계)
argument-hint: "[고칠 점 — 있으면 수정 요청으로 처리]"
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# /ph:features [고칠 점]

3단계. PRD 를 바탕으로 `docs/FEATURES.md` 를 만든다. 기능별 처리 흐름이 mermaid 시퀀스 다이어그램으로 들어간다.
사용자에게는 쉬운 한국어로만 말한다. 엔진은 Bash 로 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" …` (매번 전체 명령).

`$ARGUMENTS` 가 있으면 **수정 요청**이다 → `${CLAUDE_PLUGIN_ROOT}/commands/revise.md` 를 Read 해서 단계 `features`, 요청 `$ARGUMENTS` 로 따르고 끝낸다.

## 1. 선행 조건

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status --json
```

- 기획이 없으면 "/ph:start 로 먼저 시작하세요" 하고 멈춘다.
- PRD 가 없으면 "PRD 가 먼저 있어야 해요 — /ph:prd" 하고 멈춘다.

## 2. 이미 기능 정리가 있으면

PRD 가 기능 정리보다 나중에 바뀌었다는 경고가 있으면 먼저 알린다("PRD 가 바뀌어서 다시 만드는 걸 권해요").
그다음 AskUserQuestion — header `기능 정리`, question "기능 정리가 이미 있어요(<N>자). 어떻게 할까요?":
`새로 만들기`(지금 문서는 백업) / `고칠 점 알려 주기` / `그대로 두기`.
`고칠 점 알려 주기` → 무엇을 고칠지 묻고 revise.md 절차(단계 `features`)로.

## 3. 생성

"기능 정리를 쓰고 있어요. 2~4분 걸릴 수 있어요." 라고 알린 뒤:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" prompt features` → stdout JSON `{"system","user","out"}` (모두 절대경로). `warnings` 가 있으면 쉬운 말로 알린다.
2. `rm -f planning/.work/features.gen.txt`.
3. 작성 — **이 세션이 직접 쓴다**(서브에이전트에 맡기지 않는다):
   - Read 로 JSON 의 `system` 파일과 `user` 파일을 읽는다. system 내용이 이번 작성의 역할·규칙·출력 형식이다(빈 파일이면 없음). 앞선 대화 내용은 섞지 않는다.
   - user 내용에 대한 응답 **본문만** Write 로 JSON 의 `out` 파일에 쓴다. 머리말·맺음말·설명을 붙이지 않고, 전체를 코드펜스로 감싸지 않는다(본문 안의 ```mermaid 등은 형식대로). JSON 만 내라고 하면 JSON 만 쓴다.
   - 쓴 뒤에는 본문을 고치지 않는다(오타·표현 포함). 그대로 저장 단계로 넘긴다.
4. `test -s planning/.work/features.gen.txt` 실패 시 한 번만 다시. 또 실패하면 알리고 멈춘다.
5. 백업:
   ```bash
   [ -f docs/FEATURES.md ] && mkdir -p planning/.work/backup && cp docs/FEATURES.md "planning/.work/backup/FEATURES.$(date +%Y%m%d-%H%M%S).md"
   ```
6. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" save features planning/.work/features.gen.txt`

## 4. 결과 보여 주기

```bash
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");let f=false,m=0;for(const l of s.split(/\r?\n/)){if(/^```mermaid/.test(l))m++;if(/^```/.test(l))f=!f;else if(!f&&/^#{1,3} /.test(l))console.log(l)}console.log("chars="+s.length+" mermaid="+m)' docs/FEATURES.md
```

```
기능 정리를 만들었습니다 — docs/FEATURES.md (<N>자, 흐름 다이어그램 <M>개)
목차: <## 제목들, 많으면 앞 10개>
다음: /ph:next  (기반 선택 — 어떤 디자인·기술로 만들지 고릅니다)
```

다이어그램은 GitHub 에 올리면 그림으로 보이고, VS Code 에서는 mermaid 미리보기 확장으로 볼 수 있다고 한 줄 안내한다.
뒤 단계 문서가 이미 있었다면 다시 만드는 걸 권한다.

