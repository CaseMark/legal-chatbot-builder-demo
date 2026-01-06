import { detectPII, getPIIWarningMessage } from "@/lib/security/pii-detection";
import {
  tokenLimitService,
  estimateTokens,
  estimateMessageTokens,
  getRequestContext,
  createLimitErrorResponse,
} from "@/lib/demo-limits";

export async function POST(req: Request) {
  // Extract request context for limit tracking
  const headers = new Headers(req.headers);
  const userId =
    headers.get("x-auth-user-id") ||
    headers.get("x-user-id") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "anonymous";
  const sessionId =
    headers.get("x-session-id") ||
    `${userId}:${new Date().toISOString().split("T")[0]}`;
  const adminKey = headers.get("x-admin-key") || undefined;

  try {
    const { messages, context, researchMode } = await req.json();

    // Get the last user message for PII checking
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content || "";

    // Check for PII if research mode is enabled
    if (researchMode && lastMessage?.role === "user") {
      const piiResult = detectPII(userQuery);
      if (piiResult.hasPII) {
        const warningMessage = getPIIWarningMessage(piiResult);
        return new Response(
          JSON.stringify({
            error: "PII_DETECTED",
            message: warningMessage,
            piiTypes: piiResult.detectedTypes,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Estimate tokens for this request
    const estimatedInputTokens = estimateMessageTokens(messages);
    const estimatedOutputTokens = 1000; // Buffer for response
    const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens;

    // Check all token limits (per-request, session, daily, monthly)
    const limitCheck = await tokenLimitService.checkLimits(
      userId,
      sessionId,
      totalEstimatedTokens,
      adminKey
    );

    if (!limitCheck.allowed) {
      // Use the standardized error response
      return new Response(
        JSON.stringify({
          error: "TOKEN_LIMIT_EXCEEDED",
          limitType: limitCheck.limitType,
          message: limitCheck.message,
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
          resetTime: limitCheck.resetTime?.toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": limitCheck.limit.toString(),
            "X-RateLimit-Remaining": limitCheck.remaining.toString(),
            "X-RateLimit-Reset": limitCheck.resetTime
              ? Math.floor(limitCheck.resetTime.getTime() / 1000).toString()
              : "",
          },
        }
      );
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(context, researchMode);

    // Build full messages array
    const fullMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Get API key from environment
    const apiKey = process.env.CASEDEV_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "CONFIGURATION_ERROR",
          message:
            "API key not configured. Please set CASEDEV_API_KEY in environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Make API call (using OpenAI-compatible endpoint)
    const baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.LLM_MODEL || "gpt-4o-mini";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: true,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM API error:", errorText);
      return new Response(
        JSON.stringify({
          error: "API_ERROR",
          message: "Failed to get response from AI service.",
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let outputContent = "";

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim());

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  // Calculate and track actual usage
                  const outputTokens = estimateTokens(outputContent);
                  const totalTokens = estimatedInputTokens + outputTokens;

                  // Track usage in the token limit service
                  await tokenLimitService.trackUsage(
                    userId,
                    sessionId,
                    totalTokens
                  );

                  // Send complete event with usage info
                  controller.enqueue(
                    `data: ${JSON.stringify({
                      type: "complete",
                      usage: {
                        prompt_tokens: estimatedInputTokens,
                        completion_tokens: outputTokens,
                        total_tokens: totalTokens,
                      },
                    })}\n\n`
                  );
                  controller.enqueue("data: [DONE]\n\n");
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    outputContent += content;
                    controller.enqueue(
                      `data: ${JSON.stringify({ type: "chunk", content })}\n\n`
                    );
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        } catch (error) {
          console.error("Stream processing error:", error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

function buildSystemPrompt(
  context?: {
    contextText: string;
    sources: Array<{ fileName: string; pageCitations?: number[] }>;
  },
  researchMode?: boolean
): string {
  const basePrompt = `You are a helpful AI assistant for legal document analysis and research. You provide clear, accurate, and professional responses.

Your capabilities:
- Legal document analysis and summarization
- Contract review and risk assessment
- Research assistance and information synthesis
- Clear explanation of complex legal concepts

Response Guidelines:
- Use **bold** for key points and findings
- Use *italics* for emphasis and legal terms
- Create bullet points for lists
- Include citations when referencing documents
- Be concise but thorough`;

  if (context) {
    return `${basePrompt}

RELEVANT DOCUMENT CONTEXT:
${context.contextText}

SOURCES: ${context.sources
      .map((s) => {
        let citation = s.fileName;
        if (s.pageCitations && s.pageCitations.length > 0) {
          citation += ` (page ${s.pageCitations.join(", ")})`;
        }
        return citation;
      })
      .join(", ")}

When answering, prioritize information from the provided document context and cite your sources.`;
  }

  if (researchMode) {
    return `${basePrompt}

RESEARCH MODE ENABLED: You can provide information based on your training data. Be clear about the sources of your information.`;
  }

  return basePrompt;
}
