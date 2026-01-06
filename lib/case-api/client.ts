"use server";

import {
  VaultCreateResponse,
  UploadResponse,
  IngestResponse,
  SearchResponse,
  ChatCompletionResponse,
  ChatbotMetadata,
  VaultObject,
} from "./types";

const CASE_API_BASE = "https://api.case.dev";

function getApiKey(): string {
  const apiKey = process.env.CASEDEV_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CASEDEV_API_KEY environment variable is not set. " +
        "For local development, add it to .env.local. " +
        "For Vercel deployment, add it in your Vercel project settings under Environment Variables."
    );
  }
  return apiKey;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(`${CASE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Vault operations
export async function createVault(
  name: string,
  description?: string
): Promise<VaultCreateResponse> {
  return apiRequest<VaultCreateResponse>("/vault", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      enableGraph: false, // Disable GraphRAG for faster processing
    }),
  });
}

export async function listVaults(): Promise<{
  vaults: Array<{
    id: string;
    name: string;
    totalObjects: number;
    totalBytes: number;
  }>;
}> {
  return apiRequest("/vault", { method: "GET" });
}

export async function getVault(
  vaultId: string
): Promise<{ id: string; name: string; totalObjects: number; totalBytes: number }> {
  return apiRequest(`/vault/${vaultId}`, { method: "GET" });
}

export async function listVaultObjects(
  vaultId: string
): Promise<{ objects: VaultObject[] }> {
  return apiRequest(`/vault/${vaultId}/objects`, { method: "GET" });
}

export async function deleteVaultObject(
  vaultId: string,
  objectId: string
): Promise<void> {
  const apiKey = getApiKey();
  const response = await fetch(
    `${CASE_API_BASE}/vault/${vaultId}/objects/${objectId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete object: ${response.status}`);
  }
}

// Document upload operations
export async function getUploadUrl(
  vaultId: string,
  filename: string,
  contentType: string,
  autoIndex: boolean = true
): Promise<UploadResponse> {
  return apiRequest<UploadResponse>(`/vault/${vaultId}/upload`, {
    method: "POST",
    body: JSON.stringify({
      filename,
      contentType,
      auto_index: autoIndex,
    }),
  });
}

export async function uploadFileToS3(
  uploadUrl: string,
  file: Blob | ArrayBuffer,
  contentType: string
): Promise<void> {
  const body =
    file instanceof ArrayBuffer ? new Blob([file], { type: contentType }) : file;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file to S3: ${response.status}`);
  }
}

// Ingestion operations
export async function triggerIngestion(
  vaultId: string,
  objectId: string
): Promise<IngestResponse> {
  return apiRequest<IngestResponse>(`/vault/${vaultId}/ingest/${objectId}`, {
    method: "POST",
  });
}

export async function getObjectStatus(
  vaultId: string,
  objectId: string
): Promise<{
  id: string;
  filename: string;
  ingestionStatus: string;
  pageCount?: number;
  textLength?: number;
  chunkCount?: number;
}> {
  return apiRequest(`/vault/${vaultId}/objects/${objectId}`, { method: "GET" });
}

// Search operations
export async function searchVault(
  vaultId: string,
  query: string,
  topK: number = 5
): Promise<SearchResponse> {
  return apiRequest<SearchResponse>(`/vault/${vaultId}/search`, {
    method: "POST",
    body: JSON.stringify({
      query,
      method: "hybrid",
      topK,
    }),
  });
}

// LLM operations
export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  model: string = "anthropic/claude-sonnet-4-20250514"
): Promise<ChatCompletionResponse> {
  return apiRequest<ChatCompletionResponse>("/llm/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
}

// Chat history operations
export async function saveChatHistory(
  vaultId: string,
  history: Array<{
    id: string;
    role: string;
    content: string;
    sources?: unknown[];
    timestamp: string;
  }>
): Promise<{ objectId: string }> {
  const filename = ".chat-history.json";
  const contentType = "application/json";
  const content = JSON.stringify(history, null, 2);

  // First, delete any existing chat history file
  try {
    const { objects } = await listVaultObjects(vaultId);
    const existingHistory = objects.filter((obj) => obj.filename === filename);

    for (const obj of existingHistory) {
      await deleteVaultObject(vaultId, obj.id);
    }
  } catch {
    // Continue anyway
  }

  // Get upload URL - disable auto-indexing for metadata files
  const { uploadUrl, objectId } = await getUploadUrl(
    vaultId,
    filename,
    contentType,
    false
  );

  // Upload the JSON content
  const blob = new Blob([content], { type: contentType });
  await uploadFileToS3(uploadUrl, blob, contentType);

  return { objectId };
}

export async function loadChatHistory(
  vaultId: string
): Promise<Array<{
  id: string;
  role: string;
  content: string;
  sources?: unknown[];
  timestamp: string;
}> | null> {
  try {
    const { objects } = await listVaultObjects(vaultId);
    const historyObject = objects.find(
      (obj) => obj.filename === ".chat-history.json"
    );

    if (!historyObject) {
      return null;
    }

    const apiKey = getApiKey();
    const response = await fetch(
      `${CASE_API_BASE}/vault/${vaultId}/objects/${historyObject.id}/download`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const downloadData = await response.json();

    if (Array.isArray(downloadData)) {
      return downloadData;
    }

    const downloadUrl = downloadData.downloadUrl || downloadData.url;
    if (!downloadUrl) {
      return null;
    }

    const contentResponse = await fetch(downloadUrl);
    if (!contentResponse.ok) {
      return null;
    }

    return contentResponse.json();
  } catch {
    return null;
  }
}

export async function deleteChatHistory(vaultId: string): Promise<boolean> {
  try {
    const { objects } = await listVaultObjects(vaultId);
    const historyObject = objects.find(
      (obj) => obj.filename === ".chat-history.json"
    );

    if (!historyObject) {
      return true;
    }

    await deleteVaultObject(vaultId, historyObject.id);
    return true;
  } catch {
    return false;
  }
}

// Chatbot metadata operations
export async function saveChatbotMetadata(
  vaultId: string,
  metadata: ChatbotMetadata
): Promise<{ objectId: string }> {
  const filename = ".chatbot-metadata.json";
  const contentType = "application/json";
  const content = JSON.stringify(
    { ...metadata, updatedAt: new Date().toISOString() },
    null,
    2
  );

  // First, delete any existing metadata file
  try {
    const { objects } = await listVaultObjects(vaultId);
    const existingMetadata = objects.filter((obj) => obj.filename === filename);

    for (const obj of existingMetadata) {
      await deleteVaultObject(vaultId, obj.id);
    }
  } catch {
    // Continue anyway
  }

  // Get upload URL - disable auto-indexing for metadata files
  const { uploadUrl, objectId } = await getUploadUrl(
    vaultId,
    filename,
    contentType,
    false
  );

  // Upload the JSON content
  const blob = new Blob([content], { type: contentType });
  await uploadFileToS3(uploadUrl, blob, contentType);

  return { objectId };
}

export async function loadChatbotMetadata(
  vaultId: string
): Promise<ChatbotMetadata | null> {
  try {
    const { objects } = await listVaultObjects(vaultId);
    const metadataObject = objects.find(
      (obj) => obj.filename === ".chatbot-metadata.json"
    );

    if (!metadataObject) {
      return null;
    }

    const apiKey = getApiKey();
    const response = await fetch(
      `${CASE_API_BASE}/vault/${vaultId}/objects/${metadataObject.id}/download`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const downloadData = await response.json();

    // Check if content returned directly
    if (downloadData.name !== undefined && downloadData.systemPrompt !== undefined) {
      return downloadData as ChatbotMetadata;
    }

    const downloadUrl = downloadData.downloadUrl || downloadData.url;
    if (!downloadUrl) {
      return null;
    }

    const contentResponse = await fetch(downloadUrl);
    if (!contentResponse.ok) {
      return null;
    }

    return contentResponse.json();
  } catch {
    return null;
  }
}

// Helper to filter out metadata files from document lists
export function filterMetadataFiles(
  objects: Array<{ id: string; filename: string; [key: string]: unknown }>
): Array<{ id: string; filename: string; [key: string]: unknown }> {
  const metadataFiles = [".chat-history.json", ".chatbot-metadata.json"];
  return objects.filter((obj) => !metadataFiles.includes(obj.filename));
}

// RAG Chat - combines search and LLM
export async function ragChat(
  vaultId: string,
  query: string,
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{
  answer: string;
  sources: SearchResponse["chunks"];
  sourceFiles: SearchResponse["sources"];
  usage?: ChatCompletionResponse["usage"];
}> {
  // First, search for relevant documents
  let searchResults: SearchResponse;
  try {
    searchResults = await searchVault(vaultId, query, 5);
  } catch {
    searchResults = { method: "hybrid", query, chunks: [], sources: [] };
  }

  const hasDocuments = searchResults.chunks && searchResults.chunks.length > 0;

  // Build context from search results
  const context = hasDocuments
    ? searchResults.chunks
        .map((chunk, i) => {
          const source = searchResults.sources?.find(
            (s) => s.id === chunk.object_id
          );
          const filename = source?.filename || "Document";
          return `[${i + 1}] (${filename}): ${chunk.text}`;
        })
        .join("\n\n")
    : "";

  // Build the prompt with or without context
  let ragSystemPrompt: string;

  if (hasDocuments) {
    ragSystemPrompt = `${systemPrompt}

You have access to the following documents from the knowledge base. Use them to answer the user's question.
Always cite your sources using [1], [2], etc. when referencing information from the documents.
If the information is not in the provided documents, say so clearly.

DOCUMENTS:
${context}`;
  } else {
    ragSystemPrompt = `${systemPrompt}

IMPORTANT: The knowledge base is currently empty or no relevant documents were found for this query.
Let the user know that you don't have any documents in your knowledge base yet, and suggest they upload relevant documents to get better answers.
You can still try to help with general questions, but be clear that you're not drawing from any specific documents.`;
  }

  // Build messages array
  const messages = [
    { role: "system", content: ragSystemPrompt },
    ...conversationHistory,
    { role: "user", content: query },
  ];

  // Get LLM response
  const completion = await chatCompletion(messages);
  const answer =
    completion.choices[0]?.message?.content ||
    "I was unable to generate a response.";

  return {
    answer,
    sources: searchResults.chunks || [],
    sourceFiles: searchResults.sources || [],
    usage: completion.usage,
  };
}
