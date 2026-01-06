import { NextRequest, NextResponse } from "next/server";
import {
  ocrLimitService,
  validateFile,
  validateFiles,
  getLimitDescriptions,
} from "@/lib/ocr-limits";

/**
 * POST /api/ocr/validate - Validate files before upload
 *
 * Body: { files: Array<{ name: string, size: number, type: string }> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { files } = body;

    if (!files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: "files array is required" },
        { status: 400 }
      );
    }

    // Get user/session context
    const userId =
      request.headers.get("x-auth-user-id") ||
      request.headers.get("x-user-id") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    const sessionId =
      request.headers.get("x-session-id") ||
      `${userId}:${new Date().toISOString().split("T")[0]}`;

    const bypassKey = request.headers.get("x-ocr-bypass-key") || undefined;

    // Validate all files
    const validation = validateFiles(files);

    // Check usage limits for valid files
    let usageLimitCheck = null;
    if (validation.valid.length > 0) {
      usageLimitCheck = await ocrLimitService.checkLimits(
        userId,
        sessionId,
        validation.totalEstimatedPages,
        bypassKey
      );
    }

    // Get current usage stats
    const usageStats = await ocrLimitService.getUsageStats(userId, sessionId);

    return NextResponse.json({
      validation: {
        valid: validation.valid,
        invalid: validation.invalid,
        totalSize: validation.totalSize,
        totalEstimatedPages: validation.totalEstimatedPages,
        summary: validation.summary,
      },
      usageLimitCheck,
      usageStats,
      limits: getLimitDescriptions(),
    });
  } catch (error) {
    console.error("Error validating files:", error);
    return NextResponse.json(
      { error: "Failed to validate files" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ocr/validate - Get current limits and usage
 */
export async function GET(request: NextRequest) {
  try {
    const userId =
      request.headers.get("x-auth-user-id") ||
      request.headers.get("x-user-id") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    const sessionId =
      request.headers.get("x-session-id") ||
      `${userId}:${new Date().toISOString().split("T")[0]}`;

    const usageStats = await ocrLimitService.getUsageStats(userId, sessionId);
    const limits = getLimitDescriptions();
    const config = ocrLimitService.getConfig();

    return NextResponse.json({
      usageStats,
      limits,
      config: {
        maxFileSizeMB: config.maxFileSizeMB,
        maxPagesPerDocument: config.maxPagesPerDocument,
        maxPagesPerSession: config.maxPagesPerSession,
        maxPagesPerDay: config.maxPagesPerDay,
        maxDocumentsPerSession: config.maxDocumentsPerSession,
        maxDocumentsPerDay: config.maxDocumentsPerDay,
        supportedTypes: [...config.supportedImageTypes, "application/pdf"],
      },
    });
  } catch (error) {
    console.error("Error getting OCR limits:", error);
    return NextResponse.json(
      { error: "Failed to get OCR limits" },
      { status: 500 }
    );
  }
}
