import { NextResponse } from "next/server";
import {
  getDemoLimits,
  getLimitsSummary,
  getDisabledFeatures,
} from "@/lib/demo-limits/demo-limits.config";

/**
 * GET /api/demo/config
 * Returns demo configuration, limits summary, and disabled features
 */
export async function GET() {
  const config = getDemoLimits();
  const limitsSummary = getLimitsSummary();
  const disabledFeatures = getDisabledFeatures();

  return NextResponse.json({
    config: {
      isDemoMode: config.app.isDemoMode,
      appName: config.app.appName,
      upgradeUrl: config.app.upgradeUrl,
      contactEmail: config.app.contactEmail,
      demoExpiryDays: config.app.demoExpiryDays,
      features: config.features,
    },
    limitsSummary,
    disabledFeatures,
    limits: {
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
