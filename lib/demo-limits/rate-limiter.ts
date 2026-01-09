/**
 * Rate Limiter Service - API-level rate limiting with tiered access
 *
 * Implements:
 * 1. API-level rate limiting (requests per time window)
 * 2. Request throttling (minimum delay between requests)
 * 3. Tiered limits (demo vs authenticated users)
 *
 * Uses in-memory stores (use Redis in production for distributed systems)
 */

// =============================================================================
// Types
// =============================================================================

export type UserTier = "demo" | "authenticated" | "premium" | "admin";

export interface TierLimits {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Requests per hour */
  requestsPerHour: number;
  /** Requests per day */
  requestsPerDay: number;
  /** Minimum milliseconds between requests (throttling) */
  minRequestIntervalMs: number;
  /** Tokens per request */
  tokensPerRequest: number;
  /** Tokens per session */
  tokensPerSession: number;
  /** Tokens per day */
  tokensPerDay: number;
  /** Tokens per month */
  tokensPerMonth: number;
}

export interface RateLimitConfig {
  demo: TierLimits;
  authenticated: TierLimits;
  premium: TierLimits;
  admin: TierLimits;
}

export interface RateLimitResult {
  allowed: boolean;
  tier: UserTier;
  limitType?: "requests_per_minute" | "requests_per_hour" | "requests_per_day" | "throttle";
  limit?: number;
  used?: number;
  remaining?: number;
  retryAfterMs?: number;
  message?: string;
}

interface RequestRecord {
  timestamps: number[]; // Timestamps of recent requests
  lastRequestTime: number;
}

// =============================================================================
// Configuration
// =============================================================================

function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get rate limit configuration from environment variables
 */
export function getRateLimitConfig(): RateLimitConfig {
  return {
    // Demo tier - most restrictive
    demo: {
      requestsPerMinute: parseIntEnv("DEMO_RATE_LIMIT_RPM", 10),
      requestsPerHour: parseIntEnv("DEMO_RATE_LIMIT_RPH", 60),
      requestsPerDay: parseIntEnv("DEMO_RATE_LIMIT_RPD", 200),
      minRequestIntervalMs: parseIntEnv("DEMO_RATE_LIMIT_MIN_INTERVAL_MS", 2000), // 2 seconds
      tokensPerRequest: parseIntEnv("DEMO_TOKEN_LIMIT_PER_REQUEST", 4000),
      tokensPerSession: parseIntEnv("DEMO_TOKEN_LIMIT_PER_SESSION", 50000),
      tokensPerDay: parseIntEnv("DEMO_TOKEN_LIMIT_PER_DAY", 100000),
      tokensPerMonth: parseIntEnv("DEMO_TOKEN_LIMIT_PER_MONTH", 1000000),
    },
    // Authenticated tier - more generous
    authenticated: {
      requestsPerMinute: parseIntEnv("AUTH_RATE_LIMIT_RPM", 30),
      requestsPerHour: parseIntEnv("AUTH_RATE_LIMIT_RPH", 300),
      requestsPerDay: parseIntEnv("AUTH_RATE_LIMIT_RPD", 1000),
      minRequestIntervalMs: parseIntEnv("AUTH_RATE_LIMIT_MIN_INTERVAL_MS", 500), // 0.5 seconds
      tokensPerRequest: parseIntEnv("AUTH_TOKEN_LIMIT_PER_REQUEST", 8000),
      tokensPerSession: parseIntEnv("AUTH_TOKEN_LIMIT_PER_SESSION", 200000),
      tokensPerDay: parseIntEnv("AUTH_TOKEN_LIMIT_PER_DAY", 500000),
      tokensPerMonth: parseIntEnv("AUTH_TOKEN_LIMIT_PER_MONTH", 5000000),
    },
    // Premium tier - very generous
    premium: {
      requestsPerMinute: parseIntEnv("PREMIUM_RATE_LIMIT_RPM", 60),
      requestsPerHour: parseIntEnv("PREMIUM_RATE_LIMIT_RPH", 1000),
      requestsPerDay: parseIntEnv("PREMIUM_RATE_LIMIT_RPD", 5000),
      minRequestIntervalMs: parseIntEnv("PREMIUM_RATE_LIMIT_MIN_INTERVAL_MS", 100), // 0.1 seconds
      tokensPerRequest: parseIntEnv("PREMIUM_TOKEN_LIMIT_PER_REQUEST", 16000),
      tokensPerSession: parseIntEnv("PREMIUM_TOKEN_LIMIT_PER_SESSION", 1000000),
      tokensPerDay: parseIntEnv("PREMIUM_TOKEN_LIMIT_PER_DAY", 2000000),
      tokensPerMonth: parseIntEnv("PREMIUM_TOKEN_LIMIT_PER_MONTH", 20000000),
    },
    // Admin tier - unlimited
    admin: {
      requestsPerMinute: Infinity,
      requestsPerHour: Infinity,
      requestsPerDay: Infinity,
      minRequestIntervalMs: 0,
      tokensPerRequest: Infinity,
      tokensPerSession: Infinity,
      tokensPerDay: Infinity,
      tokensPerMonth: Infinity,
    },
  };
}

// =============================================================================
// Rate Limiter Service
// =============================================================================

// In-memory stores (use Redis in production)
const requestStore = new Map<string, RequestRecord>();

// Time windows in milliseconds
const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

class RateLimiterService {
  private config: RateLimitConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.config = getRateLimitConfig();
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of old request records
   */
  private startCleanup(): void {
    if (typeof setInterval !== "undefined" && !this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
    }
  }

  /**
   * Clean up old request records
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - ONE_DAY; // Keep records for 24 hours

    requestStore.forEach((record, userId) => {
      // Remove timestamps older than 24 hours
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
      
      // Remove empty records
      if (record.timestamps.length === 0) {
        requestStore.delete(userId);
      }
    });
  }

  /**
   * Refresh configuration from environment
   */
  refreshConfig(): void {
    this.config = getRateLimitConfig();
  }

  /**
   * Get or create request record for a user
   */
  private getRequestRecord(userId: string): RequestRecord {
    let record = requestStore.get(userId);
    if (!record) {
      record = {
        timestamps: [],
        lastRequestTime: 0,
      };
      requestStore.set(userId, record);
    }
    return record;
  }

  /**
   * Determine user tier based on authentication status
   */
  getUserTier(
    userId: string,
    isAuthenticated: boolean,
    isPremium: boolean,
    isAdmin: boolean
  ): UserTier {
    if (isAdmin) return "admin";
    if (isPremium) return "premium";
    if (isAuthenticated) return "authenticated";
    return "demo";
  }

  /**
   * Get limits for a specific tier
   */
  getTierLimits(tier: UserTier): TierLimits {
    return this.config[tier];
  }

  /**
   * Check rate limits for a user
   */
  checkRateLimit(
    userId: string,
    tier: UserTier = "demo"
  ): RateLimitResult {
    const limits = this.config[tier];
    const record = this.getRequestRecord(userId);
    const now = Date.now();

    // 1. Check throttling (minimum interval between requests)
    if (limits.minRequestIntervalMs > 0 && record.lastRequestTime > 0) {
      const timeSinceLastRequest = now - record.lastRequestTime;
      if (timeSinceLastRequest < limits.minRequestIntervalMs) {
        const retryAfterMs = limits.minRequestIntervalMs - timeSinceLastRequest;
        return {
          allowed: false,
          tier,
          limitType: "throttle",
          limit: limits.minRequestIntervalMs,
          used: timeSinceLastRequest,
          remaining: 0,
          retryAfterMs,
          message: `Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before making another request.`,
        };
      }
    }

    // Clean old timestamps
    const oneMinuteAgo = now - ONE_MINUTE;
    const oneHourAgo = now - ONE_HOUR;
    const oneDayAgo = now - ONE_DAY;

    // Count requests in each window
    const requestsLastMinute = record.timestamps.filter((ts) => ts > oneMinuteAgo).length;
    const requestsLastHour = record.timestamps.filter((ts) => ts > oneHourAgo).length;
    const requestsLastDay = record.timestamps.filter((ts) => ts > oneDayAgo).length;

    // 2. Check requests per minute
    if (requestsLastMinute >= limits.requestsPerMinute) {
      const oldestInWindow = record.timestamps.filter((ts) => ts > oneMinuteAgo)[0];
      const retryAfterMs = oldestInWindow ? (oldestInWindow + ONE_MINUTE - now) : ONE_MINUTE;
      return {
        allowed: false,
        tier,
        limitType: "requests_per_minute",
        limit: limits.requestsPerMinute,
        used: requestsLastMinute,
        remaining: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
        message: `Rate limit exceeded: ${limits.requestsPerMinute} requests per minute. Please wait.`,
      };
    }

    // 3. Check requests per hour
    if (requestsLastHour >= limits.requestsPerHour) {
      const oldestInWindow = record.timestamps.filter((ts) => ts > oneHourAgo)[0];
      const retryAfterMs = oldestInWindow ? (oldestInWindow + ONE_HOUR - now) : ONE_HOUR;
      return {
        allowed: false,
        tier,
        limitType: "requests_per_hour",
        limit: limits.requestsPerHour,
        used: requestsLastHour,
        remaining: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
        message: `Rate limit exceeded: ${limits.requestsPerHour} requests per hour. Please wait.`,
      };
    }

    // 4. Check requests per day
    if (requestsLastDay >= limits.requestsPerDay) {
      const oldestInWindow = record.timestamps.filter((ts) => ts > oneDayAgo)[0];
      const retryAfterMs = oldestInWindow ? (oldestInWindow + ONE_DAY - now) : ONE_DAY;
      return {
        allowed: false,
        tier,
        limitType: "requests_per_day",
        limit: limits.requestsPerDay,
        used: requestsLastDay,
        remaining: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
        message: `Daily rate limit exceeded: ${limits.requestsPerDay} requests per day. Resets in ${Math.ceil(retryAfterMs / ONE_HOUR)} hours.`,
      };
    }

    // All checks passed
    return {
      allowed: true,
      tier,
      limit: limits.requestsPerMinute,
      used: requestsLastMinute,
      remaining: limits.requestsPerMinute - requestsLastMinute,
    };
  }

  /**
   * Record a request (call after successful rate limit check)
   */
  recordRequest(userId: string): void {
    const record = this.getRequestRecord(userId);
    const now = Date.now();
    
    record.timestamps.push(now);
    record.lastRequestTime = now;
    
    // Keep only last 24 hours of timestamps
    const oneDayAgo = now - ONE_DAY;
    record.timestamps = record.timestamps.filter((ts) => ts > oneDayAgo);
    
    requestStore.set(userId, record);
  }

  /**
   * Get rate limit statistics for a user
   */
  getStats(userId: string, tier: UserTier = "demo"): {
    tier: UserTier;
    limits: TierLimits;
    usage: {
      lastMinute: number;
      lastHour: number;
      lastDay: number;
    };
    remaining: {
      perMinute: number;
      perHour: number;
      perDay: number;
    };
  } {
    const limits = this.config[tier];
    const record = this.getRequestRecord(userId);
    const now = Date.now();

    const oneMinuteAgo = now - ONE_MINUTE;
    const oneHourAgo = now - ONE_HOUR;
    const oneDayAgo = now - ONE_DAY;

    const lastMinute = record.timestamps.filter((ts) => ts > oneMinuteAgo).length;
    const lastHour = record.timestamps.filter((ts) => ts > oneHourAgo).length;
    const lastDay = record.timestamps.filter((ts) => ts > oneDayAgo).length;

    return {
      tier,
      limits,
      usage: {
        lastMinute,
        lastHour,
        lastDay,
      },
      remaining: {
        perMinute: Math.max(0, limits.requestsPerMinute - lastMinute),
        perHour: Math.max(0, limits.requestsPerHour - lastHour),
        perDay: Math.max(0, limits.requestsPerDay - lastDay),
      },
    };
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  resetUser(userId: string): void {
    requestStore.delete(userId);
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const rateLimiter = new RateLimiterService();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check rate limit and return result
 */
export function checkRateLimit(
  userId: string,
  tier: UserTier = "demo"
): RateLimitResult {
  return rateLimiter.checkRateLimit(userId, tier);
}

/**
 * Record a request after successful rate limit check
 */
export function recordRequest(userId: string): void {
  rateLimiter.recordRequest(userId);
}

/**
 * Get rate limit stats for a user
 */
export function getRateLimitStats(userId: string, tier: UserTier = "demo") {
  return rateLimiter.getStats(userId, tier);
}

/**
 * Determine user tier from request headers
 */
export function getUserTierFromHeaders(headers: Headers): UserTier {
  // Check for admin key
  const adminKey = headers.get("x-admin-key");
  const configuredAdminKey = process.env.DEMO_ADMIN_OVERRIDE_KEY;
  if (adminKey && configuredAdminKey && adminKey === configuredAdminKey) {
    return "admin";
  }

  // Check for premium flag
  const isPremium = headers.get("x-user-premium") === "true";
  if (isPremium) return "premium";

  // Check for authenticated user
  const authUserId = headers.get("x-auth-user-id");
  if (authUserId) return "authenticated";

  // Default to demo
  return "demo";
}

/**
 * Create rate limit error response
 */
export function createRateLimitErrorResponse(result: RateLimitResult): Response {
  const retryAfterSeconds = result.retryAfterMs 
    ? Math.ceil(result.retryAfterMs / 1000) 
    : 60;

  return new Response(
    JSON.stringify({
      error: "RATE_LIMIT_EXCEEDED",
      limitType: result.limitType,
      message: result.message,
      tier: result.tier,
      limit: result.limit,
      used: result.used,
      remaining: result.remaining,
      retryAfterMs: result.retryAfterMs,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": (result.limit || 0).toString(),
        "X-RateLimit-Remaining": (result.remaining || 0).toString(),
        "X-RateLimit-Reset": Math.floor((Date.now() + (result.retryAfterMs || 60000)) / 1000).toString(),
        "Retry-After": retryAfterSeconds.toString(),
      },
    }
  );
}
