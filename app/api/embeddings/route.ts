export async function POST(req: Request) {
  try {
    const { texts } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({
          error: "INVALID_INPUT",
          message: "texts array is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = process.env.CASEDEV_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "CONFIGURATION_ERROR",
          message: "API key not configured",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

    // Process in batches of 20
    const batchSize = 20;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: batch,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Embedding API error:", errorText);

        // Return zero embeddings as fallback
        const fallbackEmbeddings = batch.map(() => new Array(1536).fill(0));
        allEmbeddings.push(...fallbackEmbeddings);
        continue;
      }

      const data = await response.json();
      const embeddings = data.data.map(
        (item: { embedding: number[] }) => item.embedding
      );
      allEmbeddings.push(...embeddings);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return new Response(
      JSON.stringify({ embeddings: allEmbeddings }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in embeddings API:", error);
    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: "Failed to generate embeddings",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
