/**
 * TokenLimitService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  tokenLimitService,
  estimateTokens,
  estimateMessageTokens,
} from "@/lib/demo-limits/token-limit-service";
import { testUsers, testMessages, estimatedTokens } from "../fixtures";

describe("TokenLimitService", () => {
  beforeEach(() => {
    // Reset the service state
    tokenLimitService.refreshConfig();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  describe("checkLimits", () => {
    it("should allow requests within all limits", async () => {
      const result = await tokenLimitService.checkLimits(
        testUsers.basic.userId,
        testUsers.basic.sessionId,
        1000
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it("should reject requests exceeding per-request limit", async () => {
      const result = await tokenLimitService.checkLimits(
        testUsers.basic.userId,
        testUsers.basic.sessionId,
        5000 // Exceeds 4000 per-request limit
      );

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("per_request");
      expect(result.message).toContain("exceeds maximum token limit");
    });

    it("should reject requests that would exceed session limit", async () => {
      const userId = "session-test-user";
      const sessionId = "session-test-session";

      // Use up most of the session limit
      await tokenLimitService.trackUsage(userId, sessionId, 49000);

      // Try to use more than remaining
      const result = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        2000 // Would exceed 50000 session limit
      );

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("per_session");
      expect(result.message).toContain("Session limit");
    });

    it("should reject requests that would exceed daily limit", async () => {
      const userId = "daily-test-user";
      // Need to use multiple sessions to test daily limit without hitting session limit first
      // Session limit is 50000, daily limit is 100000
      // So we need to use 2+ sessions to accumulate enough daily usage

      // Use up tokens across multiple sessions
      await tokenLimitService.trackUsage(userId, "daily-session-1", 49000);
      await tokenLimitService.trackUsage(userId, "daily-session-2", 49000);
      // Now at 98000 daily tokens

      // Try to use more than remaining daily limit with a fresh session
      const result = await tokenLimitService.checkLimits(
        userId,
        "daily-session-3",
        3000 // Would exceed 100000 daily limit (98000 + 3000 = 101000)
      );

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("daily");
      expect(result.message).toContain("Daily limit");
      expect(result.resetTime).toBeDefined();
    });

    it("should allow admin override to bypass all limits", async () => {
      const userId = "admin-test-user";
      const sessionId = "admin-test-session";

      // Use up all limits
      await tokenLimitService.trackUsage(userId, sessionId, 100000);

      // Admin should bypass
      const result = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        5000, // Would normally exceed all limits
        "test-admin-key"
      );

      expect(result.allowed).toBe(true);
      expect(result.isAdminOverride).toBe(true);
    });

    it("should not allow invalid admin key to bypass limits", async () => {
      const userId = "invalid-admin-user";
      const sessionId = "invalid-admin-session";

      // Use up session limit
      await tokenLimitService.trackUsage(userId, sessionId, 49000);

      const result = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        2000,
        "wrong-admin-key"
      );

      expect(result.allowed).toBe(false);
      expect(result.isAdminOverride).toBeUndefined();
    });
  });

  describe("trackUsage", () => {
    it("should track token usage for session", async () => {
      const userId = "track-user";
      const sessionId = "track-session";

      await tokenLimitService.trackUsage(userId, sessionId, 1000);
      const stats = await tokenLimitService.getUsageStats(userId, sessionId);

      expect(stats.session.used).toBe(1000);
    });

    it("should accumulate usage across multiple requests", async () => {
      const userId = "accumulate-user";
      const sessionId = "accumulate-session";

      await tokenLimitService.trackUsage(userId, sessionId, 1000);
      await tokenLimitService.trackUsage(userId, sessionId, 2000);
      await tokenLimitService.trackUsage(userId, sessionId, 500);

      const stats = await tokenLimitService.getUsageStats(userId, sessionId);

      expect(stats.session.used).toBe(3500);
      expect(stats.daily.used).toBe(3500);
      expect(stats.monthly.used).toBe(3500);
    });

    it("should track usage per user independently", async () => {
      const sessionId1 = "user1-session";
      const sessionId2 = "user2-session";

      await tokenLimitService.trackUsage("user1", sessionId1, 1000);
      await tokenLimitService.trackUsage("user2", sessionId2, 2000);

      const stats1 = await tokenLimitService.getUsageStats("user1", sessionId1);
      const stats2 = await tokenLimitService.getUsageStats("user2", sessionId2);

      expect(stats1.daily.used).toBe(1000);
      expect(stats2.daily.used).toBe(2000);
    });
  });

  describe("getUsageStats", () => {
    it("should return complete usage statistics", async () => {
      const userId = "stats-user";
      const sessionId = "stats-session";

      await tokenLimitService.trackUsage(userId, sessionId, 5000);

      const stats = await tokenLimitService.getUsageStats(userId, sessionId);

      expect(stats.session).toBeDefined();
      expect(stats.session.used).toBe(5000);
      expect(stats.session.limit).toBe(50000);
      expect(stats.session.remaining).toBe(45000);
      expect(stats.session.percentUsed).toBe(10);

      expect(stats.daily).toBeDefined();
      expect(stats.daily.resetTime).toBeInstanceOf(Date);

      expect(stats.monthly).toBeDefined();
      expect(stats.monthly.resetTime).toBeInstanceOf(Date);

      expect(stats.limits).toBeDefined();
      expect(stats.limits.perRequest).toBe(4000);
    });

    it("should return zero usage for new users", async () => {
      const stats = await tokenLimitService.getUsageStats(
        "new-user",
        "new-session"
      );

      expect(stats.session.used).toBe(0);
      expect(stats.daily.used).toBe(0);
      expect(stats.monthly.used).toBe(0);
    });
  });

  describe("resetSession", () => {
    it("should reset session usage to zero", async () => {
      const userId = "reset-user";
      const sessionId = "reset-session";

      await tokenLimitService.trackUsage(userId, sessionId, 10000);
      let stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.session.used).toBe(10000);

      await tokenLimitService.resetSession(sessionId);
      stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.session.used).toBe(0);
    });

    it("should not affect daily or monthly usage when resetting session", async () => {
      const userId = "reset-daily-user";
      const sessionId = "reset-daily-session";

      await tokenLimitService.trackUsage(userId, sessionId, 10000);
      await tokenLimitService.resetSession(sessionId);

      const stats = await tokenLimitService.getUsageStats(userId, sessionId);

      expect(stats.session.used).toBe(0);
      expect(stats.daily.used).toBe(10000); // Daily should remain
    });
  });

  describe("checkOcrLimit", () => {
    it("should allow OCR within limits", async () => {
      const result = await tokenLimitService.checkOcrLimit(
        testUsers.basic.userId,
        5
      );

      expect(result.allowed).toBe(true);
    });

    it("should reject OCR exceeding daily limit", async () => {
      const userId = "ocr-limit-user";

      // Track OCR usage near limit
      await tokenLimitService.trackOcrUsage(userId, 18);

      const result = await tokenLimitService.checkOcrLimit(userId, 5);

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("ocr");
      expect(result.message).toContain("OCR limit");
    });

    it("should allow admin to bypass OCR limits", async () => {
      const userId = "ocr-admin-user";

      // Use up OCR limit
      await tokenLimitService.trackOcrUsage(userId, 20);

      const result = await tokenLimitService.checkOcrLimit(
        userId,
        10,
        "test-admin-key"
      );

      expect(result.allowed).toBe(true);
      expect(result.isAdminOverride).toBe(true);
    });
  });

  describe("Daily Reset", () => {
    it("should reset daily usage at midnight UTC", async () => {
      const userId = "daily-reset-user";
      const sessionId = "daily-reset-session";

      // Use some tokens
      await tokenLimitService.trackUsage(userId, sessionId, 50000);

      let stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.daily.used).toBe(50000);

      // Advance to next day (midnight UTC)
      vi.setSystemTime(new Date("2024-06-16T00:00:01Z"));

      // Check limits to trigger reset check
      await tokenLimitService.checkLimits(userId, sessionId, 100);

      stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.daily.used).toBe(0); // Should be reset
    });
  });
});

describe("Token Estimation", () => {
  describe("estimateTokens", () => {
    it("should estimate tokens from text length", () => {
      const text = "Hello world"; // 11 characters
      const tokens = estimateTokens(text);

      // ~4 chars per token, so 11 chars ≈ 3 tokens
      expect(tokens).toBe(3);
    });

    it("should handle empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("should handle long text", () => {
      const text = "A".repeat(1000);
      const tokens = estimateTokens(text);

      // 1000 chars / 4 = 250 tokens
      expect(tokens).toBe(250);
    });
  });

  describe("estimateMessageTokens", () => {
    it("should estimate tokens for array of messages", () => {
      const tokens = estimateMessageTokens(testMessages.short);

      // "Hello" = ~2 tokens + 4 overhead per message
      expect(tokens).toBeGreaterThan(0);
    });

    it("should handle multiple messages", () => {
      const tokens = estimateMessageTokens(testMessages.medium);

      expect(tokens).toBeGreaterThan(estimateMessageTokens(testMessages.short));
    });

    it("should handle empty array", () => {
      expect(estimateMessageTokens([])).toBe(0);
    });
  });
});
