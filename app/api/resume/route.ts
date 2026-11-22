import { NextRequest, NextResponse } from "next/server";
import { buildResumePrompt } from "@/lib/prompts";
import { callLlmJson } from "@/lib/llm";

/**
 * 기능 D: 병원 자기소개서 첨삭 Route Handler (개발 지시서 4-D, 6-3, 6-5 준수)
 * - 지원자가 쓰지 않은 경험·수치·자격을 새로 만들지 않음
 * - 입력한 자소서 원문과 개인정보는 서버나 로그에 절대 저장하지 않고 즉시 메모리에서 폐기
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hospital = (body.hospital || "").trim();
    const question = (body.question || "").trim();
    const draft = (body.draft || "").trim();

    if (!hospital || !question || !draft) {
      return NextResponse.json(
        { error: "지원 병원명, 자소서 문항, 본인 초안을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    if (draft.length < 20) {
      return NextResponse.json(
        { error: "정확한 첨삭을 위해 초안을 20자 이상 입력해 주세요." },
        { status: 400 }
      );
    }

    // 개인정보(전화번호, 주민등록번호 패턴) 마스킹 처리 후 LLM 호출
    const sanitizedDraft = draft
      .replace(/01[016789]-?\d{3,4}-?\d{4}/g, "[연락처 비공개]")
      .replace(/\d{6}-?[1-4]\d{6}/g, "[주민번호 비공개]");

    const prompt =
      buildResumePrompt(hospital, question, sanitizedDraft) +
      (body.simulateError ? "\n[SIMULATE_LLM_ERROR]" : "");

    const result = await callLlmJson<{
      revisedText: string;
      improvementPoints: string[];
      competencyKeywords: string[];
      followUpQuestions: string[];
    }>(prompt);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "자기소개서 첨삭 중 오류가 발생했습니다. 다시 시도해 주세요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
