"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Warning,
  ArrowSquareOut,
  Lightning,
  Clock,
  X,
  ArrowClockwise,
} from "@phosphor-icons/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogMedia,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LimitType =
  | "per_request"
  | "per_session"
  | "daily"
  | "monthly"
  | "file_size"
  | "file_type"
  | "pages_per_doc"
  | "docs_per_session"
  | "pages_per_session"
  | "pages_per_day"
  | "queue_full"
  | "ocr";

interface LimitWarningModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Type of limit that was hit */
  limitType: LimitType;
  /** Error message from the limit check */
  message: string;
  /** Current usage amount */
  used?: number;
  /** Maximum limit */
  limit?: number;
  /** Remaining allowance */
  remaining?: number;
  /** When the limit resets (for daily/monthly) */
  resetTime?: Date;
  /** URL to upgrade page */
  upgradeUrl?: string;
  /** Callback for session reset action */
  onResetSession?: () => void;
  /** Callback for starting a new chat */
  onNewChat?: () => void;
}

function formatTimeUntil(resetTime: Date): string {
  const now = new Date();
  const diff = resetTime.getTime() - now.getTime();

  if (diff <= 0) return "now";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
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

function getLimitInfo(limitType: LimitType) {
  const info: Record<
    LimitType,
    {
      title: string;
      description: string;
      icon: "warning" | "clock" | "lightning";
      canReset: boolean;
      canUpgrade: boolean;
    }
  > = {
    per_request: {
      title: "Message Too Long",
      description:
        "Your message exceeds the maximum token limit per request. Please shorten your message and try again.",
      icon: "warning",
      canReset: false,
      canUpgrade: true,
    },
    per_session: {
      title: "Session Limit Reached",
      description:
        "You've reached the token limit for this session. Start a new chat to continue.",
      icon: "lightning",
      canReset: true,
      canUpgrade: true,
    },
    daily: {
      title: "Daily Limit Reached",
      description:
        "You've used all your tokens for today. Your limit will reset at midnight UTC.",
      icon: "clock",
      canReset: false,
      canUpgrade: true,
    },
    monthly: {
      title: "Monthly Limit Reached",
      description:
        "You've reached your monthly token limit. Consider upgrading for more capacity.",
      icon: "clock",
      canReset: false,
      canUpgrade: true,
    },
    file_size: {
      title: "File Too Large",
      description:
        "The file you're trying to upload exceeds the maximum size limit.",
      icon: "warning",
      canReset: false,
      canUpgrade: true,
    },
    file_type: {
      title: "Unsupported File Type",
      description:
        "This file type is not supported. Please upload a PDF, PNG, JPG, or TIFF file.",
      icon: "warning",
      canReset: false,
      canUpgrade: false,
    },
    pages_per_doc: {
      title: "Document Too Long",
      description:
        "This document has more pages than allowed. Try splitting it into smaller documents.",
      icon: "warning",
      canReset: false,
      canUpgrade: true,
    },
    docs_per_session: {
      title: "Document Limit Reached",
      description:
        "You've reached the maximum number of documents for this session.",
      icon: "lightning",
      canReset: true,
      canUpgrade: true,
    },
    pages_per_session: {
      title: "Page Limit Reached",
      description:
        "You've reached the maximum number of OCR pages for this session.",
      icon: "lightning",
      canReset: true,
      canUpgrade: true,
    },
    pages_per_day: {
      title: "Daily OCR Limit Reached",
      description:
        "You've used all your OCR pages for today. Try again tomorrow.",
      icon: "clock",
      canReset: false,
      canUpgrade: true,
    },
    queue_full: {
      title: "Processing Queue Full",
      description:
        "The document processing queue is currently full. Please wait a moment and try again.",
      icon: "clock",
      canReset: false,
      canUpgrade: false,
    },
    ocr: {
      title: "OCR Limit Reached",
      description:
        "You've reached your OCR processing limit for the day.",
      icon: "clock",
      canReset: false,
      canUpgrade: true,
    },
  };

  return info[limitType] || info.daily;
}

export function LimitWarningModal({
  open,
  onClose,
  limitType,
  message,
  used,
  limit,
  remaining,
  resetTime,
  upgradeUrl = "#",
  onResetSession,
  onNewChat,
}: LimitWarningModalProps) {
  const info = getLimitInfo(limitType);

  const iconElement = {
    warning: (
      <Warning className="h-8 w-8 text-destructive" weight="fill" />
    ),
    clock: <Clock className="h-8 w-8 text-amber-500" weight="fill" />,
    lightning: (
      <Lightning className="h-8 w-8 text-amber-500" weight="fill" />
    ),
  }[info.icon];

  const showUsageBar = used !== undefined && limit !== undefined;
  const percentUsed = showUsageBar ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia
            className={cn(
              info.icon === "warning"
                ? "bg-destructive/10"
                : "bg-amber-100 dark:bg-amber-900/30"
            )}
          >
            {iconElement}
          </AlertDialogMedia>
          <AlertDialogTitle>{info.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {message || info.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Usage Progress */}
        {showUsageBar && (
          <div
            className="rounded-lg bg-muted/50 p-4"
            role="region"
            aria-label="Usage statistics"
          >
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Usage</span>
              <span className="font-mono font-medium">
                {formatNumber(used)} / {formatNumber(limit)}
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={percentUsed}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${percentUsed.toFixed(0)}% of limit used`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  percentUsed >= 90
                    ? "bg-destructive"
                    : percentUsed >= 70
                      ? "bg-yellow-500"
                      : "bg-primary"
                )}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
              <span>
                {remaining !== undefined && remaining >= 0
                  ? `${formatNumber(remaining)} remaining`
                  : "Limit reached"}
              </span>
              {resetTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Resets in {formatTimeUntil(resetTime)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Reset time info for non-bar scenarios */}
        {!showUsageBar && resetTime && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Resets in {formatTimeUntil(resetTime)}</span>
          </div>
        )}

        <AlertDialogFooter>
          {/* Secondary action - Reset/New Chat */}
          {info.canReset && (onResetSession || onNewChat) && (
            <AlertDialogCancel
              onClick={() => {
                onResetSession?.();
                onNewChat?.();
                onClose();
              }}
              aria-label={onNewChat ? "Start new chat" : "Reset session"}
            >
              <ArrowClockwise className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {onNewChat ? "New Chat" : "Reset Session"}
            </AlertDialogCancel>
          )}

          {/* Close button */}
          {!info.canReset && (
            <AlertDialogCancel onClick={onClose}>
              Got it
            </AlertDialogCancel>
          )}

          {/* Upgrade CTA */}
          {info.canUpgrade && upgradeUrl !== "#" && (
            <AlertDialogAction
              render={
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
            >
              Upgrade Now
              <ArrowSquareOut className="h-4 w-4 ml-1.5" aria-hidden="true" />
            </AlertDialogAction>
          )}

          {/* Just close for non-upgradeable limits */}
          {!info.canUpgrade && info.canReset && (
            <AlertDialogAction onClick={onClose}>
              Got it
            </AlertDialogAction>
          )}
        </AlertDialogFooter>

        {/* Close button in corner */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook to manage limit warning modal state
 */
export function useLimitWarning() {
  const [modalState, setModalState] = useState<{
    open: boolean;
    limitType: LimitType;
    message: string;
    used?: number;
    limit?: number;
    remaining?: number;
    resetTime?: Date;
  }>({
    open: false,
    limitType: "daily",
    message: "",
  });

  const showLimitWarning = useCallback(
    (props: {
      limitType: LimitType;
      message: string;
      used?: number;
      limit?: number;
      remaining?: number;
      resetTime?: Date | string;
    }) => {
      setModalState({
        open: true,
        limitType: props.limitType,
        message: props.message,
        used: props.used,
        limit: props.limit,
        remaining: props.remaining,
        resetTime: props.resetTime
          ? typeof props.resetTime === "string"
            ? new Date(props.resetTime)
            : props.resetTime
          : undefined,
      });
    },
    []
  );

  const closeLimitWarning = useCallback(() => {
    setModalState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    modalState,
    showLimitWarning,
    closeLimitWarning,
  };
}
