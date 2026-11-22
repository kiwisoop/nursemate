declare module "pdf-parse" {
  interface PdfParseOptions {
    max?: number;
    version?: string;
    pagerender?: (pageData: {
      getTextContent: () => Promise<{
        items: Array<{ str?: string; hasEOL?: boolean }>;
      }>;
    }) => Promise<string> | string;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
