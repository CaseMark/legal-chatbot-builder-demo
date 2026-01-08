'use client';

/**
 * Client-side embedding service that calls the server API
 * Embeddings are generated server-side but stored client-side in IndexedDB
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private isReady = false;

  private constructor() {}

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  async initialize(): Promise<void> {
    // No heavy initialization needed for API-based embeddings
    this.isReady = true;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isReady) {
      await this.initialize();
    }

    try {
      // Clean and truncate text (OpenAI has a token limit)
      const cleanText = text.replace(/\s+/g, ' ').trim();
      
      // Call our API endpoint
      const response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [cleanText],
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.embeddings && data.embeddings[0]) {
        return data.embeddings[0];
      }
      
      throw new Error('Invalid embedding response format');
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }
      throw new Error('Failed to generate embedding');
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isReady) {
      await this.initialize();
    }
    
    const embeddings: number[][] = [];
    
    // Process in batches to avoid rate limits and optimize API calls
    const batchSize = 20; // Process 20 texts at a time
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        // Clean texts
        const cleanBatch = batch.map(text => text.replace(/\s+/g, ' ').trim());
        
        // Call our API endpoint
        const response = await fetch('/api/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            texts: cleanBatch,
          }),
        });

        if (!response.ok) {
          throw new Error(`Embedding API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.embeddings) {
          embeddings.push(...data.embeddings);
        }
        
        // Small delay to avoid rate limiting if processing many batches
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error generating embeddings for batch starting at ${i}:`, error);
        // For failed batches, generate individually as fallback
        for (const text of batch) {
          try {
            const embedding = await this.generateEmbedding(text);
            embeddings.push(embedding);
          } catch (innerError) {
            console.error('Failed to generate embedding for individual text:', innerError);
            // Push zero embedding as last resort
            embeddings.push(new Array(1536).fill(0)); // text-embedding-3-small dimension is 1536
          }
        }
      }
    }
    
    return embeddings;
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  isLoading(): boolean {
    // API-based embeddings don't have a loading state like local models
    return false;
  }
}
