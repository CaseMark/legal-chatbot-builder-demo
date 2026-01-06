/**
 * OCR Limit Configuration
 * All limits are configurable via environment variables
 */

export interface OCRLimitConfig {
  // File limits
  maxFileSizeMB: number;
  maxFileSizeBytes: number;

  // Page limits
  maxPagesPerDocument: number;
  maxPagesPerDay: number;
  maxPagesPerSession: number;

  // Document limits
  maxDocumentsPerSession: number;
  maxDocumentsPerDay: number;

  // Processing limits
  maxConcurrentJobs: number;
  processingTimeoutMs: number;

  // Supported file types
  supportedImageTypes: string[];
  supportedDocumentTypes: string[];

  // Testing bypass
  bypassEnabled: boolean;
  bypassKey: string;
}

function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

export function getOCRLimitConfig(): OCRLimitConfig {
  const maxFileSizeMB = parseIntEnv("OCR_MAX_FILE_SIZE_MB", 5);

  return {
    // File limits
    maxFileSizeMB,
    maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,

    // Page limits
    maxPagesPerDocument: parseIntEnv("OCR_MAX_PAGES_PER_DOCUMENT", 10),
    maxPagesPerDay: parseIntEnv("OCR_MAX_PAGES_PER_DAY", 50),
    maxPagesPerSession: parseIntEnv("OCR_MAX_PAGES_PER_SESSION", 30),

    // Document limits
    maxDocumentsPerSession: parseIntEnv("OCR_MAX_DOCUMENTS_PER_SESSION", 5),
    maxDocumentsPerDay: parseIntEnv("OCR_MAX_DOCUMENTS_PER_DAY", 20),

    // Processing limits
    maxConcurrentJobs: parseIntEnv("OCR_MAX_CONCURRENT_JOBS", 3),
    processingTimeoutMs: parseIntEnv("OCR_PROCESSING_TIMEOUT_MS", 120000), // 2 minutes

    // Supported file types for OCR
    supportedImageTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/tiff",
      "image/webp",
      "image/bmp",
    ],

    // Document types that may need OCR (scanned PDFs)
    supportedDocumentTypes: [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/tiff",
    ],

    // Testing bypass
    bypassEnabled: parseBoolEnv("OCR_BYPASS_ENABLED", false),
    bypassKey: process.env.OCR_BYPASS_KEY || "",
  };
}

// Export default config
export const DEFAULT_OCR_CONFIG = getOCRLimitConfig();

/**
 * Example .env.local configuration:
 *
 * # OCR File Limits
 * OCR_MAX_FILE_SIZE_MB=5
 *
 * # OCR Page Limits
 * OCR_MAX_PAGES_PER_DOCUMENT=10
 * OCR_MAX_PAGES_PER_DAY=50
 * OCR_MAX_PAGES_PER_SESSION=30
 *
 * # OCR Document Limits
 * OCR_MAX_DOCUMENTS_PER_SESSION=5
 * OCR_MAX_DOCUMENTS_PER_DAY=20
 *
 * # OCR Processing
 * OCR_MAX_CONCURRENT_JOBS=3
 * OCR_PROCESSING_TIMEOUT_MS=120000
 *
 * # OCR Testing Bypass
 * OCR_BYPASS_ENABLED=true
 * OCR_BYPASS_KEY=your-ocr-test-key
 */
