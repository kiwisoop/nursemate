import { describe, it, expect } from "vitest";
import { extractPdfWithPages } from "@/lib/pdf";
import { callLlmJson } from "@/lib/llm";
import {
  buildStudyPrompt,
  buildWrongReviewPrompt,
  buildSummaryNotePrompt,
  buildSchedulePrompt,
  buildTermsPrompt,
  buildResumePrompt,
  buildInterviewChatPrompt,
  buildInterviewReviewAnalysisPrompt,
} from "@/lib/prompts";
import abbreviations from "@/data/abbreviations.json";
import { StudyQuestion } from "@/lib/storage";

describe("NurseMate 핵심 기능 및 주요 흐름(문제 생성 → 풀이 → 오답 복습) 통합 테스트", () => {
  it("단계 1 & 2: 강의록 PDF에서 페이지 번호([p.N])를 보존하여 추출하고 국시형 10문항과 근거 페이지를 생성한다", async () => {
    const samplePdfBuffer = Buffer.from(
      [
        "성인간호학 COPD 산소요법 강의록: 만성폐쇄성폐질환 환자에게는 저농도 산소(1~2L/min)를 투여하고 반좌위를 취해준다.",
        "심부정맥혈전증(DVT) 예방 간호: 조기 이상을 격려하고 간헐적 공기압박기(IPC)를 적용한다.",
        "수혈 부작용 간호중재: 오한과 발열, 호흡곤란 발생 시 즉시 수혈을 중단하고 생리식염수로 정맥로를 유지한다.",
      ].join("\n[PAGE_SPLIT]\n"),
      "utf-8"
    );

    const pdfResult = await extractPdfWithPages(samplePdfBuffer);
    expect(pdfResult.totalPages).toBe(3);
    expect(pdfResult.usedPages).toBe(3);
    expect(pdfResult.formattedText).toContain("[p.1]");
    expect(pdfResult.formattedText).toContain("[p.2]");
    expect(pdfResult.formattedText).toContain("[p.3]");
    expect(pdfResult.truncatedNotice).toBeNull();

    // 프롬프트 A로 LLM 호출 → 요약 + 10문항 생성 검증
    const prompt = buildStudyPrompt("성인간호학", "호흡·순환·수혈 간호", pdfResult.formattedText);
    const studyResult = await callLlmJson<{
      summary: Array<{ heading: string; content: string }>;
      questions: StudyQuestion[];
    }>(prompt);

    expect(studyResult.summary.length).toBeGreaterThan(0);
    expect(studyResult.questions).toHaveLength(10);

    // 모든 10문항이 5지선다이며 근거 페이지(sourcePages)와 해설을 포함하는지 검증
    for (const q of studyResult.questions) {
      expect(q.choices).toHaveLength(5);
      expect(q.answer).toBeGreaterThanOrEqual(1);
      expect(q.answer).toBeLessThanOrEqual(5);
      expect(q.explanation.length).toBeGreaterThan(5);
      expect(Array.isArray(q.sourcePages)).toBe(true);
      expect(q.sourcePages.length).toBeGreaterThan(0);
    }
  });

  it("단계 2 오류 처리: 스캔 PDF(텍스트 부족)는 안내 오류를 던지고, 긴 PDF는 앞 N페이지만 사용 안내를 반환한다", async () => {
    // 1. 스캔 PDF(텍스트가 거의 없는 PDF)
    const emptyScanBuffer = Buffer.from("   ", "utf-8");
    await expect(extractPdfWithPages(emptyScanBuffer)).rejects.toThrow(
      "텍스트를 읽을 수 없는 PDF입니다"
    );

    // 2. 긴 PDF 절단 ("앞 N페이지만 사용했습니다")
    const longPages = Array.from(
      { length: 6 },
      (_, i) => `페이지 ${i + 1}의 간호학 강의 본문입니다. `.repeat(30)
    ).join("\n[PAGE_SPLIT]\n");
    const longBuffer = Buffer.from(longPages, "utf-8");

    const truncatedResult = await extractPdfWithPages(longBuffer, 1200);
    expect(truncatedResult.usedPages).toBeLessThan(truncatedResult.totalPages);
    expect(truncatedResult.truncatedNotice).toBe(
      `앞 ${truncatedResult.usedPages}페이지만 사용했습니다`
    );
  });

  it("단계 2 JSON 파싱 재시도: 첫 응답이 잘못된 JSON이면 1회 재시도하여 정상 파싱한다", async () => {
    let attempts = 0;
    const recovered = await callLlmJson<{ ok: boolean }>("[테스트]", async (attempt) => {
      attempts = attempt;
      if (attempt === 1) {
        return "이것은 깨진 JSON 응답입니다 { invalid";
      }
      return JSON.stringify({ ok: true });
    });

    expect(attempts).toBe(2);
    expect(recovered.ok).toBe(true);
  });

  it("단계 3 (문제 풀이 → 오답 복습 → 요약노트 → 일정표): 틀린 문제를 다시 설명하고 유사문제 3개를 생성한다", async () => {
    const wrongQuestion: StudyQuestion = {
      id: 1,
      stem: "수혈 시작 10분 후 환자가 오한과 호흡곤란을 호소할 때 최우선 간호중재는?",
      choices: [
        "① 즉시 수혈을 중단하고 생리식염수로 정맥로를 유지한다.",
        "② 수혈 속도를 두 배로 높인다.",
        "③ 해열제를 투여하며 수혈을 계속한다.",
        "④ 1시간 뒤 활력징후를 다시 측정한다.",
        "⑤ 혈액백을 온수에 데워 투여한다.",
      ],
      answer: 1,
      explanation: "급성 수혈부작용 의심 시 즉시 수혈을 중단해야 합니다.",
      sourcePages: [3],
    };

    // 1. 오답 복습 ([다시 설명] + 유사문제 3개)
    const reviewRes = await callLlmJson<{
      easyExplanation: string;
      questions: StudyQuestion[];
    }>(buildWrongReviewPrompt(JSON.stringify(wrongQuestion)));

    expect(reviewRes.easyExplanation.length).toBeGreaterThan(10);
    expect(reviewRes.questions).toHaveLength(3);
    expect(reviewRes.questions[0].sourcePages).toContain(3);

    // 2. A4 요약노트
    const noteRes = await callLlmJson<{
      title: string;
      keyTable: Array<{ category: string; corePoint: string; nursingIntervention: string }>;
      memoryPoints: string[];
    }>(buildSummaryNotePrompt("[p.3] 수혈 부작용 시 즉시 수혈 중단"));
    expect(noteRes.keyTable.length).toBeGreaterThan(0);
    expect(noteRes.memoryPoints.length).toBeGreaterThan(0);

    // 3. 학습 일정표
    const scheduleRes = await callLlmJson<{
      strategy: string;
      schedule: Array<{ date: string; subject: string; hours: string }>;
    }>(buildSchedulePrompt("2026-12-20", 5, "성인간호학, 약리학"));
    expect(scheduleRes.schedule.length).toBeGreaterThan(0);
    expect(scheduleRes.schedule[0].hours).toBe("5시간");
  });

  it("단계 4: 고정 약어 데이터 30개가 존재하고, 어원 분해 표가 예시 단어 3개씩 생성한다", async () => {
    expect(abbreviations).toHaveLength(30);
    const abbrNames = abbreviations.map((a) => a.abbr);
    expect(abbrNames).toEqual(
      expect.arrayContaining(["BP", "HR", "RR", "NPO", "PRN", "I/O", "DVT", "COPD"])
    );

    const termsRes = await callLlmJson<{
      items: Array<{
        affix: string;
        meaning: string;
        examples: Array<{ word: string; korean: string }>;
      }>;
    }>(buildTermsPrompt(["hyper-", "hypo-", "-itis"]));

    expect(termsRes.items).toHaveLength(3);
    expect(termsRes.items[0].examples).toHaveLength(3);
  });

  it("단계 5: 자소서 첨삭 시 초안에 없는 허위 수치나 자격증을 추가하지 않고 역량 키워드와 추가 질문을 반환한다", async () => {
    const draft =
      "내과병동 실습 중 어지럼증을 호소하는 환자분을 발견하고 침상 난간을 확인한 뒤 담당 간호사 선생님께 보고드렸습니다.";
    const resumeRes = await callLlmJson<{
      revisedText: string;
      improvementPoints: string[];
      competencyKeywords: string[];
      followUpQuestions: string[];
    }>(buildResumePrompt("서울아산병원", "환자안전 실천 경험", draft));

    expect(resumeRes.revisedText).toContain("어지럼증");
    // 초안에 없는 허위 토익 점수나 수상 경력이 추가되지 않았는지 확인
    expect(resumeRes.revisedText).not.toMatch(/토익|900점|대상 수상|BLS 자격증/);
    expect(resumeRes.competencyKeywords.length).toBeGreaterThan(0);
    expect(resumeRes.followUpQuestions.length).toBeGreaterThan(0);
  });

  it("단계 6: 모의 면접 10문항 완료 시 100점 만점 점수와 총평을 반환하고 후기 분석 TOP 5 STAR 가이드를 생성한다", async () => {
    const turn10Res = await callLlmJson<{
      isFinished: boolean;
      finalEvaluation?: { totalScore: number; overallReview: string };
    }>(
      buildInterviewChatPrompt(
        "서울대학교병원",
        "중환자실",
        "4학년 졸업예정자",
        10,
        "Q1~Q9 대화 내역",
        "산소포화도 88% 저하 환자를 최우선으로 사정하고 보고하겠습니다."
      )
    );

    expect(turn10Res.isFinished).toBe(true);
    expect(turn10Res.finalEvaluation?.totalScore).toBeGreaterThanOrEqual(0);
    expect(turn10Res.finalEvaluation?.totalScore).toBeLessThanOrEqual(100);

    const analysisRes = await callLlmJson<{
      departmentQuestions: Array<{ department: string; questions: string[] }>;
      top5Questions: Array<{ rank: number; question: string }>;
    }>(buildInterviewReviewAnalysisPrompt("서울대학교병원", "중환자실과 응급실 면접 후기입니다."));

    expect(analysisRes.departmentQuestions.length).toBeGreaterThan(0);
    expect(analysisRes.top5Questions).toHaveLength(5);
  });
});
