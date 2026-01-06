"use client";

import { useState, useEffect } from "react";
import {
  Lightning,
  ArrowSquareOut,
  Sparkle,
  Check,
  X,
  Rocket,
  Crown,
  Star,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface UpgradeCtaProps {
  /** CTA variant */
  variant?: "banner" | "card" | "inline" | "modal-footer";
  /** Trigger context */
  context?: "limit-warning" | "sidebar" | "settings" | "general";
  /** Custom headline */
  headline?: string;
  /** Custom description */
  description?: string;
  /** Upgrade URL */
  upgradeUrl?: string;
  /** Show feature comparison */
  showFeatures?: boolean;
  /** Custom class name */
  className?: string;
  /** Dismissible */
  dismissible?: boolean;
  /** On dismiss callback */
  onDismiss?: () => void;
}

const features = {
  demo: [
    { name: "4K tokens per request", included: true },
    { name: "50K tokens per session", included: true },
    { name: "100K tokens per day", included: true },
    { name: "50 OCR pages per day", included: true },
    { name: "Priority support", included: false },
    { name: "Custom integrations", included: false },
    { name: "Advanced analytics", included: false },
    { name: "Team collaboration", included: false },
  ],
  pro: [
    { name: "Unlimited tokens per request", included: true },
    { name: "Unlimited session tokens", included: true },
    { name: "1M tokens per day", included: true },
    { name: "500 OCR pages per day", included: true },
    { name: "Priority support", included: true },
    { name: "Custom integrations", included: true },
    { name: "Advanced analytics", included: true },
    { name: "Team collaboration", included: true },
  ],
};

function FeatureComparison({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lightning className="h-4 w-4 text-amber-500" weight="fill" />
          Demo Plan
        </div>
        <ul className="space-y-2">
          {features.demo.map((feature, idx) => (
            <li
              key={idx}
              className={cn(
                "flex items-center gap-2 text-sm",
                feature.included ? "text-foreground" : "text-muted-foreground/50"
              )}
            >
              {feature.included ? (
                <Check className="h-3.5 w-3.5 text-green-500" weight="bold" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              {feature.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Crown className="h-4 w-4 text-amber-500" weight="fill" />
          Pro Plan
        </div>
        <ul className="space-y-2">
          {features.pro.map((feature, idx) => (
            <li
              key={idx}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <Check className="h-3.5 w-3.5 text-green-500" weight="bold" />
              {feature.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function UpgradeCta({
  variant = "banner",
  context = "general",
  headline,
  description,
  upgradeUrl = "#",
  showFeatures = false,
  className,
  dismissible = false,
  onDismiss,
}: UpgradeCtaProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const contextMessages = {
    "limit-warning": {
      headline: headline || "Need more capacity?",
      description:
        description ||
        "Upgrade to Pro for higher limits and unlock all features.",
    },
    sidebar: {
      headline: headline || "Unlock Full Power",
      description:
        description ||
        "Remove limits and access premium features with Pro.",
    },
    settings: {
      headline: headline || "Upgrade Your Plan",
      description:
        description ||
        "Get unlimited usage and priority support with Pro.",
    },
    general: {
      headline: headline || "Ready for More?",
      description:
        description ||
        "Upgrade to Pro for unlimited usage and premium features.",
    },
  };

  const { headline: ctaHeadline, description: ctaDescription } =
    contextMessages[context];

  // Inline variant - minimal, fits in existing UI
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 text-sm dark:from-amber-950/30 dark:to-orange-950/30",
          className
        )}
      >
        <Sparkle className="h-3.5 w-3.5 text-amber-500" weight="fill" />
        <span className="text-amber-800 dark:text-amber-200">
          {ctaHeadline}
        </span>
        {upgradeUrl !== "#" && (
          <a
            href={upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 underline underline-offset-2"
          >
            Upgrade
            <ArrowSquareOut className="inline h-3 w-3 ml-0.5" />
          </a>
        )}
      </div>
    );
  }

  // Modal footer variant - for use in dialogs
  if (variant === "modal-footer") {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 p-3 dark:from-amber-950/30 dark:to-orange-950/30",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-amber-500" weight="fill" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {ctaHeadline}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {ctaDescription}
            </p>
          </div>
        </div>
        {upgradeUrl !== "#" && (
          <Button
            size="sm"
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
            render={
              <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            Upgrade
            <ArrowSquareOut className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
      </div>
    );
  }

  // Banner variant - full width
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 p-4 text-white",
          className
        )}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00bTAtMTZjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00bS0xNiAxNmMwLTIuMiAxLjgtNCA0LTRzNCAxLjggNCA0LTEuOCA0LTQgNC00LTEuOC00LTRtMC0xNmMwLTIuMiAxLjgtNCA0LTRzNCAxLjggNCA0LTEuOCA0LTQgNC00LTEuOC00LTQiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white/20 p-2">
              <Crown className="h-5 w-5" weight="fill" />
            </div>
            <div>
              <h3 className="font-semibold">{ctaHeadline}</h3>
              <p className="text-sm text-white/90">{ctaDescription}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {upgradeUrl !== "#" && (
              <Button
                className="bg-white text-amber-600 hover:bg-white/90"
                render={
                  <a
                    href={upgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                Upgrade Now
                <ArrowSquareOut className="h-4 w-4 ml-1.5" />
              </Button>
            )}
            {dismissible && (
              <button
                onClick={handleDismiss}
                className="rounded p-1 hover:bg-white/20 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Card variant - for sidebars or standalone placement
  return (
    <Card
      className={cn(
        "overflow-hidden border-amber-200 dark:border-amber-800",
        className
      )}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-900/30">
              <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" weight="fill" />
            </div>
            <CardTitle className="text-base">{ctaHeadline}</CardTitle>
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <CardDescription>{ctaDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {showFeatures && <FeatureComparison className="mb-4" />}

        {upgradeUrl !== "#" && (
          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
            render={
              <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <Rocket className="h-4 w-4 mr-2" weight="fill" />
            Upgrade to Pro
            <ArrowSquareOut className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Floating upgrade button for persistent visibility
 */
export function FloatingUpgradeButton({
  upgradeUrl = "#",
  className,
}: {
  upgradeUrl?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(true);

  if (!visible || upgradeUrl === "#") return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300",
        className
      )}
    >
      <Button
        className="rounded-full shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 pr-2"
        render={
          <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" />
        }
      >
        <Rocket className="h-4 w-4 mr-2" weight="fill" />
        Upgrade to Pro
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVisible(false);
          }}
          className="ml-2 rounded-full p-1 hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </Button>
    </div>
  );
}
