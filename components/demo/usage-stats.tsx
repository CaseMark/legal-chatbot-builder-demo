"use client";

import { useState, useEffect } from "react";
import {
  Lightning,
  File,
  Info,
  Clock,
  CalendarBlank,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface UsageStatsProps {
  className?: string;
  compact?: boolean;
  showSession?: boolean;
}

interface Stats {
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

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

export function UsageStats({
  className,
  compact = false,
  showSession = false,
}: UsageStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/usage");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch {
        // Silently fail - stats are optional
      } finally {
        setLoading(false);
      }
    }

    fetchStats();

    // Refresh every minute
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-4 text-xs", className)}>
        {showSession && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-muted-foreground">
              {formatNumber(stats.session.remaining)} session
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Lightning className="h-3.5 w-3.5 text-yellow-500" weight="fill" />
          <span className="text-muted-foreground">
            {formatNumber(stats.daily.remaining)} daily
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <File className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-muted-foreground">
            {stats.ocr.remaining} OCR
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-background p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Demo Usage</h3>
      </div>

      <div className="space-y-4">
        {/* Session Usage */}
        {showSession && (
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>Session</span>
              </div>
              <span className="text-muted-foreground">
                {formatNumber(stats.session.used)} /{" "}
                {formatNumber(stats.session.limit)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  stats.session.percentUsed > 90
                    ? "bg-destructive"
                    : stats.session.percentUsed > 70
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                )}
                style={{
                  width: `${Math.min(stats.session.percentUsed, 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Daily Token Usage */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <div className="flex items-center gap-1.5">
              <CalendarBlank className="h-4 w-4 text-green-500" />
              <span>Daily Tokens</span>
            </div>
            <span className="text-muted-foreground">
              {formatNumber(stats.daily.used)} /{" "}
              {formatNumber(stats.daily.limit)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                stats.daily.percentUsed > 90
                  ? "bg-destructive"
                  : stats.daily.percentUsed > 70
                  ? "bg-yellow-500"
                  : "bg-green-500"
              )}
              style={{ width: `${Math.min(stats.daily.percentUsed, 100)}%` }}
            />
          </div>
        </div>

        {/* OCR Usage */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <div className="flex items-center gap-1.5">
              <File className="h-4 w-4 text-orange-500" />
              <span>OCR Pages</span>
            </div>
            <span className="text-muted-foreground">
              {stats.ocr.used} / {stats.ocr.limit}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                stats.ocr.percentUsed > 90
                  ? "bg-destructive"
                  : stats.ocr.percentUsed > 70
                  ? "bg-yellow-500"
                  : "bg-orange-500"
              )}
              style={{ width: `${Math.min(stats.ocr.percentUsed, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Limits reset daily at midnight UTC. Per-request limit:{" "}
        {formatNumber(stats.limits.perRequest)} tokens.
      </p>
    </div>
  );
}
