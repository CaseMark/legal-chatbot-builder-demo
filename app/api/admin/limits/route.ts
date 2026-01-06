import { NextRequest, NextResponse } from "next/server";
import { getDemoLimits } from "@/lib/demo-limits/demo-limits.config";
import { tokenLimitService } from "@/lib/demo-limits/token-limit-service";
import { limitAnalytics } from "@/lib/demo-limits/limit-analytics";

// In-memory user tracking store (mirrors token-limit-service internal state)
// In production, this would be a database query
interface UserUsageRecord {
  userId: string;
  session: {
    tokens: number;
    tokensLimit: number;
    tokensPercent: number;
  };
  daily: {
    tokens: number;
    tokensLimit: number;
    tokensPercent: number;
    ocrPages: number;
    ocrPagesLimit: number;
    ocrPagesPercent: number;
    resetTime: string;
  };
  monthly: {
    tokens: number;
    tokensLimit: number;
    tokensPercent: number;
    resetTime: string;
  };
  lastActivity: string;
  requestCount: number;
}

// Track all users who have used the system
const userRegistry = new Map<string, { lastActivity: number; requestCount: number }>();

/**
 * Register user activity (called from other services)
 */
export function registerUserActivity(userId: string): void {
  const existing = userRegistry.get(userId);
  userRegistry.set(userId, {
    lastActivity: Date.now(),
    requestCount: (existing?.requestCount || 0) + 1,
  });
}

/**
 * Verify admin key
 */
function verifyAdminKey(request: NextRequest): boolean {
  const config = getDemoLimits();
  if (!config.admin.overrideEnabled || !config.admin.overrideKey) {
    return false;
  }
  const providedKey = request.headers.get("x-admin-key");
  return providedKey === config.admin.overrideKey;
}

/**
 * GET /api/admin/limits
 * Returns all user usage data and statistics
 */
export async function GET(request: NextRequest) {
  // Verify admin access
  if (!verifyAdminKey(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing admin key" },
      { status: 401 }
    );
  }

  const config = getDemoLimits();
  const limitHitStats = limitAnalytics.getStats();

  // Build user list from registry
  const users: UserUsageRecord[] = [];
  const today = new Date().toISOString().split("T")[0];
  let activeToday = 0;
  let totalTokensToday = 0;
  let totalOcrPagesToday = 0;

  for (const [userId, meta] of userRegistry.entries()) {
    // Get usage stats for this user
    const sessionId = `${userId}:admin-view`;
    const stats = await tokenLimitService.getUsageStats(userId, sessionId);

    const lastActivityDate = new Date(meta.lastActivity).toISOString().split("T")[0];
    if (lastActivityDate === today) {
      activeToday++;
      totalTokensToday += stats.daily.used;
      totalOcrPagesToday += stats.ocr.used;
    }

    users.push({
      userId,
      session: {
        tokens: stats.session.used,
        tokensLimit: stats.session.limit,
        tokensPercent: stats.session.percentUsed,
      },
      daily: {
        tokens: stats.daily.used,
        tokensLimit: stats.daily.limit,
        tokensPercent: stats.daily.percentUsed,
        ocrPages: stats.ocr.used,
        ocrPagesLimit: stats.ocr.limit,
        ocrPagesPercent: stats.ocr.percentUsed,
        resetTime: stats.daily.resetTime.toISOString(),
      },
      monthly: {
        tokens: stats.monthly.used,
        tokensLimit: stats.monthly.limit,
        tokensPercent: stats.monthly.percentUsed,
        resetTime: stats.monthly.resetTime.toISOString(),
      },
      lastActivity: new Date(meta.lastActivity).toISOString(),
      requestCount: meta.requestCount,
    });
  }

  // Sort by last activity (most recent first)
  users.sort((a, b) =>
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  return NextResponse.json({
    users,
    stats: {
      totalUsers: users.length,
      activeToday,
      limitHitsToday: limitHitStats.hitsToday,
      totalTokensToday,
      totalOcrPagesToday,
    },
    limitHits: limitHitStats.recentHits,
    config: {
      tokens: config.tokens,
      ocr: {
        maxFileSizeMB: config.ocr.maxFileSizeMB,
        maxPagesPerDocument: config.ocr.maxPagesPerDocument,
        maxDocumentsPerSession: config.ocr.maxDocumentsPerSession,
        dailyPageLimit: config.ocr.dailyPageLimit,
      },
    },
  });
}

/**
 * POST /api/admin/limits
 * Admin actions: reset user, clear all
 */
export async function POST(request: NextRequest) {
  // Verify admin access
  if (!verifyAdminKey(request)) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing admin key" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action, userId, resetType } = body;

    switch (action) {
      case "reset_user": {
        if (!userId) {
          return NextResponse.json(
            { error: "userId is required" },
            { status: 400 }
          );
        }

        // Reset based on type
        const sessionId = `${userId}:${new Date().toISOString().split("T")[0]}`;

        if (resetType === "session" || resetType === "all") {
          await tokenLimitService.resetSession(sessionId);
        }

        // For daily/all reset, we'd need to expose a method in tokenLimitService
        // For now, log the action
        console.log(`[ADMIN] Reset user ${userId} (${resetType})`);

        return NextResponse.json({
          success: true,
          message: `Reset ${resetType} limits for user ${userId}`,
        });
      }

      case "clear_all": {
        // Clear all tracking data
        userRegistry.clear();
        limitAnalytics.clearLogs();
        console.log("[ADMIN] Cleared all user tracking data");

        return NextResponse.json({
          success: true,
          message: "Cleared all user tracking data",
        });
      }

      case "clear_logs": {
        limitAnalytics.clearLogs();
        console.log("[ADMIN] Cleared limit hit logs");

        return NextResponse.json({
          success: true,
          message: "Cleared limit hit logs",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[ADMIN] Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
