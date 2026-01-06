"use server";

import { DEFAULT_DEMO_LIMITS, DemoLimits } from "@/lib/case-api/types";

// In-memory usage tracking (resets on server restart)
// In production, use a database or Redis
const usageStore = new Map<
  string,
  {
    tokens: number;
    ocrPages: number;
    lastReset: number;
  }
>();

function getDateKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getUserKey(identifier: string): string {
  return `${identifier}:${getDateKey()}`;
}

function getUsage(identifier: string) {
  const key = getUserKey(identifier);
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  let usage = usageStore.get(key);

  // Reset if it's a new day
  if (!usage || now - usage.lastReset > dayInMs) {
    usage = { tokens: 0, ocrPages: 0, lastReset: now };
    usageStore.set(key, usage);
  }

  return usage;
}

export async function checkTokenLimit(
  identifier: string,
  requestedTokens: number,
  limits: DemoLimits = DEFAULT_DEMO_LIMITS
): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  message?: string;
}> {
  const usage = getUsage(identifier);
  const remaining = limits.maxTokensPerDay - usage.tokens;

  if (usage.tokens + requestedTokens > limits.maxTokensPerDay) {
    return {
      allowed: false,
      remaining,
      used: usage.tokens,
      limit: limits.maxTokensPerDay,
      message: `Daily token limit (${limits.maxTokensPerDay.toLocaleString()}) reached. Try again tomorrow.`,
    };
  }

  return {
    allowed: true,
    remaining: remaining - requestedTokens,
    used: usage.tokens,
    limit: limits.maxTokensPerDay,
  };
}

export async function trackTokenUsage(
  identifier: string,
  tokensUsed: number
): Promise<void> {
  const key = getUserKey(identifier);
  const usage = getUsage(identifier);
  usage.tokens += tokensUsed;
  usageStore.set(key, usage);
}

export async function checkOcrLimit(
  identifier: string,
  requestedPages: number,
  limits: DemoLimits = DEFAULT_DEMO_LIMITS
): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  message?: string;
}> {
  const usage = getUsage(identifier);
  const remaining = limits.maxOcrPagesPerDay - usage.ocrPages;

  if (usage.ocrPages + requestedPages > limits.maxOcrPagesPerDay) {
    return {
      allowed: false,
      remaining,
      used: usage.ocrPages,
      limit: limits.maxOcrPagesPerDay,
      message: `Daily OCR limit (${limits.maxOcrPagesPerDay} pages) reached. Try again tomorrow.`,
    };
  }

  return {
    allowed: true,
    remaining: remaining - requestedPages,
    used: usage.ocrPages,
    limit: limits.maxOcrPagesPerDay,
  };
}

export async function trackOcrUsage(
  identifier: string,
  pagesProcessed: number
): Promise<void> {
  const key = getUserKey(identifier);
  const usage = getUsage(identifier);
  usage.ocrPages += pagesProcessed;
  usageStore.set(key, usage);
}

export async function getUsageStats(
  identifier: string,
  limits: DemoLimits = DEFAULT_DEMO_LIMITS
): Promise<{
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
  ocr: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  };
}> {
  const usage = getUsage(identifier);

  return {
    tokens: {
      used: usage.tokens,
      limit: limits.maxTokensPerDay,
      remaining: limits.maxTokensPerDay - usage.tokens,
      percentUsed: Math.round((usage.tokens / limits.maxTokensPerDay) * 100),
    },
    ocr: {
      used: usage.ocrPages,
      limit: limits.maxOcrPagesPerDay,
      remaining: limits.maxOcrPagesPerDay - usage.ocrPages,
      percentUsed: Math.round(
        (usage.ocrPages / limits.maxOcrPagesPerDay) * 100
      ),
    },
  };
}

// Token estimation utilities
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;
  for (const message of messages) {
    // Add tokens for role and message structure
    total += 4; // role + structure overhead
    total += estimateTokens(message.content);
  }
  return total;
}
