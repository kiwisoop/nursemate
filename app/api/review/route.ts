import { NextRequest, NextResponse } from "next/server";
import {
  buildWrongReviewPrompt,
  buildSummaryNotePrompt,
  buildSchedulePrompt,
} from "@/lib/prompts";
import { callLlmJson } from "@/lib/llm";
import { StudyQuestion } from "@/lib/storage";

/**
 * 기능 B: 오답 복습([다시 설명]), 시험 직전 [요약노트], 맞춤 [일정표] 생성 Route Handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, simulateError } = body;
    const errorTag = simulateError ? "\n[SIMULATE_LLM_ERROR]" : "";

    // 1. [다시 설명]: 쉬운 개념 설명 + 유사문제 3개
    if (mode === "wrong_review") {
      const question = body.question as StudyQuestion | undefined;
      if (!question || !question.stem) {
        return NextResponse.json(
          { error: "복습할 문항 정보가 없습니다." },
          { status: 400 }
        );
      }

      const prompt = buildWrongReviewPrompt(JSON.stringify(question)) + errorTag;
      const result = await callLlmJson<{
        easyExplanation: string;
        questions: StudyQuestion[];
      }>(prompt);

      return NextResponse.json(result);
    }

    // 2. [요약노트]: A4 1장 분량 핵심 표 & 암기 포인트
    if (mode === "summary_note") {
      const content = (body.content || "").trim();
      if (!content) {
        return NextResponse.json(
          { error: "요약노트를 생성할 학습 자료나 요약 내용이 없습니다." },
          { status: 400 }
        );
      }

      const prompt = buildSummaryNotePrompt(content) + errorTag;
      const result = await callLlmJson<{
        title: string;
        keyTable: Array<{
          category: string;
          corePoint: string;
          nursingIntervention: string;
        }>;
        memoryPoints: string[];
        cautionNote: string;
      }>(prompt);

      return NextResponse.json(result);
    }

    // 3. [일정표]: 시험일, 하루 공부 시간, 약한 과목 기반 날짜별 학습 계획표
    if (mode === "schedule") {
      const examDate = (body.examDate || "").trim();
      const dailyHours = Number(body.dailyHours) || 0;
      const weakSubjects = (body.weakSubjects || "").trim();

      if (!examDate || dailyHours <= 0 || !weakSubjects) {
        return NextResponse.json(
          { error: "시험일, 하루 공부 시간, 약한 과목을 모두 입력해 주세요." },
          { status: 400 }
        );
      }

      const prompt = buildSchedulePrompt(examDate, dailyHours, weakSubjects) + errorTag;
      const result = await callLlmJson<{
        strategy: string;
        schedule: Array<{
          date: string;
          subject: string;
          topic: string;
          hours: string;
          goal: string;
        }>;
      }>(prompt);

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "지원하지 않는 요청 모드입니다." },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "요청을 처리하는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
