'use client';

import { DocumentProcessor, ProcessedDocument, DocumentChunk } from './document-processor';
import { LocalVectorStore, StoredEmbedding } from './vector-store';
import { EmbeddingService } from './embedding-service';
import { HybridSearch } from './hybrid-search';

export interface RAGContext {
  relevantChunks: Array<{
    chunk: DocumentChunk;
    similarity: number;
    bm25Score?: number;
    combinedScore?: number;
  }>;
  contextText: string;
  sources: Array<{
    fileName: string;
    pageNumber?: number;
    chunkIndex?: number;
  }>;
}

/**
 * Client-side RAG service
 * All document processing, storage, and search happens in the browser
 * Only embeddings are generated server-side via API
 */
export class RAGService {
  private static instance: RAGService;
  private documentProcessor: DocumentProcessor;
  private vectorStore: LocalVectorStore;
  private embeddingService: EmbeddingService;
  private hybridSearch: HybridSearch;
  private isInitialized = false;
  private currentChatbotId: string | null = null;

  private constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.vectorStore = new LocalVectorStore();
    this.embeddingService = EmbeddingService.getInstance();
    this.hybridSearch = new HybridSearch();
  }

  static getInstance(): RAGService {
    if (!RAGService.instance) {
      RAGService.instance = new RAGService();
    }
    return RAGService.instance;
  }

  async initialize(chatbotId?: string): Promise<void> {
    if (this.isInitialized && this.currentChatbotId === chatbotId) return;

    try {
      await this.vectorStore.initialize();
      await this.embeddingService.initialize();
      
      // If chatbotId provided, reindex for that chatbot
      if (chatbotId) {
        this.currentChatbotId = chatbotId;
        await this.reindexHybridSearch(chatbotId);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize RAG service:', error);
      throw error;
    }
  }

  async uploadDocument(
    file: File, 
    chatbotId: string,
    onProgress?: (progress: number) => void
  ): Promise<ProcessedDocument> {
    await this.initialize(chatbotId);

    try {
      onProgress?.(10);

      // Process the document (client-side PDF/DOCX extraction)
      const document = await this.documentProcessor.processFile(file);
      onProgress?.(40);

      // Generate embeddings for all chunks (server-side API call)
      const texts = document.chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);
      onProgress?.(80);

      // Store document and embeddings in IndexedDB
      await this.vectorStore.storeDocument(document, chatbotId);

      const storedEmbeddings: StoredEmbedding[] = embeddings.map((embedding, index) => ({
        id: `emb_${document.chunks[index].id}`,
        chunkId: document.chunks[index].id,
        embedding,
        content: document.chunks[index].content,
        metadata: document.chunks[index].metadata,
        createdAt: Date.now(),
      }));

      await this.vectorStore.storeEmbeddings(storedEmbeddings, chatbotId);
      onProgress?.(90);

      // Re-index all documents for hybrid search
      await this.reindexHybridSearch(chatbotId);
      onProgress?.(100);

      return document;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  async searchRelevantContext(
    query: string, 
    chatbotId: string,
    topK: number = 5
  ): Promise<RAGContext> {
    await this.initialize(chatbotId);

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Get documents for this chatbot
      const allDocuments = await this.vectorStore.getDocumentsForChatbot(chatbotId);
      
      if (allDocuments.length === 0) {
        return {
          relevantChunks: [],
          contextText: '',
          sources: [],
        };
      }

      // Get vector similarity results
      const vectorResults = await this.vectorStore.searchSimilar(
        queryEmbedding, 
        chatbotId, 
        Math.min(100, topK * 10)
      );

      // Use hybrid search to combine with BM25
      const hybridResults = await this.hybridSearch.search(query, vectorResults, topK);

      // Format results
      const relevantChunks = hybridResults.map(item => ({
        chunk: item.chunk,
        similarity: item.vectorScore,
        bm25Score: item.bm25Score,
        combinedScore: item.combinedScore,
      }));

      // Create context text
      const contextText = relevantChunks
        .map(item => `[${item.chunk.metadata.fileName}] ${item.chunk.content}`)
        .join('\n\n');

      // Extract sources
      const sources = relevantChunks.map(item => ({
        fileName: item.chunk.metadata.fileName,
        pageNumber: item.chunk.metadata.pageNumber,
        chunkIndex: item.chunk.metadata.chunkIndex,
      }));

      return {
        relevantChunks,
        contextText,
        sources,
      };
    } catch (error) {
      console.error('Error searching context:', error);
      return {
        relevantChunks: [],
        contextText: '',
        sources: [],
      };
    }
  }

  async getDocumentsForChatbot(chatbotId: string): Promise<ProcessedDocument[]> {
    await this.initialize(chatbotId);
    return this.vectorStore.getDocumentsForChatbot(chatbotId);
  }

  async deleteDocument(documentId: string, chatbotId: string): Promise<void> {
    await this.initialize(chatbotId);
    await this.vectorStore.deleteDocument(documentId);
    await this.reindexHybridSearch(chatbotId);
  }

  async clearChatbotDocuments(chatbotId: string): Promise<void> {
    await this.initialize(chatbotId);
    await this.vectorStore.clearChatbotDocuments(chatbotId);
    await this.reindexHybridSearch(chatbotId);
  }

  private async reindexHybridSearch(chatbotId: string): Promise<void> {
    try {
      // Get all documents and their chunks for this chatbot
      const documents = await this.vectorStore.getDocumentsForChatbot(chatbotId);
      const allChunks: DocumentChunk[] = [];
      
      for (const doc of documents) {
        allChunks.push(...doc.chunks);
      }
      
      // Re-index for hybrid search
      await this.hybridSearch.indexDocuments(allChunks);
    } catch (error) {
      console.error('Error reindexing hybrid search:', error);
    }
  }

  isEmbeddingServiceReady(): boolean {
    return this.embeddingService.isInitialized();
  }

  async getStorageStats(chatbotId: string): Promise<{
    documentsCount: number;
    totalChunks: number;
    totalSize: string;
  }> {
    await this.initialize(chatbotId);
    
    try {
      const documents = await this.getDocumentsForChatbot(chatbotId);
      const totalChunks = documents.reduce((sum, doc) => sum + doc.totalChunks, 0);
      const totalBytes = documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0);
      
      const sizeString = totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
        : totalBytes > 1024
        ? `${(totalBytes / 1024).toFixed(1)} KB`
        : `${totalBytes} B`;

      return {
        documentsCount: documents.length,
        totalChunks,
        totalSize: sizeString,
      };
    } catch {
      return {
        documentsCount: 0,
        totalChunks: 0,
        totalSize: '0 B',
      };
    }
  }
}
