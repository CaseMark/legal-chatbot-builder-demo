import { detectPII, getPIIWarningMessage } from "@/lib/security/pii-detection";
import {
  tokenLimitService,
  estimateTokens,
  estimateMessageTokens,
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
    const { 
      message,           // Single message from client
      messages,          // Or array of messages (legacy support)
      context,           // RAG context from client-side search
      systemPrompt,      // Custom system prompt from chatbot settings
      conversationHistory, // Previous messages for context
      researchMode 
    } = await req.json();

    // Build messages array
    let chatMessages: Array<{ role: string; content: string }> = [];
    
    if (messages) {
      // Legacy format: array of messages
      chatMessages = messages;
    } else if (message) {
      // New format: single message with conversation history
      if (conversationHistory && Array.isArray(conversationHistory)) {
        chatMessages = [...conversationHistory, { role: "user", content: message }];
      } else {
        chatMessages = [{ role: "user", content: message }];
      }
    }

    // Get the last user message for PII checking
    const lastMessage = chatMessages[chatMessages.length - 1];
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
    const estimatedInputTokens = estimateMessageTokens(chatMessages);
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

    // Build system prompt (use custom prompt if provided)
    const finalSystemPrompt = buildSystemPrompt(context, systemPrompt, researchMode);

    // Build full messages array
    const fullMessages = [
      { role: "system" as const, content: finalSystemPrompt },
      ...chatMessages.map((m: { role: string; content: string }) => ({
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

    // Make API call (using Case.dev LLM endpoint)
    const baseUrl = process.env.LLM_BASE_URL || "https://api.case.dev";
    const model = process.env.LLM_MODEL || "anthropic/claude-sonnet-4-20250514";

    // Case.dev uses /llm/v1/chat/completions, OpenAI uses /v1/chat/completions
    const endpoint = baseUrl.includes("case.dev") 
      ? `${baseUrl}/llm/v1/chat/completions`
      : `${baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: false, // Non-streaming for simpler client handling
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

    const data = await response.json();
    const assistantContent = data.choices?.[0]?.message?.content || "";
    
    // Calculate and track actual usage
    const outputTokens = estimateTokens(assistantContent);
    const totalTokens = estimatedInputTokens + outputTokens;

    // Track usage in the token limit service
    await tokenLimitService.trackUsage(userId, sessionId, totalTokens);

    // Return response
    return new Response(
      JSON.stringify({
        message: {
          role: "assistant",
          content: assistantContent,
        },
        usage: {
          prompt_tokens: estimatedInputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
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
  context?: string | {
    contextText?: string;
    sources?: Array<{ fileName: string; pageNumber?: number }>;
  } | null,
  customSystemPrompt?: string,
  researchMode?: boolean
): string {
  // Use custom system prompt if provided, otherwise use default
  const basePrompt = customSystemPrompt || `You are a helpful AI assistant for legal document analysis and research. You provide clear, accurate, and professional responses.

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

  // Handle context - can be string or object
  if (context) {
    let contextText = "";
    let sources: Array<{ fileName: string; pageNumber?: number }> = [];
    
    if (typeof context === "string") {
      contextText = context;
    } else if (typeof context === "object") {
      contextText = context.contextText || "";
      sources = context.sources || [];
    }

    if (contextText) {
      const sourcesStr = sources.length > 0 
        ? `\n\nSOURCES: ${sources.map((s) => {
            let citation = s.fileName;
            if (s.pageNumber) {
              citation += ` (page ${s.pageNumber})`;
            }
            return citation;
          }).join(", ")}`
        : "";

      return `${basePrompt}

RELEVANT DOCUMENT CONTEXT:
${contextText}${sourcesStr}

When answering, prioritize information from the provided document context and cite your sources.`;
    }
  }

  if (researchMode) {
    return `${basePrompt}

RESEARCH MODE ENABLED: You can provide information based on your training data. Be clear about the sources of your information.`;
  }

  return basePrompt;
}
