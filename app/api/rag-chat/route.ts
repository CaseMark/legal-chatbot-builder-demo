import { NextRequest, NextResponse } from "next/server";
import { ragChat } from "@/lib/case-api/client";
import { ChatSource } from "@/lib/case-api/types";
import {
  checkTokenLimit,
  trackTokenUsage,
  estimateMessageTokens,
} from "@/lib/demo-limits/token-tracker";
import { getLegalSystemPrompt, LegalPromptType } from "@/lib/legal/prompts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      vaultId,
      conversationHistory = [],
      promptType = "default",
      customSystemPrompt,
    } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!vaultId) {
      return NextResponse.json(
        { error: "vaultId is required" },
        { status: 400 }
      );
    }

    // Get identifier for rate limiting
    const identifier =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    // Estimate tokens for this request
    const estimatedInputTokens = estimateMessageTokens([
      ...conversationHistory,
      { role: "user", content: message },
    ]);
    const estimatedTotalTokens = estimatedInputTokens + 2000; // Add buffer for response

    // Check token limits
    const limitCheck = await checkTokenLimit(identifier, estimatedTotalTokens);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: "TOKEN_LIMIT_REACHED",
          message: limitCheck.message,
          limit: limitCheck.limit,
          used: limitCheck.used,
          remaining: limitCheck.remaining,
        },
        { status: 429 }
      );
    }

    // Get system prompt
    const systemPrompt =
      customSystemPrompt || getLegalSystemPrompt(promptType as LegalPromptType);

    // Call RAG chat
    const { answer, sources, sourceFiles, usage } = await ragChat(
      vaultId,
      message.trim(),
      systemPrompt,
      conversationHistory
    );

    // Transform sources to client format
    const chatSources: ChatSource[] = sources.map((s) => {
      const sourceFile = sourceFiles?.find((sf) => sf.id === s.object_id);
      return {
        text: s.text,
        filename: sourceFile?.filename || s.filename || "Document",
        objectId: s.object_id,
        page: s.page,
        score: s.hybridScore,
      };
    });

    // Track actual token usage
    if (usage) {
      await trackTokenUsage(identifier, usage.total_tokens);
    } else {
      // Fallback to estimated if no usage returned
      await trackTokenUsage(identifier, estimatedTotalTokens);
    }

    return NextResponse.json({
      message: {
        role: "assistant",
        content: answer,
        sources: chatSources,
      },
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in RAG chat:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process message",
      },
      { status: 500 }
    );
  }
}
