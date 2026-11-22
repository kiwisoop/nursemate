import { NextRequest, NextResponse } from "next/server";
import { extractPdfWithPages } from "@/lib/pdf";
import { buildStudyPrompt } from "@/lib/prompts";
import { callLlmJson, getLlmConfig } from "@/lib/llm";
import { StudyQuestion } from "@/lib/storage";

interface StudyLlmResponse {
  summary: Array<{ heading: string; content: string }>;
  questions: StudyQuestion[];
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * 단계 1 테스트 및 상태 확인용 GET 핸들러
 */
export async function GET() {
  const config = getLlmConfig();
  const testResult = await callLlmJson<{ status: string; message: string }>(
    "NurseMate 상태 점검 테스트"
  );
  return NextResponse.json({
    ok: true,
    provider: config.provider,
    model: config.model,
    llmResponse: testResult,
  });
}

/**
 * 기능 A: 강의록 PDF 업로드 → 페이지 번호 보존 텍스트 추출 → 요약 + 국시형 10문항 생성
 * (업로드된 PDF는 메모리에서만 처리 후 즉시 폐기하며 서버 디스크나 로그에 남기지 않음)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const subject = ((formData.get("subject") as string) || "").trim();
    const unit = ((formData.get("unit") as string) || "").trim();
    const simulateError = formData.get("simulateError") === "true";
    const file = formData.get("file") as File | null;

    if (!subject || !unit) {
      return NextResponse.json(
        { error: "과목명과 단원명을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: "강의록 PDF 파일을 업로드해 주세요." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "PDF 파일 크기는 최대 20MB까지 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF 텍스트 추출 (페이지 번호 [p.N] 보존 및 스캔 PDF / 긴 PDF 처리)
    const pdfResult = await extractPdfWithPages(buffer);

    const prompt = buildStudyPrompt(
      subject,
      unit,
      simulateError ? `${pdfResult.formattedText}\n[SIMULATE_LLM_ERROR]` : pdfResult.formattedText
    );

    const llmData = await callLlmJson<StudyLlmResponse>(prompt);

    if (!llmData || !Array.isArray(llmData.questions) || llmData.questions.length === 0) {
      return NextResponse.json(
        { error: "문제를 생성하지 못했습니다. 다시 시도해 주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary: llmData.summary || [],
      questions: llmData.questions.map((q, idx) => ({
        id: q.id || idx + 1,
        stem: q.stem,
        choices: q.choices,
        answer: Number(q.answer) || 1,
        explanation: q.explanation,
        sourcePages: Array.isArray(q.sourcePages) ? q.sourcePages : [],
      })),
      totalPages: pdfResult.totalPages,
      usedPages: pdfResult.usedPages,
      truncatedNotice: pdfResult.truncatedNotice,
      extractedTextForNote: pdfResult.formattedText.slice(0, 4000),
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "강의록 처리 중 오류가 발생했습니다. 다시 시도해 주세요.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
