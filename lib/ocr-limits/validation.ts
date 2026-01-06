/**
 * Pre-upload validation utilities for OCR processing
 */

import { getOCRLimitConfig, OCRLimitConfig } from "./config";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  fileInfo: {
    name: string;
    size: number;
    sizeFormatted: string;
    type: string;
    extension: string;
    requiresOCR: boolean;
    estimatedPages: number;
  };
}

export interface PageEstimation {
  estimatedPages: number;
  confidence: "high" | "medium" | "low";
  method: string;
}

// File type mappings
const FILE_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/tiff": "tiff",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

// Average bytes per page for different file types (rough estimates)
const BYTES_PER_PAGE: Record<string, number> = {
  pdf: 100000, // ~100KB per page for typical PDF
  jpg: 500000, // ~500KB per image (1 page)
  jpeg: 500000,
  png: 800000, // ~800KB per image (1 page)
  tiff: 2000000, // ~2MB per image (1 page)
  webp: 300000, // ~300KB per image (1 page)
  bmp: 3000000, // ~3MB per image (1 page)
};

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file extension from MIME type or filename
 */
export function getFileExtension(filename: string, mimeType?: string): string {
  if (mimeType && FILE_EXTENSIONS[mimeType]) {
    return FILE_EXTENSIONS[mimeType];
  }

  const parts = filename.split(".");
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }

  return "";
}

/**
 * Check if file type requires OCR processing
 */
export function requiresOCR(mimeType: string): boolean {
  const config = getOCRLimitConfig();
  return (
    config.supportedImageTypes.includes(mimeType) ||
    mimeType === "application/pdf"
  );
}

/**
 * Estimate page count based on file size and type
 * This is a rough estimation - actual page count should be determined
 * by parsing the file (e.g., PDF metadata or image dimensions)
 */
export function estimatePageCount(
  fileSize: number,
  fileType: string
): PageEstimation {
  const extension = FILE_EXTENSIONS[fileType] || "";

  // Images are always 1 page
  if (fileType.startsWith("image/")) {
    return {
      estimatedPages: 1,
      confidence: "high",
      method: "image_single_page",
    };
  }

  // For PDFs, estimate based on file size
  if (fileType === "application/pdf") {
    const bytesPerPage = BYTES_PER_PAGE.pdf;
    const estimated = Math.max(1, Math.ceil(fileSize / bytesPerPage));

    // Confidence based on file size
    // Smaller files have more predictable page counts
    let confidence: "high" | "medium" | "low" = "medium";
    if (fileSize < 500000) {
      // < 500KB
      confidence = "high";
    } else if (fileSize > 5000000) {
      // > 5MB
      confidence = "low";
    }

    return {
      estimatedPages: estimated,
      confidence,
      method: "pdf_size_estimation",
    };
  }

  // Default: assume 1 page
  return {
    estimatedPages: 1,
    confidence: "low",
    method: "default",
  };
}

/**
 * Validate a file before upload
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  config?: OCRLimitConfig
): FileValidationResult {
  const cfg = config || getOCRLimitConfig();
  const warnings: string[] = [];

  const extension = getFileExtension(file.name, file.type);
  const sizeFormatted = formatFileSize(file.size);
  const needsOCR = requiresOCR(file.type);
  const pageEstimation = estimatePageCount(file.size, file.type);

  // Base file info
  const fileInfo = {
    name: file.name,
    size: file.size,
    sizeFormatted,
    type: file.type,
    extension,
    requiresOCR: needsOCR,
    estimatedPages: pageEstimation.estimatedPages,
  };

  // Check file size
  if (file.size > cfg.maxFileSizeBytes) {
    return {
      valid: false,
      error: `File size (${sizeFormatted}) exceeds maximum of ${cfg.maxFileSizeMB}MB.`,
      fileInfo,
    };
  }

  // Check file type
  const isSupported =
    cfg.supportedImageTypes.includes(file.type) ||
    cfg.supportedDocumentTypes.includes(file.type) ||
    file.type === "text/plain" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (!isSupported) {
    return {
      valid: false,
      error: `File type "${file.type || extension}" is not supported. Supported types: PDF, JPEG, PNG, TIFF, TXT, DOCX.`,
      fileInfo,
    };
  }

  // Check estimated pages
  if (pageEstimation.estimatedPages > cfg.maxPagesPerDocument) {
    return {
      valid: false,
      error: `Estimated page count (${pageEstimation.estimatedPages}) exceeds maximum of ${cfg.maxPagesPerDocument} pages per document.`,
      fileInfo,
    };
  }

  // Add warnings for edge cases
  if (pageEstimation.confidence === "low") {
    warnings.push(
      "Page count estimation may be inaccurate. Actual count will be determined during processing."
    );
  }

  if (needsOCR && file.size > 2 * 1024 * 1024) {
    warnings.push("Large files may take longer to process with OCR.");
  }

  if (file.type === "image/tiff") {
    warnings.push("TIFF files may contain multiple pages.");
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    fileInfo,
  };
}

/**
 * Validate multiple files for batch upload
 */
export function validateFiles(
  files: Array<{ name: string; size: number; type: string }>,
  config?: OCRLimitConfig
): {
  valid: FileValidationResult[];
  invalid: FileValidationResult[];
  totalSize: number;
  totalEstimatedPages: number;
  summary: string;
} {
  const cfg = config || getOCRLimitConfig();
  const valid: FileValidationResult[] = [];
  const invalid: FileValidationResult[] = [];
  let totalSize = 0;
  let totalEstimatedPages = 0;

  for (const file of files) {
    const result = validateFile(file, cfg);
    if (result.valid) {
      valid.push(result);
      totalSize += file.size;
      totalEstimatedPages += result.fileInfo.estimatedPages;
    } else {
      invalid.push(result);
    }
  }

  const summary =
    invalid.length > 0
      ? `${valid.length} of ${files.length} files valid. ${invalid.length} rejected.`
      : `All ${files.length} files valid.`;

  return {
    valid,
    invalid,
    totalSize,
    totalEstimatedPages,
    summary,
  };
}

/**
 * Get human-readable limit descriptions
 */
export function getLimitDescriptions(config?: OCRLimitConfig): {
  fileSize: string;
  pagesPerDocument: string;
  pagesPerSession: string;
  pagesPerDay: string;
  documentsPerSession: string;
  documentsPerDay: string;
  supportedTypes: string;
} {
  const cfg = config || getOCRLimitConfig();

  return {
    fileSize: `Maximum ${cfg.maxFileSizeMB}MB per file`,
    pagesPerDocument: `Maximum ${cfg.maxPagesPerDocument} pages per document`,
    pagesPerSession: `Maximum ${cfg.maxPagesPerSession} pages per session`,
    pagesPerDay: `Maximum ${cfg.maxPagesPerDay} pages per day`,
    documentsPerSession: `Maximum ${cfg.maxDocumentsPerSession} documents per session`,
    documentsPerDay: `Maximum ${cfg.maxDocumentsPerDay} documents per day`,
    supportedTypes: "PDF, JPEG, PNG, TIFF, TXT, DOCX",
  };
}
