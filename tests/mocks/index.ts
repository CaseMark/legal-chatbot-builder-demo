/**
 * Test Mocks
 *
 * Mock implementations for testing API routes and services.
 */

import { vi } from "vitest";

// =============================================================================
// API Response Mocks
// =============================================================================

/**
 * Create a mock Response object
 */
export function createMockResponse(
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, headers = {} } = options;

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/**
 * Create a mock streaming response
 */
export function createMockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const stream = new ReadableStream({
    start(controller) {
      function push() {
        if (chunkIndex < chunks.length) {
          controller.enqueue(encoder.encode(chunks[chunkIndex]));
          chunkIndex++;
          setTimeout(push, 10);
        } else {
          controller.close();
        }
      }
      push();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

/**
 * Mock fetch for successful chat API
 */
export function mockChatApiSuccess(responseContent: string = "This is a test response.") {
  return vi.fn().mockResolvedValue(
    createMockStreamResponse([
      `data: ${JSON.stringify({ choices: [{ delta: { content: responseContent } }] })}\n\n`,
      "data: [DONE]\n\n",
    ])
  );
}

/**
 * Mock fetch for rate limited response
 */
export function mockRateLimitedResponse(
  limitType: string = "daily",
  limit: number = 100000,
  used: number = 100000
) {
  return vi.fn().mockResolvedValue(
    createMockResponse(
      {
        error: "TOKEN_LIMIT_EXCEEDED",
        limitType,
        message: `${limitType} limit of ${limit.toLocaleString()} tokens reached.`,
        limit,
        used,
        remaining: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": "0",
        },
      }
    )
  );
}

// =============================================================================
// Request Mocks
// =============================================================================

/**
 * Create a mock NextRequest
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Request {
  const { method = "GET", headers = {}, body } = options;

  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Create a mock chat request
 */
export function createMockChatRequest(
  messages: Array<{ role: string; content: string }>,
  options: {
    userId?: string;
    sessionId?: string;
    adminKey?: string;
    researchMode?: boolean;
  } = {}
) {
  const { userId = "test-user", sessionId = "test-session", adminKey, researchMode = false } = options;

  const headers: Record<string, string> = {
    "x-user-id": userId,
    "x-session-id": sessionId,
  };

  if (adminKey) {
    headers["x-admin-key"] = adminKey;
  }

  return createMockRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers,
    body: { messages, researchMode },
  });
}

/**
 * Create a mock file upload FormData
 */
export function createMockFormData(
  file: { name: string; size: number; type: string },
  vaultId: string = "vault-123"
): FormData {
  const formData = new FormData();

  // Create a mock file blob
  const blob = new Blob(["x".repeat(file.size)], { type: file.type });
  const mockFile = new File([blob], file.name, { type: file.type });

  formData.append("file", mockFile);
  formData.append("vaultId", vaultId);

  return formData;
}

// =============================================================================
// Service Mocks
// =============================================================================

/**
 * Create a mock TokenLimitService
 */
export function createMockTokenLimitService() {
  return {
    checkLimits: vi.fn().mockResolvedValue({
      allowed: true,
      limit: 100000,
      used: 0,
      remaining: 100000,
    }),
    trackUsage: vi.fn().mockResolvedValue(undefined),
    getUsageStats: vi.fn().mockResolvedValue({
      session: { used: 0, limit: 50000, remaining: 50000, percentUsed: 0 },
      daily: { used: 0, limit: 100000, remaining: 100000, percentUsed: 0, resetTime: new Date() },
      monthly: { used: 0, limit: 1000000, remaining: 1000000, percentUsed: 0, resetTime: new Date() },
      ocr: { used: 0, limit: 50, remaining: 50, percentUsed: 0, resetTime: new Date() },
      limits: { perRequest: 4000, perSession: 50000, dailyPerUser: 100000, monthlyPerUser: 1000000 },
    }),
    resetSession: vi.fn().mockResolvedValue(undefined),
    isAdminOverride: vi.fn().mockReturnValue(false),
    refreshConfig: vi.fn(),
  };
}

/**
 * Create a mock OCRLimitService
 */
export function createMockOCRLimitService() {
  return {
    validateFile: vi.fn().mockReturnValue({ allowed: true }),
    checkLimits: vi.fn().mockResolvedValue({ allowed: true, remaining: 50 }),
    createJob: vi.fn().mockImplementation((userId, sessionId, file, pages) => ({
      id: `ocr_${Date.now()}`,
      userId,
      sessionId,
      filename: file.name,
      fileSize: file.size,
      fileType: file.type,
      estimatedPages: pages,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
    })),
    startJob: vi.fn(),
    completeJob: vi.fn(),
    failJob: vi.fn(),
    getJob: vi.fn(),
    getSessionJobs: vi.fn().mockReturnValue([]),
    trackUsage: vi.fn().mockResolvedValue(undefined),
    getUsageStats: vi.fn().mockResolvedValue({
      session: {
        pages: { used: 0, limit: 30, remaining: 30, percentUsed: 0 },
        documents: { used: 0, limit: 5, remaining: 5, percentUsed: 0 },
      },
      daily: {
        pages: { used: 0, limit: 50, remaining: 50, percentUsed: 0 },
        documents: { used: 0, limit: 20, remaining: 20, percentUsed: 0 },
        resetTime: new Date(),
      },
      limits: { maxFileSizeMB: 5, maxPagesPerDocument: 10 },
      queue: { active: 0, pending: 0, maxConcurrent: 3 },
    }),
    isBypass: vi.fn().mockReturnValue(false),
    refreshConfig: vi.fn(),
  };
}

// =============================================================================
// OCR Processing Mocks
// =============================================================================

/**
 * Mock OCR processing result
 */
export function createMockOCRResult(
  pages: number,
  options: { success?: boolean; text?: string } = {}
) {
  const { success = true, text = "Extracted text from document." } = options;

  if (success) {
    return {
      success: true,
      pages,
      text: Array(pages).fill(text).join("\n\n--- Page Break ---\n\n"),
      metadata: {
        processedAt: new Date().toISOString(),
        processingTimeMs: 1500 * pages,
        confidence: 0.95,
      },
    };
  }

  return {
    success: false,
    error: "OCR processing failed",
    pages: 0,
    text: "",
  };
}

// =============================================================================
// Time Mocks
// =============================================================================

/**
 * Mock the current date/time
 */
export function mockDate(date: Date | string | number) {
  const mockNow = new Date(date).getTime();
  vi.setSystemTime(mockNow);
  return mockNow;
}

/**
 * Advance time by specified milliseconds
 */
export function advanceTime(ms: number) {
  vi.advanceTimersByTime(ms);
}

/**
 * Mock midnight reset (advance to next midnight UTC)
 */
export function advanceToMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  vi.advanceTimersByTime(diff);
  return midnight;
}

// =============================================================================
// Header Mocks
// =============================================================================

/**
 * Create mock headers for authenticated request
 */
export function createAuthHeaders(
  userId: string = "test-user",
  sessionId?: string,
  adminKey?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-user-id": userId,
    "x-session-id": sessionId || `${userId}:${new Date().toISOString().split("T")[0]}`,
  };

  if (adminKey) {
    headers["x-admin-key"] = adminKey;
  }

  return headers;
}

// =============================================================================
// Export all mocks
// =============================================================================

export const mocks = {
  createMockResponse,
  createMockStreamResponse,
  mockChatApiSuccess,
  mockRateLimitedResponse,
  createMockRequest,
  createMockChatRequest,
  createMockFormData,
  createMockTokenLimitService,
  createMockOCRLimitService,
  createMockOCRResult,
  mockDate,
  advanceTime,
  advanceToMidnight,
  createAuthHeaders,
};
