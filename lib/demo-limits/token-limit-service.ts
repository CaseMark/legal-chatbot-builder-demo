/**
 * TokenLimitService - Comprehensive token limiting for demo app
 *
 * Tracks usage at multiple levels:
 * - Per-request: Limit individual API call token count
 * - Per-session: Track cumulative tokens within a browser session
 * - Per-user daily: Track daily usage per user/IP
 * - Per-user monthly: Track monthly usage per user/IP
 */

import { getDemoLimits, DemoLimitsConfig } from "./demo-limits.config";
import { logLimitHit } from "./limit-analytics";

// Legacy config adapter for backward compatibility
import { getTokenLimitConfig, TokenLimitConfig } from "./config";

// Usage record for a user
interface UserUsage {
  // Daily tracking
  dailyTokens: number;
  dailyOcrPages: number;
  dailyResetTime: number;

  // Monthly tracking
  monthlyTokens: number;
  monthlyResetTime: number;

  // Request timestamps for rate limiting
  lastRequestTime: number;
  requestCount: number;
}

// Session usage (keyed by session ID)
interface SessionUsage {
  tokens: number;
  createdAt: number;
  lastActivity: number;
}

// In-memory stores (use Redis in production)
const userUsageStore = new Map<string, UserUsage>();
const sessionUsageStore = new Map<string, SessionUsage>();

// Cleanup old sessions periodically (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export type LimitType =
  | "per_request"
  | "per_session"
  | "daily"
  | "monthly"
  | "ocr";

export interface LimitCheckResult {
  allowed: boolean;
  limitType?: LimitType;
  limit: number;
  used: number;
  remaining: number;
  resetTime?: Date;
  message?: string;
  isAdminOverride?: boolean;
}

export interface UsageStats {
  session: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  daily: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    resetTime: Date;
  };
  monthly: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    resetTime: Date;
  };
  ocr: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    resetTime: Date;
  };
  limits: {
    perRequest: number;
    perSession: number;
    dailyPerUser: number;
    monthlyPerUser: number;
  };
}

class TokenLimitService {
  private config: TokenLimitConfig;
  private demoConfig: DemoLimitsConfig;

  constructor() {
    this.config = getTokenLimitConfig();
    this.demoConfig = getDemoLimits();

    // Cleanup old sessions every hour
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
    }
  }

  /**
   * Refresh config from environment (useful for testing)
   */
  refreshConfig(): void {
    this.config = getTokenLimitConfig();
    this.demoConfig = getDemoLimits();
  }

  /**
   * Check if admin override is active
   */
  isAdminOverride(adminKey?: string): boolean {
    // Check unified config first
    if (this.demoConfig.admin.overrideEnabled && this.demoConfig.admin.overrideKey) {
      if (adminKey === this.demoConfig.admin.overrideKey) return true;
    }
    // Fall back to legacy config
    if (!this.config.adminOverrideEnabled) return false;
    if (!this.config.adminOverrideKey) return false;
    return adminKey === this.config.adminOverrideKey;
  }

  /**
   * Get or create user usage record
   */
  private getUserUsage(userId: string): UserUsage {
    const now = Date.now();
    let usage = userUsageStore.get(userId);

    if (!usage) {
      usage = {
        dailyTokens: 0,
        dailyOcrPages: 0,
        dailyResetTime: this.getNextDailyReset(),
        monthlyTokens: 0,
        monthlyResetTime: this.getNextMonthlyReset(),
        lastRequestTime: now,
        requestCount: 0,
      };
      userUsageStore.set(userId, usage);
      return usage;
    }

    // Check if daily reset is needed
    if (now >= usage.dailyResetTime) {
      usage.dailyTokens = 0;
      usage.dailyOcrPages = 0;
      usage.dailyResetTime = this.getNextDailyReset();
    }

    // Check if monthly reset is needed
    if (now >= usage.monthlyResetTime) {
      usage.monthlyTokens = 0;
      usage.monthlyResetTime = this.getNextMonthlyReset();
    }

    return usage;
  }

  /**
   * Get or create session usage record
   */
  private getSessionUsage(sessionId: string): SessionUsage {
    const now = Date.now();
    let session = sessionUsageStore.get(sessionId);

    if (!session) {
      session = {
        tokens: 0,
        createdAt: now,
        lastActivity: now,
      };
      sessionUsageStore.set(sessionId, session);
    } else {
      session.lastActivity = now;
    }

    return session;
  }

  /**
   * Calculate next daily reset time (midnight UTC)
   */
  private getNextDailyReset(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Calculate next monthly reset time (first of next month UTC)
   */
  private getNextMonthlyReset(): number {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    nextMonth.setUTCDate(1);
    nextMonth.setUTCHours(0, 0, 0, 0);
    return nextMonth.getTime();
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    sessionUsageStore.forEach((session, sessionId) => {
      if (now - session.lastActivity > SESSION_EXPIRY_MS) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach((id) => sessionUsageStore.delete(id));
  }

  /**
   * Check all limits before making an API call
   */
  async checkLimits(
    userId: string,
    sessionId: string,
    requestedTokens: number,
    adminKey?: string
  ): Promise<LimitCheckResult> {
    // Check admin override first
    if (this.isAdminOverride(adminKey)) {
      return {
        allowed: true,
        limit: Infinity,
        used: 0,
        remaining: Infinity,
        isAdminOverride: true,
      };
    }

    // 1. Check per-request limit
    if (requestedTokens > this.config.perRequestLimit) {
      const result: LimitCheckResult = {
        allowed: false,
        limitType: "per_request",
        limit: this.config.perRequestLimit,
        used: requestedTokens,
        remaining: 0,
        message: `Request exceeds maximum token limit of ${this.config.perRequestLimit.toLocaleString()} tokens. Please reduce your message length.`,
      };
      // Log the limit hit
      logLimitHit({
        userId,
        sessionId,
        limitType: "per_request",
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
        message: result.message!,
      });
      return result;
    }

    // 2. Check session limit
    const session = this.getSessionUsage(sessionId);
    if (session.tokens + requestedTokens > this.config.perSessionLimit) {
      const result: LimitCheckResult = {
        allowed: false,
        limitType: "per_session",
        limit: this.config.perSessionLimit,
        used: session.tokens,
        remaining: this.config.perSessionLimit - session.tokens,
        message: `Session limit of ${this.config.perSessionLimit.toLocaleString()} tokens reached. Please start a new session or clear your chat.`,
      };
      logLimitHit({
        userId,
        sessionId,
        limitType: "per_session",
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
        message: result.message!,
      });
      return result;
    }

    // 3. Check daily limit
    const userUsage = this.getUserUsage(userId);
    if (userUsage.dailyTokens + requestedTokens > this.config.dailyLimitPerUser) {
      const result: LimitCheckResult = {
        allowed: false,
        limitType: "daily",
        limit: this.config.dailyLimitPerUser,
        used: userUsage.dailyTokens,
        remaining: this.config.dailyLimitPerUser - userUsage.dailyTokens,
        resetTime: new Date(userUsage.dailyResetTime),
        message: `Daily limit of ${this.config.dailyLimitPerUser.toLocaleString()} tokens reached. Resets at midnight UTC.`,
      };
      logLimitHit({
        userId,
        sessionId,
        limitType: "daily",
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
        message: result.message!,
      });
      return result;
    }

    // 4. Check monthly limit
    if (
      userUsage.monthlyTokens + requestedTokens >
      this.config.monthlyLimitPerUser
    ) {
      const result: LimitCheckResult = {
        allowed: false,
        limitType: "monthly",
        limit: this.config.monthlyLimitPerUser,
        used: userUsage.monthlyTokens,
        remaining: this.config.monthlyLimitPerUser - userUsage.monthlyTokens,
        resetTime: new Date(userUsage.monthlyResetTime),
        message: `Monthly limit of ${this.config.monthlyLimitPerUser.toLocaleString()} tokens reached. Resets on the 1st of next month.`,
      };
      logLimitHit({
        userId,
        sessionId,
        limitType: "monthly",
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
        message: result.message!,
      });
      return result;
    }

    // All checks passed
    return {
      allowed: true,
      limit: this.config.dailyLimitPerUser,
      used: userUsage.dailyTokens,
      remaining: this.config.dailyLimitPerUser - userUsage.dailyTokens,
    };
  }

  /**
   * Check OCR limits
   */
  async checkOcrLimit(
    userId: string,
    requestedPages: number,
    adminKey?: string
  ): Promise<LimitCheckResult> {
    if (this.isAdminOverride(adminKey)) {
      return {
        allowed: true,
        limit: Infinity,
        used: 0,
        remaining: Infinity,
        isAdminOverride: true,
      };
    }

    const userUsage = this.getUserUsage(userId);

    if (
      userUsage.dailyOcrPages + requestedPages >
      this.config.dailyOcrPagesLimit
    ) {
      const result: LimitCheckResult = {
        allowed: false,
        limitType: "ocr",
        limit: this.config.dailyOcrPagesLimit,
        used: userUsage.dailyOcrPages,
        remaining: this.config.dailyOcrPagesLimit - userUsage.dailyOcrPages,
        resetTime: new Date(userUsage.dailyResetTime),
        message: `Daily OCR limit of ${this.config.dailyOcrPagesLimit} pages reached. Resets at midnight UTC.`,
      };
      logLimitHit({
        userId,
        sessionId: `${userId}:ocr`,
        limitType: "ocr",
        limit: result.limit,
        used: result.used,
        remaining: result.remaining,
        message: result.message!,
      });
      return result;
    }

    return {
      allowed: true,
      limit: this.config.dailyOcrPagesLimit,
      used: userUsage.dailyOcrPages,
      remaining: this.config.dailyOcrPagesLimit - userUsage.dailyOcrPages,
    };
  }

  /**
   * Track token usage after successful API call
   */
  async trackUsage(
    userId: string,
    sessionId: string,
    tokensUsed: number
  ): Promise<void> {
    // Update session usage
    const session = this.getSessionUsage(sessionId);
    session.tokens += tokensUsed;
    sessionUsageStore.set(sessionId, session);

    // Update user usage
    const userUsage = this.getUserUsage(userId);
    userUsage.dailyTokens += tokensUsed;
    userUsage.monthlyTokens += tokensUsed;
    userUsage.lastRequestTime = Date.now();
    userUsage.requestCount += 1;
    userUsageStore.set(userId, userUsage);
  }

  /**
   * Track OCR usage
   */
  async trackOcrUsage(userId: string, pagesProcessed: number): Promise<void> {
    const userUsage = this.getUserUsage(userId);
    userUsage.dailyOcrPages += pagesProcessed;
    userUsageStore.set(userId, userUsage);
  }

  /**
   * Get comprehensive usage statistics
   */
  async getUsageStats(userId: string, sessionId: string): Promise<UsageStats> {
    const userUsage = this.getUserUsage(userId);
    const session = this.getSessionUsage(sessionId);

    const calcPercent = (used: number, limit: number) =>
      limit > 0 ? Math.round((used / limit) * 100) : 0;

    return {
      session: {
        used: session.tokens,
        limit: this.config.perSessionLimit,
        remaining: Math.max(0, this.config.perSessionLimit - session.tokens),
        percentUsed: calcPercent(session.tokens, this.config.perSessionLimit),
      },
      daily: {
        used: userUsage.dailyTokens,
        limit: this.config.dailyLimitPerUser,
        remaining: Math.max(
          0,
          this.config.dailyLimitPerUser - userUsage.dailyTokens
        ),
        percentUsed: calcPercent(
          userUsage.dailyTokens,
          this.config.dailyLimitPerUser
        ),
        resetTime: new Date(userUsage.dailyResetTime),
      },
      monthly: {
        used: userUsage.monthlyTokens,
        limit: this.config.monthlyLimitPerUser,
        remaining: Math.max(
          0,
          this.config.monthlyLimitPerUser - userUsage.monthlyTokens
        ),
        percentUsed: calcPercent(
          userUsage.monthlyTokens,
          this.config.monthlyLimitPerUser
        ),
        resetTime: new Date(userUsage.monthlyResetTime),
      },
      ocr: {
        used: userUsage.dailyOcrPages,
        limit: this.config.dailyOcrPagesLimit,
        remaining: Math.max(
          0,
          this.config.dailyOcrPagesLimit - userUsage.dailyOcrPages
        ),
        percentUsed: calcPercent(
          userUsage.dailyOcrPages,
          this.config.dailyOcrPagesLimit
        ),
        resetTime: new Date(userUsage.dailyResetTime),
      },
      limits: {
        perRequest: this.config.perRequestLimit,
        perSession: this.config.perSessionLimit,
        dailyPerUser: this.config.dailyLimitPerUser,
        monthlyPerUser: this.config.monthlyLimitPerUser,
      },
    };
  }

  /**
   * Reset session usage (e.g., when user clears chat)
   */
  async resetSession(sessionId: string): Promise<void> {
    sessionUsageStore.delete(sessionId);
  }

  /**
   * Get current config (for debugging/admin)
   */
  getConfig(): TokenLimitConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const tokenLimitService = new TokenLimitService();

// Export helper functions for backward compatibility
export async function checkTokenLimits(
  userId: string,
  sessionId: string,
  requestedTokens: number,
  adminKey?: string
): Promise<LimitCheckResult> {
  return tokenLimitService.checkLimits(
    userId,
    sessionId,
    requestedTokens,
    adminKey
  );
}

export async function trackTokenUsage(
  userId: string,
  sessionId: string,
  tokensUsed: number
): Promise<void> {
  return tokenLimitService.trackUsage(userId, sessionId, tokensUsed);
}

export async function getUsageStats(
  userId: string,
  sessionId: string
): Promise<UsageStats> {
  return tokenLimitService.getUsageStats(userId, sessionId);
}

// Token estimation utilities
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;
  for (const message of messages) {
    total += 4; // role + structure overhead
    total += estimateTokens(message.content);
  }
  return total;
}
