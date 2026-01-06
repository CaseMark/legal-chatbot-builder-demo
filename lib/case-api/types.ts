// Chatbot types
export interface Chatbot {
  id: string;
  name: string;
  description: string;
  vaultId: string;
  systemPrompt: string;
  welcomeMessage: string;
  primaryColor: string;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
  totalBytes: number;
}

// Document types
export interface Document {
  id: string;
  chatbotId: string;
  filename: string;
  contentType: string;
  size: number;
  ingestionStatus: "pending" | "processing" | "completed" | "failed";
  uploadedAt: Date;
  pageCount?: number;
  textLength?: number;
  chunkCount?: number;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

export interface ChatSource {
  text: string;
  filename: string;
  objectId: string;
  page?: number;
  score: number;
}

// Conversation types
export interface Conversation {
  id: string;
  chatbotId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface VaultCreateResponse {
  id: string;
  name: string;
  description?: string;
  filesBucket: string;
  vectorBucket: string;
  indexName: string;
  region: string;
  createdAt: string;
}

export interface VaultListResponse {
  vaults: Array<{
    id: string;
    name: string;
    description?: string;
    enableGraph: boolean;
    totalObjects: number;
    totalBytes: number;
    createdAt: string;
  }>;
  total: number;
}

export interface VaultObject {
  id: string;
  filename: string;
  ingestionStatus: string;
  sizeBytes: number;
  pageCount?: number;
  textLength?: number;
  chunkCount?: number;
}

export interface UploadResponse {
  objectId: string;
  uploadUrl: string;
  expiresIn: number;
  instructions: {
    method: string;
    headers: Record<string, string>;
  };
}

export interface IngestResponse {
  objectId: string;
  workflowId: string;
  status: string;
  message: string;
}

export interface SearchChunk {
  text: string;
  object_id: string;
  chunk_index: number;
  hybridScore: number;
  vectorScore: number;
  bm25Score: number;
  filename?: string;
  page?: number;
}

export interface SearchSource {
  id: string;
  filename: string;
  pageCount?: number;
}

export interface SearchResponse {
  method: string;
  query: string;
  chunks: SearchChunk[];
  sources: SearchSource[];
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: number;
  };
}

// Chatbot metadata stored in vault
export interface ChatbotMetadata {
  name: string;
  description: string;
  systemPrompt: string;
  welcomeMessage: string;
  primaryColor: string;
  documentSizes: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

// Embed configuration
export interface EmbedConfig {
  chatbotId: string;
  position: "bottom-right" | "bottom-left";
  buttonText: string;
  headerText: string;
  primaryColor: string;
}

// Demo limits
export interface DemoLimits {
  maxTokensPerDay: number;
  maxDocumentsPerChatbot: number;
  maxOcrPagesPerDay: number;
  maxFileSizeMB: number;
}

export const DEFAULT_DEMO_LIMITS: DemoLimits = {
  maxTokensPerDay: 50000,
  maxDocumentsPerChatbot: 10,
  maxOcrPagesPerDay: 20,
  maxFileSizeMB: 10,
};
