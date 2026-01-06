/**
 * Demo Limits Configuration Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDemoLimits,
  getDemoLimitsConfig,
  refreshDemoLimitsConfig,
  getLimitsSummary,
  getDisabledFeatures,
  DEMO_LIMITS,
} from "@/lib/demo-limits/demo-limits.config";
import { configFixtures } from "../fixtures";

describe("Demo Limits Configuration", () => {
  beforeEach(() => {
    // Reset environment variables to test defaults
    vi.unstubAllEnvs();
  });

  describe("getDemoLimitsConfig", () => {
    it("should return default configuration when no env vars set", () => {
      // Remove all DEMO_ env vars
      Object.keys(process.env).forEach((key) => {
        if (key.startsWith("DEMO_")) {
          delete process.env[key];
        }
      });

      const config = getDemoLimitsConfig();

      // Check token defaults
      expect(config.tokens.perRequest).toBe(4000);
      expect(config.tokens.perSession).toBe(50000);
      expect(config.tokens.perDay).toBe(100000);
      expect(config.tokens.perMonth).toBe(1000000);

      // Check OCR defaults
      expect(config.ocr.maxFileSizeMB).toBe(5);
      expect(config.ocr.maxFileSizeBytes).toBe(5 * 1024 * 1024);
      expect(config.ocr.maxPagesPerDocument).toBe(10);
      expect(config.ocr.maxDocumentsPerSession).toBe(5);
      expect(config.ocr.dailyPageLimit).toBe(50);

      // Check feature defaults
      expect(config.features.enableExport).toBe(false);
      expect(config.features.enableBulkUpload).toBe(false);
      expect(config.features.enableResearchMode).toBe(true);

      // Check admin defaults
      expect(config.admin.overrideEnabled).toBe(false);

      // Check app defaults
      expect(config.app.isDemoMode).toBe(true);
    });

    it("should read token limits from environment variables", () => {
      process.env.DEMO_TOKEN_LIMIT_PER_REQUEST = "8000";
      process.env.DEMO_TOKEN_LIMIT_PER_SESSION = "100000";
      process.env.DEMO_TOKEN_LIMIT_PER_DAY = "500000";
      process.env.DEMO_TOKEN_LIMIT_PER_MONTH = "5000000";

      const config = getDemoLimitsConfig();

      expect(config.tokens.perRequest).toBe(8000);
      expect(config.tokens.perSession).toBe(100000);
      expect(config.tokens.perDay).toBe(500000);
      expect(config.tokens.perMonth).toBe(5000000);
    });

    it("should read OCR limits from environment variables", () => {
      process.env.DEMO_OCR_MAX_FILE_SIZE_MB = "10";
      process.env.DEMO_OCR_MAX_PAGES_PER_DOC = "20";
      process.env.DEMO_OCR_MAX_DOCS_PER_SESSION = "10";
      process.env.DEMO_OCR_DAILY_PAGE_LIMIT = "100";

      const config = getDemoLimitsConfig();

      expect(config.ocr.maxFileSizeMB).toBe(10);
      expect(config.ocr.maxFileSizeBytes).toBe(10 * 1024 * 1024);
      expect(config.ocr.maxPagesPerDocument).toBe(20);
      expect(config.ocr.maxDocumentsPerSession).toBe(10);
      expect(config.ocr.dailyPageLimit).toBe(100);
    });

    it("should read feature flags from environment variables", () => {
      process.env.DEMO_FEATURE_EXPORT = "true";
      process.env.DEMO_FEATURE_BULK_UPLOAD = "true";
      process.env.DEMO_FEATURE_ADVANCED_SEARCH = "true";
      process.env.DEMO_FEATURE_RESEARCH_MODE = "false";

      const config = getDemoLimitsConfig();

      expect(config.features.enableExport).toBe(true);
      expect(config.features.enableBulkUpload).toBe(true);
      expect(config.features.enableAdvancedSearch).toBe(true);
      expect(config.features.enableResearchMode).toBe(false);
    });

    it("should read admin config from environment variables", () => {
      process.env.DEMO_ADMIN_OVERRIDE_ENABLED = "true";
      process.env.DEMO_ADMIN_OVERRIDE_KEY = "my-secret-key";
      process.env.DEMO_OCR_BYPASS_ENABLED = "true";
      process.env.DEMO_OCR_BYPASS_KEY = "ocr-bypass-key";

      const config = getDemoLimitsConfig();

      expect(config.admin.overrideEnabled).toBe(true);
      expect(config.admin.overrideKey).toBe("my-secret-key");
      expect(config.admin.ocrBypassEnabled).toBe(true);
      expect(config.admin.ocrBypassKey).toBe("ocr-bypass-key");
    });

    it("should read app config from environment variables", () => {
      process.env.DEMO_MODE = "false";
      process.env.DEMO_APP_NAME = "My Legal App";
      process.env.DEMO_UPGRADE_URL = "https://myapp.com/upgrade";
      process.env.DEMO_CONTACT_EMAIL = "support@myapp.com";
      process.env.DEMO_EXPIRY_DAYS = "14";

      const config = getDemoLimitsConfig();

      expect(config.app.isDemoMode).toBe(false);
      expect(config.app.appName).toBe("My Legal App");
      expect(config.app.upgradeUrl).toBe("https://myapp.com/upgrade");
      expect(config.app.contactEmail).toBe("support@myapp.com");
      expect(config.app.demoExpiryDays).toBe(14);
    });

    it("should handle invalid integer values gracefully", () => {
      process.env.DEMO_TOKEN_LIMIT_PER_REQUEST = "not-a-number";
      process.env.DEMO_OCR_MAX_FILE_SIZE_MB = "";

      const config = getDemoLimitsConfig();

      // Should fall back to defaults
      expect(config.tokens.perRequest).toBe(4000);
      expect(config.ocr.maxFileSizeMB).toBe(5);
    });

    it("should handle boolean parsing correctly", () => {
      // Test various boolean formats
      process.env.DEMO_FEATURE_EXPORT = "1";
      process.env.DEMO_FEATURE_BULK_UPLOAD = "TRUE";
      process.env.DEMO_FEATURE_ADVANCED_SEARCH = "false";
      process.env.DEMO_FEATURE_CUSTOMIZATION = "0";

      const config = getDemoLimitsConfig();

      expect(config.features.enableExport).toBe(true);
      expect(config.features.enableBulkUpload).toBe(true);
      expect(config.features.enableAdvancedSearch).toBe(false);
      expect(config.features.enableCustomization).toBe(false);
    });
  });

  describe("getDemoLimits (singleton)", () => {
    it("should return cached configuration", () => {
      const config1 = getDemoLimits();
      const config2 = getDemoLimits();

      // Should be the same object reference
      expect(config1).toBe(config2);
    });
  });

  describe("refreshDemoLimitsConfig", () => {
    it("should reload configuration from environment", () => {
      // Get initial config
      const initial = getDemoLimits();
      const initialPerRequest = initial.tokens.perRequest;

      // Change env var
      process.env.DEMO_TOKEN_LIMIT_PER_REQUEST = "9999";

      // Refresh config
      const refreshed = refreshDemoLimitsConfig();

      expect(refreshed.tokens.perRequest).toBe(9999);
      expect(refreshed.tokens.perRequest).not.toBe(initialPerRequest);
    });
  });

  describe("getLimitsSummary", () => {
    it("should return human-readable limit summaries", () => {
      const summary = getLimitsSummary();

      expect(summary.tokens).toBeInstanceOf(Array);
      expect(summary.tokens.length).toBeGreaterThan(0);
      expect(summary.tokens[0]).toContain("tokens");

      expect(summary.ocr).toBeInstanceOf(Array);
      expect(summary.ocr.length).toBeGreaterThan(0);

      expect(summary.features).toBeInstanceOf(Array);
    });

    it("should include formatted token limits", () => {
      const summary = getLimitsSummary();

      expect(summary.tokens.some((s) => s.includes("per request"))).toBe(true);
      expect(summary.tokens.some((s) => s.includes("per session"))).toBe(true);
      expect(summary.tokens.some((s) => s.includes("per day"))).toBe(true);
    });

    it("should include OCR limits", () => {
      const summary = getLimitsSummary();

      expect(summary.ocr.some((s) => s.includes("MB"))).toBe(true);
      expect(summary.ocr.some((s) => s.includes("pages"))).toBe(true);
      expect(summary.ocr.some((s) => s.includes("documents"))).toBe(true);
    });
  });

  describe("getDisabledFeatures", () => {
    it("should return list of disabled features", () => {
      // With default config, most features are disabled
      const disabled = getDisabledFeatures();

      expect(disabled).toBeInstanceOf(Array);
      expect(disabled.length).toBeGreaterThan(0);
    });

    it("should include Export when disabled", () => {
      process.env.DEMO_FEATURE_EXPORT = "false";
      refreshDemoLimitsConfig();

      const disabled = getDisabledFeatures();

      expect(disabled).toContain("Document Export");
    });

    it("should not include Export when enabled", () => {
      process.env.DEMO_FEATURE_EXPORT = "true";
      refreshDemoLimitsConfig();

      const disabled = getDisabledFeatures();

      expect(disabled).not.toContain("Document Export");
    });

    it("should return empty array when all features enabled", () => {
      process.env.DEMO_FEATURE_EXPORT = "true";
      process.env.DEMO_FEATURE_BULK_UPLOAD = "true";
      process.env.DEMO_FEATURE_ADVANCED_SEARCH = "true";
      process.env.DEMO_FEATURE_CUSTOMIZATION = "true";
      process.env.DEMO_FEATURE_API_ACCESS = "true";
      refreshDemoLimitsConfig();

      const disabled = getDisabledFeatures();

      expect(disabled.length).toBe(0);
    });
  });

  describe("DEMO_LIMITS constant", () => {
    it("should be defined and have correct structure", () => {
      expect(DEMO_LIMITS).toBeDefined();
      expect(DEMO_LIMITS.tokens).toBeDefined();
      expect(DEMO_LIMITS.ocr).toBeDefined();
      expect(DEMO_LIMITS.features).toBeDefined();
      expect(DEMO_LIMITS.admin).toBeDefined();
      expect(DEMO_LIMITS.app).toBeDefined();
    });
  });

  describe("Config Type Safety", () => {
    it("should have all required token properties", () => {
      const config = getDemoLimits();

      expect(typeof config.tokens.perRequest).toBe("number");
      expect(typeof config.tokens.perSession).toBe("number");
      expect(typeof config.tokens.perDay).toBe("number");
      expect(typeof config.tokens.perMonth).toBe("number");
    });

    it("should have all required OCR properties", () => {
      const config = getDemoLimits();

      expect(typeof config.ocr.maxFileSizeMB).toBe("number");
      expect(typeof config.ocr.maxFileSizeBytes).toBe("number");
      expect(typeof config.ocr.maxPagesPerDocument).toBe("number");
      expect(typeof config.ocr.maxDocumentsPerSession).toBe("number");
      expect(Array.isArray(config.ocr.supportedImageTypes)).toBe(true);
      expect(Array.isArray(config.ocr.supportedDocumentTypes)).toBe(true);
    });

    it("should have all required feature flags as booleans", () => {
      const config = getDemoLimits();

      expect(typeof config.features.enableExport).toBe("boolean");
      expect(typeof config.features.enableBulkUpload).toBe("boolean");
      expect(typeof config.features.enableAdvancedSearch).toBe("boolean");
      expect(typeof config.features.enableResearchMode).toBe("boolean");
      expect(typeof config.features.enableCustomization).toBe("boolean");
      expect(typeof config.features.enableApiAccess).toBe("boolean");
    });
  });
});

describe("Limit Analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  it("should be importable from the main module", async () => {
    const { logLimitHit, getLimitHitStats } = await import(
      "@/lib/demo-limits/limit-analytics"
    );

    expect(typeof logLimitHit).toBe("function");
    expect(typeof getLimitHitStats).toBe("function");
  });

  it("should log limit hits", async () => {
    const { logLimitHit, getLimitHitStats, clearLimitHitLogs } = await import(
      "@/lib/demo-limits/limit-analytics"
    );

    // Clear any existing logs
    clearLimitHitLogs();

    // Log a limit hit
    const log = logLimitHit({
      userId: "test-user",
      sessionId: "test-session",
      limitType: "daily",
      limit: 100000,
      used: 100000,
      remaining: 0,
      message: "Daily limit reached",
    });

    expect(log.id).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(log.limitType).toBe("daily");

    // Check stats
    const stats = getLimitHitStats();
    expect(stats.hitsToday).toBe(1);
    expect(stats.hitsByType["daily"]).toBe(1);
  });
});
