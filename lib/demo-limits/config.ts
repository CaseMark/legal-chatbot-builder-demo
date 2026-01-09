/**
 * Token Limit Configuration
 * All limits are configurable via environment variables
 */

export interface TokenLimitConfig {
  // Per-request limits
  perRequestLimit: number;

  // Per-session limits
  perSessionLimit: number;

  // Daily limits per user
  dailyLimitPerUser: number;

  // Monthly limits per user (optional)
  monthlyLimitPerUser: number;

  // OCR limits
  dailyOcrPagesLimit: number;

  // File size limit in MB
  maxFileSizeMB: number;

  // Max documents per chatbot
  maxDocumentsPerChatbot: number;

  // Admin override - bypass all limits
  adminOverrideEnabled: boolean;
  adminOverrideKey: string;
}

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

export function getTokenLimitConfig(): TokenLimitConfig {
  return {
    // Token limits - check DEMO_ prefixed vars first, then fall back to legacy names
    perRequestLimit: parseIntEnv("DEMO_TOKEN_LIMIT_PER_REQUEST", 0) || parseIntEnv("TOKEN_LIMIT_PER_REQUEST", 4000),
    perSessionLimit: parseIntEnv("DEMO_TOKEN_LIMIT_PER_SESSION", 0) || parseIntEnv("TOKEN_LIMIT_PER_SESSION", 50000),
    dailyLimitPerUser: parseIntEnv("DEMO_TOKEN_LIMIT_PER_DAY", 0) || parseIntEnv("TOKEN_LIMIT_DAILY_PER_USER", 100000),
    monthlyLimitPerUser: parseIntEnv("DEMO_TOKEN_LIMIT_PER_MONTH", 0) || parseIntEnv("TOKEN_LIMIT_MONTHLY_PER_USER", 1000000),

    // OCR and file limits - check DEMO_ prefixed vars first
    dailyOcrPagesLimit: parseIntEnv("DEMO_OCR_DAILY_PAGE_LIMIT", 0) || parseIntEnv("OCR_LIMIT_DAILY_PAGES", 20),
    maxFileSizeMB: parseIntEnv("DEMO_OCR_MAX_FILE_SIZE_MB", 0) || parseIntEnv("MAX_FILE_SIZE_MB", 10),
    maxDocumentsPerChatbot: parseIntEnv("DEMO_OCR_MAX_DOCS_PER_SESSION", 0) || parseIntEnv("MAX_DOCUMENTS_PER_CHATBOT", 10),

    // Admin override - check DEMO_ prefixed vars first
    adminOverrideEnabled: parseBoolEnv("DEMO_ADMIN_OVERRIDE_ENABLED", false) || parseBoolEnv("ADMIN_OVERRIDE_ENABLED", false),
    adminOverrideKey: process.env.DEMO_ADMIN_OVERRIDE_KEY || process.env.ADMIN_OVERRIDE_KEY || "",
  };
}

// Export default config for immediate use
export const DEFAULT_CONFIG = getTokenLimitConfig();

/**
 * Example .env.local configuration:
 *
 * # Token Limits
 * TOKEN_LIMIT_PER_REQUEST=4000
 * TOKEN_LIMIT_PER_SESSION=50000
 * TOKEN_LIMIT_DAILY_PER_USER=100000
 * TOKEN_LIMIT_MONTHLY_PER_USER=1000000
 *
 * # OCR & File Limits
 * OCR_LIMIT_DAILY_PAGES=20
 * MAX_FILE_SIZE_MB=10
 * MAX_DOCUMENTS_PER_CHATBOT=10
 *
 * # Admin Override
 * ADMIN_OVERRIDE_ENABLED=true
 * ADMIN_OVERRIDE_KEY=your-secret-admin-key
 */
