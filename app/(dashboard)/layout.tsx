import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-2 font-semibold">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Legal Chatbot Demo
            </a>
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <a
                href="/chat"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Chat
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Demo Mode
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative">{children}</main>

      {/* Toast Notifications */}
      <Toaster position="bottom-right" />
    </div>
  );
}
