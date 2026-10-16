// 자동 생성 — tools/port-from-web.mjs 가 planning-helper/lib/prompts/dev.ts 에서 타입만 제거했다. 직접 고치지 말 것.
// 5단계: 개발 명세서.
// SYSTEM 과 생성 모드 userPrompt 는 원본(5dd15d8 app/api/generate/dev/route.ts)과 한 글자도 다르면 안 된다.
// 수정 모드는 원본에 없던 것(신규) — prd 의 수정 템플릿과 같은 형태로 만들었다.
// 검증: npx -y tsx scripts/verify-prompts.mjs
export const SYSTEM = `당신은 시니어 풀스택 개발자입니다.
아래 PRD, 기능 정리, 화면 설계(IA)를 바탕으로 Claude Code 또는 AI Studio에 전달할 개발 요청 프롬프트를 작성하세요.
이 문서는 AI에게 서비스 개발을 직접 요청하는 프롬프트입니다.

[문서 시작부에 반드시 포함할 고지문]
> ⚠️ **이 명세서는 초안입니다.**
> 전체 방향과 구조를 잡기 위한 틀이며, 구체적인 기술 스펙(특히 AI 활용 고도화, 파싱 방식, 외부 연동 등)은 별도 논의가 필요합니다.
> 개발 착수 전 아래 명세를 검토하고 불명확한 부분은 먼저 질문해주세요.

[작성 항목]

## 서비스 개요
- 한 줄 정의
- 핵심 기능 (PRD 기반)
- 기술 스택 제안 (프론트엔드 / 백엔드 / DB / AI)
- 화면 참고: [화면 설계(IA) 첨부됨 — 화면 구성과 담긴 기능은 IA 기준으로 구현]

## 메뉴 구조
- 화면 목록과 각 역할 한 줄 요약 (화면 설계 IA 기반)
- 화면 간 이동 흐름

## 화면별 개발 요청
각 화면별로 아래 형식:

### [화면명]
- **구현 목적**
- **UI 구성**: 화면 설계(IA) 기준 주요 UI 요소 나열
- **기능 동작**: 사용자 액션 → 시스템 처리 흐름 (구체적으로)
- **AI/API 연동**: 사용 여부, 입력/출력 형태, 처리 방식
- **예외 처리**: 주요 에러 케이스와 대응

## 데이터 구조
- 필요한 DB 테이블 및 주요 필드
- 상태값 정의 (있을 경우)

## PoC 검증 요건
과제 정의서에 명시된 수행팀의 검증 기준을 별도 섹션으로 정리:
- 성공 지표 (정확도, 처리 시간 등 수치 목표)
- 실패 기준 (PoC 종료 조건)
- 검증에 필요한 로깅·측정 기능 구현 요건

## 논의 필요 항목
- 기술적으로 결정되지 않은 사항
- AI 활용 고도화 방안 (파싱, 분류, 추출 등)
- 외부 시스템 연동 여부

[작성 원칙]
- PRD는 사용자 서비스 관점으로 작성된 문서이므로, PoC 검증 요건은 과제 정의서에서 직접 추출할 것
- PRD의 서비스 목적과 핵심 기능을 개발 맥락에 반영할 것
- 화면 구조·메뉴·화면 이동 흐름은 화면 설계(IA)를 그대로 반영할 것
- 각 화면의 기능 동작은 기능 정리에서 정의한 기능을 기준으로 구현할 것
- 화면별 UI 구성은 화면 설계(IA)의 "주요 UI·상태"와 얼라인할 것
- 확정되지 않은 스펙은 "논의 필요 항목"으로 분리할 것
- 마크다운 형식으로 출력`;
export function userPrompt({ prd, feature_spec, design_spec, task_definition, requirements, needs_admin_page, revision_request, current_content, }) {
    // 신규: 수정 모드 (prd 수정 템플릿과 같은 형태)
    if (revision_request) {
        return `아래 개발 명세서를 수정 요청 사항에 맞게 수정해주세요.\n\n수정 요청:\n${revision_request}\n\n현재 개발 명세서:\n${current_content}\n\n원본 과제 정의서:\n${task_definition || "(없음)"}`;
    }
    // 원본 그대로
    const adminNote = needs_admin_page
        ? "\n\n[관리자 페이지 포함 요청]\n현업 담당자용 서비스 화면 외에, PoC 수행팀이 정확도·처리 현황을 모니터링할 수 있는 관리자 페이지를 별도로 포함해주세요. 화면별 개발 요청 섹션에 두 페이지를 모두 작성하세요."
        : "";
    const userContent = `PRD:\n${prd}\n\n기능 정리:\n${feature_spec}\n\n화면 설계(IA):\n${design_spec}\n\n과제 정의서:\n${task_definition || "(없음)"}\n\n요구사항:\n${requirements || "(없음)"}${adminNote}`;
    return userContent;
}
// ─────────────────────────────────────────────────────────────────────────────
// "참고 자료" 꼬리말. 원본은 브라우저(StepDoc.tsx)가 생성 직후 붙여서 저장했다.
// 이관본은 붙이지 않는다(app/api/generate/dev/route.ts 주석). appendReferences 는 원본 동작
// 기록·검증용으로만 남기고, stripReferences 는 가져온 옛 데이터를 다룰 때 쓴다.
// ─────────────────────────────────────────────────────────────────────────────
const REFS_MARKER = "\n\n---\n\n## 📎 참고 자료\n\n";
/** 원본 StepDoc.tsx 의 dev_spec 꼬리말 로직 그대로. */
export function appendReferences(text, project) {
    const refs = [];
    if (project.prd)
        refs.push(`<details>\n<summary>📄 PRD 원문</summary>\n\n${project.prd}\n</details>`);
    if (project.feature_spec)
        refs.push(`<details>\n<summary>📋 기능 정리 원문</summary>\n\n${project.feature_spec}\n</details>`);
    if (project.design_spec)
        refs.push(`<details>\n<summary>🗺️ 화면 설계(IA) 원문</summary>\n\n${project.design_spec}\n</details>`);
    if (refs.length > 0) {
        return text + `\n\n---\n\n## 📎 참고 자료\n\n${refs.join("\n\n")}`;
    }
    return text;
}
/**
 * 저장된 개발 명세서에서 "참고 자료" 꼬리말을 떼어 낸다. 수정 모드·일관성 점검에
 * 넘길 때 PRD 등 원문 사본이 중복으로 들어가지 않게 한다(수정 후에는 다시 붙인다).
 */
export function stripReferences(content) {
    const i = content.lastIndexOf(REFS_MARKER);
    return i >= 0 ? content.slice(0, i) : content;
}
