/**
 * Vitest Test Setup
 *
 * This file runs before all tests and sets up the testing environment.
 */

import { beforeEach, afterEach, vi } from "vitest";

// Mock environment variables for tests
process.env.DEMO_MODE = "true";
process.env.DEMO_TOKEN_LIMIT_PER_REQUEST = "4000";
process.env.DEMO_TOKEN_LIMIT_PER_SESSION = "50000";
process.env.DEMO_TOKEN_LIMIT_PER_DAY = "100000";
process.env.DEMO_TOKEN_LIMIT_PER_MONTH = "1000000";
process.env.DEMO_OCR_MAX_FILE_SIZE_MB = "5";
process.env.DEMO_OCR_MAX_PAGES_PER_DOC = "10";
process.env.DEMO_OCR_MAX_DOCS_PER_SESSION = "5";
process.env.DEMO_OCR_MAX_PAGES_PER_SESSION = "30";
process.env.DEMO_OCR_DAILY_PAGE_LIMIT = "50";
process.env.DEMO_ADMIN_OVERRIDE_ENABLED = "true";
process.env.DEMO_ADMIN_OVERRIDE_KEY = "test-admin-key";

// OCR bypass config (uses OCR_ prefix, not DEMO_OCR_)
process.env.OCR_BYPASS_ENABLED = "true";
process.env.OCR_BYPASS_KEY = "test-ocr-bypass-key";

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Global fetch mock
global.fetch = vi.fn();

// Console mock to suppress logs during tests (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});
