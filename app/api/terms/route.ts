import { NextRequest, NextResponse } from "next/server";
import { buildTermsPrompt } from "@/lib/prompts";
import { callLlmJson } from "@/lib/llm";

/**
 * 기능 C: 의학용어 접두사/어근/접미사 어원 분해 표 생성 Route Handler
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const affixes: string[] = Array.isArray(body.affixes)
      ? body.affixes.map((a: string) => String(a).trim()).filter(Boolean)
      : [];

    if (affixes.length === 0) {
      return NextResponse.json(
        { error: "분석할 접두사/어근/접미사를 하나 이상 선택해 주세요." },
        { status: 400 }
      );
    }

    const prompt =
      buildTermsPrompt(affixes) + (body.simulateError ? "\n[SIMULATE_LLM_ERROR]" : "");

    const result = await callLlmJson<{
      items: Array<{
        affix: string;
        type: string;
        meaning: string;
        examples: Array<{ word: string; breakdown: string; korean: string }>;
      }>;
    }>(prompt);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "어원 표를 생성하는 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
