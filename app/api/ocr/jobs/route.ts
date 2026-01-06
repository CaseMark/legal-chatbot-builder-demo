import { NextRequest, NextResponse } from "next/server";
import { ocrLimitService } from "@/lib/ocr-limits";

/**
 * GET /api/ocr/jobs - Get OCR jobs for current session
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

    // Get job ID from query params for single job lookup
    const jobId = request.nextUrl.searchParams.get("jobId");

    if (jobId) {
      const job = ocrLimitService.getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      return NextResponse.json({ job });
    }

    // Get all jobs for session
    const jobs = ocrLimitService.getSessionJobs(sessionId);

    // Get queue stats
    const queueStats = {
      active: ocrLimitService.getActiveJobCount(),
      pending: ocrLimitService.getPendingJobCount(),
    };

    return NextResponse.json({
      jobs,
      queueStats,
    });
  } catch (error) {
    console.error("Error getting OCR jobs:", error);
    return NextResponse.json(
      { error: "Failed to get OCR jobs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ocr/jobs - Create a new OCR job (called after file upload)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, fileSize, fileType, estimatedPages } = body;

    if (!filename || !fileSize || !fileType) {
      return NextResponse.json(
        { error: "filename, fileSize, and fileType are required" },
        { status: 400 }
      );
    }

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

    // Check limits before creating job
    const limitCheck = await ocrLimitService.checkLimits(
      userId,
      sessionId,
      estimatedPages || 1,
      bypassKey
    );

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: "OCR_LIMIT_EXCEEDED",
          limitType: limitCheck.limitType,
          message: limitCheck.message,
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
        },
        { status: 429 }
      );
    }

    // Create the job
    const job = ocrLimitService.createJob(
      userId,
      sessionId,
      { name: filename, size: fileSize, type: fileType },
      estimatedPages || 1
    );

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error creating OCR job:", error);
    return NextResponse.json(
      { error: "Failed to create OCR job" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ocr/jobs - Update job status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, action, progress, actualPages, error: jobError } = body;

    if (!jobId || !action) {
      return NextResponse.json(
        { error: "jobId and action are required" },
        { status: 400 }
      );
    }

    let job = null;

    switch (action) {
      case "start":
        job = ocrLimitService.startJob(jobId);
        break;

      case "progress":
        if (typeof progress !== "number") {
          return NextResponse.json(
            { error: "progress number is required for progress action" },
            { status: 400 }
          );
        }
        job = ocrLimitService.updateJobProgress(jobId, progress);
        break;

      case "complete":
        if (typeof actualPages !== "number") {
          return NextResponse.json(
            { error: "actualPages number is required for complete action" },
            { status: 400 }
          );
        }
        job = await ocrLimitService.completeJob(jobId, actualPages);
        break;

      case "fail":
        job = ocrLimitService.failJob(jobId, jobError || "Unknown error");
        break;

      case "cancel":
        job = ocrLimitService.cancelJob(jobId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (!job) {
      return NextResponse.json(
        { error: "Job not found or action not allowed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error updating OCR job:", error);
    return NextResponse.json(
      { error: "Failed to update OCR job" },
      { status: 500 }
    );
  }
}
