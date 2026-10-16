---
description: 기획 도우미 킷 사용법 — 커맨드 목록과 진행 순서
allowed-tools: Bash
---

# /ph:help

아래 내용을 그대로 보여 준다. 끝에 지금 폴더의 진행 상황을 한 줄 덧붙인다
(`planning/project.json` 이 있으면 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status` 의 "다음 할 일" 한 줄, 없으면 "이 폴더에서 /ph:start 로 시작하세요").

```
기획 도우미 킷 — 과제 정의서와 요구사항만 있으면 기획 문서 6종을 차례로 만들어 드려요.

처음이라면:  /ph:start  →  /ph:next  를 반복  →  /ph:check  →  /ph:publish

진행 순서
  1. 입력·명확화 질문   /ph:start (처음) · /ph:questions (답 고치기·질문 새로 만들기)
  2. PRD                /ph:prd       docs/PRD.md
  3. 기능 정리          /ph:features  docs/FEATURES.md
  4. 기반 선택          /ph:foundation  디자인·기술·배포 방식을 AI 추천 받아 확정
  5. 화면 설계          /ph:design    docs/DESIGN.md
  6. 개발 명세서        /ph:dev       docs/DEV_SPEC.md
  +  일관성 점검        /ph:check     docs/CONSISTENCY.md
  +  저장소에 올리기    /ph:publish   GitHub 저장소로 올리기

언제든 쓰는 것
  /ph:next                    다음 단계 하나를 알아서 진행
  /ph:status                  어디까지 했는지, 다시 만들 문서가 있는지
  /ph:revise <단계> <고칠 점>  만든 문서를 원하는 대로 고치기
                              예) /ph:revise prd 성공 기준에 처리 시간 목표를 넣어 줘
  /ph:prd <고칠 점>           단계 커맨드에 고칠 점을 붙여도 같은 뜻

알아 두면 좋은 것
  - 기획 하나 = 폴더 하나. 새 기획은 새 폴더에서 시작하세요.
  - 앞 단계 문서를 고치면 뒤 단계에 "다시 만들기 권장"이 표시돼요.
  - 문서를 다시 만들거나 고치면 이전 버전은 planning/.work/backup/ 에 남아요.
  - 입력(과제 정의서·요구사항)은 planning/input/ 의 파일을 직접 고쳐도 돼요.
```
