/**
 * NurseMate 시스템 프롬프트 모음 (개발 지시서 5장 준수)
 * 모든 프롬프트 앞에 공통 지침이 자동으로 붙습니다.
 */

export const COMMON_SYSTEM_PROMPT = `너는 한국 간호학과 학생을 돕는 학습 도우미야.
- 한국어로 답한다.
- 의료 정보는 확실한 것만 말하고, 불확실하면 "교재 확인 필요"라고 밝힌다.
- 제공된 자료가 있으면 그 자료에 근거해서만 답한다.`;

/**
 * A. 강의록 → 요약 + 국시형 5지선다 10문항 프롬프트
 */
export function buildStudyPrompt(subject: string, unit: string, lectureText: string): string {
  return `${COMMON_SYSTEM_PROMPT}

아래는 [${subject}] [${unit}] 강의 자료야. 각 문단 앞의 [p.N]은 페이지 번호야.
1. 핵심 내용을 소제목별로 요약해줘. (시험에 나올 만한 개념은 **굵게**)
2. 한국 간호사 국가고시 형식의 5지선다 문제 10개를 만들어줘.
   - 사례 제시형 위주 (환자 상황 → 가장 우선적인 간호중재 등)
   - 오답 보기도 그럴듯하게
3. 자료에 없는 내용은 만들지 말고, 각 문제의 근거 페이지를 sourcePages에 넣어줘.
반드시 아래 지정된 JSON 형식으로만 답해. 마크다운 코드블록 없이 순수 JSON만 출력해.

{
  "summary": [{ "heading": "소제목", "content": "마크다운 요약 (**핵심개념** 포함)" }],
  "questions": [{
    "id": 1,
    "stem": "사례 + 질문",
    "choices": ["① 보기1", "② 보기2", "③ 보기3", "④ 보기4", "⑤ 보기5"],
    "answer": 1,
    "explanation": "정답 및 오답 해설",
    "sourcePages": [1]
  }]
}

[강의 자료]
${lectureText}`;
}

/**
 * B-1. 오답 복습 (다시 설명 + 유사문제 3개) 프롬프트
 */
export function buildWrongReviewPrompt(questionJson: string): string {
  return `${COMMON_SYSTEM_PROMPT}

[오답 복습] 다음 문제를 틀렸어. 이 개념만 쉽게 다시 설명하고, 같은 개념으로 비슷한 문제 3개를 새로 내줘. (같은 JSON 형식)
반드시 아래 JSON 형식으로만 답해:
{
  "easyExplanation": "해당 개념에 대한 쉽고 친절한 설명 (마크다운)",
  "questions": [{
    "id": 1,
    "stem": "사례 + 질문",
    "choices": ["① 보기1", "② 보기2", "③ 보기3", "④ 보기4", "⑤ 보기5"],
    "answer": 1,
    "explanation": "해설",
    "sourcePages": [1]
  }]
}

[틀린 문제]
${questionJson}`;
}

/**
 * B-2. 요약노트 (A4 한 장 분량) 프롬프트
 */
export function buildSummaryNotePrompt(lectureOrSummaryText: string): string {
  return `${COMMON_SYSTEM_PROMPT}

[요약노트] 이 자료에서 시험에 나올 가능성이 높은 내용만 A4 한 장 분량으로, 표와 암기 포인트 위주로 정리해줘.
반드시 아래 JSON 형식으로만 답해:
{
  "title": "요약노트 제목",
  "keyTable": [
    { "category": "구분/개념", "corePoint": "핵심 내용", "nursingIntervention": "주요 간호중재 및 정상수치" }
  ],
  "memoryPoints": ["암기 포인트 1", "암기 포인트 2"],
  "cautionNote": "시험 단골 함정 및 주의사항"
}

[자료]
${lectureOrSummaryText}`;
}

/**
 * B-3. 학습 일정표 프롬프트
 */
export function buildSchedulePrompt(examDate: string, dailyHours: number, weakSubjects: string): string {
  return `${COMMON_SYSTEM_PROMPT}

[일정표] 시험일은 [${examDate}], 하루 [${dailyHours}시간] 공부 가능, 약한 과목은 [${weakSubjects}]이야. 이를 반영해 날짜별 일정표를 표로 짜줘.
반드시 아래 JSON 형식으로만 답해:
{
  "strategy": "전체 학습 전략 요약",
  "schedule": [
    { "date": "날짜/주차", "subject": "과목명", "topic": "세부 학습 내용", "hours": "${dailyHours}시간", "goal": "학습 목표" }
  ]
}`;
}

/**
 * C. 의학용어 어원 표 프롬프트
 */
export function buildTermsPrompt(selectedAffixes: string[]): string {
  return `${COMMON_SYSTEM_PROMPT}

의학용어를 접두사/어근/접미사로 분해해 표로 정리해줘: [${selectedAffixes.join(", ")}]
각각 뜻, 예시 단어 3개, 한국어 용어를 함께 써줘.
반드시 아래 JSON 형식으로만 답해:
{
  "items": [
    {
      "affix": "접두사/어근/접미사",
      "type": "접두사 | 어근 | 접미사",
      "meaning": "의미",
      "examples": [
        { "word": "영문 의학용어", "breakdown": "어원 분해 설명", "korean": "한국어 용어" }
      ]
    }
  ]
}`;
}

/**
 * D. 자기소개서 첨삭 프롬프트 (절대 규칙: 없는 사실 생성 금지)
 */
export function buildResumePrompt(hospital: string, promptQuestion: string, draft: string): string {
  return `${COMMON_SYSTEM_PROMPT}

아래는 [${hospital}] 자기소개서 문항과 지원자가 쓴 초안이야.
1. 지원자가 쓴 경험과 사실은 절대 바꾸거나 새로 지어내지 마. 수치·자격·경험을 추가하지 마.
2. 빠진 맥락(상황·나의 행동·결과)과 간호 직무역량(환자안전, 의사소통, 협업 등)이 드러나도록 문장을 다듬어줘.
3. 수정본, 보완 포인트, 드러난 역량 키워드, 지원자에게 추가로 물어볼 질문을 나눠서 줘.
반드시 아래 JSON 형식으로만 답해:
{
  "revisedText": "다듬어진 자기소개서 전문 (초안의 사실만 사용)",
  "improvementPoints": ["보완 포인트 1", "보완 포인트 2"],
  "competencyKeywords": ["환자안전", "의사소통"],
  "followUpQuestions": ["지원자에게 추가로 물어볼 질문 1", "질문 2"]
}

[문항]
${promptQuestion}

[초안]
${draft}`;
}

/**
 * E-1. 부서별 모의 면접 프롬프트
 */
export function buildInterviewChatPrompt(
  hospital: string,
  department: string,
  applicantType: string,
  turnCount: number,
  historyText: string,
  userAnswer: string
): string {
  return `${COMMON_SYSTEM_PROMPT}

[모의 면접]
너는 [${hospital}] [${department}] 신규 간호사 면접관이야. 지원자는 [${applicantType}]이야.
- 질문은 한 번에 하나씩
- 지원자 답변에 (1) 좋았던 점 (2) 보완할 점 (3) 더 나은 답변 예시 순으로 피드백
- 인성 → 직무 → 상황 대처(예: 환아 보호자가 화를 낼 때) 순서
- 10문항이 끝나면 전체 총평과 100점 만점 점수

현재 진행 문항 번호: ${turnCount} / 10
이전 대화 내역:
${historyText}

지원자의 방금 답변:
${userAnswer}

반드시 아래 JSON 형식으로만 답해:
{
  "feedback": {
    "goodPoints": "(1) 좋았던 점",
    "improvementPoints": "(2) 보완할 점",
    "betterExample": "(3) 더 나은 답변 예시"
  },
  "nextQuestion": "다음 면접 질문 (10문항 완료 시 빈 문자열)",
  "questionCategory": "인성 | 직무 | 상황 대처 | 완료",
  "isFinished": false,
  "finalEvaluation": {
    "totalScore": 88,
    "overallReview": "10문항 완료 시 전체 총평",
    "strengths": ["강점 1", "강점 2"],
    "weaknesses": ["보완점 1"]
  }
}`;
}

/**
 * E-2. 면접 후기 분석 프롬프트
 */
export function buildInterviewReviewAnalysisPrompt(hospital: string, reviewText: string): string {
  return `${COMMON_SYSTEM_PROMPT}

[후기 분석]
아래는 [${hospital}] 면접 후기야.
1. 부서별로 질문을 분류해줘. 2. 공통으로 자주 나온 질문 TOP 5를 뽑아줘.
3. 각 질문의 답변 구조(STAR)를 알려줘.
반드시 아래 JSON 형식으로만 답해:
{
  "departmentQuestions": [
    { "department": "부서명", "questions": ["질문 1", "질문 2"] }
  ],
  "top5Questions": [
    {
      "rank": 1,
      "question": "자주 나온 질문",
      "starGuide": {
        "situation": "S(상황): 어떤 임상/실습 상황을 제시할지",
        "task": "T(과제): 해결해야 했던 간호 문제",
        "action": "A(행동): 본인이 취한 구체적 간호 행위/의사소통",
        "result": "R(결과): 환자 반응 및 배운 점"
      }
    }
  ]
}

[후기]
${reviewText}`;
}
