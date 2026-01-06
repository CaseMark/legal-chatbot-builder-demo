// Configuration
export { getOCRLimitConfig, DEFAULT_OCR_CONFIG } from "./config";
export type { OCRLimitConfig } from "./config";

// OCR Limit Service
export {
  ocrLimitService,
  checkOCRLimits,
  getOCRUsageStats,
} from "./ocr-limit-service";
export type {
  OCRJob,
  OCRJobStatus,
  OCRLimitCheckResult,
  OCRUsageStats,
} from "./ocr-limit-service";

// Validation utilities
export {
  validateFile,
  validateFiles,
  formatFileSize,
  getFileExtension,
  requiresOCR,
  estimatePageCount,
  getLimitDescriptions,
} from "./validation";
export type { FileValidationResult, PageEstimation } from "./validation";
