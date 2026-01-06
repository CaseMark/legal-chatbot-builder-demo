/**
 * Limit Hit Analytics and Logging
 *
 * Tracks when users hit their limits for analytics and admin visibility.
 * Uses in-memory storage (replace with database in production).
 */

import { LimitType } from "./token-limit-service";

// =============================================================================
// Types
// =============================================================================

export interface LimitHitLog {
  id: string;
  timestamp: string;
  userId: string;
  sessionId: string;
  limitType: LimitType | "ocr" | string;
  limit: number;
  used: number;
  remaining: number;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LimitHitStats {
  totalHits: number;
  hitsToday: number;
  hitsByType: Record<string, number>;
  hitsByUser: Record<string, number>;
  recentHits: LimitHitLog[];
}

// =============================================================================
// In-Memory Storage
// =============================================================================

const limitHitLogs: LimitHitLog[] = [];
const MAX_LOGS = 1000; // Keep last 1000 logs in memory

// Daily counters (reset at midnight)
let dailyStats = {
  hits: 0,
  byType: {} as Record<string, number>,
  byUser: {} as Record<string, number>,
  resetTime: getNextMidnight(),
};

function getNextMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

function checkDailyReset(): void {
  if (Date.now() >= dailyStats.resetTime) {
    dailyStats = {
      hits: 0,
      byType: {},
      byUser: {},
      resetTime: getNextMidnight(),
    };
  }
}

// =============================================================================
// Logging Functions
// =============================================================================

/**
 * Log a limit hit event
 */
export function logLimitHit(params: {
  userId: string;
  sessionId: string;
  limitType: LimitType | "ocr" | string;
  limit: number;
  used: number;
  remaining?: number;
  message: string;
  metadata?: Record<string, unknown>;
}): LimitHitLog {
  checkDailyReset();

  const log: LimitHitLog = {
    id: `lh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: params.userId,
    sessionId: params.sessionId,
    limitType: params.limitType,
    limit: params.limit,
    used: params.used,
    remaining: params.remaining ?? 0,
    message: params.message,
    metadata: params.metadata,
  };

  // Add to logs (FIFO)
  limitHitLogs.unshift(log);
  if (limitHitLogs.length > MAX_LOGS) {
    limitHitLogs.pop();
  }

  // Update daily stats
  dailyStats.hits++;
  dailyStats.byType[params.limitType] = (dailyStats.byType[params.limitType] || 0) + 1;
  dailyStats.byUser[params.userId] = (dailyStats.byUser[params.userId] || 0) + 1;

  // Console log for server-side visibility
  console.log(`[LIMIT HIT] ${params.limitType}`, {
    userId: params.userId.slice(0, 20),
    used: params.used,
    limit: params.limit,
    message: params.message,
  });

  return log;
}

/**
 * Get limit hit statistics
 */
export function getLimitHitStats(): LimitHitStats {
  checkDailyReset();

  return {
    totalHits: limitHitLogs.length,
    hitsToday: dailyStats.hits,
    hitsByType: { ...dailyStats.byType },
    hitsByUser: { ...dailyStats.byUser },
    recentHits: limitHitLogs.slice(0, 50), // Last 50 hits
  };
}

/**
 * Get recent limit hits
 */
export function getRecentLimitHits(count: number = 50): LimitHitLog[] {
  return limitHitLogs.slice(0, count);
}

/**
 * Get limit hits for a specific user
 */
export function getUserLimitHits(userId: string, count: number = 20): LimitHitLog[] {
  return limitHitLogs
    .filter((log) => log.userId === userId)
    .slice(0, count);
}

/**
 * Get limit hits by type
 */
export function getLimitHitsByType(limitType: string, count: number = 50): LimitHitLog[] {
  return limitHitLogs
    .filter((log) => log.limitType === limitType)
    .slice(0, count);
}

/**
 * Clear all logs (admin function)
 */
export function clearLimitHitLogs(): void {
  limitHitLogs.length = 0;
  dailyStats = {
    hits: 0,
    byType: {},
    byUser: {},
    resetTime: getNextMidnight(),
  };
}

// =============================================================================
// Analytics Helpers
// =============================================================================

/**
 * Get users who are approaching their limits (>80% used)
 */
export function getUsersApproachingLimits(): string[] {
  const users = new Set<string>();

  // Check recent logs for users with high usage
  for (const log of limitHitLogs.slice(0, 100)) {
    const usagePercent = (log.used / log.limit) * 100;
    if (usagePercent >= 80) {
      users.add(log.userId);
    }
  }

  return Array.from(users);
}

/**
 * Get the most hit limit type today
 */
export function getMostHitLimitType(): { type: string; count: number } | null {
  checkDailyReset();

  const types = Object.entries(dailyStats.byType);
  if (types.length === 0) return null;

  const [type, count] = types.reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  );

  return { type, count };
}

/**
 * Get hourly hit distribution for today
 */
export function getHourlyDistribution(): Record<number, number> {
  const today = new Date().toISOString().split("T")[0];
  const hourly: Record<number, number> = {};

  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourly[i] = 0;
  }

  // Count hits per hour
  for (const log of limitHitLogs) {
    if (log.timestamp.startsWith(today)) {
      const hour = new Date(log.timestamp).getUTCHours();
      hourly[hour]++;
    }
  }

  return hourly;
}

// =============================================================================
// Export singleton analytics service
// =============================================================================

export const limitAnalytics = {
  log: logLimitHit,
  getStats: getLimitHitStats,
  getRecent: getRecentLimitHits,
  getUserHits: getUserLimitHits,
  getByType: getLimitHitsByType,
  clearLogs: clearLimitHitLogs,
  getUsersApproachingLimits,
  getMostHitLimitType,
  getHourlyDistribution,
};
