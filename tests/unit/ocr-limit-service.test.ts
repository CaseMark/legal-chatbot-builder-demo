/**
 * OCRLimitService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ocrLimitService } from "@/lib/ocr-limits/ocr-limit-service";
import { testUsers, testFiles, ocrJobs } from "../fixtures";

describe("OCRLimitService", () => {
  beforeEach(() => {
    // Reset the service state
    ocrLimitService.refreshConfig();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  describe("validateFile", () => {
    it("should accept valid PDF files", () => {
      const result = ocrLimitService.validateFile(testFiles.validPdf);

      expect(result.allowed).toBe(true);
    });

    it("should accept valid image files", () => {
      const result = ocrLimitService.validateFile(testFiles.validImage);

      expect(result.allowed).toBe(true);
    });

    it("should accept valid TIFF files", () => {
      const result = ocrLimitService.validateFile(testFiles.validTiff);

      expect(result.allowed).toBe(true);
    });

    it("should accept valid PNG files", () => {
      const result = ocrLimitService.validateFile(testFiles.validPng);

      expect(result.allowed).toBe(true);
    });

    it("should reject files exceeding size limit", () => {
      const result = ocrLimitService.validateFile(testFiles.largePdf);

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("file_size");
      expect(result.message).toContain("exceeds maximum");
    });

    it("should reject unsupported file types", () => {
      const result = ocrLimitService.validateFile(testFiles.invalidType);

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("file_type");
      expect(result.message).toContain("not supported");
    });

    it("should allow bypass key to skip validation", () => {
      const result = ocrLimitService.validateFile(
        testFiles.largePdf,
        "test-ocr-bypass-key"
      );

      expect(result.allowed).toBe(true);
      expect(result.isBypass).toBe(true);
    });

    it("should not allow invalid bypass key", () => {
      const result = ocrLimitService.validateFile(
        testFiles.largePdf,
        "wrong-bypass-key"
      );

      expect(result.allowed).toBe(false);
      expect(result.isBypass).toBeUndefined();
    });
  });

  describe("checkLimits", () => {
    it("should allow processing within all limits", async () => {
      const result = await ocrLimitService.checkLimits(
        testUsers.basic.userId,
        testUsers.basic.sessionId,
        5 // 5 pages
      );

      expect(result.allowed).toBe(true);
    });

    it("should reject documents exceeding max pages per document", async () => {
      const result = await ocrLimitService.checkLimits(
        testUsers.basic.userId,
        testUsers.basic.sessionId,
        15 // Exceeds 10 pages per document limit
      );

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("pages_per_document");
      expect(result.message).toContain("maximum of 10 pages");
    });

    it("should reject when session document limit is reached", async () => {
      const userId = "doc-limit-user";
      const sessionId = "doc-limit-session";

      // Process 5 documents (session limit)
      for (let i = 0; i < 5; i++) {
        await ocrLimitService.trackUsage(userId, sessionId, 2);
      }

      const result = await ocrLimitService.checkLimits(userId, sessionId, 2);

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("documents_per_session");
    });

    it("should reject when session page limit would be exceeded", async () => {
      const userId = "page-limit-user";
      const sessionId = "page-limit-session";

      // Use 28 of 30 session pages
      await ocrLimitService.trackUsage(userId, sessionId, 28);

      const result = await ocrLimitService.checkLimits(userId, sessionId, 5);

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("pages_per_session");
    });

    it("should reject when daily page limit would be exceeded", async () => {
      const userId = "daily-page-user";
      const sessionId = "daily-page-session";

      // Use 48 of 50 daily pages across multiple sessions
      await ocrLimitService.trackUsage(userId, sessionId, 48);

      // Reset session but daily limit remains
      await ocrLimitService.resetSession(sessionId);

      const newSessionId = "daily-page-session-2";
      const result = await ocrLimitService.checkLimits(userId, newSessionId, 5);

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("pages_per_day");
    });

    it("should allow bypass key to skip all limit checks", async () => {
      const userId = "bypass-user";
      const sessionId = "bypass-session";

      // Max out all limits
      for (let i = 0; i < 5; i++) {
        await ocrLimitService.trackUsage(userId, sessionId, 10);
      }

      const result = await ocrLimitService.checkLimits(
        userId,
        sessionId,
        50,
        "test-ocr-bypass-key"
      );

      expect(result.allowed).toBe(true);
      expect(result.isBypass).toBe(true);
    });
  });

  describe("Job Management", () => {
    describe("createJob", () => {
      it("should create a new OCR job", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        expect(job.id).toBeDefined();
        expect(job.status).toBe("queued");
        expect(job.progress).toBe(0);
        expect(job.filename).toBe(testFiles.validPdf.name);
        expect(job.estimatedPages).toBe(5);
      });

      it("should generate unique job IDs", () => {
        const job1 = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        vi.advanceTimersByTime(1);

        const job2 = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validImage,
          1
        );

        expect(job1.id).not.toBe(job2.id);
      });
    });

    describe("startJob", () => {
      it("should transition job from queued to processing", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        const startedJob = ocrLimitService.startJob(job.id);

        expect(startedJob?.status).toBe("processing");
        expect(startedJob?.startedAt).toBeDefined();
      });

      it("should return null for non-existent job", () => {
        const result = ocrLimitService.startJob("non-existent-job");

        expect(result).toBeNull();
      });

      it("should return null for already started job", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        ocrLimitService.startJob(job.id);
        const result = ocrLimitService.startJob(job.id);

        expect(result).toBeNull();
      });
    });

    describe("updateJobProgress", () => {
      it("should update job progress", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        ocrLimitService.startJob(job.id);
        const updatedJob = ocrLimitService.updateJobProgress(job.id, 50);

        expect(updatedJob?.progress).toBe(50);
      });

      it("should clamp progress between 0 and 100", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        let updated = ocrLimitService.updateJobProgress(job.id, 150);
        expect(updated?.progress).toBe(100);

        updated = ocrLimitService.updateJobProgress(job.id, -10);
        expect(updated?.progress).toBe(0);
      });
    });

    describe("completeJob", () => {
      it("should mark job as completed and track usage", async () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        ocrLimitService.startJob(job.id);
        const completedJob = await ocrLimitService.completeJob(job.id, 5);

        expect(completedJob?.status).toBe("completed");
        expect(completedJob?.actualPages).toBe(5);
        expect(completedJob?.progress).toBe(100);
        expect(completedJob?.completedAt).toBeDefined();

        // Check usage was tracked
        const stats = await ocrLimitService.getUsageStats(
          testUsers.basic.userId,
          testUsers.basic.sessionId
        );
        expect(stats.session.pages.used).toBe(5);
        expect(stats.session.documents.used).toBe(1);
      });
    });

    describe("failJob", () => {
      it("should mark job as failed with error message", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        ocrLimitService.startJob(job.id);
        const failedJob = ocrLimitService.failJob(job.id, "Processing error");

        expect(failedJob?.status).toBe("failed");
        expect(failedJob?.error).toBe("Processing error");
        expect(failedJob?.completedAt).toBeDefined();
      });
    });

    describe("cancelJob", () => {
      it("should cancel a queued job", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        const cancelledJob = ocrLimitService.cancelJob(job.id);

        expect(cancelledJob?.status).toBe("cancelled");
      });

      it("should cancel a processing job", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        ocrLimitService.startJob(job.id);
        const cancelledJob = ocrLimitService.cancelJob(job.id);

        expect(cancelledJob?.status).toBe("cancelled");
      });

      it("should not cancel completed jobs", () => {
        const job = ocrLimitService.createJob(
          testUsers.basic.userId,
          testUsers.basic.sessionId,
          testFiles.validPdf,
          5
        );

        ocrLimitService.startJob(job.id);
        ocrLimitService.completeJob(job.id, 5);

        const result = ocrLimitService.cancelJob(job.id);

        expect(result).toBeNull();
      });
    });

    describe("getSessionJobs", () => {
      it("should return all jobs for a session", () => {
        // Use a unique session ID to avoid state pollution from other tests
        const uniqueSessionId = `session-jobs-test-${Date.now()}`;

        ocrLimitService.createJob(
          testUsers.basic.userId,
          uniqueSessionId,
          testFiles.validPdf,
          5
        );

        vi.advanceTimersByTime(100);

        ocrLimitService.createJob(
          testUsers.basic.userId,
          uniqueSessionId,
          testFiles.validImage,
          1
        );

        const jobs = ocrLimitService.getSessionJobs(uniqueSessionId);

        expect(jobs.length).toBe(2);
      });

      it("should return empty array for new session", () => {
        const jobs = ocrLimitService.getSessionJobs("new-session");

        expect(jobs).toEqual([]);
      });

      it("should sort jobs by creation time (newest first)", () => {
        // Use a unique session ID to avoid state pollution from other tests
        const uniqueSessionId = `session-sort-test-${Date.now()}`;

        ocrLimitService.createJob(
          testUsers.basic.userId,
          uniqueSessionId,
          testFiles.validPdf,
          5
        );

        vi.advanceTimersByTime(1000);

        const newerJob = ocrLimitService.createJob(
          testUsers.basic.userId,
          uniqueSessionId,
          testFiles.validImage,
          1
        );

        const jobs = ocrLimitService.getSessionJobs(uniqueSessionId);

        expect(jobs[0].id).toBe(newerJob.id);
      });
    });
  });

  describe("Usage Statistics", () => {
    it("should return complete OCR usage stats", async () => {
      const userId = "stats-user";
      const sessionId = "stats-session";

      await ocrLimitService.trackUsage(userId, sessionId, 10);

      const stats = await ocrLimitService.getUsageStats(userId, sessionId);

      expect(stats.session.pages.used).toBe(10);
      expect(stats.session.pages.limit).toBe(30);
      expect(stats.session.documents.used).toBe(1);
      expect(stats.session.documents.limit).toBe(5);

      expect(stats.daily.pages.used).toBe(10);
      expect(stats.daily.pages.limit).toBe(50);
      expect(stats.daily.resetTime).toBeInstanceOf(Date);

      expect(stats.limits.maxFileSizeMB).toBe(5);
      expect(stats.limits.maxPagesPerDocument).toBe(10);

      expect(stats.queue).toBeDefined();
    });

    it("should return zero usage for new users", async () => {
      const stats = await ocrLimitService.getUsageStats("new-user", "new-session");

      expect(stats.session.pages.used).toBe(0);
      expect(stats.session.documents.used).toBe(0);
      expect(stats.daily.pages.used).toBe(0);
    });
  });

  describe("Daily Reset", () => {
    it("should reset daily usage at midnight UTC", async () => {
      const userId = "daily-reset-user";
      const sessionId = "daily-reset-session";

      // Track some usage
      await ocrLimitService.trackUsage(userId, sessionId, 20);

      let stats = await ocrLimitService.getUsageStats(userId, sessionId);
      expect(stats.daily.pages.used).toBe(20);

      // Advance to next day
      vi.setSystemTime(new Date("2024-06-16T00:00:01Z"));

      // Check limits to trigger reset
      await ocrLimitService.checkLimits(userId, sessionId, 1);

      stats = await ocrLimitService.getUsageStats(userId, sessionId);
      expect(stats.daily.pages.used).toBe(0);
    });
  });

  describe("Queue Management", () => {
    it("should track active job count", () => {
      // Get the initial count (may be non-zero due to shared state)
      const initialCount = ocrLimitService.getActiveJobCount();

      const uniqueSessionId = `queue-count-test-${Date.now()}`;

      const job1 = ocrLimitService.createJob(
        testUsers.basic.userId,
        uniqueSessionId,
        testFiles.validPdf,
        5
      );

      const job2 = ocrLimitService.createJob(
        testUsers.basic.userId,
        uniqueSessionId,
        testFiles.validImage,
        1
      );

      ocrLimitService.startJob(job1.id);

      // Should have 2 more active jobs than before (1 processing + 1 queued)
      expect(ocrLimitService.getActiveJobCount()).toBe(initialCount + 2);

      // Clean up - complete both jobs
      ocrLimitService.completeJob(job1.id, 5);
      ocrLimitService.completeJob(job2.id, 1);
    });

    it("should reject when queue is full", async () => {
      const timestamp = Date.now();
      const jobs = [];

      // Create max concurrent jobs (3)
      for (let i = 0; i < 3; i++) {
        const job = ocrLimitService.createJob(
          `queue-full-user-${i}-${timestamp}`,
          `queue-full-session-${i}-${timestamp}`,
          testFiles.validPdf,
          1
        );
        ocrLimitService.startJob(job.id);
        jobs.push(job);
      }

      const result = await ocrLimitService.checkLimits(
        `new-queue-user-${timestamp}`,
        `new-queue-session-${timestamp}`,
        1
      );

      expect(result.allowed).toBe(false);
      expect(result.limitType).toBe("queue_full");

      // Clean up - complete all jobs
      for (const job of jobs) {
        await ocrLimitService.completeJob(job.id, 1);
      }
    });
  });
});
