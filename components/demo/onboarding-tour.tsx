"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Lightning,
  File,
  ChatCircle,
  Sparkle,
  Info,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TourStep {
  /** Unique identifier for the step */
  id: string;
  /** Target element selector (CSS selector) */
  target: string;
  /** Title of the tooltip */
  title: string;
  /** Description text */
  description: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Position of the tooltip relative to target */
  position?: "top" | "bottom" | "left" | "right";
  /** Highlight the target element */
  highlight?: boolean;
  /** Custom action button text */
  actionText?: string;
  /** Callback when this step's action is clicked */
  onAction?: () => void;
}

interface OnboardingTourProps {
  /** Tour steps configuration */
  steps: TourStep[];
  /** Storage key for completion state */
  storageKey?: string;
  /** Callback when tour is completed */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
  /** Whether to show the tour (controlled mode) */
  show?: boolean;
  /** Force show even if completed before */
  forceShow?: boolean;
}

// Default tour steps for the demo app
export const defaultDemoTourSteps: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='welcome']",
    title: "Welcome to the Demo!",
    description:
      "This is a demo version with usage limits. Let's take a quick tour to help you get started.",
    icon: <Sparkle className="h-5 w-5 text-amber-500" weight="fill" />,
    position: "bottom",
  },
  {
    id: "chat",
    target: "[data-tour='chat-input']",
    title: "Ask Legal Questions",
    description:
      "Type your legal questions here. The AI assistant will analyze your documents and provide helpful answers.",
    icon: <ChatCircle className="h-5 w-5 text-blue-500" weight="fill" />,
    position: "top",
    highlight: true,
  },
  {
    id: "documents",
    target: "[data-tour='document-upload']",
    title: "Upload Documents",
    description:
      "Upload PDFs, images, or scanned documents. The OCR system will extract text for analysis.",
    icon: <File className="h-5 w-5 text-green-500" weight="fill" />,
    position: "right",
    highlight: true,
  },
  {
    id: "usage",
    target: "[data-tour='usage-meter']",
    title: "Track Your Usage",
    description:
      "Monitor your token and OCR usage here. Demo limits reset daily at midnight UTC.",
    icon: <Lightning className="h-5 w-5 text-amber-500" weight="fill" />,
    position: "bottom",
    highlight: true,
  },
  {
    id: "sample-docs",
    target: "[data-tour='sample-documents']",
    title: "Try Sample Documents",
    description:
      "Not sure where to start? Use our sample legal documents to explore the features.",
    icon: <Info className="h-5 w-5 text-purple-500" weight="fill" />,
    position: "left",
    actionText: "Load Samples",
  },
];

function TooltipArrow({
  position,
  className,
}: {
  position: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const arrowClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-background",
    bottom:
      "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-background",
    left: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-background",
    right:
      "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-background",
  };

  return (
    <div
      className={cn(
        "absolute w-0 h-0 border-8",
        arrowClasses[position],
        className
      )}
      aria-hidden="true"
    />
  );
}

export function OnboardingTour({
  steps,
  storageKey = "demo-tour-completed",
  onComplete,
  onSkip,
  show: controlledShow,
  forceShow = false,
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check if tour was completed
  useEffect(() => {
    if (controlledShow !== undefined) {
      setIsVisible(controlledShow);
      return;
    }

    if (forceShow) {
      setIsVisible(true);
      return;
    }

    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // Delay showing tour to let page render
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [storageKey, controlledShow, forceShow]);

  // Update target position
  const updateTargetPosition = useCallback(() => {
    if (!isVisible || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const target = document.querySelector(step.target);

    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isVisible, currentStep, steps]);

  useEffect(() => {
    updateTargetPosition();

    // Update on scroll/resize
    window.addEventListener("scroll", updateTargetPosition, true);
    window.addEventListener("resize", updateTargetPosition);

    return () => {
      window.removeEventListener("scroll", updateTargetPosition, true);
      window.removeEventListener("resize", updateTargetPosition);
    };
  }, [updateTargetPosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, "true");
    onComplete?.();
  };

  const handleSkip = () => {
    setIsVisible(false);
    localStorage.setItem(storageKey, "true");
    onSkip?.();
  };

  const handleAction = () => {
    const step = steps[currentStep];
    step.onAction?.();
    handleNext();
  };

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Center on screen if no target
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const step = steps[currentStep];
    const position = step.position || "bottom";
    const padding = 16;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
    const tooltipWidth = tooltipRef.current?.offsetWidth || 320;

    switch (position) {
      case "top":
        return {
          bottom: window.innerHeight - targetRect.top + padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case "bottom":
        return {
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case "left":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          right: window.innerWidth - targetRect.left + padding,
        };
      case "right":
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.right + padding,
        };
      default:
        return {};
    }
  };

  if (!isVisible || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Highlight cutout for target element */}
      {targetRect && step.highlight && (
        <div
          className="fixed z-[9999] rounded-lg ring-4 ring-primary/50 ring-offset-4 ring-offset-transparent transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-description"
        className={cn(
          "fixed z-[10000] w-80 rounded-2xl bg-background p-5 shadow-2xl ring-1 ring-foreground/10",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        style={getTooltipStyle()}
      >
        {/* Arrow */}
        {targetRect && (
          <TooltipArrow position={step.position || "bottom"} />
        )}

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="space-y-3">
          {/* Icon and title */}
          <div className="flex items-start gap-3">
            {step.icon && (
              <div className="flex-shrink-0 rounded-full bg-muted p-2">
                {step.icon}
              </div>
            )}
            <div>
              <h3
                id="tour-title"
                className="font-semibold text-foreground"
              >
                {step.title}
              </h3>
              <p
                id="tour-description"
                className="mt-1 text-sm text-muted-foreground"
              >
                {step.description}
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  idx === currentStep
                    ? "w-4 bg-primary"
                    : idx < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted"
                )}
                aria-hidden="true"
              />
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePrev}
                  aria-label="Previous step"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}

              {step.onAction && step.actionText ? (
                <Button size="sm" onClick={handleAction}>
                  {step.actionText}
                </Button>
              ) : (
                <Button size="sm" onClick={handleNext}>
                  {isLastStep ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Got it!
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Hook to control the onboarding tour
 */
export function useOnboardingTour(storageKey = "demo-tour-completed") {
  const [isActive, setIsActive] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    setHasCompleted(!!completed);
  }, [storageKey]);

  const startTour = useCallback(() => {
    setIsActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(storageKey, "true");
    setHasCompleted(true);
  }, [storageKey]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasCompleted(false);
  }, [storageKey]);

  return {
    isActive,
    hasCompleted,
    startTour,
    endTour,
    resetTour,
  };
}

/**
 * Button to restart the tour
 */
export function RestartTourButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      <Info className="h-4 w-4" />
      <span>Take the tour</span>
    </button>
  );
}
