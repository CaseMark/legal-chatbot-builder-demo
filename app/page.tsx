"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  ChatCircle,
  File,
  Database,
  Trash,
  ArrowRight,
  Spinner,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DemoModeBanner } from "@/components/demo/demo-mode-banner";
import { UsageStatsCard } from "@/components/demo/usage-stats-card";
import { useChatbots } from "@/hooks/use-chatbot-storage";
import { getSessionStats, calculateTimeRemaining } from "@/lib/session-storage";
import { getDemoLimits } from "@/lib/demo-limits";

export default function HomePage() {
  const { chatbots, isLoading, createChatbot, deleteChatbot } = useChatbots();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newChatbot, setNewChatbot] = useState({
    name: "",
    description: "",
  });

  // Session stats for usage tracking
  const [sessionStats, setSessionStats] = useState(() => getSessionStats());
  const [timeRemaining, setTimeRemaining] = useState("");
  const demoLimits = getDemoLimits();

  // Update stats periodically
  useEffect(() => {
    const updateStats = () => {
      const stats = getSessionStats();
      setSessionStats(stats);
      setTimeRemaining(calculateTimeRemaining(stats.sessionResetAt));
    };
    updateStats();
    const interval = setInterval(updateStats, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreateChatbot(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatbot.name.trim()) return;

    setCreating(true);
    setError(null);

    try {
      // Create chatbot in localStorage only (no server-side vault)
      createChatbot(
        newChatbot.name.trim(),
        newChatbot.description?.trim() || ""
      );

      setShowCreateModal(false);
      setNewChatbot({ name: "", description: "" });
    } catch (err) {
      console.error("Failed to create chatbot:", err);
      setError(err instanceof Error ? err.message : "Failed to create chatbot");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteChatbot(id: string) {
    if (
      !confirm(
        "Are you sure you want to delete this chatbot? This will also delete all associated documents from your browser."
      )
    ) {
      return;
    }

    setDeleting(id);

    try {
      // Delete from localStorage (documents in IndexedDB will be cleaned up by RAGService)
      deleteChatbot(id);
    } catch (err) {
      console.error("Failed to delete chatbot:", err);
      alert("Failed to delete chatbot");
    } finally {
      setDeleting(null);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      <DemoModeBanner />

      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Legal AI Chatbot Builder
                </h1>
                <a
                  href="https://case.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  <span>built with</span>
                  <svg width="14" height="14" viewBox="0 0 144 144" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M127.927 56.3865C127.927 54.7298 126.583 53.3867 124.927 53.3865H19.6143C17.9574 53.3865 16.6143 54.7296 16.6143 56.3865V128.226C16.6143 129.883 17.9574 131.226 19.6143 131.226H124.927C126.583 131.226 127.927 129.883 127.927 128.226V56.3865ZM93.1553 32.6638C93.1553 31.007 91.8121 29.6639 90.1553 29.6638H53.4102C51.7534 29.664 50.4102 31.0071 50.4102 32.6638V47.3865H93.1553V32.6638ZM99.1553 47.3865H124.927C129.897 47.3867 133.927 51.4161 133.927 56.3865V128.226C133.927 133.197 129.897 137.226 124.927 137.226H19.6143C14.6437 137.226 10.6143 133.197 10.6143 128.226V56.3865C10.6143 51.4159 14.6437 47.3865 19.6143 47.3865H44.4102V32.6638C44.4102 27.6933 48.4397 23.664 53.4102 23.6638H90.1553C95.1258 23.6639 99.1553 27.6933 99.1553 32.6638V47.3865Z" fill="#EB5600"/>
                    <path d="M76.6382 70.6082C77.8098 69.4366 79.7088 69.4366 80.8804 70.6082L98.8013 88.5291C100.754 90.4817 100.754 93.6477 98.8013 95.6003L80.8804 113.521C79.7088 114.693 77.8097 114.693 76.6382 113.521C75.4667 112.35 75.4667 110.451 76.6382 109.279L93.8521 92.0642L76.6382 74.8503C75.4666 73.6788 75.4666 71.7797 76.6382 70.6082Z" fill="#EB5600"/>
                    <path d="M67.3618 70.6082C66.1902 69.4366 64.2912 69.4366 63.1196 70.6082L45.1987 88.5291C43.2461 90.4817 43.2461 93.6477 45.1987 95.6003L63.1196 113.521C64.2912 114.693 66.1903 114.693 67.3618 113.521C68.5333 112.35 68.5333 110.451 67.3618 109.279L50.1479 92.0642L67.3618 74.8503C68.5334 73.6788 68.5334 71.7797 67.3618 70.6082Z" fill="#EB5600"/>
                  </svg>
                  <span className="font-semibold">case.dev</span>
                </a>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Build custom chatbots trained on your firm&apos;s knowledge base
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* New Chatbot Button */}
              <Button
                onClick={() => setShowCreateModal(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" weight="bold" />
                New Chatbot
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main chatbots area */}
          <div className="flex-1">
            {error && (
              <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : chatbots.length === 0 ? (
          <div className="py-16 text-center">
            <ChatCircle className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              No chatbots yet
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Get started by creating your first AI chatbot.
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-4">
              Create Chatbot
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {chatbots.map((chatbot) => (
              <div
                key={chatbot.id}
                className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-semibold text-card-foreground">
                        {chatbot.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                        {chatbot.description || "No description"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteChatbot(chatbot.id)}
                      disabled={deleting === chatbot.id}
                      className="ml-2 flex-shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      title="Delete chatbot"
                    >
                      {deleting === chatbot.id ? (
                        <Spinner className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="mt-auto flex items-center gap-4 pt-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <File className="mr-1 h-4 w-4" />
                      {chatbot.documentCount} docs
                    </div>
                    <div className="flex items-center">
                      <Database className="mr-1 h-4 w-4" />
                      {formatBytes(chatbot.totalBytes)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t bg-muted/30 px-6 py-4">
                  <Link
                    href={`/chatbots/${chatbot.id}`}
                    className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    Manage
                  </Link>
                  <Link
                    href={`/chatbots/${chatbot.id}/chat`}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Test Chat
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
            </div>
          )}
          </div>

          {/* Sidebar with usage stats */}
          <div className="w-full lg:w-80 lg:flex-shrink-0">
            <UsageStatsCard
              priceUsed={sessionStats.sessionPrice}
              priceLimit={demoLimits.session.sessionPriceLimit}
              timeRemaining={timeRemaining}
            />
          </div>
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-background shadow-xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-foreground">
                Create New Chatbot
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a new AI chatbot with its own knowledge base.
              </p>

              <form onSubmit={handleCreateChatbot} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-foreground"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newChatbot.name}
                    onChange={(e) =>
                      setNewChatbot({ ...newChatbot, name: e.target.value })
                    }
                    className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g., HR Policy Assistant"
                    required
                    disabled={creating}
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-foreground"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={newChatbot.description}
                    onChange={(e) =>
                      setNewChatbot({
                        ...newChatbot,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="What will this chatbot help with?"
                    disabled={creating}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={creating || !newChatbot.name.trim()}
                  >
                    {creating ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Chatbot"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
