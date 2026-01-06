"use client";

import { useState, useEffect, useCallback } from "react";
import {
  File,
  Files,
  Clock,
  CalendarBlank,
  ArrowClockwise,
  Warning,
  CheckCircle,
  Info,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface OCRUsageStats {
  session: {
    pages: { used: number; limit: number; remaining: number; percentUsed: number };
    documents: { used: number; limit: number; remaining: number; percentUsed: number };
  };
  daily: {
    pages: { used: number; limit: number; remaining: number; percentUsed: number };
    documents: { used: number; limit: number; remaining: number; percentUsed: number };
    resetTime: string;
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

interface OCRUsageMeterProps {
  className?: string;
  compact?: boolean;
  showQueue?: boolean;
  onRefresh?: () => void;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatTimeUntil(resetTime: string): string {
  const reset = new Date(resetTime);
  const now = new Date();
  const diff = reset.getTime() - now.getTime();

  if (diff <= 0) return "Now";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function ProgressBar({
  percent,
  color = "primary",
}: {
  percent: number;
  color?: "primary" | "warning" | "danger" | "blue" | "green" | "orange";
}) {
  const getColorClass = () => {
    if (percent >= 90) return "bg-destructive";
    if (percent >= 70) return "bg-yellow-500";

    switch (color) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-green-500";
      case "orange":
        return "bg-orange-500";
      default:
        return "bg-primary";
    }
  };

  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          getColorClass()
        )}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function OCRUsageMeter({
  className,
  compact = false,
  showQueue = true,
  onRefresh,
}: OCRUsageMeterProps) {
  const [stats, setStats] = useState<OCRUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/ocr/validate");
      if (!response.ok) throw new Error("Failed to fetch OCR stats");
      const data = await response.json();
      setStats(data.usageStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleRefresh = () => {
    setLoading(true);
    fetchStats();
    onRefresh?.();
  };

  if (loading && !stats) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 bg-muted rounded w-24" />
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-4 text-xs", className)}>
        <div className="flex items-center gap-1.5">
          <File className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-muted-foreground">
            {stats.daily.pages.remaining} pages
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Files className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-muted-foreground">
            {stats.daily.documents.remaining} docs
          </span>
        </div>
        {showQueue && stats.queue.active > 0 && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-yellow-500 animate-pulse" />
            <span className="text-muted-foreground">
              {stats.queue.active} processing
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-background p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <File className="h-5 w-5 text-orange-500" />
          <h3 className="font-medium">OCR Usage</h3>
        </div>
        <button
          onClick={handleRefresh}
          className="text-muted-foreground hover:text-foreground transition-colors"
          disabled={loading}
        >
          <ArrowClockwise
            className={cn("h-4 w-4", loading && "animate-spin")}
          />
        </button>
      </div>

      <div className="space-y-4">
        {/* Session Pages */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Session Pages</span>
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {formatNumber(stats.session.pages.used)} /{" "}
              {formatNumber(stats.session.pages.limit)}
            </span>
          </div>
          <ProgressBar percent={stats.session.pages.percentUsed} color="blue" />
        </div>

        {/* Session Documents */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <div className="flex items-center gap-1.5">
              <Files className="h-4 w-4 text-green-500" />
              <span>Session Documents</span>
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {formatNumber(stats.session.documents.used)} /{" "}
              {formatNumber(stats.session.documents.limit)}
            </span>
          </div>
          <ProgressBar
            percent={stats.session.documents.percentUsed}
            color="green"
          />
        </div>

        {/* Daily Pages */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <div className="flex items-center gap-1.5">
              <CalendarBlank className="h-4 w-4 text-orange-500" />
              <span>Daily Pages</span>
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {formatNumber(stats.daily.pages.used)} /{" "}
              {formatNumber(stats.daily.pages.limit)}
            </span>
          </div>
          <ProgressBar percent={stats.daily.pages.percentUsed} color="orange" />
          <p className="text-xs text-muted-foreground mt-1">
            Resets in {formatTimeUntil(stats.daily.resetTime)}
          </p>
        </div>

        {/* Queue Status */}
        {showQueue && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processing Queue</span>
              <div className="flex items-center gap-2">
                {stats.queue.active > 0 ? (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Clock className="h-3.5 w-3.5 animate-pulse" />
                    {stats.queue.active} active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Idle
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Limits Info */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-1">
            <Info className="h-3 w-3" />
            <span>Limits</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <span>Max file: {stats.limits.maxFileSizeMB}MB</span>
            <span>Max pages/doc: {stats.limits.maxPagesPerDocument}</span>
          </div>
        </div>

        {/* Warning if approaching limits */}
        {(stats.daily.pages.percentUsed >= 80 ||
          stats.session.documents.percentUsed >= 80) && (
          <div className="rounded bg-yellow-50 dark:bg-yellow-950 p-2 text-xs">
            <div className="flex items-start gap-2">
              <Warning className="h-4 w-4 text-yellow-600 mt-0.5" />
              <span className="text-yellow-700 dark:text-yellow-300">
                Approaching OCR limits. Consider waiting for daily reset.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
