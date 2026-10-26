---
description: 기획 진행 현황 — 단계별 완료 여부, 글자 수, 다시 만들어야 할 문서, 다음 할 일
allowed-tools: Bash, Read
---

# /ph:status

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ph.mjs" status
```

- `planning/project.json` 이 없으면 "이 폴더에는 아직 기획이 없어요 — /ph:start 로 시작하세요" 라고만 한다.
- 엔진 출력을 그대로 붙이지 말고 쉬운 표로 다시 보여 준다(엔진이 이미 표로 주면 그대로 써도 된다):

```
<프로젝트명>  — <한 줄 요약(있으면)>

| 단계 | 상태 | 파일 |
| 1. 입력·명확화 질문 | 완료 (질문 3개 답함) | planning/input/ |
| 2. PRD | 완료 · 8,210자 | docs/PRD.md |
| 3. 기능 정리 | 다시 만들기 권장 — PRD 가 더 나중에 바뀜 | docs/FEATURES.md |
| 4. 기반 선택 | 확정 전 | docs/FOUNDATION.md |
| 5. 화면 설계 | 아직 | |
| 6. 개발 명세서 | 아직 | |
| 일관성 점검 | 아직 | docs/CONSISTENCY.md |

다음: /ph:next  (<무엇을 하는지 한마디>)
```

"앞 단계가 바뀜" 경고가 있으면 해당 단계 커맨드(`/ph:features` 등)로 다시 만들 수 있다고 덧붙인다.
