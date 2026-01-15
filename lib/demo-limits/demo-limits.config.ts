/**
 * Unified Demo Limits Configuration
 *
 * Central configuration file for all demo app limits.
 * All values are configurable via environment variables.
 */

// =============================================================================
// Type Definitions
// =============================================================================

export interface TokenLimits {
  /** Maximum tokens per single request (default: 4000) */
  perRequest: number;
  /** Maximum tokens per session (default: 50000) */
  perSession: number;
  /** Maximum tokens per day per user (default: 100000) */
  perDay: number;
  /** Maximum tokens per month per user (default: 1000000) */
  perMonth: number;
}

export interface OCRLimits {
  /** Maximum file size in MB (default: 5) */
  maxFileSizeMB: number;
  /** Maximum file size in bytes (computed) */
  maxFileSizeBytes: number;
  /** Maximum pages per document (default: 10) */
  maxPagesPerDocument: number;
  /** Maximum documents per session (default: 5) */
  maxDocumentsPerSession: number;
  /** Maximum pages per session (default: 30) */
  maxPagesPerSession: number;
  /** Maximum pages per day (default: 50) */
  dailyPageLimit: number;
  /** Maximum documents per day (default: 20) */
  dailyDocumentLimit: number;
  /** Maximum concurrent OCR jobs (default: 3) */
  maxConcurrentJobs: number;
  /** OCR processing timeout in ms (default: 120000) */
  processingTimeoutMs: number;
  /** Supported image MIME types */
  supportedImageTypes: string[];
  /** Supported document MIME types */
  supportedDocumentTypes: string[];
}

export interface FeatureFlags {
  /** Enable document export feature (default: false) */
  enableExport: boolean;
  /** Enable bulk document upload (default: false) */
  enableBulkUpload: boolean;
  /** Enable advanced search features (default: false) */
  enableAdvancedSearch: boolean;
  /** Enable research mode (default: true) */
  enableResearchMode: boolean;
  /** Enable chatbot customization (default: false) */
  enableCustomization: boolean;
  /** Enable API access (default: false) */
  enableApiAccess: boolean;
}

export interface AdminConfig {
  /** Enable admin override for all limits (default: false) */
  overrideEnabled: boolean;
  /** Secret key for admin override */
  overrideKey: string;
  /** Enable OCR bypass for testing (default: false) */
  ocrBypassEnabled: boolean;
  /** Secret key for OCR bypass */
  ocrBypassKey: string;
}

export interface DemoAppConfig {
  /** Demo mode indicator */
  isDemoMode: boolean;
  /** Demo app name */
  appName: string;
  /** Contact/upgrade URL */
  upgradeUrl: string;
  /** Contact email */
  contactEmail: string;
  /** Demo expiration notice (days until demo expires, 0 = no expiry) */
  demoExpiryDays: number;
}

export interface SessionPriceLimits {
  /** Session duration in hours (default: 24) */
  sessionHours: number;
  /** Maximum price allowed per session in dollars (default: 5) */
  sessionPriceLimit: number;
  /** Price per 1000 characters processed (default: 0.0005) */
  pricePerThousandChars: number;
  /** Maximum documents per session (default: 20) */
  maxDocumentsPerSession: number;
}

export interface DemoLimitsConfig {
  tokens: TokenLimits;
  ocr: OCRLimits;
  features: FeatureFlags;
  admin: AdminConfig;
  app: DemoAppConfig;
  session: SessionPriceLimits;
}

// =============================================================================
// Environment Variable Parsers
// =============================================================================

function parseIntEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseFloatEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseStringEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

// =============================================================================
// Configuration Builder
// =============================================================================

/**
 * Build the complete demo limits configuration from environment variables
 */
export function getDemoLimitsConfig(): DemoLimitsConfig {
  const maxFileSizeMB = parseIntEnv("DEMO_OCR_MAX_FILE_SIZE_MB", 5);

  return {
    // Token Limits
    tokens: {
      perRequest: parseIntEnv("DEMO_TOKEN_LIMIT_PER_REQUEST", 4000),
      perSession: parseIntEnv("DEMO_TOKEN_LIMIT_PER_SESSION", 50000),
      perDay: parseIntEnv("DEMO_TOKEN_LIMIT_PER_DAY", 100000),
      perMonth: parseIntEnv("DEMO_TOKEN_LIMIT_PER_MONTH", 1000000),
    },

    // OCR Limits
    ocr: {
      maxFileSizeMB,
      maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
      maxPagesPerDocument: parseIntEnv("DEMO_OCR_MAX_PAGES_PER_DOC", 10),
      maxDocumentsPerSession: parseIntEnv("DEMO_OCR_MAX_DOCS_PER_SESSION", 5),
      maxPagesPerSession: parseIntEnv("DEMO_OCR_MAX_PAGES_PER_SESSION", 30),
      dailyPageLimit: parseIntEnv("DEMO_OCR_DAILY_PAGE_LIMIT", 50),
      dailyDocumentLimit: parseIntEnv("DEMO_OCR_DAILY_DOC_LIMIT", 20),
      maxConcurrentJobs: parseIntEnv("DEMO_OCR_MAX_CONCURRENT_JOBS", 3),
      processingTimeoutMs: parseIntEnv("DEMO_OCR_TIMEOUT_MS", 120000),
      supportedImageTypes: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/tiff",
        "image/webp",
        "image/bmp",
      ],
      supportedDocumentTypes: [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/tiff",
      ],
    },

    // Feature Flags
    features: {
      enableExport: parseBoolEnv("DEMO_FEATURE_EXPORT", false),
      enableBulkUpload: parseBoolEnv("DEMO_FEATURE_BULK_UPLOAD", false),
      enableAdvancedSearch: parseBoolEnv("DEMO_FEATURE_ADVANCED_SEARCH", false),
      enableResearchMode: parseBoolEnv("DEMO_FEATURE_RESEARCH_MODE", true),
      enableCustomization: parseBoolEnv("DEMO_FEATURE_CUSTOMIZATION", false),
      enableApiAccess: parseBoolEnv("DEMO_FEATURE_API_ACCESS", false),
    },

    // Admin Configuration
    admin: {
      overrideEnabled: parseBoolEnv("DEMO_ADMIN_OVERRIDE_ENABLED", false),
      overrideKey: parseStringEnv("DEMO_ADMIN_OVERRIDE_KEY", ""),
      ocrBypassEnabled: parseBoolEnv("DEMO_OCR_BYPASS_ENABLED", false),
      ocrBypassKey: parseStringEnv("DEMO_OCR_BYPASS_KEY", ""),
    },

    // App Configuration
    app: {
      isDemoMode: parseBoolEnv("DEMO_MODE", true),
      appName: parseStringEnv("DEMO_APP_NAME", "Legal Chatbot Builder"),
      upgradeUrl: parseStringEnv("DEMO_UPGRADE_URL", "https://case.dev"),
      contactEmail: parseStringEnv("DEMO_CONTACT_EMAIL", "sales@example.com"),
      demoExpiryDays: parseIntEnv("DEMO_EXPIRY_DAYS", 0),
    },

    // Session Price Limits (for cost-based tracking)
    session: {
      sessionHours: parseIntEnv("DEMO_SESSION_HOURS", 24),
      sessionPriceLimit: parseFloatEnv("DEMO_SESSION_PRICE_LIMIT", 5),
      pricePerThousandChars: 0.0005, // $0.0005 per 1000 characters (~$0.50 per million chars)
      maxDocumentsPerSession: parseIntEnv("DEMO_MAX_DOCUMENTS_PER_SESSION", 20),
    },
  };
}

// =============================================================================
// Singleton Configuration Instance
// =============================================================================

let _configInstance: DemoLimitsConfig | null = null;

/**
 * Get the singleton demo limits configuration
 * Use refreshDemoLimitsConfig() to reload from environment
 */
export function getDemoLimits(): DemoLimitsConfig {
  if (!_configInstance) {
    _configInstance = getDemoLimitsConfig();
  }
  return _configInstance;
}

/**
 * Refresh configuration from environment variables
 * Useful for testing or when env vars change at runtime
 */
export function refreshDemoLimitsConfig(): DemoLimitsConfig {
  _configInstance = getDemoLimitsConfig();
  return _configInstance;
}

// =============================================================================
// Convenience Exports
// =============================================================================

/**
 * The main DEMO_LIMITS constant - use this for quick access to limits
 */
export const DEMO_LIMITS = getDemoLimits();

/**
 * Get a human-readable summary of all limits
 */
export function getLimitsSummary(): {
  tokens: string[];
  ocr: string[];
  features: string[];
} {
  const config = getDemoLimits();

  return {
    tokens: [
      `${config.tokens.perRequest.toLocaleString()} tokens per request`,
      `${config.tokens.perSession.toLocaleString()} tokens per session`,
      `${config.tokens.perDay.toLocaleString()} tokens per day`,
    ],
    ocr: [
      `${config.ocr.maxFileSizeMB}MB max file size`,
      `${config.ocr.maxPagesPerDocument} pages per document`,
      `${config.ocr.maxDocumentsPerSession} documents per session`,
      `${config.ocr.dailyPageLimit} pages per day`,
    ],
    features: [
      config.features.enableExport ? "Export enabled" : "Export disabled",
      config.features.enableBulkUpload ? "Bulk upload enabled" : "Bulk upload disabled",
      config.features.enableAdvancedSearch ? "Advanced search enabled" : "Advanced search disabled",
    ],
  };
}

/**
 * Get disabled features list (for showing upgrade prompts)
 */
export function getDisabledFeatures(): string[] {
  const config = getDemoLimits();
  const disabled: string[] = [];

  if (!config.features.enableExport) disabled.push("Document Export");
  if (!config.features.enableBulkUpload) disabled.push("Bulk Upload");
  if (!config.features.enableAdvancedSearch) disabled.push("Advanced Search");
  if (!config.features.enableCustomization) disabled.push("Chatbot Customization");
  if (!config.features.enableApiAccess) disabled.push("API Access");

  return disabled;
}

// =============================================================================
// Environment Variable Documentation
// =============================================================================

/**
 * Example .env.local configuration:
 *
 * # ===========================================
 * # Demo Mode Configuration
 * # ===========================================
 * DEMO_MODE=true
 * DEMO_APP_NAME="Legal Chatbot Builder"
 * DEMO_UPGRADE_URL="https://yourapp.com/pricing"
 * DEMO_CONTACT_EMAIL="sales@yourapp.com"
 * DEMO_EXPIRY_DAYS=14
 *
 * # ===========================================
 * # Token Limits
 * # ===========================================
 * DEMO_TOKEN_LIMIT_PER_REQUEST=4000
 * DEMO_TOKEN_LIMIT_PER_SESSION=50000
 * DEMO_TOKEN_LIMIT_PER_DAY=100000
 * DEMO_TOKEN_LIMIT_PER_MONTH=1000000
 *
 * # ===========================================
 * # OCR Limits
 * # ===========================================
 * DEMO_OCR_MAX_FILE_SIZE_MB=5
 * DEMO_OCR_MAX_PAGES_PER_DOC=10
 * DEMO_OCR_MAX_DOCS_PER_SESSION=5
 * DEMO_OCR_MAX_PAGES_PER_SESSION=30
 * DEMO_OCR_DAILY_PAGE_LIMIT=50
 * DEMO_OCR_DAILY_DOC_LIMIT=20
 * DEMO_OCR_MAX_CONCURRENT_JOBS=3
 * DEMO_OCR_TIMEOUT_MS=120000
 *
 * # ===========================================
 * # Feature Flags
 * # ===========================================
 * DEMO_FEATURE_EXPORT=false
 * DEMO_FEATURE_BULK_UPLOAD=false
 * DEMO_FEATURE_ADVANCED_SEARCH=false
 * DEMO_FEATURE_RESEARCH_MODE=true
 * DEMO_FEATURE_CUSTOMIZATION=false
 * DEMO_FEATURE_API_ACCESS=false
 *
 * # ===========================================
 * # Admin Override
 * # ===========================================
 * DEMO_ADMIN_OVERRIDE_ENABLED=false
 * DEMO_ADMIN_OVERRIDE_KEY=your-secret-admin-key
 * DEMO_OCR_BYPASS_ENABLED=false
 * DEMO_OCR_BYPASS_KEY=your-ocr-bypass-key
 */
