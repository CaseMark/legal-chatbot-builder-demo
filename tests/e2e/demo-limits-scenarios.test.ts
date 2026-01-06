/**
 * E2E Test Scenarios for Demo Limits
 *
 * Tests complete user journeys through the demo app with limits.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { tokenLimitService } from "@/lib/demo-limits/token-limit-service";
import { ocrLimitService } from "@/lib/ocr-limits/ocr-limit-service";
import { validateFile, estimatePageCount } from "@/lib/ocr-limits/validation";
import { logLimitHit, getLimitHitStats, clearLimitHitLogs } from "@/lib/demo-limits/limit-analytics";
import { testUsers, testFiles } from "../fixtures";

describe("E2E: User Hits Token Limit Mid-Conversation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    tokenLimitService.refreshConfig();
    clearLimitHitLogs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should gracefully handle hitting session limit during conversation", async () => {
    // Use unique IDs to avoid state pollution from other tests
    const timestamp = Date.now();
    const userId = `e2e-session-user-${timestamp}`;
    const sessionId = `e2e-session-id-${timestamp}`;

    // Simulate a conversation that gradually uses up session tokens
    // Note: per_request limit is 4000, so each request must be <= 4000
    // But we can track more usage (simulating response tokens)
    // Session limit is 50000

    // Track usage directly (simulating many small conversations)
    await tokenLimitService.trackUsage(userId, sessionId, 45000);

    // User tries to send another message (must be <= 4000 per_request)
    const finalCheck = await tokenLimitService.checkLimits(
      userId,
      sessionId,
      3000 // Would exceed 50000 session limit (45k + 3k needs < 5k remaining)
    );

    // Actually 45k + 3k = 48k, which is < 50k, so should be allowed
    // Let's use up more tokens first
    await tokenLimitService.trackUsage(userId, sessionId, 3000);
    // Now at 48000

    const check = await tokenLimitService.checkLimits(
      userId,
      sessionId,
      3000 // Would need 51k total, exceeds 50k limit
    );

    expect(check.allowed).toBe(false);
    expect(check.limitType).toBe("per_session");
    expect(check.remaining).toBe(2000);
    expect(check.message).toContain("Session limit");

    // Verify limit hit was logged
    const stats = getLimitHitStats();
    expect(stats.hitsToday).toBeGreaterThan(0);

    // User can reset session and continue
    await tokenLimitService.resetSession(sessionId);

    const afterReset = await tokenLimitService.checkLimits(
      userId,
      sessionId,
      3000
    );
    expect(afterReset.allowed).toBe(true);
  });

  it("should transition from session to daily limit", async () => {
    // Use unique user ID to avoid state pollution
    const timestamp = Date.now();
    const userId = `e2e-daily-user-${timestamp}`;

    // Session 1: Use 49k tokens (just under session limit)
    const session1 = `transition-session-1-${timestamp}`;
    await tokenLimitService.trackUsage(userId, session1, 49000);

    // Reset session
    await tokenLimitService.resetSession(session1);

    // Session 2: Use another 49k tokens (total daily: 98k)
    const session2 = `transition-session-2-${timestamp}`;
    await tokenLimitService.trackUsage(userId, session2, 49000);

    // Session 3: Try to use more that would exceed daily limit
    // 98k + 3k = 101k > 100k daily limit
    // Note: per_request limit is 4000, so we need to request <= 4000 tokens
    const session3 = `transition-session-3-${timestamp}`;
    const check = await tokenLimitService.checkLimits(
      userId,
      session3,
      3000 // Under per_request limit but should hit daily limit
    );

    expect(check.allowed).toBe(false);
    expect(check.limitType).toBe("daily");
    expect(check.remaining).toBe(2000); // 100k - 98k
  });
});

describe("E2E: User Uploads Document Exceeding Size Limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    ocrLimitService.refreshConfig();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should reject oversized document with clear error message", async () => {
    const userId = "e2e-upload-user";
    const sessionId = "e2e-upload-session";

    // User tries to upload 10MB file (limit is 5MB)
    const oversizedFile = {
      name: "large-contract.pdf",
      size: 10 * 1024 * 1024,
      type: "application/pdf",
    };

    // Step 1: File validation fails
    const validation = ocrLimitService.validateFile(oversizedFile);

    expect(validation.allowed).toBe(false);
    expect(validation.limitType).toBe("file_size");
    expect(validation.message).toContain("exceeds maximum");
    expect(validation.message).toContain("5MB");

    // User should not be able to proceed
    // The upload should be rejected before even checking limits
  });

  it("should provide helpful feedback for unsupported file types", async () => {
    const unsupportedFile = {
      name: "spreadsheet.xlsx",
      size: 1024 * 1024,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    const validation = ocrLimitService.validateFile(unsupportedFile);

    expect(validation.allowed).toBe(false);
    expect(validation.limitType).toBe("file_type");
    expect(validation.message).toContain("not supported");
  });

  it("should allow valid files to proceed", async () => {
    // Use unique IDs to avoid state pollution
    const timestamp = Date.now();
    const userId = `e2e-valid-user-${timestamp}`;
    const sessionId = `e2e-valid-session-${timestamp}`;

    // User uploads valid small PDF (use smaller file to ensure page limit not hit)
    const validFile = {
      name: "contract.pdf",
      size: 500 * 1024, // 500KB - small file
      type: "application/pdf",
    };

    // Step 1: Validation passes
    const validation = ocrLimitService.validateFile(validFile);
    expect(validation.allowed).toBe(true);

    // Step 2: Estimate pages
    const estimation = estimatePageCount(validFile.size, validFile.type);
    expect(estimation.estimatedPages).toBeGreaterThan(0);

    // Step 3: Limit check passes
    const limitCheck = await ocrLimitService.checkLimits(
      userId,
      sessionId,
      estimation.estimatedPages
    );
    expect(limitCheck.allowed).toBe(true);

    // Step 4: Create and process job
    const job = ocrLimitService.createJob(
      userId,
      sessionId,
      validFile,
      estimation.estimatedPages
    );
    expect(job.status).toBe("queued");

    // Clean up - complete the job
    await ocrLimitService.completeJob(job.id, estimation.estimatedPages);
  });
});

describe("E2E: User Exceeds Daily Limits", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    tokenLimitService.refreshConfig();
    ocrLimitService.refreshConfig();
    clearLimitHitLogs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should block all operations when daily token limit reached", async () => {
    const userId = "e2e-daily-block-user";
    // Session limit is 50000, daily limit is 100000
    // Need to use multiple sessions to test daily limit

    // Use up daily token limit across multiple sessions
    await tokenLimitService.trackUsage(userId, "daily-block-s1", 49000);
    await tokenLimitService.trackUsage(userId, "daily-block-s2", 49000);
    // Now at 98000 daily tokens

    // Any new request should be blocked by daily limit
    const check = await tokenLimitService.checkLimits(userId, "daily-block-s3", 3000);

    expect(check.allowed).toBe(false);
    expect(check.limitType).toBe("daily");
    expect(check.resetTime).toBeDefined();

    // Calculate time until reset
    const now = new Date();
    const resetTime = check.resetTime!;
    expect(resetTime.getTime()).toBeGreaterThan(now.getTime());
  });

  it("should block OCR operations when daily page limit reached", async () => {
    const userId = "e2e-ocr-daily-user";
    const sessionId = "e2e-ocr-daily-session";

    // Use up daily OCR page limit (50 pages)
    await ocrLimitService.trackUsage(userId, sessionId, 30);
    await ocrLimitService.trackUsage(userId, "session-2", 15);

    // Try to upload another document
    const check = await ocrLimitService.checkLimits(
      userId,
      "session-3",
      10 // Would exceed 50 page limit
    );

    expect(check.allowed).toBe(false);
    expect(check.limitType).toBe("pages_per_day");
    expect(check.remaining).toBe(5);
  });

  it("should show remaining usage accurately", async () => {
    const userId = "e2e-remaining-user";
    const sessionId = "e2e-remaining-session";

    // Use some tokens
    await tokenLimitService.trackUsage(userId, sessionId, 60000);

    const stats = await tokenLimitService.getUsageStats(userId, sessionId);

    expect(stats.daily.used).toBe(60000);
    expect(stats.daily.remaining).toBe(40000);
    expect(stats.daily.percentUsed).toBe(60);
  });
});

describe("E2E: Limit Reset at Midnight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tokenLimitService.refreshConfig();
    ocrLimitService.refreshConfig();
    clearLimitHitLogs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should reset token limits at midnight UTC", async () => {
    const timestamp = Date.now();
    const userId = `e2e-midnight-user-${timestamp}`;

    // Set time to 11:55 PM UTC
    vi.setSystemTime(new Date("2024-06-15T23:55:00Z"));

    // Use tokens across sessions to approach daily limit
    await tokenLimitService.trackUsage(userId, `midnight-s1-${timestamp}`, 49000);
    await tokenLimitService.trackUsage(userId, `midnight-s2-${timestamp}`, 49000);
    // Now at 98000 daily tokens

    // Request must be <= 4000 (per_request limit), so use 3000
    let check = await tokenLimitService.checkLimits(userId, `midnight-s3-${timestamp}`, 3000);
    expect(check.allowed).toBe(false);
    expect(check.limitType).toBe("daily");

    // Advance past midnight UTC
    vi.setSystemTime(new Date("2024-06-16T00:05:00Z"));

    // Trigger reset by checking limits with a fresh session
    check = await tokenLimitService.checkLimits(userId, `midnight-s4-${timestamp}`, 3000);

    // Daily limit should be reset
    expect(check.allowed).toBe(true);

    // Verify stats reflect reset
    const stats = await tokenLimitService.getUsageStats(userId, `midnight-s4-${timestamp}`);
    expect(stats.daily.used).toBe(0);

    // Monthly should still accumulate
    expect(stats.monthly.used).toBe(98000);
  });

  it("should reset OCR limits at midnight UTC", async () => {
    const userId = "e2e-ocr-midnight-user";

    // Set time to 11:55 PM UTC
    vi.setSystemTime(new Date("2024-06-15T23:55:00Z"));

    // Use up daily OCR pages across sessions (daily limit is 50, session is 30)
    await ocrLimitService.trackUsage(userId, "ocr-midnight-s1", 25);
    await ocrLimitService.trackUsage(userId, "ocr-midnight-s2", 23);
    // Now at 48 daily pages

    let check = await ocrLimitService.checkLimits(userId, "ocr-midnight-s3", 5);
    expect(check.allowed).toBe(false);
    expect(check.limitType).toBe("pages_per_day");

    // Advance past midnight
    vi.setSystemTime(new Date("2024-06-16T00:05:00Z"));

    // Should be allowed now with a fresh session
    check = await ocrLimitService.checkLimits(userId, "ocr-midnight-s4", 5);
    expect(check.allowed).toBe(true);
  });

  it("should handle timezone edge cases correctly", async () => {
    const userId = "e2e-tz-user";
    const sessionId = "e2e-tz-session";

    // Simulate user in Pacific timezone thinking it's still the same day
    // UTC: June 16, 00:05 = Pacific: June 15, 17:05

    vi.setSystemTime(new Date("2024-06-15T08:00:00Z"));
    await tokenLimitService.trackUsage(userId, sessionId, 50000);

    // Jump to next UTC day
    vi.setSystemTime(new Date("2024-06-16T00:05:00Z"));

    // Should reset based on UTC midnight
    await tokenLimitService.checkLimits(userId, sessionId, 100);

    const stats = await tokenLimitService.getUsageStats(userId, sessionId);
    expect(stats.daily.used).toBe(0);
  });
});

describe("E2E: Admin Override Scenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    tokenLimitService.refreshConfig();
    ocrLimitService.refreshConfig();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow admin to bypass all token limits", async () => {
    const userId = "e2e-admin-token-user";
    const sessionId = "e2e-admin-token-session";

    // Max out all limits
    await tokenLimitService.trackUsage(userId, sessionId, 100000);

    // Regular request fails
    let check = await tokenLimitService.checkLimits(userId, sessionId, 1000);
    expect(check.allowed).toBe(false);

    // Admin request succeeds
    check = await tokenLimitService.checkLimits(
      userId,
      sessionId,
      1000,
      "test-admin-key"
    );
    expect(check.allowed).toBe(true);
    expect(check.isAdminOverride).toBe(true);
  });

  it("should allow OCR bypass for testing", async () => {
    const userId = "e2e-ocr-bypass-user";
    const sessionId = "e2e-ocr-bypass-session";

    // Max out OCR limits
    for (let i = 0; i < 5; i++) {
      await ocrLimitService.trackUsage(userId, sessionId, 10);
    }

    // Regular check fails
    let check = await ocrLimitService.checkLimits(userId, sessionId, 10);
    expect(check.allowed).toBe(false);

    // Bypass check succeeds
    check = await ocrLimitService.checkLimits(
      userId,
      sessionId,
      100, // Even large requests allowed
      "test-ocr-bypass-key"
    );
    expect(check.allowed).toBe(true);
    expect(check.isBypass).toBe(true);
  });

  it("should reject invalid admin/bypass keys", async () => {
    const userId = "e2e-invalid-key-user";
    const sessionId = "e2e-invalid-key-session";

    await tokenLimitService.trackUsage(userId, sessionId, 100000);

    // Invalid key should be rejected
    const check = await tokenLimitService.checkLimits(
      userId,
      sessionId,
      1000,
      "wrong-admin-key"
    );

    expect(check.allowed).toBe(false);
    expect(check.isAdminOverride).toBeUndefined();
  });
});

describe("E2E: Complete User Journey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T09:00:00Z"));
    tokenLimitService.refreshConfig();
    ocrLimitService.refreshConfig();
    clearLimitHitLogs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should simulate a complete day of demo usage", async () => {
    // Use unique user ID to avoid state from other tests
    const timestamp = Date.now();
    const userId = `e2e-journey-user-${timestamp}`;

    // Morning session: Upload documents and chat
    const session1 = `morning-session-${timestamp}`;

    // Upload 3 documents
    for (let i = 0; i < 3; i++) {
      const check = await ocrLimitService.checkLimits(userId, session1, 5);
      expect(check.allowed).toBe(true);
      await ocrLimitService.trackUsage(userId, session1, 5);
    }

    // Chat about uploaded documents
    for (let i = 0; i < 5; i++) {
      const check = await tokenLimitService.checkLimits(userId, session1, 2000);
      expect(check.allowed).toBe(true);
      await tokenLimitService.trackUsage(userId, session1, 2000);
    }

    // Check morning usage
    let tokenStats = await tokenLimitService.getUsageStats(userId, session1);
    expect(tokenStats.session.used).toBe(10000);
    expect(tokenStats.daily.used).toBe(10000);

    let ocrStats = await ocrLimitService.getUsageStats(userId, session1);
    expect(ocrStats.session.pages.used).toBe(15);
    expect(ocrStats.session.documents.used).toBe(3);

    // Afternoon: New session
    vi.setSystemTime(new Date("2024-06-15T14:00:00Z"));
    const session2 = `afternoon-session-${timestamp}`;

    // More chatting
    for (let i = 0; i < 10; i++) {
      const check = await tokenLimitService.checkLimits(userId, session2, 3000);
      expect(check.allowed).toBe(true);
      await tokenLimitService.trackUsage(userId, session2, 3000);
    }

    // Upload more documents
    for (let i = 0; i < 2; i++) {
      const check = await ocrLimitService.checkLimits(userId, session2, 5);
      expect(check.allowed).toBe(true);
      await ocrLimitService.trackUsage(userId, session2, 5);
    }

    // Check afternoon usage
    tokenStats = await tokenLimitService.getUsageStats(userId, session2);
    expect(tokenStats.session.used).toBe(30000); // New session
    expect(tokenStats.daily.used).toBe(40000); // Cumulative

    ocrStats = await ocrLimitService.getUsageStats(userId, session2);
    expect(ocrStats.session.documents.used).toBe(2); // New session
    expect(ocrStats.daily.documents.used).toBe(5); // Cumulative

    // Evening: Approaching limits - use a new session to avoid session limit
    vi.setSystemTime(new Date("2024-06-15T20:00:00Z"));
    const session3 = `evening-session-${timestamp}`;

    // Heavy usage across sessions (session limit is 50k, we have 40k daily already)
    await tokenLimitService.trackUsage(userId, session3, 48000); // session3 at 48k
    // Daily total: 40k + 48k = 88k

    const session4 = `evening-session2-${timestamp}`;
    await tokenLimitService.trackUsage(userId, session4, 10000); // session4 at 10k
    // Daily total: 88k + 10k = 98k

    // Should hit daily limit on a fresh session
    // Note: per_request limit is 4000, so request must be <= 4000
    const session5 = `evening-session3-${timestamp}`;
    const finalCheck = await tokenLimitService.checkLimits(
      userId,
      session5,
      3000 // 98k + 3k = 101k > 100k daily limit, and 3k <= 4k per_request
    );
    expect(finalCheck.allowed).toBe(false);
    expect(finalCheck.limitType).toBe("daily");

    // Check analytics captured the limit hit
    const analytics = getLimitHitStats();
    expect(analytics.hitsToday).toBeGreaterThan(0);
    expect(analytics.hitsByUser[userId]).toBeGreaterThan(0);
  });
});
