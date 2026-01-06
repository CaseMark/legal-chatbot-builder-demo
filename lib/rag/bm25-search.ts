"use client";

import { DocumentChunk } from "./document-processor";

export interface BM25SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export class BM25Search {
  private documents: DocumentChunk[] = [];
  private termFreqs: Map<string, Map<string, number>> = new Map();
  private docFreqs: Map<string, number> = new Map();
  private avgDocLength = 0;
  private k1 = 1.2;
  private b = 0.75;

  async indexDocuments(chunks: DocumentChunk[]): Promise<void> {
    this.documents = chunks;
    this.termFreqs.clear();
    this.docFreqs.clear();

    let totalLength = 0;

    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.content);
      totalLength += tokens.length;

      const termFreq = new Map<string, number>();

      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }

      this.termFreqs.set(chunk.id, termFreq);

      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
      }
    }

    this.avgDocLength = totalLength / chunks.length;
  }

  search(query: string, topK: number = 5): BM25SearchResult[] {
    const queryTerms = this.tokenize(query);
    const scores: { chunk: DocumentChunk; score: number }[] = [];

    for (const chunk of this.documents) {
      const score = this.calculateBM25Score(queryTerms, chunk.id);
      if (score > 0) {
        scores.push({ chunk, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  private calculateBM25Score(queryTerms: string[], chunkId: string): number {
    const termFreq = this.termFreqs.get(chunkId);
    if (!termFreq) return 0;

    const docLength = Array.from(termFreq.values()).reduce(
      (sum, freq) => sum + freq,
      0
    );
    let score = 0;

    for (const term of queryTerms) {
      const tf = termFreq.get(term) || 0;
      const df = this.docFreqs.get(term) || 0;

      if (tf > 0 && df > 0) {
        const idf = Math.log(
          (this.documents.length - df + 0.5) / (df + 0.5)
        );

        const numerator = tf * (this.k1 + 1);
        const denominator =
          tf +
          this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

        score += idf * (numerator / denominator);
      }
    }

    return score;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }
}
