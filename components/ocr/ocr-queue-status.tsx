"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  Spinner,
  File,
  Queue,
  Prohibit,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface OCRJob {
  id: string;
  filename: string;
  fileSize: number;
  fileType: string;
  estimatedPages: number;
  actualPages?: number;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

interface OCRQueueStatusProps {
  className?: string;
  maxVisibleJobs?: number;
  showCompleted?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(startMs: number, endMs?: number): string {
  const end = endMs || Date.now();
  const durationSec = Math.floor((end - startMs) / 1000);

  if (durationSec < 60) return `${durationSec}s`;
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}m ${seconds}s`;
}

function JobStatusIcon({ status }: { status: OCRJob["status"] }) {
  switch (status) {
    case "queued":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "processing":
      return <Spinner className="h-4 w-4 text-blue-500 animate-spin" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" weight="fill" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" weight="fill" />;
    case "cancelled":
      return <Prohibit className="h-4 w-4 text-muted-foreground" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function JobStatusBadge({ status }: { status: OCRJob["status"] }) {
  const variants: Record<OCRJob["status"], string> = {
    queued: "bg-muted text-muted-foreground",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    completed:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    cancelled: "bg-muted text-muted-foreground",
  };

  const labels: Record<OCRJob["status"], string> = {
    queued: "Queued",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        variants[status]
      )}
    >
      <JobStatusIcon status={status} />
      {labels[status]}
    </span>
  );
}

export function OCRQueueStatus({
  className,
  maxVisibleJobs = 5,
  showCompleted = true,
  autoRefresh = true,
  refreshInterval = 5000,
}: OCRQueueStatusProps) {
  const [jobs, setJobs] = useState<OCRJob[]>([]);
  const [queueStats, setQueueStats] = useState({ active: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/ocr/jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
        setQueueStats(data.queueStats || { active: 0, pending: 0 });
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    if (autoRefresh) {
      const interval = setInterval(fetchJobs, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchJobs, autoRefresh, refreshInterval]);

  // Filter jobs based on showCompleted
  const visibleJobs = jobs.filter((job) => {
    if (!showCompleted && (job.status === "completed" || job.status === "cancelled")) {
      return false;
    }
    return true;
  });

  const displayedJobs = expanded
    ? visibleJobs
    : visibleJobs.slice(0, maxVisibleJobs);
  const hasMore = visibleJobs.length > maxVisibleJobs;

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground",
          className
        )}
      >
        <Queue className="mx-auto h-8 w-8 mb-2" />
        <p>No OCR jobs in queue</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Queue className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">OCR Queue</span>
          {queueStats.active > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Spinner className="h-3 w-3 animate-spin" />
              {queueStats.active} active
            </span>
          )}
        </div>
        <button
          onClick={fetchJobs}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowClockwise className="h-4 w-4" />
        </button>
      </div>

      {/* Jobs List */}
      <div className="divide-y">
        {displayedJobs.map((job) => (
          <div
            key={job.id}
            className="px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <JobStatusIcon status={job.status} />
                  <span className="text-sm font-medium truncate">
                    {job.filename}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatFileSize(job.fileSize)}</span>
                  <span>
                    {job.actualPages || job.estimatedPages} page
                    {(job.actualPages || job.estimatedPages) !== 1 ? "s" : ""}
                  </span>
                  {job.startedAt && (
                    <span>{formatDuration(job.startedAt, job.completedAt)}</span>
                  )}
                </div>
              </div>
              <JobStatusBadge status={job.status} />
            </div>

            {/* Progress bar for processing jobs */}
            {job.status === "processing" && (
              <div className="mt-2">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {job.progress}% complete
                </p>
              </div>
            )}

            {/* Error message for failed jobs */}
            {job.status === "failed" && job.error && (
              <p className="mt-2 text-xs text-destructive">{job.error}</p>
            )}
          </div>
        ))}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-xs text-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t"
        >
          {expanded
            ? "Show less"
            : `Show ${visibleJobs.length - maxVisibleJobs} more`}
        </button>
      )}
    </div>
  );
}
