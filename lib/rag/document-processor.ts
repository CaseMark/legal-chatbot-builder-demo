"use client";

// Client-side only imports
let pdfjsLib: typeof import("pdfjs-dist") | null = null;
let mammoth: typeof import("mammoth") | null = null;

// Initialize PDF.js only on client side
const initializePDFJS = async () => {
  if (typeof window === "undefined") return;
  if (pdfjsLib) return;

  pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
};

const initializeMammoth = async () => {
  if (typeof window === "undefined") return;
  if (mammoth) return;

  mammoth = await import("mammoth");
};

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    fileName: string;
    fileType: string;
    chunkIndex: number;
    totalChunks: number;
    uploadedAt: number;
    pageNumber?: number;
    startPos?: number;
    endPos?: number;
  };
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  fileType: string;
  totalChunks: number;
  chunks: DocumentChunk[];
  uploadedAt: number;
  metadata?: Record<string, unknown>;
}

export class DocumentProcessor {
  private chunkSize = 1500;
  private chunkOverlap = 300;

  async processFile(file: File): Promise<ProcessedDocument> {
    if (typeof window === "undefined") {
      throw new Error("Document processing must be done on the client side");
    }

    const fileType = file.type;
    let text = "";
    let pageMap: Map<number, { start: number; end: number }> | undefined;

    try {
      switch (fileType) {
        case "application/pdf":
          await initializePDFJS();
          const pdfResult = await this.extractPDFText(file);
          text = pdfResult.text;
          pageMap = pdfResult.pageMap;
          break;
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          await initializeMammoth();
          text = await this.extractDocxText(file);
          break;
        case "text/plain":
          text = await this.extractPlainText(file);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      const chunks = await this.chunkText(
        text,
        {
          fileName: file.name,
          fileType,
          uploadedAt: Date.now(),
        },
        pageMap
      );
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        id: documentId,
        fileName: file.name,
        fileType,
        totalChunks: chunks.length,
        chunks,
        uploadedAt: Date.now(),
      };
    } catch (error) {
      console.error("Error processing file:", error);
      throw new Error(
        `Failed to process ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async extractPDFText(
    file: File
  ): Promise<{ text: string; pageMap: Map<number, { start: number; end: number }> }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib!.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    const pageMap = new Map<number, { start: number; end: number }>();

    for (let i = 1; i <= pdf.numPages; i++) {
      const startPos = text.length;
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => (item as { str: string }).str)
        .join(" ");

      text += pageText + "\n";
      const endPos = text.length;

      pageMap.set(i, { start: startPos, end: endPos });
    }

    return { text, pageMap };
  }

  private async extractDocxText(file: File): Promise<string> {
    if (!mammoth) throw new Error("Mammoth not initialized");
    const arrayBuffer = await file.arrayBuffer();
    const result = await (
      mammoth as unknown as {
        default: {
          extractRawText: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
        };
      }
    ).default.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractPlainText(file: File): Promise<string> {
    return await file.text();
  }

  public async chunkText(
    text: string,
    metadata: {
      fileName: string;
      fileType: string;
      documentId?: string;
      uploadedAt?: number;
      [key: string]: unknown;
    },
    pageMap?: Map<number, { start: number; end: number }>
  ): Promise<DocumentChunk[]> {
    const { fileName, fileType, uploadedAt = Date.now() } = metadata;
    const chunks: DocumentChunk[] = [];
    const words = text.split(/\s+/);
    let currentChunk = "";
    let chunkIndex = 0;
    let currentPosition = 0;

    for (const word of words) {
      const testChunk = currentChunk + (currentChunk ? " " : "") + word;

      if (testChunk.length > this.chunkSize && currentChunk.length > 0) {
        const chunkStartPos = currentPosition - currentChunk.length;
        const chunkEndPos = currentPosition;

        let pageNumber: number | undefined;
        if (pageMap) {
          for (const [page, range] of pageMap.entries()) {
            if (chunkStartPos >= range.start && chunkStartPos < range.end) {
              pageNumber = page;
              break;
            }
          }
        }

        chunks.push({
          id: `chunk_${Date.now()}_${chunkIndex}_${Math.random().toString(36).substr(2, 9)}`,
          content: currentChunk.trim(),
          metadata: {
            fileName,
            fileType,
            chunkIndex,
            totalChunks: 0,
            uploadedAt,
            pageNumber,
            startPos: chunkStartPos,
            endPos: chunkEndPos,
          },
        });

        const overlapWords = currentChunk
          .split(/\s+/)
          .slice(-Math.floor(this.chunkOverlap / 10));
        currentChunk = overlapWords.join(" ") + " " + word;
        chunkIndex++;
      } else {
        currentChunk = testChunk;
      }

      currentPosition += word.length + 1;
    }

    if (currentChunk.trim()) {
      const chunkStartPos = currentPosition - currentChunk.length;
      const chunkEndPos = currentPosition;

      let pageNumber: number | undefined;
      if (pageMap) {
        for (const [page, range] of pageMap.entries()) {
          if (chunkStartPos >= range.start && chunkStartPos < range.end) {
            pageNumber = page;
            break;
          }
        }
      }

      chunks.push({
        id: `chunk_${Date.now()}_${chunkIndex}_${Math.random().toString(36).substr(2, 9)}`,
        content: currentChunk.trim(),
        metadata: {
          fileName,
          fileType,
          chunkIndex,
          totalChunks: 0,
          uploadedAt,
          pageNumber,
          startPos: chunkStartPos,
          endPos: chunkEndPos,
        },
      });
    }

    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }
}
