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
    // Token limits
    perRequestLimit: parseIntEnv("TOKEN_LIMIT_PER_REQUEST", 4000),
    perSessionLimit: parseIntEnv("TOKEN_LIMIT_PER_SESSION", 50000),
    dailyLimitPerUser: parseIntEnv("TOKEN_LIMIT_DAILY_PER_USER", 100000),
    monthlyLimitPerUser: parseIntEnv("TOKEN_LIMIT_MONTHLY_PER_USER", 1000000),

    // OCR and file limits
    dailyOcrPagesLimit: parseIntEnv("OCR_LIMIT_DAILY_PAGES", 20),
    maxFileSizeMB: parseIntEnv("MAX_FILE_SIZE_MB", 10),
    maxDocumentsPerChatbot: parseIntEnv("MAX_DOCUMENTS_PER_CHATBOT", 10),

    // Admin override
    adminOverrideEnabled: parseBoolEnv("ADMIN_OVERRIDE_ENABLED", false),
    adminOverrideKey: process.env.ADMIN_OVERRIDE_KEY || "",
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
