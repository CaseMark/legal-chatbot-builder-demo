"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChatCircle,
  File,
  CloudArrowUp,
  Spinner,
  CheckCircle,
  XCircle,
  Trash,
  Gear,
  Code,
  Copy,
  Check,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DemoModeBanner } from "@/components/demo/demo-mode-banner";
import { useChatbotWithHistory } from "@/hooks/use-chatbot-storage";
import { RAGService, ProcessedDocument } from "@/lib/rag";

interface LocalDocument {
  id: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedAt: number;
  status: "processing" | "completed" | "failed";
  error?: string;
}

export default function ChatbotManagePage() {
  const params = useParams();
  const chatbotId = params.chatbotId as string;

  // Use localStorage hook for chatbot data
  const { chatbot, isLoading: chatbotLoading, updateChatbot } = useChatbotWithHistory(chatbotId);

  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<"documents" | "settings" | "embed">(
    "documents"
  );
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ragService, setRagService] = useState<RAGService | null>(null);

  // Settings form state - initialized from localStorage chatbot
  const [settings, setSettings] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    welcomeMessage: "",
    primaryColor: "#0ea5e9",
  });
  const [saving, setSaving] = useState(false);

  // Initialize RAG service
  useEffect(() => {
    const initRAG = async () => {
      const service = RAGService.getInstance();
      await service.initialize(chatbotId);
      setRagService(service);
    };
    initRAG();
  }, [chatbotId]);

  // Update settings form when chatbot loads from localStorage
  useEffect(() => {
    if (chatbot) {
      setSettings({
        name: chatbot.name,
        description: chatbot.description,
        systemPrompt: chatbot.systemPrompt,
        welcomeMessage: chatbot.welcomeMessage,
        primaryColor: chatbot.primaryColor,
      });
    }
  }, [chatbot]);

  // Load documents from IndexedDB
  const loadDocuments = useCallback(async () => {
    if (!ragService) return;
    
    try {
      const docs = await ragService.getDocumentsForChatbot(chatbotId);
      const localDocs: LocalDocument[] = docs.map((doc: ProcessedDocument) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        totalChunks: doc.totalChunks,
        uploadedAt: doc.uploadedAt,
        status: "completed" as const,
      }));
      setDocuments(localDocs);
      
      // Update document count in localStorage
      if (localDocs.length !== chatbot?.documentCount) {
        updateChatbot({ documentCount: localDocs.length });
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  }, [ragService, chatbotId, chatbot?.documentCount, updateChatbot]);

  useEffect(() => {
    if (ragService) {
      loadDocuments();
    }
  }, [ragService, loadDocuments]);

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || !ragService) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add temporary document entry
      setDocuments(prev => [{
        id: tempId,
        fileName: file.name,
        fileSize: file.size,
        totalChunks: 0,
        uploadedAt: Date.now(),
        status: "processing",
      }, ...prev]);

      try {
        // Process document client-side
        const processedDoc = await ragService.uploadDocument(
          file,
          chatbotId,
          (progress) => {
            setUploadProgress(prev => ({ ...prev, [tempId]: progress }));
          }
        );

        // Update document entry with real data
        setDocuments(prev => prev.map(doc => 
          doc.id === tempId 
            ? {
                id: processedDoc.id,
                fileName: processedDoc.fileName,
                fileSize: processedDoc.fileSize,
                totalChunks: processedDoc.totalChunks,
                uploadedAt: processedDoc.uploadedAt,
                status: "completed" as const,
              }
            : doc
        ));

        // Clear progress
        setUploadProgress(prev => {
          const { [tempId]: _, ...rest } = prev;
          return rest;
        });

      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        
        // Mark as failed
        setDocuments(prev => prev.map(doc => 
          doc.id === tempId 
            ? { ...doc, status: "failed" as const, error: error instanceof Error ? error.message : "Upload failed" }
            : doc
        ));
      }
    }

    setUploading(false);
    
    // Update document count
    const docs = await ragService.getDocumentsForChatbot(chatbotId);
    updateChatbot({ documentCount: docs.length });
  }

  async function handleDeleteDocument(documentId: string) {
    if (!ragService) return;
    
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await ragService.deleteDocument(documentId, chatbotId);
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      // Update document count
      const docs = await ragService.getDocumentsForChatbot(chatbotId);
      updateChatbot({ documentCount: docs.length });
    } catch (error) {
      console.error("Failed to delete document:", error);
      alert("Failed to delete document");
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Save to localStorage
      const updated = updateChatbot({
        name: settings.name,
        description: settings.description,
        systemPrompt: settings.systemPrompt,
        welcomeMessage: settings.welcomeMessage,
        primaryColor: settings.primaryColor,
      });

      if (updated) {
        alert("Settings saved successfully!");
      } else {
        alert("Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getStatusBadge(doc: LocalDocument) {
    switch (doc.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
            <CheckCircle className="h-3 w-3" weight="fill" />
            Ready
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
            <Spinner className="h-3 w-3 animate-spin" />
            {uploadProgress[doc.id] ? `${uploadProgress[doc.id]}%` : "Processing"}
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
            <XCircle className="h-3 w-3" weight="fill" />
            Failed
          </span>
        );
      default:
        return null;
    }
  }

  function getEmbedCode() {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${baseUrl}/embed.js" data-chatbot-id="${chatbotId}"></script>`;
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (chatbotLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <h2 className="text-xl font-semibold text-foreground">
          Chatbot not found
        </h2>
        <Link href="/" className="mt-4 text-primary hover:underline">
          Go back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DemoModeBanner />

      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {chatbot.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {chatbot.description || "No description"}
                </p>
              </div>
            </div>
            <Link href={`/chatbots/${chatbotId}/chat`}>
              <Button className="gap-2">
                <ChatCircle className="h-5 w-5" />
                Test Chat
              </Button>
            </Link>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b">
            <nav className="-mb-px flex gap-6">
              <button
                onClick={() => setActiveTab("documents")}
                className={cn(
                  "border-b-2 pb-3 text-sm font-medium transition-colors",
                  activeTab === "documents"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Documents ({documents.filter(d => d.status === "completed").length})
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors",
                  activeTab === "settings"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Gear className="h-4 w-4" />
                Settings
              </button>
              <button
                onClick={() => setActiveTab("embed")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors",
                  activeTab === "embed"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Code className="h-4 w-4" />
                Embed
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "documents" && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Client-side processing:</strong> Documents are processed and stored locally in your browser. 
                Your data never leaves your device (except for generating embeddings via API).
              </p>
            </div>

            {/* Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <input
                type="file"
                id="file-upload"
                multiple
                accept=".pdf,.txt,.docx"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <CloudArrowUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {uploading ? (
                    <span className="text-primary">Processing documents...</span>
                  ) : (
                    <>
                      <span className="font-medium text-primary">
                        Click to upload
                      </span>{" "}
                      or drag and drop
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, TXT, DOCX (processed locally in your browser)
                </p>
              </label>
            </div>

            {/* Documents List */}
            {documents.length === 0 ? (
              <div className="rounded-xl border bg-card py-12 text-center">
                <File className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-sm font-medium text-foreground">
                  No documents yet
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload documents to build your chatbot&apos;s knowledge base.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Document
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Details
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center">
                            <File className="mr-3 h-5 w-5 text-muted-foreground" />
                            <div>
                              <span className="text-sm font-medium text-foreground">
                                {doc.fileName}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(doc.uploadedAt)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                          {formatBytes(doc.fileSize)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {getStatusBadge(doc)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                          {doc.status === "completed" && (
                            <span>{doc.totalChunks} chunks</span>
                          )}
                          {doc.status === "processing" && (
                            <span className="flex items-center">
                              <Spinner className="mr-2 h-4 w-4 animate-spin text-yellow-500" />
                              Processing...
                            </span>
                          )}
                          {doc.status === "failed" && (
                            <span className="text-red-600">{doc.error}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          {doc.status === "completed" && (
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-muted-foreground hover:text-red-600 transition-colors"
                              title="Delete document"
                            >
                              <Trash className="h-5 w-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="rounded-xl border bg-card p-6">
            <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-6">
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
                  value={settings.name}
                  onChange={(e) =>
                    setSettings({ ...settings, name: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                  value={settings.description}
                  onChange={(e) =>
                    setSettings({ ...settings, description: e.target.value })
                  }
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="systemPrompt"
                  className="block text-sm font-medium text-foreground"
                >
                  System Prompt
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Instructions that define how the chatbot behaves and responds.
                </p>
                <textarea
                  id="systemPrompt"
                  value={settings.systemPrompt}
                  onChange={(e) =>
                    setSettings({ ...settings, systemPrompt: e.target.value })
                  }
                  rows={6}
                  className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="welcomeMessage"
                  className="block text-sm font-medium text-foreground"
                >
                  Welcome Message
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  The first message users see when they open the chat.
                </p>
                <textarea
                  id="welcomeMessage"
                  value={settings.welcomeMessage}
                  onChange={(e) =>
                    setSettings({ ...settings, welcomeMessage: e.target.value })
                  }
                  rows={2}
                  className="mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="primaryColor"
                  className="block text-sm font-medium text-foreground"
                >
                  Primary Color
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    id="primaryColor"
                    value={settings.primaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, primaryColor: e.target.value })
                    }
                    className="h-10 w-20 cursor-pointer rounded border border-input"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) =>
                      setSettings({ ...settings, primaryColor: e.target.value })
                    }
                    className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === "embed" && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Embed Code
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add this code to your website to embed the chatbot widget.
              </p>

              <div className="relative mt-4">
                <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                  <code>{getEmbedCode()}</code>
                </pre>
                <button
                  onClick={() => handleCopy(getEmbedCode())}
                  className="absolute right-2 top-2 rounded bg-gray-800 px-3 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                >
                  {copied ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copy
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Direct Link
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Share this link to open the chatbot in a full page.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/chatbots/${chatbotId}/chat`
                      : ""
                  }
                  className="flex-1 rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    handleCopy(
                      `${window.location.origin}/chatbots/${chatbotId}/chat`
                    )
                  }
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">
                Widget Preview
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This is how the chat widget will appear on your website.
              </p>

              <div className="relative mt-4 h-96 overflow-hidden rounded-lg bg-muted">
                <div className="absolute bottom-4 right-4">
                  <button
                    style={{ backgroundColor: settings.primaryColor }}
                    className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
                  >
                    <ChatCircle className="h-6 w-6" weight="fill" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
