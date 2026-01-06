"use client";

import { useRef } from "react";
import { ArrowDown, Trash } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    clearMessages,
  } = useChatStream();

  const {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldAutoScroll,
    handleTouchStart,
  } = useAutoScroll([messages]);

  const formRef = useRef<HTMLFormElement>(null);

  // Convert messages to the format expected by MessageList
  const displayMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    createdAt: msg.createdAt,
  }));

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Chat</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about your documents
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearMessages}
            className="gap-2"
          >
            <Trash className="h-4 w-4" />
            Clear Chat
          </Button>
        )}
      </div>

      {/* Messages Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-6 py-4"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-full bg-muted p-4">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-medium">Start a conversation</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Ask questions about legal topics, analyze documents, or get help
              with research. Your chat history is saved locally.
            </p>
            <div className="mt-6 grid gap-2 text-sm">
              <SuggestionButton
                onClick={() => {
                  handleInputChange({
                    target: { value: "What are the key elements of a valid contract?" },
                  } as React.ChangeEvent<HTMLTextAreaElement>);
                }}
              >
                What are the key elements of a valid contract?
              </SuggestionButton>
              <SuggestionButton
                onClick={() => {
                  handleInputChange({
                    target: { value: "Explain the difference between civil and criminal law" },
                  } as React.ChangeEvent<HTMLTextAreaElement>);
                }}
              >
                Explain the difference between civil and criminal law
              </SuggestionButton>
              <SuggestionButton
                onClick={() => {
                  handleInputChange({
                    target: { value: "What should I look for in a lease agreement?" },
                  } as React.ChangeEvent<HTMLTextAreaElement>);
                }}
              >
                What should I look for in a lease agreement?
              </SuggestionButton>
            </div>
          </div>
        ) : (
          <MessageList
            messages={displayMessages}
            showTimeStamps
            isTyping={isLoading && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content}
          />
        )}
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

      {/* Input Area */}
      <div className="border-t bg-background px-6 py-4">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mx-auto max-w-3xl"
        >
          <MessageInput
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            isGenerating={isLoading}
            submitOnEnter
          />
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
          Demo mode: 50,000 tokens per day limit.{" "}
          <span className="text-primary">Press Enter to send</span>
        </p>
      </div>
    </div>
  );
}

function SuggestionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-background px-4 py-2 text-left text-sm transition-colors",
        "hover:bg-muted hover:border-primary/20"
      )}
    >
      {children}
    </button>
  );
}
