"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  PaperPlaneTilt,
  Spinner,
  ArrowDown,
  Trash,
  Robot,
  User,
  CaretDown,
  CaretUp,
  File,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DemoModeBanner } from "@/components/demo/demo-mode-banner";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { useChatbotWithHistory } from "@/hooks/use-chatbot-storage";
import { RAGService, RAGContext } from "@/lib/rag";

interface ChatSource {
  fileName: string;
  pageNumber?: number;
  chunkIndex?: number;
}

export default function ChatbotChatPage() {
  const params = useParams();
  const chatbotId = params.chatbotId as string;

  // Use localStorage hooks for chatbot and chat history
  const {
    chatbot,
    isLoading: loading,
    messages,
    addMessage,
    clearMessages,
    getConversationHistory,
  } = useChatbotWithHistory(chatbotId);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [documentCount, setDocumentCount] = useState(0);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize RAG service
  useEffect(() => {
    const initRAG = async () => {
      const service = RAGService.getInstance();
      await service.initialize(chatbotId);
      setRagService(service);
      
      // Get document count
      const docs = await service.getDocumentsForChatbot(chatbotId);
      setDocumentCount(docs.length);
    };
    initRAG();
  }, [chatbotId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (shouldAutoScroll && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, shouldAutoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isAtBottom);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading || !chatbot || !ragService) return;

    const userContent = input.trim();
    
    // Add user message to localStorage
    addMessage("user", userContent);
    setInput("");
    setIsLoading(true);
    setShouldAutoScroll(true);

    try {
      // Get conversation history for context
      const conversationHistory = getConversationHistory(10);

      // Search for relevant context using client-side RAG
      let ragContext: RAGContext | null = null;
      if (documentCount > 0) {
        ragContext = await ragService.searchRelevantContext(userContent, chatbotId, 5);
      }

      // Send to chat API with context
      const response = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userContent,
          systemPrompt: chatbot.systemPrompt,
          conversationHistory,
          // Include RAG context if available
          context: ragContext?.contextText || null,
          sources: ragContext?.sources || [],
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Add assistant message to localStorage with sources including text excerpts
        addMessage(
          "assistant",
          data.message.content,
          ragContext?.relevantChunks?.map((item) => ({
            text: item.chunk.content.slice(0, 300) + (item.chunk.content.length > 300 ? "..." : ""), // Include text excerpt
            filename: item.chunk.metadata.fileName,
            objectId: "",
            page: item.chunk.metadata.pageNumber,
            score: item.combinedScore || item.similarity || 0,
          }))
        );
      } else {
        const error = await response.json();
        addMessage(
          "assistant",
          `Error: ${error.error || "Failed to get response"}`
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage(
        "assistant",
        "Sorry, there was an error processing your request."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleClearMessages() {
    if (confirm("Are you sure you want to clear the chat history?")) {
      clearMessages();
    }
  }

  function scrollToBottom() {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
      setShouldAutoScroll(true);
    }
  }

  if (loading) {
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
    <div className="flex min-h-screen flex-col bg-background">
      <DemoModeBanner />

      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/chatbots/${chatbotId}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-semibold text-foreground">{chatbot.name}</h1>
              <p className="text-xs text-muted-foreground">
                {documentCount > 0 
                  ? `${documentCount} document${documentCount !== 1 ? 's' : ''} in knowledge base`
                  : "No documents uploaded yet"}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearMessages}>
              <Trash className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-4xl px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-[calc(100vh-16rem)] flex-col items-center justify-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: chatbot.primaryColor + "20" }}
              >
                <Robot
                  className="h-8 w-8"
                  style={{ color: chatbot.primaryColor }}
                />
              </div>
              <h2 className="mt-4 text-lg font-medium text-foreground">
                {chatbot.welcomeMessage}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {documentCount > 0 
                  ? "Ask questions about the documents in this chatbot's knowledge base."
                  : "Upload documents to the chatbot to enable document-based Q&A."}
              </p>
              {documentCount > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    "What documents are in the knowledge base?",
                    "Summarize the main topics",
                    "What are the key points?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="rounded-lg border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              {documentCount === 0 && (
                <Link
                  href={`/chatbots/${chatbotId}`}
                  className="mt-6 text-sm text-primary hover:underline"
                >
                  Upload documents →
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: chatbot.primaryColor + "20" }}
                    >
                      <Robot
                        className="h-4 w-4"
                        style={{ color: chatbot.primaryColor }}
                      />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownRenderer>{message.content}</MarkdownRenderer>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">
                        {message.content}
                      </div>
                    )}
                    {message.sources && message.sources.length > 0 && (
                      <SourcesDropdown sources={message.sources} />
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: chatbot.primaryColor + "20" }}
                  >
                    <Robot
                      className="h-4 w-4"
                      style={{ color: chatbot.primaryColor }}
                    />
                  </div>
                  <div className="rounded-xl bg-muted px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 animate-bounce rounded-full"
                        style={{
                          backgroundColor: chatbot.primaryColor,
                          animationDelay: "0ms",
                        }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full"
                        style={{
                          backgroundColor: chatbot.primaryColor,
                          animationDelay: "150ms",
                        }}
                      />
                      <span
                        className="h-2 w-2 animate-bounce rounded-full"
                        style={{
                          backgroundColor: chatbot.primaryColor,
                          animationDelay: "300ms",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!shouldAutoScroll && messages.length > 0 && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-background px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{ backgroundColor: chatbot.primaryColor }}
            className="h-12 w-12 rounded-xl p-0"
          >
            {isLoading ? (
              <Spinner className="h-5 w-5 animate-spin" />
            ) : (
              <PaperPlaneTilt className="h-5 w-5" weight="fill" />
            )}
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Sources dropdown component
function SourcesDropdown({ sources }: { sources: Array<{
  text: string;
  filename: string;
  objectId: string;
  page?: number;
  score: number;
}> }) {
  const [expanded, setExpanded] = useState(false);

  // Filter out sources without filenames
  const validSources = sources.filter(s => s.filename);
  if (validSources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <File className="h-3 w-3" />
        {validSources.length} source{validSources.length !== 1 ? "s" : ""}
        {expanded ? (
          <CaretUp className="h-3 w-3" />
        ) : (
          <CaretDown className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {validSources.map((source, index) => (
            <div
              key={index}
              className="rounded-lg bg-background/50 p-2 text-xs"
            >
              <div className="font-medium text-foreground">
                {source.filename}
                {source.page && ` (page ${source.page})`}
              </div>
              {source.text && (
                <p className="mt-1 text-muted-foreground italic line-clamp-3">
                  "{source.text}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
