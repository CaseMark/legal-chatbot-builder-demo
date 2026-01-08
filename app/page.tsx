"use client";

import { useState } from "react";
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
import { useChatbots } from "@/hooks/use-chatbot-storage";

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
              <h1 className="text-2xl font-bold text-foreground">
                Legal AI Chatbot Builder
              </h1>
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
