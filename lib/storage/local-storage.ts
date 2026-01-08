/**
 * Client-side localStorage utilities for chatbot data persistence
 * 
 * This module handles browser-local storage for:
 * - Chatbot configurations
 * - Chat history
 * - User preferences
 * 
 * Documents are stored in IndexedDB via the RAG service (see lib/rag/).
 * All data stays local in the browser - no server-side storage.
 */

// Storage keys
const STORAGE_KEYS = {
  CHATBOTS: 'legal_chatbot_builder_chatbots',
  CHAT_HISTORY: 'legal_chatbot_builder_chat_history',
  SELECTED_CHATBOT: 'legal_chatbot_builder_selected_chatbot',
} as const;

// Types
export interface StoredChatbot {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  welcomeMessage: string;
  primaryColor: string;
  documentCount: number;
  totalBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    text: string;
    filename: string;
    objectId: string;
    page?: number;
    score: number;
  }>;
  timestamp: string;
}

export interface StoredConversation {
  chatbotId: string;
  messages: StoredMessage[];
  updatedAt: string;
}

// Helper to check if we're in browser
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// Helper to safely parse JSON
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ============ Chatbot Storage ============

/**
 * Get all chatbots from localStorage
 */
export function getStoredChatbots(): StoredChatbot[] {
  if (!isBrowser()) return [];
  const data = localStorage.getItem(STORAGE_KEYS.CHATBOTS);
  return safeJsonParse<StoredChatbot[]>(data, []);
}

/**
 * Get a single chatbot by ID
 */
export function getStoredChatbot(id: string): StoredChatbot | null {
  const chatbots = getStoredChatbots();
  return chatbots.find(c => c.id === id) || null;
}

/**
 * Save a chatbot to localStorage
 */
export function saveStoredChatbot(chatbot: StoredChatbot): void {
  if (!isBrowser()) return;
  const chatbots = getStoredChatbots();
  const existingIndex = chatbots.findIndex(c => c.id === chatbot.id);
  
  if (existingIndex >= 0) {
    chatbots[existingIndex] = { ...chatbot, updatedAt: new Date().toISOString() };
  } else {
    chatbots.push(chatbot);
  }
  
  localStorage.setItem(STORAGE_KEYS.CHATBOTS, JSON.stringify(chatbots));
}

/**
 * Update a chatbot in localStorage
 */
export function updateStoredChatbot(id: string, updates: Partial<StoredChatbot>): StoredChatbot | null {
  if (!isBrowser()) return null;
  const chatbots = getStoredChatbots();
  const index = chatbots.findIndex(c => c.id === id);
  
  if (index < 0) return null;
  
  chatbots[index] = {
    ...chatbots[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEYS.CHATBOTS, JSON.stringify(chatbots));
  return chatbots[index];
}

/**
 * Delete a chatbot from localStorage
 */
export function deleteStoredChatbot(id: string): boolean {
  if (!isBrowser()) return false;
  const chatbots = getStoredChatbots();
  const filtered = chatbots.filter(c => c.id !== id);
  
  if (filtered.length === chatbots.length) return false;
  
  localStorage.setItem(STORAGE_KEYS.CHATBOTS, JSON.stringify(filtered));
  
  // Also delete associated chat history
  deleteStoredConversation(id);
  
  return true;
}

// ============ Chat History Storage ============

/**
 * Get all conversations from localStorage
 */
function getAllConversations(): Record<string, StoredConversation> {
  if (!isBrowser()) return {};
  const data = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
  return safeJsonParse<Record<string, StoredConversation>>(data, {});
}

/**
 * Get conversation for a specific chatbot
 */
export function getStoredConversation(chatbotId: string): StoredConversation | null {
  const conversations = getAllConversations();
  return conversations[chatbotId] || null;
}

/**
 * Save a message to conversation history
 */
export function addMessageToConversation(chatbotId: string, message: StoredMessage): void {
  if (!isBrowser()) return;
  const conversations = getAllConversations();
  
  if (!conversations[chatbotId]) {
    conversations[chatbotId] = {
      chatbotId,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
  }
  
  conversations[chatbotId].messages.push(message);
  conversations[chatbotId].updatedAt = new Date().toISOString();
  
  localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(conversations));
}

/**
 * Save entire conversation
 */
export function saveStoredConversation(chatbotId: string, messages: StoredMessage[]): void {
  if (!isBrowser()) return;
  const conversations = getAllConversations();
  
  conversations[chatbotId] = {
    chatbotId,
    messages,
    updatedAt: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(conversations));
}

/**
 * Clear conversation for a chatbot
 */
export function clearStoredConversation(chatbotId: string): void {
  if (!isBrowser()) return;
  const conversations = getAllConversations();
  
  if (conversations[chatbotId]) {
    conversations[chatbotId].messages = [];
    conversations[chatbotId].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(conversations));
  }
}

/**
 * Delete conversation for a chatbot
 */
export function deleteStoredConversation(chatbotId: string): void {
  if (!isBrowser()) return;
  const conversations = getAllConversations();
  delete conversations[chatbotId];
  localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(conversations));
}

// ============ Selected Chatbot ============

/**
 * Get the currently selected chatbot ID
 */
export function getSelectedChatbotId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(STORAGE_KEYS.SELECTED_CHATBOT);
}

/**
 * Set the currently selected chatbot ID
 */
export function setSelectedChatbotId(id: string | null): void {
  if (!isBrowser()) return;
  if (id) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_CHATBOT, id);
  } else {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_CHATBOT);
  }
}

// ============ Utility Functions ============

/**
 * Generate a unique ID for new chatbots
 */
export function generateChatbotId(): string {
  return `chatbot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique ID for messages
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Clear all stored data (for testing/reset)
 */
export function clearAllStoredData(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.CHATBOTS);
  localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.SELECTED_CHATBOT);
}

/**
 * Export all data (for backup)
 */
export function exportStoredData(): {
  chatbots: StoredChatbot[];
  conversations: Record<string, StoredConversation>;
  selectedChatbotId: string | null;
} {
  return {
    chatbots: getStoredChatbots(),
    conversations: getAllConversations(),
    selectedChatbotId: getSelectedChatbotId(),
  };
}

/**
 * Import data (for restore)
 */
export function importStoredData(data: {
  chatbots?: StoredChatbot[];
  conversations?: Record<string, StoredConversation>;
  selectedChatbotId?: string | null;
}): void {
  if (!isBrowser()) return;
  
  if (data.chatbots) {
    localStorage.setItem(STORAGE_KEYS.CHATBOTS, JSON.stringify(data.chatbots));
  }
  if (data.conversations) {
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(data.conversations));
  }
  if (data.selectedChatbotId !== undefined) {
    setSelectedChatbotId(data.selectedChatbotId);
  }
}
