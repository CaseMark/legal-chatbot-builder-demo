"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface WebCitation {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date;
  citations?: WebCitation[];
  searchQueries?: Array<{
    query: string;
  }>;
  isStreaming?: boolean;
  metadata?: {
    type?: string;
    [key: string]: unknown;
  };
}

export interface UseChatStreamOptions {
  onCitationsUpdate?: (citations: WebCitation[]) => void;
  onSearchQueries?: (queries: Array<{ query: string }>) => void;
  initialMessages?: ChatMessage[];
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = "legal_chat_messages_v1";

export function useChatStream(options: UseChatStreamOptions = {}) {
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsedMessages = JSON.parse(stored);
          return parsedMessages.map((msg: Record<string, unknown>) => ({
            ...msg,
            createdAt: msg.createdAt ? new Date(msg.createdAt as string) : undefined,
          }));
        }
      } catch (error) {
        console.error("Failed to load messages from localStorage:", error);
      }
    }
    return options.initialMessages || [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (error) {
        console.error("Failed to save messages to localStorage:", error);
      }
    }
  }, [messages, storageKey]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (
      e: React.FormEvent,
      submitOptions?: { body?: Record<string, unknown>; messageContent?: string }
    ) => {
      e.preventDefault();

      const messageContent = submitOptions?.messageContent || input;
      if (!messageContent.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: messageContent,
        createdAt: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        citations: [],
        searchQueries: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      if (!submitOptions?.messageContent) {
        setInput("");
      }
      setIsLoading(true);

      if (options.onCitationsUpdate) {
        options.onCitationsUpdate([]);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            ...submitOptions?.body,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          if (response.status === 400) {
            const errorData = await response.json();
            if (errorData.error === "PII_DETECTED") {
              setMessages((prev) => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...lastMessage,
                    content: errorData.message,
                    isStreaming: false,
                  };
                }
                return updated;
              });
              setIsLoading(false);
              return;
            }
          }

          if (response.status === 429) {
            const errorData = await response.json();
            setMessages((prev) => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage.role === "assistant") {
                updated[updated.length - 1] = {
                  ...lastMessage,
                  content: errorData.message || "Demo limit exceeded. Please try again later.",
                  isStreaming: false,
                };
              }
              return updated;
            });
            setIsLoading(false);
            return;
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataContent = line.slice(6);

                if (dataContent === "[DONE]") {
                  continue;
                }

                try {
                  const data = JSON.parse(dataContent);

                  if (data.type === "chunk") {
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastMessage = updated[updated.length - 1];
                      if (lastMessage.role === "assistant") {
                        updated[updated.length - 1] = {
                          ...lastMessage,
                          content: lastMessage.content + data.content,
                        };
                      }
                      return updated;
                    });
                  }

                  if (data.type === "citations" && data.citations) {
                    const formattedCitations = data.citations.map(
                      (citation: WebCitation) => ({
                        title: citation.title || "Web Search Result",
                        url: citation.url || "#",
                        snippet: citation.snippet || "",
                        source:
                          citation.source ||
                          (citation.url
                            ? new URL(citation.url).hostname
                            : "Web"),
                      })
                    );

                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastMessage = updated[updated.length - 1];
                      if (lastMessage.role === "assistant") {
                        const existingCitations = lastMessage.citations || [];
                        const newCitations = formattedCitations.filter(
                          (newCit: WebCitation) =>
                            !existingCitations.some(
                              (existing: WebCitation) =>
                                existing.url === newCit.url
                            )
                        );

                        updated[updated.length - 1] = {
                          ...lastMessage,
                          citations: [...existingCitations, ...newCitations],
                        };
                      }
                      return updated;
                    });

                    if (options.onCitationsUpdate) {
                      setTimeout(() => {
                        setMessages((prev) => {
                          const lastMessage = prev[prev.length - 1];
                          if (
                            lastMessage?.role === "assistant" &&
                            lastMessage.citations
                          ) {
                            options.onCitationsUpdate!(lastMessage.citations);
                          }
                          return prev;
                        });
                      }, 0);
                    }
                  }

                  if (data.type === "complete") {
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastMessage = updated[updated.length - 1];
                      if (lastMessage.role === "assistant") {
                        const existingCitations = lastMessage.citations || [];

                        let finalCitations = existingCitations;
                        if (
                          existingCitations.length === 0 &&
                          data.citations
                        ) {
                          finalCitations = (data.citations || []).map(
                            (citation: WebCitation) => ({
                              title: citation.title || "Web Search Result",
                              url: citation.url || "#",
                              snippet: citation.snippet || "",
                              source:
                                citation.source ||
                                (citation.url
                                  ? new URL(citation.url).hostname
                                  : "Web"),
                            })
                          );
                        }

                        updated[updated.length - 1] = {
                          ...lastMessage,
                          content: data.content || lastMessage.content,
                          citations: finalCitations,
                          searchQueries: data.searchQueries || [],
                          isStreaming: false,
                        };
                      }
                      return updated;
                    });
                  }
                } catch {
                  // Ignore parse errors for malformed SSE data
                }
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Streaming error:", error);
          setMessages((prev) => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (lastMessage.role === "assistant") {
              updated[updated.length - 1] = {
                ...lastMessage,
                content: "Sorry, there was an error processing your request.",
              };
            }
            return updated;
          });
        }
      } finally {
        setIsLoading(false);
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
            updated[updated.length - 1] = {
              ...lastMessage,
              isStreaming: false,
            };
          }
          return updated;
        });
      }
    },
    [input, isLoading, messages, options]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const setMessagesState = useCallback(
    (updater: React.SetStateAction<ChatMessage[]>) => {
      setMessages(updater);
    },
    []
  );

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages: setMessagesState,
    clearMessages,
  };
}
