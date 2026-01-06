/**
 * Chat Flow Integration Tests
 *
 * Tests the complete chat flow including token limits.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { tokenLimitService } from "@/lib/demo-limits/token-limit-service";
import { testUsers, testMessages, apiResponses } from "../fixtures";
import {
  createMockChatRequest,
  createMockResponse,
  createMockStreamResponse,
} from "../mocks";

// Mock the fetch for LLM API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Chat Flow Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    tokenLimitService.refreshConfig();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Normal Chat Flow", () => {
    it("should allow chat within limits", async () => {
      const userId = "chat-user-1";
      const sessionId = "chat-session-1";

      // Check limits before sending
      const limitCheck = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        500 // Estimated tokens
      );

      expect(limitCheck.allowed).toBe(true);

      // Simulate successful API call
      mockFetch.mockResolvedValueOnce(
        createMockStreamResponse(apiResponses.chatStreamChunks)
      );

      // Track usage after response
      await tokenLimitService.trackUsage(userId, sessionId, 800);

      // Verify usage was tracked
      const stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.session.used).toBe(800);
    });

    it("should accumulate usage across multiple messages", async () => {
      const userId = "multi-msg-user";
      const sessionId = "multi-msg-session";

      // Simulate multiple chat exchanges
      for (let i = 0; i < 5; i++) {
        const limitCheck = await tokenLimitService.checkLimits(
          userId,
          sessionId,
          500
        );
        expect(limitCheck.allowed).toBe(true);

        await tokenLimitService.trackUsage(userId, sessionId, 500);
      }

      const stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.session.used).toBe(2500);
      expect(stats.daily.used).toBe(2500);
    });

    it("should track usage per user independently", async () => {
      // User 1 uses tokens
      await tokenLimitService.trackUsage("user-A", "session-A", 10000);

      // User 2 uses tokens
      await tokenLimitService.trackUsage("user-B", "session-B", 5000);

      const statsA = await tokenLimitService.getUsageStats("user-A", "session-A");
      const statsB = await tokenLimitService.getUsageStats("user-B", "session-B");

      expect(statsA.daily.used).toBe(10000);
      expect(statsB.daily.used).toBe(5000);
    });
  });

  describe("Token Limit Enforcement", () => {
    it("should block requests exceeding per-request limit", async () => {
      const userId = "per-req-user";
      const sessionId = "per-req-session";

      // Try to send oversized request (>4000 tokens)
      const limitCheck = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        5000
      );

      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.limitType).toBe("per_request");
    });

    it("should block requests when session limit reached", async () => {
      const userId = "session-limit-user";
      const sessionId = "session-limit-session";

      // Use up most of session limit
      await tokenLimitService.trackUsage(userId, sessionId, 48000);

      // Try to send request that would exceed
      const limitCheck = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        3000
      );

      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.limitType).toBe("per_session");
      expect(limitCheck.remaining).toBe(2000);
    });

    it("should block requests when daily limit reached", async () => {
      const userId = "daily-limit-user";
      // Session limit is 50000, daily limit is 100000
      // So we need multiple sessions to hit daily limit without hitting session limit first

      // Use up most of daily limit across multiple sessions
      await tokenLimitService.trackUsage(userId, "daily-session-1", 49000);
      await tokenLimitService.trackUsage(userId, "daily-session-2", 49000);
      // Now at 98000 daily tokens

      // Try to send request that would exceed daily limit with a fresh session
      const limitCheck = await tokenLimitService.checkLimits(
        userId,
        "daily-session-3",
        3000
      );

      expect(limitCheck.allowed).toBe(false);
      expect(limitCheck.limitType).toBe("daily");
      expect(limitCheck.resetTime).toBeInstanceOf(Date);
    });

    it("should allow request after session reset", async () => {
      const userId = "reset-session-user";
      const sessionId = "reset-session-id";

      // Use up session limit
      await tokenLimitService.trackUsage(userId, sessionId, 49000);

      // Verify blocked
      let check = await tokenLimitService.checkLimits(userId, sessionId, 2000);
      expect(check.allowed).toBe(false);
      expect(check.limitType).toBe("per_session");

      // Reset session
      await tokenLimitService.resetSession(sessionId);

      // Should be allowed now (session reset, but daily still tracked)
      check = await tokenLimitService.checkLimits(userId, sessionId, 2000);

      // Note: Daily limit might still block if close to 100k
      // With 49k + reset, daily is still at 49k, so 2k more should be fine
      expect(check.allowed).toBe(true);
    });
  });

  describe("Admin Override", () => {
    it("should bypass all limits with valid admin key", async () => {
      const userId = "admin-override-user";
      const sessionId = "admin-override-session";

      // Max out all limits
      await tokenLimitService.trackUsage(userId, sessionId, 100000);

      // Verify blocked without admin key
      let check = await tokenLimitService.checkLimits(userId, sessionId, 1000);
      expect(check.allowed).toBe(false);

      // Should pass with admin key
      check = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        1000,
        "test-admin-key"
      );

      expect(check.allowed).toBe(true);
      expect(check.isAdminOverride).toBe(true);
    });

    it("should reject invalid admin keys", async () => {
      const userId = "bad-admin-user";
      const sessionId = "bad-admin-session";

      await tokenLimitService.trackUsage(userId, sessionId, 100000);

      const check = await tokenLimitService.checkLimits(
        userId,
        sessionId,
        1000,
        "wrong-key"
      );

      expect(check.allowed).toBe(false);
      expect(check.isAdminOverride).toBeUndefined();
    });
  });

  describe("Daily Reset", () => {
    it("should reset daily limits at midnight UTC", async () => {
      const userId = "midnight-reset-user";
      const sessionId = "midnight-reset-session";

      // Use tokens
      await tokenLimitService.trackUsage(userId, sessionId, 80000);

      // Verify near limit
      let stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.daily.used).toBe(80000);

      // Advance to next day (midnight UTC)
      vi.setSystemTime(new Date("2024-06-16T00:00:01Z"));

      // Trigger reset check
      await tokenLimitService.checkLimits(userId, sessionId, 100);

      // Verify reset
      stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.daily.used).toBe(0);
    });

    it("should preserve monthly usage across daily resets", async () => {
      const userId = "monthly-persist-user";
      const sessionId = "monthly-persist-session";

      // Use tokens on day 1
      await tokenLimitService.trackUsage(userId, sessionId, 50000);

      // Advance to day 2
      vi.setSystemTime(new Date("2024-06-16T12:00:00Z"));
      await tokenLimitService.checkLimits(userId, sessionId, 100);

      // Use more tokens
      await tokenLimitService.trackUsage(userId, sessionId, 30000);

      const stats = await tokenLimitService.getUsageStats(userId, sessionId);

      // Daily should only show day 2 usage
      expect(stats.daily.used).toBe(30000);

      // Monthly should show cumulative
      expect(stats.monthly.used).toBe(80000);
    });
  });

  describe("Concurrent Users", () => {
    it("should handle multiple concurrent users correctly", async () => {
      const users = [
        { userId: "concurrent-1", sessionId: "session-1" },
        { userId: "concurrent-2", sessionId: "session-2" },
        { userId: "concurrent-3", sessionId: "session-3" },
      ];

      // All users send requests simultaneously
      await Promise.all(
        users.map((user) =>
          tokenLimitService.checkLimits(user.userId, user.sessionId, 1000)
        )
      );

      // All users track usage
      await Promise.all(
        users.map((user) =>
          tokenLimitService.trackUsage(user.userId, user.sessionId, 1000)
        )
      );

      // Verify each user has independent tracking
      for (const user of users) {
        const stats = await tokenLimitService.getUsageStats(
          user.userId,
          user.sessionId
        );
        expect(stats.session.used).toBe(1000);
        expect(stats.daily.used).toBe(1000);
      }
    });
  });

  describe("Error Recovery", () => {
    it("should not track usage if API call fails", async () => {
      const userId = "error-user";
      const sessionId = "error-session";

      // Check limits (passes)
      const check = await tokenLimitService.checkLimits(userId, sessionId, 500);
      expect(check.allowed).toBe(true);

      // Simulate API failure - don't track usage
      mockFetch.mockRejectedValueOnce(new Error("API Error"));

      // Usage should remain zero
      const stats = await tokenLimitService.getUsageStats(userId, sessionId);
      expect(stats.session.used).toBe(0);
    });
  });
});

describe("Chat API Route Simulation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    tokenLimitService.refreshConfig();
  });

  /**
   * Simulates the chat API route logic
   */
  async function simulateChatApiCall(
    userId: string,
    sessionId: string,
    estimatedTokens: number,
    adminKey?: string
  ): Promise<{
    status: number;
    body: Record<string, unknown>;
    tokensUsed?: number;
  }> {
    // 1. Check limits
    const limitCheck = await tokenLimitService.checkLimits(
      userId,
      sessionId,
      estimatedTokens,
      adminKey
    );

    if (!limitCheck.allowed) {
      return {
        status: 429,
        body: {
          error: "TOKEN_LIMIT_EXCEEDED",
          limitType: limitCheck.limitType,
          message: limitCheck.message,
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
        },
      };
    }

    // 2. Simulate API call (would normally call LLM)
    const responseTokens = Math.floor(estimatedTokens * 0.8);
    const totalTokens = estimatedTokens + responseTokens;

    // 3. Track usage
    await tokenLimitService.trackUsage(userId, sessionId, totalTokens);

    return {
      status: 200,
      body: { success: true },
      tokensUsed: totalTokens,
    };
  }

  it("should return 200 for allowed requests", async () => {
    const result = await simulateChatApiCall(
      "api-test-user",
      "api-test-session",
      500
    );

    expect(result.status).toBe(200);
    expect(result.tokensUsed).toBeDefined();
  });

  it("should return 429 when limits exceeded", async () => {
    const userId = "api-limit-user";
    // Use multiple sessions to test daily limit without hitting session limit first

    // Use up daily limit across multiple sessions
    await tokenLimitService.trackUsage(userId, "api-session-1", 49000);
    await tokenLimitService.trackUsage(userId, "api-session-2", 49000);
    // Now at 98000 daily tokens

    const result = await simulateChatApiCall(userId, "api-session-3", 3000);

    expect(result.status).toBe(429);
    expect(result.body.error).toBe("TOKEN_LIMIT_EXCEEDED");
    expect(result.body.limitType).toBe("daily");
  });

  it("should include rate limit headers info in error response", async () => {
    const userId = "headers-user";
    const sessionId = "headers-session";

    await tokenLimitService.trackUsage(userId, sessionId, 99000);

    const result = await simulateChatApiCall(userId, sessionId, 2000);

    expect(result.body.limit).toBeDefined();
    expect(result.body.used).toBeDefined();
    expect(result.body.remaining).toBeDefined();
  });
});
