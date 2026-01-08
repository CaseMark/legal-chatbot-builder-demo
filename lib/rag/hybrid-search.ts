'use client';

import { DocumentChunk } from './document-processor';
import { BM25Search, BM25SearchResult } from './bm25-search';

export interface HybridSearchResult {
  chunk: DocumentChunk;
  vectorScore: number;
  bm25Score: number;
  combinedScore: number;
}

/**
 * Hybrid search combining vector similarity and BM25 keyword search
 * Provides better results than either method alone
 */
export class HybridSearch {
  private bm25Search = new BM25Search();
  private vectorWeight = 0.7; // Weight for vector similarity
  private bm25Weight = 0.3;   // Weight for BM25 score

  async indexDocuments(chunks: DocumentChunk[]): Promise<void> {
    await this.bm25Search.indexDocuments(chunks);
  }

  combineResults(
    vectorResults: { chunk: DocumentChunk; similarity: number }[],
    bm25Results: BM25SearchResult[],
    topK: number = 5
  ): HybridSearchResult[] {
    // Create maps for easy lookup
    const vectorMap = new Map<string, number>();
    const bm25Map = new Map<string, number>();
    
    // Normalize vector scores (already between 0-1)
    const maxVectorScore = Math.max(...vectorResults.map(r => r.similarity), 0.001);
    for (const result of vectorResults) {
      vectorMap.set(result.chunk.id, result.similarity / maxVectorScore);
    }
    
    // Normalize BM25 scores
    const maxBM25Score = Math.max(...bm25Results.map(r => r.score), 0.001);
    for (const result of bm25Results) {
      bm25Map.set(result.chunk.id, result.score / maxBM25Score);
    }
    
    // Combine results
    const allChunkIds = new Set([
      ...vectorResults.map(r => r.chunk.id),
      ...bm25Results.map(r => r.chunk.id)
    ]);
    
    const hybridResults: HybridSearchResult[] = [];
    
    for (const chunkId of allChunkIds) {
      const vectorScore = vectorMap.get(chunkId) || 0;
      const bm25Score = bm25Map.get(chunkId) || 0;
      
      // Calculate combined score using weighted sum
      const combinedScore = (vectorScore * this.vectorWeight) + (bm25Score * this.bm25Weight);
      
      // Find the chunk (prefer from vector results, then BM25 results)
      let chunk = vectorResults.find(r => r.chunk.id === chunkId)?.chunk;
      if (!chunk) {
        chunk = bm25Results.find(r => r.chunk.id === chunkId)?.chunk;
      }
      
      if (chunk) {
        hybridResults.push({
          chunk,
          vectorScore,
          bm25Score,
          combinedScore
        });
      }
    }
    
    // Sort by combined score and return top K
    hybridResults.sort((a, b) => b.combinedScore - a.combinedScore);
    return hybridResults.slice(0, topK);
  }

  async search(
    query: string, 
    vectorResults: { chunk: DocumentChunk; similarity: number }[],
    topK: number = 5
  ): Promise<HybridSearchResult[]> {
    // Get BM25 results
    const bm25Results = this.bm25Search.search(query, topK * 4); // Get more candidates
    
    // Combine and rank results
    return this.combineResults(vectorResults, bm25Results, topK);
  }

  // Allow adjusting the weights
  setWeights(vectorWeight: number, bm25Weight: number): void {
    const total = vectorWeight + bm25Weight;
    this.vectorWeight = vectorWeight / total;
    this.bm25Weight = bm25Weight / total;
  }
}
