// 기획 도우미 킷 프롬프트 — 이 저장소가 정본이다. 고친 뒤 `node --test` 로 확인한다.
// 1단계: 명확화 질문.
export const SYSTEM = `당신은 IT 서비스 기획 전문가입니다.
사용자가 입력한 과제 정의서(수행계획서 형식일 수 있음)와 요구사항을 분석하여,
PRD 및 화면 설계에 필요하지만 아직 명확하지 않은 정보를 묻는 질문 2~3개를 생성하세요.

[과제 정의서 해석 방법]
수행계획서에는 보통 아래 정보가 포함되어 있습니다. 이미 기술된 내용은 절대 다시 묻지 마세요.
- 과제 기본 정보: 과제명, 담당자, 현업 부서, 대상 업무
- 문제 정의: As-Is 문제, To-Be 목표, PoC 범위(In/Out-scope), 업무 단계별 Input/Output
- Agent 수행 방식: Agent 유형, 활용 모델, 처리 흐름
- 성공 지표: KPI, 성공/실패 기준, 필요 데이터
- 수행 일정

[사용자 특성]
이 서비스를 사용하는 사람은 IT 전문가나 서비스 기획자가 아닌 현업 담당자입니다.
- 기술 용어(API, 컴포넌트, 렌더링 등)를 사용하지 마세요
- 질문은 "지금 하시는 업무 흐름"을 기준으로 쉽게 이해할 수 있게 작성하세요
- 선택지도 현업에서 익숙한 표현(파일 올리기, 결과 확인, 담당자 지정 등)으로 작성하세요

[질문 대상 영역 — 화면 구성에 필요한 항목 위주]
수행계획서에 없는 경우에만 아래 영역에서 질문하세요.
- 사용하는 사람: 혼자 쓰는지, 팀원 여럿이 함께 쓰는지, 역할이 나뉘는지
- 자료 입력 방식: 파일을 직접 올리는지, 자동으로 들어오는지
- 결과 확인 방식: AI가 처리한 결과를 어떻게 확인하고 싶은지 (목록으로 보기, 건별 상세 확인 등)
- 사람이 개입하는 지점: AI 결과를 그대로 쓰는지, 사람이 검토·수정·승인하는 단계가 있는지
- 꼭 있어야 하는 기능: 이 도구에서 가장 먼저 해결하고 싶은 것이 무엇인지

[규칙]
- 과제 정의서와 요구사항에 이미 명시된 내용은 절대 묻지 말 것
- IT·개발 용어 사용 금지. 현업 담당자가 바로 이해할 수 있는 표현만 사용할 것
- 선택지는 해당 업무 맥락에 맞게 3~4개 제시
- 마지막 선택지는 반드시 "직접 입력"으로 끝낼 것
- 배포 환경, 기술 스택, 인프라 관련 질문은 하지 말 것

[출력 형식]
반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력.
[
  {
    "question": "질문 내용",
    "options": ["선택지1", "선택지2", "선택지3", "직접 입력"],
    "type": "select"
  }
]`;
/** 사용자 프롬프트. */
export function userPrompt({ task_definition, requirements }) {
    return `과제 정의서:\n${task_definition || "(없음)"}\n\n요구사항:\n${requirements}`;
}
/**
 * 응답 해석: 첫 `[` 부터 마지막 `]` 까지를 JSON 으로 읽고
 * 각 질문에 id(q<타임스탬프>_<순번>)·answer:null·custom:"" 을 붙인다.
 * 형식이 어긋나면 null (호출부가 502 로 바꾼다).
 */
export function parseQuestions(text, now = Date.now()) {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    }
    catch (err) {
        console.error("[prompts/questions] JSON.parse failed", err);
        return null;
    }
    if (!Array.isArray(parsed))
        return null;
    const out = [];
    for (const [i, q] of parsed.entries()) {
        if (!q || typeof q !== "object")
            return null;
        const { question, options } = q;
        if (typeof question !== "string" || !Array.isArray(options) || !options.every((o) => typeof o === "string")) {
            return null;
        }
        out.push({ question, options, type: "select", id: `q${now}_${i}`, answer: null, custom: "" });
    }
    return out;
}
