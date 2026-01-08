/**
 * Client-side RAG (Retrieval Augmented Generation) system
 * 
 * All document processing and storage happens in the browser using IndexedDB.
 * Only embeddings are generated server-side via the /api/embeddings endpoint.
 * 
 * This ensures user data stays local and no vaults are created on the server.
 */

export { DocumentProcessor } from './document-processor';
export type { DocumentChunk, ProcessedDocument } from './document-processor';

export { LocalVectorStore } from './vector-store';
export type { StoredEmbedding } from './vector-store';

export { EmbeddingService } from './embedding-service';

export { BM25Search } from './bm25-search';
export type { BM25SearchResult } from './bm25-search';

export { HybridSearch } from './hybrid-search';
export type { HybridSearchResult } from './hybrid-search';

export { RAGService } from './rag-service';
export type { RAGContext } from './rag-service';
