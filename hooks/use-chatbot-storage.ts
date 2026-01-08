"use client";

import { useState, useEffect, useCallback } from "react";
import {
  StoredChatbot,
  StoredMessage,
  getStoredChatbots,
  getStoredChatbot,
  saveStoredChatbot,
  updateStoredChatbot,
  deleteStoredChatbot,
  getStoredConversation,
  saveStoredConversation,
  clearStoredConversation,
  generateChatbotId,
  generateMessageId,
} from "@/lib/storage/local-storage";

/**
 * Hook for managing chatbots in localStorage
 */
export function useChatbots() {
  const [chatbots, setChatbots] = useState<StoredChatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load chatbots on mount
  useEffect(() => {
    setChatbots(getStoredChatbots());
    setIsLoading(false);
  }, []);

  // Refresh chatbots from storage
  const refresh = useCallback(() => {
    setChatbots(getStoredChatbots());
  }, []);

  // Create a new chatbot
  const createChatbot = useCallback(
    (
      name: string,
      description: string,
      options?: {
        systemPrompt?: string;
        welcomeMessage?: string;
        primaryColor?: string;
      }
    ): StoredChatbot => {
      const now = new Date().toISOString();
      const newChatbot: StoredChatbot = {
        id: generateChatbotId(),
        name,
        description,
        systemPrompt:
          options?.systemPrompt ||
          "You are a helpful legal assistant. Answer questions based on the documents in your knowledge base. Always cite your sources when referencing specific documents.",
        welcomeMessage:
          options?.welcomeMessage ||
          "Hello! I'm your legal assistant. How can I help you today?",
        primaryColor: options?.primaryColor || "#0ea5e9",
        documentCount: 0,
        totalBytes: 0,
        createdAt: now,
        updatedAt: now,
      };

      saveStoredChatbot(newChatbot);
      setChatbots((prev) => [newChatbot, ...prev]);
      return newChatbot;
    },
    []
  );

  // Update a chatbot
  const updateChatbotById = useCallback(
    (id: string, updates: Partial<StoredChatbot>): StoredChatbot | null => {
      const updated = updateStoredChatbot(id, updates);
      if (updated) {
        setChatbots((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
      }
      return updated;
    },
    []
  );

  // Delete a chatbot
  const deleteChatbotById = useCallback((id: string): boolean => {
    const success = deleteStoredChatbot(id);
    if (success) {
      setChatbots((prev) => prev.filter((c) => c.id !== id));
    }
    return success;
  }, []);

  // Get a single chatbot
  const getChatbotById = useCallback((id: string): StoredChatbot | null => {
    return getStoredChatbot(id);
  }, []);

  return {
    chatbots,
    isLoading,
    refresh,
    createChatbot,
    updateChatbot: updateChatbotById,
    deleteChatbot: deleteChatbotById,
    getChatbot: getChatbotById,
  };
}

/**
 * Hook for managing chat history for a specific chatbot
 */
export function useChatHistory(chatbotId: string | null) {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load messages on mount or when chatbotId changes
  useEffect(() => {
    if (!chatbotId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const conversation = getStoredConversation(chatbotId);
    setMessages(conversation?.messages || []);
    setIsLoading(false);
  }, [chatbotId]);

  // Add a message
  const addMessage = useCallback(
    (
      role: "user" | "assistant",
      content: string,
      sources?: StoredMessage["sources"]
    ): StoredMessage | null => {
      if (!chatbotId) return null;

      const newMessage: StoredMessage = {
        id: generateMessageId(),
        role,
        content,
        sources,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => {
        const updated = [...prev, newMessage];
        saveStoredConversation(chatbotId, updated);
        return updated;
      });

      return newMessage;
    },
    [chatbotId]
  );

  // Update the last assistant message (for streaming)
  const updateLastAssistantMessage = useCallback(
    (content: string, sources?: StoredMessage["sources"]) => {
      if (!chatbotId) return;

      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0 || prev[lastIndex].role !== "assistant") {
          // No assistant message to update, create one
          const newMessage: StoredMessage = {
            id: generateMessageId(),
            role: "assistant",
            content,
            sources,
            timestamp: new Date().toISOString(),
          };
          const updated = [...prev, newMessage];
          saveStoredConversation(chatbotId, updated);
          return updated;
        }

        const updated = [...prev];
        updated[lastIndex] = {
          ...updated[lastIndex],
          content,
          sources: sources || updated[lastIndex].sources,
        };
        saveStoredConversation(chatbotId, updated);
        return updated;
      });
    },
    [chatbotId]
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    if (!chatbotId) return;
    clearStoredConversation(chatbotId);
    setMessages([]);
  }, [chatbotId]);

  // Get conversation history for API calls (last N messages)
  const getConversationHistory = useCallback(
    (limit: number = 10): Array<{ role: string; content: string }> => {
      return messages.slice(-limit).map((m) => ({
        role: m.role,
        content: m.content,
      }));
    },
    [messages]
  );

  return {
    messages,
    isLoading,
    addMessage,
    updateLastAssistantMessage,
    clearMessages,
    getConversationHistory,
  };
}

/**
 * Hook for a single chatbot with its chat history
 */
export function useChatbotWithHistory(chatbotId: string | null) {
  const [chatbot, setChatbot] = useState<StoredChatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const chatHistory = useChatHistory(chatbotId);

  // Load chatbot on mount or when chatbotId changes
  useEffect(() => {
    if (!chatbotId) {
      setChatbot(null);
      setIsLoading(false);
      return;
    }

    const stored = getStoredChatbot(chatbotId);
    setChatbot(stored);
    setIsLoading(false);
  }, [chatbotId]);

  // Update chatbot
  const updateChatbot = useCallback(
    (updates: Partial<StoredChatbot>): StoredChatbot | null => {
      if (!chatbotId) return null;
      const updated = updateStoredChatbot(chatbotId, updates);
      if (updated) {
        setChatbot(updated);
      }
      return updated;
    },
    [chatbotId]
  );

  return {
    chatbot,
    isLoading: isLoading || chatHistory.isLoading,
    updateChatbot,
    messages: chatHistory.messages,
    addMessage: chatHistory.addMessage,
    updateLastAssistantMessage: chatHistory.updateLastAssistantMessage,
    clearMessages: chatHistory.clearMessages,
    getConversationHistory: chatHistory.getConversationHistory,
  };
}
