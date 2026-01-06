/**
 * OCRLimitService - Comprehensive OCR limiting for demo app
 *
 * Tracks usage at multiple levels:
 * - Per-document: File size and page count limits
 * - Per-session: Documents and pages processed in current session
 * - Per-user daily: Documents and pages processed today
 */

import { getOCRLimitConfig, OCRLimitConfig } from "./config";

// OCR job status
export type OCRJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

// OCR job record
export interface OCRJob {
  id: string;
  userId: string;
  sessionId: string;
  filename: string;
  fileSize: number;
  fileType: string;
  estimatedPages: number;
  actualPages?: number;
  status: OCRJobStatus;
  progress: number; // 0-100
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// User OCR usage record
interface UserOCRUsage {
  // Daily tracking
  dailyPages: number;
  dailyDocuments: number;
  dailyResetTime: number;

  // Session tracking (keyed separately)
  lastActivity: number;
}

// Session OCR usage
interface SessionOCRUsage {
  pages: number;
  documents: number;
  createdAt: number;
  lastActivity: number;
}

// Limit check result
export interface OCRLimitCheckResult {
  allowed: boolean;
  limitType?:
    | "file_size"
    | "file_type"
    | "pages_per_document"
    | "pages_per_session"
    | "pages_per_day"
    | "documents_per_session"
    | "documents_per_day"
    | "queue_full";
  limit?: number;
  used?: number;
  remaining?: number;
  message?: string;
  isBypass?: boolean;
}

// OCR usage stats
export interface OCRUsageStats {
  session: {
    pages: { used: number; limit: number; remaining: number; percentUsed: number };
    documents: { used: number; limit: number; remaining: number; percentUsed: number };
  };
  daily: {
    pages: { used: number; limit: number; remaining: number; percentUsed: number };
    documents: { used: number; limit: number; remaining: number; percentUsed: number };
    resetTime: Date;
  };
  limits: {
    maxFileSizeMB: number;
    maxPagesPerDocument: number;
  };
  queue: {
    active: number;
    pending: number;
    maxConcurrent: number;
  };
}

// In-memory stores
const userUsageStore = new Map<string, UserOCRUsage>();
const sessionUsageStore = new Map<string, SessionOCRUsage>();
const jobQueue = new Map<string, OCRJob>();

// Session expiry (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

class OCRLimitService {
  private config: OCRLimitConfig;

  constructor() {
    this.config = getOCRLimitConfig();

    // Cleanup expired sessions every hour
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanupExpired(), 60 * 60 * 1000);
    }
  }

  /**
   * Refresh config from environment
   */
  refreshConfig(): void {
    this.config = getOCRLimitConfig();
  }

  /**
   * Check if bypass is active
   */
  isBypass(bypassKey?: string): boolean {
    if (!this.config.bypassEnabled) return false;
    if (!this.config.bypassKey) return false;
    return bypassKey === this.config.bypassKey;
  }

  /**
   * Get or create user usage record
   */
  private getUserUsage(userId: string): UserOCRUsage {
    const now = Date.now();
    let usage = userUsageStore.get(userId);

    if (!usage) {
      usage = {
        dailyPages: 0,
        dailyDocuments: 0,
        dailyResetTime: this.getNextDailyReset(),
        lastActivity: now,
      };
      userUsageStore.set(userId, usage);
      return usage;
    }

    // Check if daily reset is needed
    if (now >= usage.dailyResetTime) {
      usage.dailyPages = 0;
      usage.dailyDocuments = 0;
      usage.dailyResetTime = this.getNextDailyReset();
    }

    usage.lastActivity = now;
    return usage;
  }

  /**
   * Get or create session usage record
   */
  private getSessionUsage(sessionId: string): SessionOCRUsage {
    const now = Date.now();
    let session = sessionUsageStore.get(sessionId);

    if (!session) {
      session = {
        pages: 0,
        documents: 0,
        createdAt: now,
        lastActivity: now,
      };
      sessionUsageStore.set(sessionId, session);
    } else {
      session.lastActivity = now;
    }

    return session;
  }

  /**
   * Calculate next daily reset (midnight UTC)
   */
  private getNextDailyReset(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Cleanup expired sessions and old jobs
   */
  private cleanupExpired(): void {
    const now = Date.now();

    // Cleanup expired sessions
    const expiredSessions: string[] = [];
    sessionUsageStore.forEach((session, sessionId) => {
      if (now - session.lastActivity > SESSION_EXPIRY_MS) {
        expiredSessions.push(sessionId);
      }
    });
    expiredSessions.forEach((id) => sessionUsageStore.delete(id));

    // Cleanup old completed/failed jobs (keep for 1 hour)
    const oldJobs: string[] = [];
    jobQueue.forEach((job, jobId) => {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.completedAt &&
        now - job.completedAt > 60 * 60 * 1000
      ) {
        oldJobs.push(jobId);
      }
    });
    oldJobs.forEach((id) => jobQueue.delete(id));
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: { name: string; size: number; type: string },
    bypassKey?: string
  ): OCRLimitCheckResult {
    // Check bypass
    if (this.isBypass(bypassKey)) {
      return { allowed: true, isBypass: true };
    }

    // Check file size
    if (file.size > this.config.maxFileSizeBytes) {
      return {
        allowed: false,
        limitType: "file_size",
        limit: this.config.maxFileSizeMB,
        used: Math.round(file.size / (1024 * 1024) * 10) / 10,
        message: `File size (${Math.round(file.size / (1024 * 1024) * 10) / 10}MB) exceeds maximum of ${this.config.maxFileSizeMB}MB.`,
      };
    }

    // Check file type for OCR-able documents
    const isImage = this.config.supportedImageTypes.includes(file.type);
    const isDocument = this.config.supportedDocumentTypes.includes(file.type);

    if (!isImage && !isDocument) {
      return {
        allowed: false,
        limitType: "file_type",
        message: `File type "${file.type}" is not supported for OCR. Supported types: PDF, JPEG, PNG, TIFF.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check all OCR limits before processing
   */
  async checkLimits(
    userId: string,
    sessionId: string,
    estimatedPages: number,
    bypassKey?: string
  ): Promise<OCRLimitCheckResult> {
    // Check bypass
    if (this.isBypass(bypassKey)) {
      return { allowed: true, isBypass: true };
    }

    // 1. Check pages per document limit
    if (estimatedPages > this.config.maxPagesPerDocument) {
      return {
        allowed: false,
        limitType: "pages_per_document",
        limit: this.config.maxPagesPerDocument,
        used: estimatedPages,
        message: `Document has ${estimatedPages} pages, exceeding the maximum of ${this.config.maxPagesPerDocument} pages per document.`,
      };
    }

    // 2. Check session limits
    const session = this.getSessionUsage(sessionId);

    if (session.documents >= this.config.maxDocumentsPerSession) {
      return {
        allowed: false,
        limitType: "documents_per_session",
        limit: this.config.maxDocumentsPerSession,
        used: session.documents,
        remaining: 0,
        message: `Session limit of ${this.config.maxDocumentsPerSession} documents reached. Start a new session to continue.`,
      };
    }

    if (session.pages + estimatedPages > this.config.maxPagesPerSession) {
      return {
        allowed: false,
        limitType: "pages_per_session",
        limit: this.config.maxPagesPerSession,
        used: session.pages,
        remaining: this.config.maxPagesPerSession - session.pages,
        message: `Session page limit would be exceeded. ${this.config.maxPagesPerSession - session.pages} pages remaining in session.`,
      };
    }

    // 3. Check daily limits
    const userUsage = this.getUserUsage(userId);

    if (userUsage.dailyDocuments >= this.config.maxDocumentsPerDay) {
      return {
        allowed: false,
        limitType: "documents_per_day",
        limit: this.config.maxDocumentsPerDay,
        used: userUsage.dailyDocuments,
        remaining: 0,
        message: `Daily limit of ${this.config.maxDocumentsPerDay} documents reached. Resets at midnight UTC.`,
      };
    }

    if (userUsage.dailyPages + estimatedPages > this.config.maxPagesPerDay) {
      return {
        allowed: false,
        limitType: "pages_per_day",
        limit: this.config.maxPagesPerDay,
        used: userUsage.dailyPages,
        remaining: this.config.maxPagesPerDay - userUsage.dailyPages,
        message: `Daily page limit would be exceeded. ${this.config.maxPagesPerDay - userUsage.dailyPages} pages remaining today.`,
      };
    }

    // 4. Check queue capacity
    const activeJobs = this.getActiveJobCount();
    if (activeJobs >= this.config.maxConcurrentJobs) {
      return {
        allowed: false,
        limitType: "queue_full",
        limit: this.config.maxConcurrentJobs,
        used: activeJobs,
        message: `Processing queue is full (${activeJobs}/${this.config.maxConcurrentJobs}). Please wait for current jobs to complete.`,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        this.config.maxPagesPerSession - session.pages,
        this.config.maxPagesPerDay - userUsage.dailyPages
      ),
    };
  }

  /**
   * Create a new OCR job
   */
  createJob(
    userId: string,
    sessionId: string,
    file: { name: string; size: number; type: string },
    estimatedPages: number
  ): OCRJob {
    const job: OCRJob = {
      id: `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      sessionId,
      filename: file.name,
      fileSize: file.size,
      fileType: file.type,
      estimatedPages,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
    };

    jobQueue.set(job.id, job);
    return job;
  }

  /**
   * Start processing a job
   */
  startJob(jobId: string): OCRJob | null {
    const job = jobQueue.get(jobId);
    if (!job || job.status !== "queued") return null;

    job.status = "processing";
    job.startedAt = Date.now();
    jobQueue.set(jobId, job);
    return job;
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId: string, progress: number): OCRJob | null {
    const job = jobQueue.get(jobId);
    if (!job) return null;

    job.progress = Math.min(100, Math.max(0, progress));
    jobQueue.set(jobId, job);
    return job;
  }

  /**
   * Complete a job and track usage
   */
  async completeJob(jobId: string, actualPages: number): Promise<OCRJob | null> {
    const job = jobQueue.get(jobId);
    if (!job) return null;

    job.status = "completed";
    job.actualPages = actualPages;
    job.progress = 100;
    job.completedAt = Date.now();
    jobQueue.set(jobId, job);

    // Track usage
    await this.trackUsage(job.userId, job.sessionId, actualPages);

    return job;
  }

  /**
   * Fail a job
   */
  failJob(jobId: string, error: string): OCRJob | null {
    const job = jobQueue.get(jobId);
    if (!job) return null;

    job.status = "failed";
    job.error = error;
    job.completedAt = Date.now();
    jobQueue.set(jobId, job);
    return job;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): OCRJob | null {
    const job = jobQueue.get(jobId);
    if (!job || job.status === "completed" || job.status === "failed") {
      return null;
    }

    job.status = "cancelled";
    job.completedAt = Date.now();
    jobQueue.set(jobId, job);
    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): OCRJob | null {
    return jobQueue.get(jobId) || null;
  }

  /**
   * Get all jobs for a session
   */
  getSessionJobs(sessionId: string): OCRJob[] {
    const jobs: OCRJob[] = [];
    jobQueue.forEach((job) => {
      if (job.sessionId === sessionId) {
        jobs.push(job);
      }
    });
    return jobs.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get active job count
   */
  getActiveJobCount(): number {
    let count = 0;
    jobQueue.forEach((job) => {
      if (job.status === "processing" || job.status === "queued") {
        count++;
      }
    });
    return count;
  }

  /**
   * Get pending jobs count
   */
  getPendingJobCount(): number {
    let count = 0;
    jobQueue.forEach((job) => {
      if (job.status === "queued") {
        count++;
      }
    });
    return count;
  }

  /**
   * Track OCR usage after successful processing
   */
  async trackUsage(
    userId: string,
    sessionId: string,
    pages: number
  ): Promise<void> {
    // Update session usage
    const session = this.getSessionUsage(sessionId);
    session.pages += pages;
    session.documents += 1;
    sessionUsageStore.set(sessionId, session);

    // Update user daily usage
    const userUsage = this.getUserUsage(userId);
    userUsage.dailyPages += pages;
    userUsage.dailyDocuments += 1;
    userUsageStore.set(userId, userUsage);
  }

  /**
   * Get comprehensive OCR usage stats
   */
  async getUsageStats(userId: string, sessionId: string): Promise<OCRUsageStats> {
    const userUsage = this.getUserUsage(userId);
    const session = this.getSessionUsage(sessionId);

    const calcPercent = (used: number, limit: number) =>
      limit > 0 ? Math.round((used / limit) * 100) : 0;

    return {
      session: {
        pages: {
          used: session.pages,
          limit: this.config.maxPagesPerSession,
          remaining: Math.max(0, this.config.maxPagesPerSession - session.pages),
          percentUsed: calcPercent(session.pages, this.config.maxPagesPerSession),
        },
        documents: {
          used: session.documents,
          limit: this.config.maxDocumentsPerSession,
          remaining: Math.max(
            0,
            this.config.maxDocumentsPerSession - session.documents
          ),
          percentUsed: calcPercent(
            session.documents,
            this.config.maxDocumentsPerSession
          ),
        },
      },
      daily: {
        pages: {
          used: userUsage.dailyPages,
          limit: this.config.maxPagesPerDay,
          remaining: Math.max(0, this.config.maxPagesPerDay - userUsage.dailyPages),
          percentUsed: calcPercent(userUsage.dailyPages, this.config.maxPagesPerDay),
        },
        documents: {
          used: userUsage.dailyDocuments,
          limit: this.config.maxDocumentsPerDay,
          remaining: Math.max(
            0,
            this.config.maxDocumentsPerDay - userUsage.dailyDocuments
          ),
          percentUsed: calcPercent(
            userUsage.dailyDocuments,
            this.config.maxDocumentsPerDay
          ),
        },
        resetTime: new Date(userUsage.dailyResetTime),
      },
      limits: {
        maxFileSizeMB: this.config.maxFileSizeMB,
        maxPagesPerDocument: this.config.maxPagesPerDocument,
      },
      queue: {
        active: this.getActiveJobCount(),
        pending: this.getPendingJobCount(),
        maxConcurrent: this.config.maxConcurrentJobs,
      },
    };
  }

  /**
   * Reset session usage (e.g., when starting new session)
   */
  async resetSession(sessionId: string): Promise<void> {
    sessionUsageStore.delete(sessionId);

    // Cancel any pending jobs for this session
    jobQueue.forEach((job, jobId) => {
      if (job.sessionId === sessionId && job.status === "queued") {
        this.cancelJob(jobId);
      }
    });
  }

  /**
   * Get current config
   */
  getConfig(): OCRLimitConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const ocrLimitService = new OCRLimitService();

// Helper exports
export async function checkOCRLimits(
  userId: string,
  sessionId: string,
  estimatedPages: number,
  bypassKey?: string
): Promise<OCRLimitCheckResult> {
  return ocrLimitService.checkLimits(userId, sessionId, estimatedPages, bypassKey);
}

export async function getOCRUsageStats(
  userId: string,
  sessionId: string
): Promise<OCRUsageStats> {
  return ocrLimitService.getUsageStats(userId, sessionId);
}
