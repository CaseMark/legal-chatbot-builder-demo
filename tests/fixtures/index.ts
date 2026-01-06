/**
 * Test Fixtures
 *
 * Reusable test data for unit and integration tests.
 */

// =============================================================================
// User & Session Fixtures
// =============================================================================

export const testUsers = {
  basic: {
    userId: "user-123",
    sessionId: "session-abc-123",
  },
  premium: {
    userId: "premium-user-456",
    sessionId: "session-premium-456",
  },
  anonymous: {
    userId: "anonymous",
    sessionId: "session-anon-001",
  },
  admin: {
    userId: "admin-user-789",
    sessionId: "session-admin-789",
    adminKey: "test-admin-key",
  },
};

// =============================================================================
// Message Fixtures
// =============================================================================

export const testMessages = {
  short: [
    { role: "user" as const, content: "Hello" },
  ],
  medium: [
    { role: "user" as const, content: "Can you explain what a contract is?" },
    { role: "assistant" as const, content: "A contract is a legally binding agreement..." },
    { role: "user" as const, content: "What are the key elements?" },
  ],
  long: Array(20).fill(null).map((_, i) => ({
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    content: `Message ${i + 1}: ${"Lorem ipsum dolor sit amet. ".repeat(50)}`,
  })),
  oversized: [
    { role: "user" as const, content: "A".repeat(20000) }, // ~5000 tokens
  ],
};

// Estimated tokens for each message set
export const estimatedTokens = {
  short: 10,
  medium: 150,
  long: 15000,
  oversized: 5000,
};

// =============================================================================
// File Fixtures
// =============================================================================

export const testFiles = {
  validPdf: {
    name: "contract.pdf",
    size: 1024 * 1024, // 1MB
    type: "application/pdf",
  },
  validImage: {
    name: "scan.jpg",
    size: 500 * 1024, // 500KB
    type: "image/jpeg",
  },
  largePdf: {
    name: "large-document.pdf",
    size: 10 * 1024 * 1024, // 10MB - exceeds 5MB limit
    type: "application/pdf",
  },
  invalidType: {
    name: "document.exe",
    size: 1024 * 1024,
    type: "application/x-executable",
  },
  validTxt: {
    name: "notes.txt",
    size: 50 * 1024, // 50KB
    type: "text/plain",
  },
  validDocx: {
    name: "report.docx",
    size: 2 * 1024 * 1024, // 2MB
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  validTiff: {
    name: "scanned-doc.tiff",
    size: 3 * 1024 * 1024, // 3MB
    type: "image/tiff",
  },
  validPng: {
    name: "receipt.png",
    size: 800 * 1024, // 800KB
    type: "image/png",
  },
};

// =============================================================================
// API Response Fixtures
// =============================================================================

export const apiResponses = {
  chatSuccess: {
    choices: [
      {
        delta: { content: "This is a response about legal matters." },
      },
    ],
  },
  chatStreamChunks: [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
    "data: [DONE]\n\n",
  ],
  uploadSuccess: {
    document: {
      id: "doc-123",
      filename: "contract.pdf",
      size: 1024 * 1024,
      contentType: "application/pdf",
      ingestionStatus: "completed",
      estimatedPages: 5,
      requiresOCR: false,
    },
    warnings: [],
  },
  limitExceeded: {
    error: "TOKEN_LIMIT_EXCEEDED",
    limitType: "daily",
    message: "Daily limit of 100,000 tokens reached.",
    limit: 100000,
    used: 100000,
    remaining: 0,
    resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  ocrLimitExceeded: {
    error: "OCR_LIMIT_EXCEEDED",
    limitType: "pages_per_day",
    message: "Daily OCR limit of 50 pages reached.",
    limit: 50,
    used: 50,
    remaining: 0,
  },
};

// =============================================================================
// Usage Stats Fixtures
// =============================================================================

export const usageStats = {
  fresh: {
    session: { used: 0, limit: 50000, remaining: 50000, percentUsed: 0 },
    daily: { used: 0, limit: 100000, remaining: 100000, percentUsed: 0, resetTime: new Date() },
    monthly: { used: 0, limit: 1000000, remaining: 1000000, percentUsed: 0, resetTime: new Date() },
    ocr: { used: 0, limit: 50, remaining: 50, percentUsed: 0, resetTime: new Date() },
    limits: { perRequest: 4000, perSession: 50000, dailyPerUser: 100000, monthlyPerUser: 1000000 },
  },
  halfUsed: {
    session: { used: 25000, limit: 50000, remaining: 25000, percentUsed: 50 },
    daily: { used: 50000, limit: 100000, remaining: 50000, percentUsed: 50, resetTime: new Date() },
    monthly: { used: 500000, limit: 1000000, remaining: 500000, percentUsed: 50, resetTime: new Date() },
    ocr: { used: 25, limit: 50, remaining: 25, percentUsed: 50, resetTime: new Date() },
    limits: { perRequest: 4000, perSession: 50000, dailyPerUser: 100000, monthlyPerUser: 1000000 },
  },
  nearLimit: {
    session: { used: 48000, limit: 50000, remaining: 2000, percentUsed: 96 },
    daily: { used: 98000, limit: 100000, remaining: 2000, percentUsed: 98, resetTime: new Date() },
    monthly: { used: 980000, limit: 1000000, remaining: 20000, percentUsed: 98, resetTime: new Date() },
    ocr: { used: 48, limit: 50, remaining: 2, percentUsed: 96, resetTime: new Date() },
    limits: { perRequest: 4000, perSession: 50000, dailyPerUser: 100000, monthlyPerUser: 1000000 },
  },
  atLimit: {
    session: { used: 50000, limit: 50000, remaining: 0, percentUsed: 100 },
    daily: { used: 100000, limit: 100000, remaining: 0, percentUsed: 100, resetTime: new Date() },
    monthly: { used: 1000000, limit: 1000000, remaining: 0, percentUsed: 100, resetTime: new Date() },
    ocr: { used: 50, limit: 50, remaining: 0, percentUsed: 100, resetTime: new Date() },
    limits: { perRequest: 4000, perSession: 50000, dailyPerUser: 100000, monthlyPerUser: 1000000 },
  },
};

// =============================================================================
// OCR Job Fixtures
// =============================================================================

export const ocrJobs = {
  queued: {
    id: "ocr_job_1",
    userId: "user-123",
    sessionId: "session-abc-123",
    filename: "contract.pdf",
    fileSize: 1024 * 1024,
    fileType: "application/pdf",
    estimatedPages: 5,
    status: "queued" as const,
    progress: 0,
    createdAt: Date.now(),
  },
  processing: {
    id: "ocr_job_2",
    userId: "user-123",
    sessionId: "session-abc-123",
    filename: "scanned.jpg",
    fileSize: 500 * 1024,
    fileType: "image/jpeg",
    estimatedPages: 1,
    status: "processing" as const,
    progress: 50,
    createdAt: Date.now() - 30000,
    startedAt: Date.now() - 15000,
  },
  completed: {
    id: "ocr_job_3",
    userId: "user-123",
    sessionId: "session-abc-123",
    filename: "receipt.png",
    fileSize: 200 * 1024,
    fileType: "image/png",
    estimatedPages: 1,
    actualPages: 1,
    status: "completed" as const,
    progress: 100,
    createdAt: Date.now() - 120000,
    startedAt: Date.now() - 60000,
    completedAt: Date.now() - 30000,
  },
  failed: {
    id: "ocr_job_4",
    userId: "user-123",
    sessionId: "session-abc-123",
    filename: "corrupted.pdf",
    fileSize: 1024 * 1024,
    fileType: "application/pdf",
    estimatedPages: 10,
    status: "failed" as const,
    progress: 25,
    error: "Failed to process document: corrupted file",
    createdAt: Date.now() - 180000,
    startedAt: Date.now() - 120000,
    completedAt: Date.now() - 90000,
  },
};

// =============================================================================
// Config Fixtures
// =============================================================================

export const configFixtures = {
  default: {
    tokens: {
      perRequest: 4000,
      perSession: 50000,
      perDay: 100000,
      perMonth: 1000000,
    },
    ocr: {
      maxFileSizeMB: 5,
      maxFileSizeBytes: 5 * 1024 * 1024,
      maxPagesPerDocument: 10,
      maxDocumentsPerSession: 5,
      maxPagesPerSession: 30,
      dailyPageLimit: 50,
      dailyDocumentLimit: 20,
      maxConcurrentJobs: 3,
      processingTimeoutMs: 120000,
      supportedImageTypes: ["image/jpeg", "image/jpg", "image/png", "image/tiff"],
      supportedDocumentTypes: ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/tiff"],
    },
    features: {
      enableExport: false,
      enableBulkUpload: false,
      enableAdvancedSearch: false,
      enableResearchMode: true,
      enableCustomization: false,
      enableApiAccess: false,
    },
    admin: {
      overrideEnabled: true,
      overrideKey: "test-admin-key",
      ocrBypassEnabled: true,
      ocrBypassKey: "test-ocr-bypass-key",
    },
    app: {
      isDemoMode: true,
      appName: "Legal Chatbot Builder",
      upgradeUrl: "https://example.com/pricing",
      contactEmail: "sales@example.com",
      demoExpiryDays: 0,
    },
  },
  restrictive: {
    tokens: {
      perRequest: 1000,
      perSession: 5000,
      perDay: 10000,
      perMonth: 50000,
    },
    ocr: {
      maxFileSizeMB: 1,
      maxFileSizeBytes: 1 * 1024 * 1024,
      maxPagesPerDocument: 3,
      maxDocumentsPerSession: 2,
      maxPagesPerSession: 5,
      dailyPageLimit: 10,
      dailyDocumentLimit: 5,
      maxConcurrentJobs: 1,
      processingTimeoutMs: 60000,
      supportedImageTypes: ["image/jpeg", "image/png"],
      supportedDocumentTypes: ["application/pdf"],
    },
    features: {
      enableExport: false,
      enableBulkUpload: false,
      enableAdvancedSearch: false,
      enableResearchMode: false,
      enableCustomization: false,
      enableApiAccess: false,
    },
    admin: {
      overrideEnabled: false,
      overrideKey: "",
      ocrBypassEnabled: false,
      ocrBypassKey: "",
    },
    app: {
      isDemoMode: true,
      appName: "Demo App",
      upgradeUrl: "#",
      contactEmail: "",
      demoExpiryDays: 7,
    },
  },
};
