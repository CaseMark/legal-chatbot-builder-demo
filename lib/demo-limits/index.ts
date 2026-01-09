// Unified Configuration (Primary)
export {
  getDemoLimits,
  getDemoLimitsConfig,
  refreshDemoLimitsConfig,
  DEMO_LIMITS,
  getLimitsSummary,
  getDisabledFeatures,
} from "./demo-limits.config";
export type {
  DemoLimitsConfig,
  TokenLimits,
  OCRLimits,
  FeatureFlags,
  AdminConfig,
  DemoAppConfig,
} from "./demo-limits.config";

// Legacy Configuration (Backward Compatibility)
export { getTokenLimitConfig, DEFAULT_CONFIG } from "./config";
export type { TokenLimitConfig } from "./config";

// Token Limit Service
export {
  tokenLimitService,
  checkTokenLimits,
  trackTokenUsage,
  getUsageStats,
  estimateTokens,
  estimateMessageTokens,
} from "./token-limit-service";
export type { LimitCheckResult, UsageStats, LimitType } from "./token-limit-service";

// Middleware helpers
export {
  getUserId,
  getSessionId,
  getAdminKey,
  getRequestContext,
  checkAndEnforceLimits,
  createLimitErrorResponse,
  estimateChatTokens,
  withTokenLimits,
} from "./middleware";
export type { RequestContext } from "./middleware";

// Limit Analytics
export {
  limitAnalytics,
  logLimitHit,
  getLimitHitStats,
  getRecentLimitHits,
  getUserLimitHits,
  getLimitHitsByType,
  clearLimitHitLogs,
} from "./limit-analytics";
export type { LimitHitLog, LimitHitStats } from "./limit-analytics";

// Legacy exports for backward compatibility
export {
  checkTokenLimit,
  trackTokenUsage as trackTokenUsageLegacy,
  checkOcrLimit,
  trackOcrUsage,
  getUsageStats as getUsageStatsLegacy,
} from "./token-tracker";

// Rate Limiter (API-level rate limiting, throttling, tiered limits)
export {
  rateLimiter,
  checkRateLimit,
  recordRequest,
  getUserTierFromHeaders,
  createRateLimitErrorResponse,
  getRateLimitStats,
  getRateLimitConfig,
} from "./rate-limiter";
export type {
  UserTier,
  TierLimits,
  RateLimitConfig,
  RateLimitResult,
} from "./rate-limiter";
