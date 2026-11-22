import { NextRequest, NextResponse } from "next/server";
import {
  buildInterviewChatPrompt,
  buildInterviewReviewAnalysisPrompt,
} from "@/lib/prompts";
import { callLlmJson } from "@/lib/llm";

/**
 * 기능 E: 부서별 모의 면접 (10문항 진행 + 총평/점수) 및 면접 후기 분석 Route Handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, simulateError } = body;
    const errorTag = simulateError ? "\n[SIMULATE_LLM_ERROR]" : "";

    // 1. 모의 면접 첫 질문 시작
    if (mode === "start") {
      const hospital = (body.hospital || "").trim();
      const department = (body.department || "").trim();
      const applicantType = (body.applicantType || "").trim();

      if (!hospital || !department || !applicantType) {
        return NextResponse.json(
          { error: "병원명, 희망 부서, 지원자 신분을 모두 입력해 주세요." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        questionNumber: 1,
        category: "인성",
        question: `안녕하세요. ${hospital} ${department} 면접을 시작하겠습니다. (${applicantType} 전형) 먼저 간단한 1분 자기소개와 함께 우리 병원 ${department}에 지원하신 동기를 말씀해 주세요.`,
      });
    }

    // 2. 모의 면접 답변 제출 → 피드백 + 다음 질문 (또는 10문항 완료 시 총평/점수)
    if (mode === "chat") {
      const hospital = (body.hospital || "").trim();
      const department = (body.department || "").trim();
      const applicantType = (body.applicantType || "").trim();
      const turnCount = Number(body.turnCount) || 1;
      const historyText = (body.historyText || "").trim();
      const userAnswer = (body.userAnswer || "").trim();

      if (!userAnswer) {
        return NextResponse.json(
          { error: "면접 질문에 대한 답변을 입력해 주세요." },
          { status: 400 }
        );
      }

      const prompt =
        buildInterviewChatPrompt(
          hospital,
          department,
          applicantType,
          turnCount,
          historyText,
          userAnswer
        ) + errorTag;

      const result = await callLlmJson<{
        feedback: {
          goodPoints: string;
          improvementPoints: string;
          betterExample: string;
        };
        nextQuestion: string;
        questionCategory: string;
        isFinished: boolean;
        finalEvaluation?: {
          totalScore: number;
          overallReview: string;
          strengths: string[];
          weaknesses: string[];
        };
      }>(prompt);

      return NextResponse.json(result);
    }

    // 3. 면접 후기 분석 탭 (부서별 분류, TOP 5 질문, STAR 답변 가이드)
    if (mode === "review_analysis") {
      const hospital = (body.hospital || "지원 병원").trim();
      const reviewText = (body.reviewText || "").trim();

      if (!reviewText || reviewText.length < 15) {
        return NextResponse.json(
          { error: "분석할 면접 후기 텍스트를 15자 이상 붙여넣어 주세요." },
          { status: 400 }
        );
      }

      const prompt =
        buildInterviewReviewAnalysisPrompt(hospital, reviewText) + errorTag;

      const result = await callLlmJson<{
        departmentQuestions: Array<{ department: string; questions: string[] }>;
        top5Questions: Array<{
          rank: number;
          question: string;
          starGuide: {
            situation: string;
            task: string;
            action: string;
            result: string;
          };
        }>;
      }>(prompt);

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "유효하지 않은 면접 요청 모드입니다." },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "모의 면접 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
