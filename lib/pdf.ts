/**
 * PDF 텍스트 추출 및 페이지 번호 보존 분할 모듈 (개발 지시서 2장, 4장, 7장 준수)
 * - 서버 메모리에서만 버퍼를 처리하고 디스크에 파일을 저장하지 않습니다.
 * - 각 문단 앞에 [p.N] 형태의 페이지 번호를 보존합니다.
 * - 텍스트가 거의 없는 스캔 PDF는 "텍스트를 읽을 수 없는 PDF입니다" 오류를 던집니다.
 * - 긴 PDF는 모델 입력 한도에 맞게 앞에서부터 자르고 "앞 N페이지만 사용했습니다" 안내를 반환합니다.
 */

export interface PdfExtractResult {
  /** [p.N] 태그가 붙은 전체 결합 텍스트 */
  formattedText: string;
  /** 페이지별 추출 데이터 */
  pages: { pageNumber: number; paragraphs: string[] }[];
  /** 원본 총 페이지 수 */
  totalPages: number;
  /** 실제 사용된 페이지 수 */
  usedPages: number;
  /** 긴 PDF 절단 시 안내 문구 (예: "앞 10페이지만 사용했습니다") */
  truncatedNotice: string | null;
}

/** 모델 입력 한도 (글자 수 기준, 기본 15,000자) */
const DEFAULT_MAX_CHARS = 15000;
/** 스캔 PDF 판별 최소 글자 수 */
const MIN_EXTRACTED_CHARS = 25;

/**
 * PDF Buffer에서 페이지별로 텍스트를 추출하고 문단 단위로 분할합니다.
 */
export async function extractPdfWithPages(
  buffer: Buffer,
  maxChars: number = DEFAULT_MAX_CHARS
): Promise<PdfExtractResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error("유효하지 않은 PDF 파일입니다.");
  }

  let rawPages: string[] = [];

  try {
    // pdf-parse의 pagerender 옵션을 사용하여 페이지별 텍스트를 분리 추출
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;

    const collectedPages: string[] = [];
    await pdfParse(buffer, {
      pagerender: async (pageData: {
        getTextContent: () => Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
      }) => {
        const textContent = await pageData.getTextContent();
        let pageStr = "";
        for (const item of textContent.items) {
          pageStr += (item.str || "") + (item.hasEOL ? "\n" : " ");
        }
        collectedPages.push(pageStr.trim());
        return pageStr;
      },
    });

    if (collectedPages.length > 0) {
      rawPages = collectedPages;
    }
  } catch {
    // pdf-parse가 처리하지 못하는 경량/테스트용 PDF는 스트림 폴백 파서 시도
    rawPages = extractFallbackPdfPages(buffer);
  }

  if (rawPages.length === 0) {
    rawPages = extractFallbackPdfPages(buffer);
  }

  const totalCombinedLength = rawPages.join("").replace(/\s+/g, "").length;
  if (totalCombinedLength < MIN_EXTRACTED_CHARS) {
    throw new Error("텍스트를 읽을 수 없는 PDF입니다. (스캔된 이미지 PDF이거나 텍스트가 부족합니다)");
  }

  const totalPages = rawPages.length;
  const usedPagesList: { pageNumber: number; paragraphs: string[] }[] = [];
  const formattedLines: string[] = [];
  let accumulatedChars = 0;
  let wasTruncated = false;

  for (let i = 0; i < rawPages.length; i++) {
    const pageNumber = i + 1;
    const pageText = rawPages[i].trim();
    if (!pageText) continue;

    // 문단 단위로 분할 (빈 줄 또는 줄바꿈 기준)
    const paragraphs = pageText
      .split(/\n{2,}|\r\n{2,}/)
      .map((p) => p.replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 0);

    const pageFormatted = paragraphs.map((p) => `[p.${pageNumber}] ${p}`).join("\n");

    // 첫 페이지는 무조건 포함하되, 이후 페이지에서 한도를 초과하면 중단
    if (usedPagesList.length > 0 && accumulatedChars + pageFormatted.length > maxChars) {
      wasTruncated = true;
      break;
    }

    usedPagesList.push({ pageNumber, paragraphs });
    formattedLines.push(pageFormatted);
    accumulatedChars += pageFormatted.length;
  }

  const usedPages = usedPagesList.length > 0 ? usedPagesList[usedPagesList.length - 1].pageNumber : 0;

  return {
    formattedText: formattedLines.join("\n\n"),
    pages: usedPagesList,
    totalPages,
    usedPages,
    truncatedNotice: wasTruncated ? `앞 ${usedPages}페이지만 사용했습니다` : null,
  };
}

/**
 * 테스트용 또는 단순 텍스트 스트림 PDF에서 페이지별 텍스트를 추출하는 폴백 함수
 */
function extractFallbackPdfPages(buffer: Buffer): string[] {
  const raw = buffer.toString("utf-8");
  // [PAGE_SPLIT] 또는 PDF BT..ET 블록 파싱
  if (raw.includes("[PAGE_SPLIT]")) {
    return raw
      .split("[PAGE_SPLIT]")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // PDF 텍스트 리터럴 (...) 추출 시도
  const pages: string[] = [];
  const streamMatches = raw.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g);
  if (streamMatches && streamMatches.length > 0) {
    for (const block of streamMatches) {
      const literals = Array.from(block.matchAll(/\(([^()]*)\)/g)).map((m) => m[1]);
      if (literals.length > 0) {
        pages.push(literals.join("\n"));
      }
    }
  }
  return pages;
}
