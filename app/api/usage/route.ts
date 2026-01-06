import { NextRequest, NextResponse } from "next/server";
import { tokenLimitService } from "@/lib/demo-limits";
import { ocrLimitService } from "@/lib/ocr-limits/ocr-limit-service";

export async function GET(request: NextRequest) {
  try {
    // Get user identifier from request
    const userId =
      request.headers.get("x-auth-user-id") ||
      request.headers.get("x-user-id") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    // Get session identifier
    const sessionId =
      request.headers.get("x-session-id") ||
      `${userId}:${new Date().toISOString().split("T")[0]}`;

    // Get token usage stats
    const tokenStats = await tokenLimitService.getUsageStats(userId, sessionId);

    // Get OCR usage stats
    const ocrStats = await ocrLimitService.getUsageStats(userId, sessionId);

    // Calculate reset time (midnight UTC)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);

    // Format response to match UsageMeter expectations
    const response = {
      session: {
        used: tokenStats.session.used,
        limit: tokenStats.session.limit,
        remaining: tokenStats.session.remaining,
        percentUsed: tokenStats.session.percentUsed,
      },
      daily: {
        used: tokenStats.daily.used,
        limit: tokenStats.daily.limit,
        remaining: tokenStats.daily.remaining,
        percentUsed: tokenStats.daily.percentUsed,
        resetTime: tomorrow.toISOString(),
      },
      monthly: {
        used: tokenStats.monthly.used,
        limit: tokenStats.monthly.limit,
        remaining: tokenStats.monthly.remaining,
        percentUsed: tokenStats.monthly.percentUsed,
        resetTime: tokenStats.monthly.resetTime?.toISOString() || tomorrow.toISOString(),
      },
      ocr: {
        used: ocrStats.daily.pages.used,
        limit: ocrStats.daily.pages.limit,
        remaining: ocrStats.daily.pages.remaining,
        percentUsed: ocrStats.daily.pages.percentUsed,
        resetTime: tomorrow.toISOString(),
      },
      limits: tokenStats.limits,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting usage stats:", error);
    return NextResponse.json(
      { error: "Failed to get usage stats" },
      { status: 500 }
    );
  }
}

// POST endpoint to reset session usage (e.g., when user clears chat)
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === "reset_session") {
      const sessionId = request.headers.get("x-session-id");
      if (sessionId) {
        await tokenLimitService.resetSession(sessionId);
        return NextResponse.json({ success: true, message: "Session reset" });
      }
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in usage POST:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
