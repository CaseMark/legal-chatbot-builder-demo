"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lightning,
  Clock,
  CalendarBlank,
  Calendar,
  File,
  ArrowClockwise,
  Info,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface UsageStats {
  session: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  daily: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    resetTime: string;
  };
  monthly: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    resetTime: string;
  };
  ocr: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    resetTime: string;
  };
  limits: {
    perRequest: number;
    perSession: number;
    dailyPerUser: number;
    monthlyPerUser: number;
  };
}

interface UsageDashboardProps {
  className?: string;
  showAllStats?: boolean;
  onRefresh?: () => void;
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

function formatTimeUntil(resetTime: string): string {
  const reset = new Date(resetTime);
  const now = new Date();
  const diff = reset.getTime() - now.getTime();

  if (diff <= 0) return "Now";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function ProgressBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const getColor = (p: number) => {
    if (p >= 90) return "bg-destructive";
    if (p >= 70) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div
      className={cn("h-2 rounded-full bg-muted overflow-hidden", className)}
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

function UsageCard({
  icon: Icon,
  title,
  used,
  limit,
  remaining,
  percentUsed,
  resetTime,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetTime?: string;
  iconColor: string;
}) {
  const getStatusIcon = () => {
    if (percentUsed >= 90) {
      return <Warning className="h-4 w-4 text-destructive" weight="fill" />;
    }
    if (percentUsed >= 70) {
      return <Warning className="h-4 w-4 text-yellow-500" weight="fill" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" weight="fill" />;
  };

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", iconColor)} weight="fill" />
          <span className="font-medium">{title}</span>
        </div>
        {getStatusIcon()}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Used</span>
          <span className="font-mono">
            {formatNumber(used)} / {formatNumber(limit)}
          </span>
        </div>

        <ProgressBar percent={percentUsed} />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatNumber(remaining)} remaining</span>
          {resetTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Resets in {formatTimeUntil(resetTime)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function UsageDashboard({
  className,
  showAllStats = true,
  onRefresh,
}: UsageDashboardProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/usage");
      if (!response.ok) {
        throw new Error("Failed to fetch usage stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Refresh every 30 seconds
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
      <div className={cn("rounded-lg border bg-background p-6", className)}>
        <div className="flex items-center justify-center py-8">
          <ArrowClockwise className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/20 bg-destructive/5 p-6",
          className
        )}
      >
        <div className="flex items-center gap-2 text-destructive">
          <Warning className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-3 text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Usage Dashboard</h2>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={loading}
        >
          <ArrowClockwise
            className={cn("h-4 w-4", loading && "animate-spin")}
          />
          Refresh
        </button>
      </div>

      {/* Limits Info */}
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lightning className="h-4 w-4" />
          <span>
            Per-request limit: {formatNumber(stats.limits.perRequest)} tokens
          </span>
        </div>
      </div>

      {/* Usage Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Session Usage */}
        <UsageCard
          icon={Clock}
          title="Session"
          used={stats.session.used}
          limit={stats.session.limit}
          remaining={stats.session.remaining}
          percentUsed={stats.session.percentUsed}
          iconColor="text-blue-500"
        />

        {/* Daily Usage */}
        <UsageCard
          icon={CalendarBlank}
          title="Daily"
          used={stats.daily.used}
          limit={stats.daily.limit}
          remaining={stats.daily.remaining}
          percentUsed={stats.daily.percentUsed}
          resetTime={stats.daily.resetTime}
          iconColor="text-green-500"
        />

        {showAllStats && (
          <>
            {/* Monthly Usage */}
            <UsageCard
              icon={Calendar}
              title="Monthly"
              used={stats.monthly.used}
              limit={stats.monthly.limit}
              remaining={stats.monthly.remaining}
              percentUsed={stats.monthly.percentUsed}
              resetTime={stats.monthly.resetTime}
              iconColor="text-purple-500"
            />

            {/* OCR Usage */}
            <UsageCard
              icon={File}
              title="OCR Pages"
              used={stats.ocr.used}
              limit={stats.ocr.limit}
              remaining={stats.ocr.remaining}
              percentUsed={stats.ocr.percentUsed}
              resetTime={stats.ocr.resetTime}
              iconColor="text-orange-500"
            />
          </>
        )}
      </div>

      {/* Warning Banner */}
      {(stats.daily.percentUsed >= 80 || stats.session.percentUsed >= 80) && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
          <div className="flex items-start gap-3">
            <Warning
              className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5"
              weight="fill"
            />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Approaching usage limit
              </p>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                {stats.daily.percentUsed >= 80
                  ? `You've used ${stats.daily.percentUsed}% of your daily limit. `
                  : ""}
                {stats.session.percentUsed >= 80
                  ? `Session is at ${stats.session.percentUsed}% capacity. Consider starting a new chat.`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Limit Exceeded Banner */}
      {(stats.daily.remaining <= 0 || stats.session.remaining <= 0) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <Warning
              className="h-5 w-5 text-destructive mt-0.5"
              weight="fill"
            />
            <div>
              <p className="font-medium text-destructive">Usage limit reached</p>
              <p className="mt-1 text-sm text-destructive/80">
                {stats.daily.remaining <= 0
                  ? `Daily limit reached. Resets in ${formatTimeUntil(stats.daily.resetTime)}.`
                  : "Session limit reached. Start a new conversation to continue."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
