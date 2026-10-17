// 웹 서비스 "기획 도우미"에서 옮겨 온 프롬프트 — 지금은 이 킷이 정본이다. 고친 뒤 `node --test` 로 확인한다.
// PRD 한 줄 요약. 원본(5dd15d8 app/api/generate/summary/route.ts)에는 시스템 프롬프트가 없다.
/** 원본 `messages[0].content` 템플릿 그대로 (PRD 앞 3000자). */
export function userPrompt(prd) {
    return `아래 PRD를 읽고, 이 서비스를 한 문장(40자 이내)으로 설명하세요. 마크다운 없이 텍스트만 출력하세요.\n\n${prd.slice(0, 3000)}`;
}
