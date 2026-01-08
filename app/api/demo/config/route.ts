import { NextResponse } from "next/server";

/**
 * GET /api/demo/config
 * Returns demo mode configuration and limits for the UI
 */
export async function GET() {
  // Read configuration from environment variables
  const isDemoMode = process.env.DEMO_MODE === "true";
  const appName = process.env.DEMO_APP_NAME || "Legal Chatbot Builder";
  const upgradeUrl = process.env.DEMO_UPGRADE_URL || "#";
  const contactEmail = process.env.DEMO_CONTACT_EMAIL || "sales@example.com";
  const demoExpiryDays = parseInt(process.env.DEMO_EXPIRY_DAYS || "0", 10);

  // Token limits
  const tokenLimitPerRequest = parseInt(process.env.DEMO_TOKEN_LIMIT_PER_REQUEST || "4000", 10);
  const tokenLimitPerSession = parseInt(process.env.DEMO_TOKEN_LIMIT_PER_SESSION || "50000", 10);
  const tokenLimitPerDay = parseInt(process.env.DEMO_TOKEN_LIMIT_PER_DAY || "100000", 10);

  // OCR limits
  const ocrMaxFileSizeMB = parseInt(process.env.DEMO_OCR_MAX_FILE_SIZE_MB || "5", 10);
  const ocrMaxPagesPerDoc = parseInt(process.env.DEMO_OCR_MAX_PAGES_PER_DOC || "10", 10);
  const ocrDailyPageLimit = parseInt(process.env.DEMO_OCR_DAILY_PAGE_LIMIT || "50", 10);
  const ocrMaxDocsPerSession = parseInt(process.env.DEMO_OCR_MAX_DOCS_PER_SESSION || "5", 10);

  // Feature flags
  const features = {
    enableExport: process.env.DEMO_FEATURE_EXPORT === "true",
    enableBulkUpload: process.env.DEMO_FEATURE_BULK_UPLOAD === "true",
    enableAdvancedSearch: process.env.DEMO_FEATURE_ADVANCED_SEARCH === "true",
    enableResearchMode: process.env.DEMO_FEATURE_RESEARCH_MODE === "true",
    enableCustomization: process.env.DEMO_FEATURE_CUSTOMIZATION === "true",
    enableApiAccess: process.env.DEMO_FEATURE_API_ACCESS === "true",
  };

  // Build disabled features list
  const disabledFeatures: string[] = [];
  if (!features.enableExport) disabledFeatures.push("Document Export");
  if (!features.enableBulkUpload) disabledFeatures.push("Bulk Upload");
  if (!features.enableAdvancedSearch) disabledFeatures.push("Advanced Search");
  if (!features.enableCustomization) disabledFeatures.push("Chatbot Customization");
  if (!features.enableApiAccess) disabledFeatures.push("API Access");

  // Build limits summary for display
  const limitsSummary = {
    tokens: [
      `${tokenLimitPerRequest.toLocaleString()} tokens per request`,
      `${tokenLimitPerSession.toLocaleString()} tokens per session`,
      `${tokenLimitPerDay.toLocaleString()} tokens per day`,
    ],
    ocr: [
      `${ocrMaxFileSizeMB}MB max file size`,
      `${ocrMaxPagesPerDoc} pages per document`,
      `${ocrDailyPageLimit} pages per day`,
      `${ocrMaxDocsPerSession} documents per session`,
    ],
    features: [
      features.enableResearchMode ? "Research Mode enabled" : "Research Mode disabled",
    ],
  };

  return NextResponse.json({
    config: {
      isDemoMode,
      appName,
      upgradeUrl,
      contactEmail,
      demoExpiryDays,
      features,
    },
    limitsSummary,
    disabledFeatures,
  });
}
