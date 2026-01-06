"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lightning,
  Clock,
  CalendarBlank,
  File,
  CaretDown,
  CaretUp,
  ArrowSquareOut,
  Warning,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UsageData {
  session: { used: number; limit: number; percentUsed: number };
  daily: { used: number; limit: number; percentUsed: number; resetTime: string };
  ocr: { used: number; limit: number; percentUsed: number; resetTime: string };
}

interface UsageMeterProps {
  /** Variant style */
  variant?: "compact" | "expanded" | "mini";
  /** Position in the UI */
  position?: "header" | "sidebar" | "floating";
  /** Show OCR stats */
  showOcr?: boolean;
  /** Custom class name */
  className?: string;
  /** Upgrade URL */
  upgradeUrl?: string;
  /** Poll interval in ms (0 to disable) */
  pollInterval?: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function MiniProgressRing({
  percent,
  size = 24,
  strokeWidth = 3,
  className,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  const getColor = (p: number) => {
    if (p >= 90) return "stroke-destructive";
    if (p >= 70) return "stroke-yellow-500";
    return "stroke-primary";
  };

  return (
    <svg
      width={size}
      height={size}
      className={cn("transform -rotate-90", className)}
      role="img"
      aria-label={`${percent.toFixed(0)}% used`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn("transition-all duration-300", getColor(percent))}
      />
    </svg>
  );
}

function ProgressBar({
  percent,
  className,
  size = "default",
}: {
  percent: number;
  className?: string;
  size?: "sm" | "default";
}) {
  const getColor = (p: number) => {
    if (p >= 90) return "bg-destructive";
    if (p >= 70) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div
      className={cn(
        "rounded-full bg-muted overflow-hidden",
        size === "sm" ? "h-1" : "h-1.5",
        className
      )}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          getColor(percent)
        )}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function UsageMeter({
  variant = "compact",
  position = "header",
  showOcr = true,
  className,
  upgradeUrl = "#",
  pollInterval = 30000,
}: UsageMeterProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    try {
      const response = await fetch("/api/usage");
      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch {
      // Silently fail - will retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();

    if (pollInterval > 0) {
      const interval = setInterval(fetchUsage, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchUsage, pollInterval]);

  // Determine if any limits are critical
  const isCritical = usage
    ? usage.session.percentUsed >= 90 ||
      usage.daily.percentUsed >= 90 ||
      (showOcr && usage.ocr.percentUsed >= 90)
    : false;

  const isWarning = usage
    ? usage.session.percentUsed >= 70 ||
      usage.daily.percentUsed >= 70 ||
      (showOcr && usage.ocr.percentUsed >= 70)
    : false;

  if (loading && !usage) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground",
          className
        )}
        aria-label="Loading usage data"
      >
        <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
        <span className="animate-pulse">Loading...</span>
      </div>
    );
  }

  if (!usage) return null;

  // Mini variant - just a circular indicator
  if (variant === "mini") {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "relative flex items-center justify-center",
          className
        )}
        aria-label={`Usage: ${usage.daily.percentUsed.toFixed(0)}% of daily limit`}
        aria-expanded={expanded}
      >
        <MiniProgressRing percent={usage.daily.percentUsed} size={28} />
        <span className="absolute text-[10px] font-medium">
          {Math.round(usage.daily.percentUsed)}
        </span>
        {isCritical && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
        )}
      </button>
    );
  }

  // Compact variant - single line with expandable details
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "rounded-lg border bg-background",
          position === "floating" && "shadow-lg",
          className
        )}
        role="region"
        aria-label="Usage statistics"
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between gap-3 p-3 text-sm"
          aria-expanded={expanded}
          aria-controls="usage-details"
        >
          <div className="flex items-center gap-2">
            <Lightning
              className={cn(
                "h-4 w-4",
                isCritical
                  ? "text-destructive"
                  : isWarning
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              )}
              weight={isCritical || isWarning ? "fill" : "regular"}
              aria-hidden="true"
            />
            <span className="font-medium">
              {formatNumber(usage.daily.used)} / {formatNumber(usage.daily.limit)}
            </span>
            <span className="text-muted-foreground">tokens today</span>
          </div>
          <div className="flex items-center gap-2">
            {isCritical && (
              <Warning
                className="h-4 w-4 text-destructive"
                weight="fill"
                aria-label="Critical usage level"
              />
            )}
            {expanded ? (
              <CaretUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <CaretDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div
            id="usage-details"
            className="border-t px-3 pb-3 pt-2 space-y-3"
          >
            {/* Session Usage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Session
                </span>
                <span className="font-mono">
                  {formatNumber(usage.session.used)} / {formatNumber(usage.session.limit)}
                </span>
              </div>
              <ProgressBar percent={usage.session.percentUsed} size="sm" />
            </div>

            {/* Daily Usage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarBlank className="h-3 w-3" aria-hidden="true" />
                  Daily
                </span>
                <span className="font-mono">
                  {formatNumber(usage.daily.used)} / {formatNumber(usage.daily.limit)}
                </span>
              </div>
              <ProgressBar percent={usage.daily.percentUsed} size="sm" />
            </div>

            {/* OCR Usage */}
            {showOcr && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <File className="h-3 w-3" aria-hidden="true" />
                    OCR Pages
                  </span>
                  <span className="font-mono">
                    {formatNumber(usage.ocr.used)} / {formatNumber(usage.ocr.limit)}
                  </span>
                </div>
                <ProgressBar percent={usage.ocr.percentUsed} size="sm" />
              </div>
            )}

            {/* Upgrade CTA */}
            {upgradeUrl !== "#" && (isCritical || isWarning) && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950"
                render={
                  <a
                    href={upgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <Lightning className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Upgrade for more
                <ArrowSquareOut className="h-3 w-3 ml-1" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Expanded variant - full details always visible
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-4 space-y-4",
        position === "floating" && "shadow-lg",
        className
      )}
      role="region"
      aria-label="Usage statistics"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightning
            className={cn(
              "h-5 w-5",
              isCritical
                ? "text-destructive"
                : isWarning
                  ? "text-yellow-500"
                  : "text-primary"
            )}
            weight="fill"
            aria-hidden="true"
          />
          <span className="font-semibold">Usage</span>
        </div>
        {isCritical && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <Warning className="h-3.5 w-3.5" weight="fill" aria-hidden="true" />
            Critical
          </span>
        )}
      </div>

      {/* Session Usage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Session
          </span>
          <span className="font-mono text-sm">
            {formatNumber(usage.session.used)} / {formatNumber(usage.session.limit)}
          </span>
        </div>
        <ProgressBar percent={usage.session.percentUsed} />
        <p className="text-xs text-muted-foreground">
          {formatNumber(usage.session.limit - usage.session.used)} remaining
        </p>
      </div>

      {/* Daily Usage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CalendarBlank className="h-4 w-4" aria-hidden="true" />
            Daily
          </span>
          <span className="font-mono text-sm">
            {formatNumber(usage.daily.used)} / {formatNumber(usage.daily.limit)}
          </span>
        </div>
        <ProgressBar percent={usage.daily.percentUsed} />
        <p className="text-xs text-muted-foreground">
          Resets at midnight UTC
        </p>
      </div>

      {/* OCR Usage */}
      {showOcr && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <File className="h-4 w-4" aria-hidden="true" />
              OCR Pages
            </span>
            <span className="font-mono text-sm">
              {formatNumber(usage.ocr.used)} / {formatNumber(usage.ocr.limit)}
            </span>
          </div>
          <ProgressBar percent={usage.ocr.percentUsed} />
          <p className="text-xs text-muted-foreground">
            {formatNumber(usage.ocr.limit - usage.ocr.used)} pages remaining today
          </p>
        </div>
      )}

      {/* Upgrade CTA */}
      {upgradeUrl !== "#" && (
        <Button
          size="sm"
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
          render={
            <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" />
          }
        >
          <Lightning className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Upgrade for unlimited
          <ArrowSquareOut className="h-3.5 w-3.5 ml-1.5" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

/**
 * Inline usage indicator for headers
 */
export function UsageIndicator({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => res.json())
      .then(setUsage)
      .catch(() => {});
  }, []);

  if (!usage) return null;

  const percent = usage.daily.percentUsed;
  const isCritical = percent >= 90;
  const isWarning = percent >= 70;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        isCritical
          ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
          : isWarning
            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        className
      )}
      aria-label={`${percent.toFixed(0)}% of daily limit used. Click for details.`}
    >
      <MiniProgressRing percent={percent} size={16} strokeWidth={2} />
      <span>{Math.round(percent)}% used</span>
      {isCritical && (
        <Warning className="h-3 w-3" weight="fill" aria-hidden="true" />
      )}
    </button>
  );
}
