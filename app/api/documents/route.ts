import { NextRequest, NextResponse } from "next/server";
import {
  getUploadUrl,
  uploadFileToS3,
  listVaultObjects,
  triggerIngestion,
  filterMetadataFiles,
  loadChatbotMetadata,
  saveChatbotMetadata,
} from "@/lib/case-api/client";
import { ChatbotMetadata } from "@/lib/case-api/types";
import {
  ocrLimitService,
  validateFile,
  estimatePageCount,
  requiresOCR,
} from "@/lib/ocr-limits";

// GET /api/documents - List documents in the default vault
export async function GET(request: NextRequest) {
  try {
    const vaultId = request.nextUrl.searchParams.get("vaultId");

    if (!vaultId) {
      return NextResponse.json(
        { error: "vaultId query parameter is required" },
        { status: 400 }
      );
    }

    const result = await listVaultObjects(vaultId);

    // Filter out metadata files
    const filteredObjects = filterMetadataFiles(result.objects);

    // Load metadata to get document sizes
    const metadata = await loadChatbotMetadata(vaultId);
    const documentSizes = metadata?.documentSizes || {};

    // Create a map of object IDs to their sizeBytes
    const sizeBytesMap: Record<string, number> = {};
    for (const obj of result.objects) {
      sizeBytesMap[obj.id] = obj.sizeBytes || 0;
    }

    return NextResponse.json({
      documents: filteredObjects.map((obj) => ({
        id: obj.id,
        filename: obj.filename,
        size: documentSizes[obj.id] || sizeBytesMap[obj.id] || 0,
        ingestionStatus: obj.ingestionStatus as string,
        pageCount: obj.pageCount as number | undefined,
        textLength: obj.textLength as number | undefined,
        chunkCount: obj.chunkCount as number | undefined,
      })),
    });
  } catch (error) {
    console.error("Error listing documents:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}

// POST /api/documents - Upload a document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const vaultId = formData.get("vaultId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!vaultId) {
      return NextResponse.json(
        { error: "vaultId is required" },
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

    // Validate file (size, type)
    const validation = validateFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "FILE_VALIDATION_FAILED",
          message: validation.error,
          fileInfo: validation.fileInfo,
        },
        { status: 400 }
      );
    }

    // Check if file requires OCR and validate OCR limits
    const needsOCR = requiresOCR(file.type);
    const pageEstimation = estimatePageCount(file.size, file.type);
    let ocrJob = null;

    if (needsOCR) {
      // Check OCR limits
      const ocrLimitCheck = await ocrLimitService.checkLimits(
        userId,
        sessionId,
        pageEstimation.estimatedPages,
        bypassKey
      );

      if (!ocrLimitCheck.allowed) {
        return NextResponse.json(
          {
            error: "OCR_LIMIT_EXCEEDED",
            limitType: ocrLimitCheck.limitType,
            message: ocrLimitCheck.message,
            limit: ocrLimitCheck.limit,
            used: ocrLimitCheck.used,
            remaining: ocrLimitCheck.remaining,
          },
          { status: 429 }
        );
      }

      // Create OCR job for tracking
      ocrJob = ocrLimitService.createJob(
        userId,
        sessionId,
        { name: file.name, size: file.size, type: file.type },
        pageEstimation.estimatedPages
      );

      // Start the job
      ocrLimitService.startJob(ocrJob.id);
    }

    try {
      // Get presigned upload URL
      const uploadResponse = await getUploadUrl(vaultId, file.name, file.type);

      // Upload file to S3
      const fileBuffer = await file.arrayBuffer();
      await uploadFileToS3(uploadResponse.uploadUrl, fileBuffer, file.type);

      // Trigger ingestion
      try {
        await triggerIngestion(vaultId, uploadResponse.objectId);
      } catch {
        // Continue anyway - auto_index might still work
      }

      // Track OCR usage if needed
      if (needsOCR && ocrJob) {
        // Complete the job with estimated pages (actual will be updated when processing completes)
        await ocrLimitService.completeJob(ocrJob.id, pageEstimation.estimatedPages);
      }

      // Save document size to metadata
      try {
        const existingMetadata = await loadChatbotMetadata(vaultId);
        const updatedMetadata: ChatbotMetadata = existingMetadata || {
          name: "Legal Chatbot",
          description: "",
          systemPrompt: "",
          welcomeMessage: "",
          primaryColor: "#0ea5e9",
          documentSizes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        updatedMetadata.documentSizes[uploadResponse.objectId] = file.size;
        await saveChatbotMetadata(vaultId, updatedMetadata);
      } catch {
        // Continue anyway
      }

      return NextResponse.json({
        document: {
          id: uploadResponse.objectId,
          filename: file.name,
          size: file.size,
          contentType: file.type,
          ingestionStatus: "processing",
          estimatedPages: pageEstimation.estimatedPages,
          requiresOCR: needsOCR,
        },
        ocrJob: ocrJob
          ? {
              id: ocrJob.id,
              status: ocrJob.status,
              estimatedPages: ocrJob.estimatedPages,
            }
          : null,
        message:
          "Document uploaded and ingestion triggered. Processing may take a few minutes.",
        warnings: validation.warnings,
      });
    } catch (uploadError) {
      // If upload fails and we created an OCR job, fail it
      if (ocrJob) {
        ocrLimitService.failJob(
          ocrJob.id,
          uploadError instanceof Error ? uploadError.message : "Upload failed"
        );
      }
      throw uploadError;
    }
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload document",
      },
      { status: 500 }
    );
  }
}
