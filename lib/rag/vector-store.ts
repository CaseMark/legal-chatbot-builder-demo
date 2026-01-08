'use client';

import { DocumentChunk, ProcessedDocument } from './document-processor';

export interface StoredEmbedding {
  id: string;
  chunkId: string;
  embedding: number[];
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
}

/**
 * Client-side vector store using IndexedDB
 * All document data stays in the browser - no server storage
 */
export class LocalVectorStore {
  private dbName = 'legal-chatbot-rag-store';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create documents store
        if (!db.objectStoreNames.contains('documents')) {
          const documentsStore = db.createObjectStore('documents', { keyPath: 'id' });
          documentsStore.createIndex('fileName', 'fileName', { unique: false });
          documentsStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
          documentsStore.createIndex('chatbotId', 'chatbotId', { unique: false });
        }

        // Create embeddings store
        if (!db.objectStoreNames.contains('embeddings')) {
          const embeddingsStore = db.createObjectStore('embeddings', { keyPath: 'id' });
          embeddingsStore.createIndex('chunkId', 'chunkId', { unique: false });
          embeddingsStore.createIndex('createdAt', 'createdAt', { unique: false });
          embeddingsStore.createIndex('chatbotId', 'chatbotId', { unique: false });
        }

        // Create chunks store
        if (!db.objectStoreNames.contains('chunks')) {
          const chunksStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunksStore.createIndex('documentId', 'documentId', { unique: false });
          chunksStore.createIndex('fileName', 'metadata.fileName', { unique: false });
          chunksStore.createIndex('chatbotId', 'chatbotId', { unique: false });
        }
      };
    });
  }

  async storeDocument(document: ProcessedDocument, chatbotId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['documents', 'chunks'], 'readwrite');
    const documentsStore = transaction.objectStore('documents');
    const chunksStore = transaction.objectStore('chunks');

    // Store document metadata with chatbotId
    await this.promisifyRequest(documentsStore.add({
      id: document.id,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      totalChunks: document.totalChunks,
      uploadedAt: document.uploadedAt,
      chatbotId,
    }));

    // Store chunks with document reference and chatbotId
    for (const chunk of document.chunks) {
      await this.promisifyRequest(chunksStore.add({
        ...chunk,
        documentId: document.id,
        chatbotId,
      }));
    }
  }

  async storeEmbeddings(embeddings: StoredEmbedding[], chatbotId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['embeddings'], 'readwrite');
    const store = transaction.objectStore('embeddings');

    for (const embedding of embeddings) {
      await this.promisifyRequest(store.add({
        ...embedding,
        chatbotId,
      }));
    }
  }

  async getDocumentsForChatbot(chatbotId: string): Promise<ProcessedDocument[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['documents', 'chunks'], 'readonly');
    const documentsStore = transaction.objectStore('documents');
    const chunksStore = transaction.objectStore('chunks');

    // Get documents for this chatbot
    const allDocuments = await this.promisifyRequest(documentsStore.getAll()) as (ProcessedDocument & { chatbotId: string })[];
    const documents = allDocuments.filter(doc => doc.chatbotId === chatbotId);
    
    // Get chunks for each document
    const result: ProcessedDocument[] = [];
    for (const doc of documents) {
      const allChunks = await this.promisifyRequest(
        chunksStore.index('documentId').getAll(doc.id)
      ) as DocumentChunk[];
      
      result.push({
        ...doc,
        chunks: allChunks,
      });
    }

    // Ensure newest uploads appear first
    result.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
    return result;
  }

  async getAllDocuments(): Promise<ProcessedDocument[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['documents', 'chunks'], 'readonly');
    const documentsStore = transaction.objectStore('documents');
    const chunksStore = transaction.objectStore('chunks');

    const documents = await this.promisifyRequest(documentsStore.getAll()) as ProcessedDocument[];
    
    // Get chunks for each document
    const result: ProcessedDocument[] = [];
    for (const doc of documents) {
      const chunks = await this.promisifyRequest(
        chunksStore.index('documentId').getAll(doc.id)
      ) as DocumentChunk[];
      
      result.push({
        ...doc,
        chunks,
      });
    }

    // Ensure newest uploads appear first
    result.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
    return result;
  }

  async searchSimilar(queryEmbedding: number[], chatbotId: string, topK: number = 5): Promise<{ chunk: DocumentChunk; similarity: number }[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['embeddings', 'chunks'], 'readonly');
    const embeddingsStore = transaction.objectStore('embeddings');
    const chunksStore = transaction.objectStore('chunks');

    const allEmbeddings = await this.promisifyRequest(embeddingsStore.getAll()) as (StoredEmbedding & { chatbotId: string })[];
    
    // Filter embeddings for this chatbot
    const embeddings = allEmbeddings.filter(e => e.chatbotId === chatbotId);
    
    // Calculate cosine similarity
    const similarities = embeddings.map(embedding => ({
      embedding,
      similarity: this.cosineSimilarity(queryEmbedding, embedding.embedding),
    }));

    // Sort by similarity and get top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);

    // Get corresponding chunks
    const results = [];
    for (const result of topResults) {
      const chunk = await this.promisifyRequest(
        chunksStore.get(result.embedding.chunkId)
      ) as DocumentChunk;
      
      if (chunk) {
        results.push({
          chunk,
          similarity: result.similarity,
        });
      }
    }

    return results;
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['documents', 'chunks', 'embeddings'], 'readwrite');
    const documentsStore = transaction.objectStore('documents');
    const chunksStore = transaction.objectStore('chunks');
    const embeddingsStore = transaction.objectStore('embeddings');

    // Get all chunks for this document
    const chunks = await this.promisifyRequest(
      chunksStore.index('documentId').getAll(documentId)
    ) as DocumentChunk[];

    // Delete document
    await this.promisifyRequest(documentsStore.delete(documentId));

    // Delete chunks and their embeddings
    for (const chunk of chunks) {
      await this.promisifyRequest(chunksStore.delete(chunk.id));
      
      // Delete corresponding embeddings
      const embeddings = await this.promisifyRequest(
        embeddingsStore.index('chunkId').getAll(chunk.id)
      ) as StoredEmbedding[];
      
      for (const embedding of embeddings) {
        await this.promisifyRequest(embeddingsStore.delete(embedding.id));
      }
    }
  }

  async clearChatbotDocuments(chatbotId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const documents = await this.getDocumentsForChatbot(chatbotId);
    
    for (const doc of documents) {
      await this.deleteDocument(doc.id);
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['documents', 'chunks', 'embeddings'], 'readwrite');
    
    await Promise.all([
      this.promisifyRequest(transaction.objectStore('documents').clear()),
      this.promisifyRequest(transaction.objectStore('chunks').clear()),
      this.promisifyRequest(transaction.objectStore('embeddings').clear()),
    ]);
  }

  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
