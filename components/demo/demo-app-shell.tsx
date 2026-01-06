"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DemoModeBanner, DemoModeBadge } from "./demo-mode-banner";
import { UsageMeter, UsageIndicator } from "./usage-meter";
import { LimitWarningModal, useLimitWarning } from "./limit-warning-modal";
import { OnboardingTour, useOnboardingTour, defaultDemoTourSteps } from "./onboarding-tour";
import { UpgradeCta, FloatingUpgradeButton } from "./upgrade-cta";
import { SampleDocuments, SampleQueries } from "./sample-documents";
import {
  Sidebar,
  List,
  Lightning,
  Question,
  Gear,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

// Context for demo app state
interface DemoAppContextValue {
  showLimitWarning: (props: {
    limitType: string;
    message: string;
    used?: number;
    limit?: number;
    remaining?: number;
    resetTime?: Date | string;
  }) => void;
  startTour: () => void;
  upgradeUrl: string;
  isDemoMode: boolean;
}

const DemoAppContext = createContext<DemoAppContextValue | null>(null);

export function useDemoApp() {
  const context = useContext(DemoAppContext);
  if (!context) {
    throw new Error("useDemoApp must be used within a DemoAppShell");
  }
  return context;
}

interface DemoAppShellProps {
  /** Main content */
  children: React.ReactNode;
  /** Sidebar content */
  sidebar?: React.ReactNode;
  /** Header content */
  header?: React.ReactNode;
  /** Whether to show the demo banner */
  showBanner?: boolean;
  /** Banner position */
  bannerPosition?: "top" | "bottom";
  /** Whether to show the floating upgrade button */
  showFloatingUpgrade?: boolean;
  /** Whether to show the onboarding tour */
  showTour?: boolean;
  /** Upgrade URL */
  upgradeUrl?: string;
  /** Custom class name for main content */
  className?: string;
  /** Whether sidebar is collapsible */
  collapsibleSidebar?: boolean;
  /** Initial sidebar collapsed state */
  sidebarCollapsed?: boolean;
}

export function DemoAppShell({
  children,
  sidebar,
  header,
  showBanner = true,
  bannerPosition = "top",
  showFloatingUpgrade = true,
  showTour = true,
  upgradeUrl = "#",
  className,
  collapsibleSidebar = true,
  sidebarCollapsed: initialCollapsed = false,
}: DemoAppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(!initialCollapsed);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const { modalState, showLimitWarning, closeLimitWarning } = useLimitWarning();
  const { isActive: tourActive, startTour, endTour, hasCompleted: tourCompleted } = useOnboardingTour();

  // Fetch demo config
  useEffect(() => {
    fetch("/api/demo/config")
      .then((res) => res.json())
      .then((data) => {
        setIsDemoMode(data.config?.isDemoMode ?? true);
      })
      .catch(() => {
        setIsDemoMode(true);
      });
  }, []);

  // Context value
  const contextValue: DemoAppContextValue = {
    showLimitWarning: useCallback(
      (props) => {
        showLimitWarning({
          limitType: props.limitType as Parameters<typeof showLimitWarning>[0]["limitType"],
          message: props.message,
          used: props.used,
          limit: props.limit,
          remaining: props.remaining,
          resetTime: props.resetTime,
        });
      },
      [showLimitWarning]
    ),
    startTour,
    upgradeUrl,
    isDemoMode,
  };

  return (
    <DemoAppContext.Provider value={contextValue}>
      <div className="flex min-h-screen flex-col" data-tour="welcome">
        {/* Demo Banner */}
        {showBanner && isDemoMode && bannerPosition === "top" && (
          <DemoModeBanner position="top" />
        )}

        {/* Main Layout */}
        <div className="flex flex-1">
          {/* Sidebar */}
          {sidebar && (
            <aside
              className={cn(
                "flex-shrink-0 border-r bg-sidebar transition-all duration-300",
                sidebarOpen ? "w-64" : "w-0 overflow-hidden"
              )}
              aria-label="Sidebar"
            >
              <div className="flex h-full w-64 flex-col">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-2">
                    <Lightning className="h-5 w-5 text-primary" weight="fill" />
                    <span className="font-semibold">Legal AI</span>
                    {isDemoMode && <DemoModeBadge />}
                  </div>
                  {collapsibleSidebar && (
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="rounded p-1 hover:bg-muted transition-colors md:hidden"
                      aria-label="Close sidebar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-y-auto p-4">{sidebar}</div>

                {/* Usage Meter in Sidebar */}
                {isDemoMode && (
                  <div className="border-t p-4" data-tour="usage-meter">
                    <UsageMeter
                      variant="compact"
                      position="sidebar"
                      upgradeUrl={upgradeUrl}
                    />
                  </div>
                )}

                {/* Tour Restart */}
                {!tourCompleted && (
                  <div className="border-t p-4">
                    <button
                      onClick={startTour}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Question className="h-4 w-4" />
                      Take the tour
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Main Content Area */}
          <main className="flex flex-1 flex-col">
            {/* Header */}
            {(header || collapsibleSidebar) && (
              <header className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-3">
                  {collapsibleSidebar && !sidebarOpen && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="rounded p-1.5 hover:bg-muted transition-colors"
                      aria-label="Open sidebar"
                    >
                      <Sidebar className="h-5 w-5" />
                    </button>
                  )}
                  {header}
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-3">
                  {isDemoMode && !sidebar && (
                    <UsageIndicator onClick={() => {}} />
                  )}
                </div>
              </header>
            )}

            {/* Page Content */}
            <div className={cn("flex-1", className)}>{children}</div>
          </main>
        </div>

        {/* Bottom Banner */}
        {showBanner && isDemoMode && bannerPosition === "bottom" && (
          <DemoModeBanner position="bottom" />
        )}

        {/* Floating Upgrade Button */}
        {showFloatingUpgrade && isDemoMode && upgradeUrl !== "#" && (
          <FloatingUpgradeButton upgradeUrl={upgradeUrl} />
        )}

        {/* Limit Warning Modal */}
        <LimitWarningModal
          open={modalState.open}
          onClose={closeLimitWarning}
          limitType={modalState.limitType}
          message={modalState.message}
          used={modalState.used}
          limit={modalState.limit}
          remaining={modalState.remaining}
          resetTime={modalState.resetTime}
          upgradeUrl={upgradeUrl}
          onNewChat={() => {
            // Emit event for parent to handle
            window.dispatchEvent(new CustomEvent("demo:new-chat"));
          }}
        />

        {/* Onboarding Tour */}
        {showTour && isDemoMode && (
          <OnboardingTour
            steps={defaultDemoTourSteps}
            show={tourActive}
            onComplete={endTour}
            onSkip={endTour}
          />
        )}
      </div>
    </DemoAppContext.Provider>
  );
}

/**
 * Chat empty state with sample content
 */
export function DemoChatEmptyState({
  onSelectQuery,
  onLoadDocument,
  className,
}: {
  onSelectQuery?: (query: string) => void;
  onLoadDocument?: (doc: unknown) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center p-6",
        className
      )}
    >
      <div className="w-full max-w-2xl space-y-6 text-center">
        {/* Welcome Message */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Welcome to Legal AI Assistant
          </h2>
          <p className="mt-2 text-muted-foreground">
            Upload legal documents or ask questions to get started
          </p>
        </div>

        {/* Sample Queries */}
        <div className="text-left">
          <SampleQueries onSelect={onSelectQuery || (() => {})} />
        </div>

        {/* Sample Documents */}
        <div className="text-left">
          <SampleDocuments
            variant="compact"
            maxItems={3}
            collapsible
            defaultCollapsed
            onLoadDocument={onLoadDocument}
            onSelectQuery={onSelectQuery}
          />
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="rounded-lg border p-4 text-center">
            <List className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 text-sm font-medium">Document Analysis</p>
            <p className="text-xs text-muted-foreground">
              Extract key terms and clauses
            </p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <Lightning className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-2 text-sm font-medium">AI Powered</p>
            <p className="text-xs text-muted-foreground">
              Intelligent legal insights
            </p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <Gear className="mx-auto h-8 w-8 text-green-500" />
            <p className="mt-2 text-sm font-medium">OCR Support</p>
            <p className="text-xs text-muted-foreground">
              Process scanned documents
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
