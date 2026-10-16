// 자동 생성 — tools/port-from-web.mjs 가 planning-helper/lib/prompts/summary.ts 에서 타입만 제거했다. 직접 고치지 말 것.
// PRD 한 줄 요약. 원본(5dd15d8 app/api/generate/summary/route.ts)에는 시스템 프롬프트가 없다.
// userPrompt 는 원본과 한 글자도 다르면 안 된다. 검증: npx -y tsx scripts/verify-prompts.mjs
/** 원본 `messages[0].content` 템플릿 그대로 (PRD 앞 3000자). */
export function userPrompt(prd) {
    return `아래 PRD를 읽고, 이 서비스를 한 문장(40자 이내)으로 설명하세요. 마크다운 없이 텍스트만 출력하세요.\n\n${prd.slice(0, 3000)}`;
}
