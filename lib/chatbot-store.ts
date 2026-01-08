import { v4 as uuidv4 } from "uuid";
import { Chatbot, Conversation, ChatMessage } from "./case-api/types";

// Use global to persist across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var chatbotStore: Map<string, Chatbot> | undefined;
  // eslint-disable-next-line no-var
  var conversationStore: Map<string, Conversation> | undefined;
}

// In-memory store for chatbots (in production, use a database)
const chatbots = global.chatbotStore ?? new Map<string, Chatbot>();
const conversations = global.conversationStore ?? new Map<string, Conversation>();

// Persist to global in development
if (process.env.NODE_ENV !== "production") {
  global.chatbotStore = chatbots;
  global.conversationStore = conversations;
}

// Default system prompt for legal chatbots
const DEFAULT_SYSTEM_PROMPT = `You are a helpful legal assistant for a law firm. You answer questions based on the firm's internal documents and knowledge base.

Guidelines:
- Be professional and accurate
- Always cite your sources when referencing specific documents
- If you're not sure about something, say so
- Do not provide legal advice - direct users to speak with an attorney for specific legal matters
- Be concise but thorough in your responses`;

const DEFAULT_WELCOME_MESSAGE =
  "Hello! I'm your legal assistant. I can help you find information from our knowledge base. What would you like to know?";

// Chatbot CRUD operations
export function createChatbot(
  name: string,
  description: string,
  vaultId: string,
  options?: {
    systemPrompt?: string;
    welcomeMessage?: string;
    primaryColor?: string;
  }
): Chatbot {
  const chatbot: Chatbot = {
    id: uuidv4(),
    name,
    description,
    vaultId,
    systemPrompt: options?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    welcomeMessage: options?.welcomeMessage || DEFAULT_WELCOME_MESSAGE,
    primaryColor: options?.primaryColor || "#0ea5e9",
    createdAt: new Date(),
    updatedAt: new Date(),
    documentCount: 0,
    totalBytes: 0,
  };

  chatbots.set(chatbot.id, chatbot);
  return chatbot;
}

export function getChatbot(id: string): Chatbot | undefined {
  return chatbots.get(id);
}

export function getAllChatbots(): Chatbot[] {
  return Array.from(chatbots.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export function updateChatbot(
  id: string,
  updates: Partial<Omit<Chatbot, "id" | "createdAt">>
): Chatbot | undefined {
  const chatbot = chatbots.get(id);
  if (!chatbot) return undefined;

  const updated = {
    ...chatbot,
    ...updates,
    updatedAt: new Date(),
  };

  chatbots.set(id, updated);
  return updated;
}

export function deleteChatbot(id: string): boolean {
  // Also delete associated conversations
  const convIds = Array.from(conversations.keys());
  for (const convId of convIds) {
    const conv = conversations.get(convId);
    if (conv && conv.chatbotId === id) {
      conversations.delete(convId);
    }
  }
  return chatbots.delete(id);
}

// Conversation operations
export function createConversation(chatbotId: string): Conversation {
  const conversation: Conversation = {
    id: uuidv4(),
    chatbotId,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  conversations.set(conversation.id, conversation);
  return conversation;
}

export function getConversation(id: string): Conversation | undefined {
  return conversations.get(id);
}

export function getConversationsByChatbot(chatbotId: string): Conversation[] {
  return Array.from(conversations.values())
    .filter((c) => c.chatbotId === chatbotId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function addMessageToConversation(
  conversationId: string,
  message: Omit<ChatMessage, "id" | "timestamp">
): Conversation | undefined {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;

  const newMessage: ChatMessage = {
    ...message,
    id: uuidv4(),
    timestamp: new Date(),
  };

  conversation.messages.push(newMessage);
  conversation.updatedAt = new Date();

  return conversation;
}

// Serialization helpers for API responses
export function serializeChatbot(chatbot: Chatbot) {
  return {
    ...chatbot,
    createdAt: chatbot.createdAt.toISOString(),
    updatedAt: chatbot.updatedAt.toISOString(),
  };
}

export function serializeConversation(conversation: Conversation) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((m) => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    })),
  };
}
