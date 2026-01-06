/**
 * Token Limit Middleware Helpers
 *
 * Utilities for extracting user/session IDs and enforcing limits in API routes
 */

import { NextRequest, NextResponse } from "next/server";
import {
  tokenLimitService,
  estimateTokens,
  estimateMessageTokens,
  LimitCheckResult,
} from "./token-limit-service";

export interface RequestContext {
  userId: string;
  sessionId: string;
  adminKey?: string;
}

/**
 * Extract user identifier from request
 * Priority: Auth user ID > X-User-ID header > IP address > "anonymous"
 */
export function getUserId(request: NextRequest): string {
  // Check for authenticated user (would come from auth middleware)
  const authUserId = request.headers.get("x-auth-user-id");
  if (authUserId) return `user:${authUserId}`;

  // Check for custom user ID header
  const customUserId = request.headers.get("x-user-id");
  if (customUserId) return `custom:${customUserId}`;

  // Fall back to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    return `ip:${ip}`;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp}`;

  // Last resort
  return "anonymous";
}

/**
 * Extract session ID from request
 * Priority: X-Session-ID header > Cookie > generated from user ID
 */
export function getSessionId(request: NextRequest, userId: string): string {
  // Check for session ID header
  const sessionHeader = request.headers.get("x-session-id");
  if (sessionHeader) return sessionHeader;

  // Check for session cookie
  const sessionCookie = request.cookies.get("session-id")?.value;
  if (sessionCookie) return sessionCookie;

  // Generate a pseudo-session from user ID and date
  // This ensures the same user gets the same session within a day
  const dateKey = new Date().toISOString().split("T")[0];
  return `${userId}:${dateKey}`;
}

/**
 * Extract admin key from request
 */
export function getAdminKey(request: NextRequest): string | undefined {
  return (
    request.headers.get("x-admin-key") ||
    request.nextUrl.searchParams.get("admin_key") ||
    undefined
  );
}

/**
 * Extract full request context
 */
export function getRequestContext(request: NextRequest): RequestContext {
  const userId = getUserId(request);
  const sessionId = getSessionId(request, userId);
  const adminKey = getAdminKey(request);

  return { userId, sessionId, adminKey };
}

/**
 * Create error response for limit exceeded
 */
export function createLimitErrorResponse(result: LimitCheckResult): NextResponse {
  const response = {
    error: "TOKEN_LIMIT_EXCEEDED",
    limitType: result.limitType,
    message: result.message,
    limit: result.limit,
    used: result.used,
    remaining: result.remaining,
    resetTime: result.resetTime?.toISOString(),
  };

  return NextResponse.json(response, {
    status: 429,
    headers: {
      "X-RateLimit-Limit": result.limit.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": result.resetTime
        ? Math.floor(result.resetTime.getTime() / 1000).toString()
        : "",
      "Retry-After": result.resetTime
        ? Math.ceil(
            (result.resetTime.getTime() - Date.now()) / 1000
          ).toString()
        : "3600",
    },
  });
}

/**
 * Check token limits and return error response if exceeded
 * Returns null if limits are OK, NextResponse if limits exceeded
 */
export async function checkAndEnforceLimits(
  request: NextRequest,
  estimatedTokens: number
): Promise<NextResponse | null> {
  const { userId, sessionId, adminKey } = getRequestContext(request);

  const result = await tokenLimitService.checkLimits(
    userId,
    sessionId,
    estimatedTokens,
    adminKey
  );

  if (!result.allowed) {
    return createLimitErrorResponse(result);
  }

  return null;
}

/**
 * Estimate tokens for a chat request body
 */
export function estimateChatTokens(body: {
  message?: string;
  messages?: Array<{ role: string; content: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
}): number {
  let tokens = 0;

  // Single message
  if (body.message) {
    tokens += estimateTokens(body.message);
  }

  // Messages array (OpenAI format)
  if (body.messages) {
    tokens += estimateMessageTokens(body.messages);
  }

  // Conversation history
  if (body.conversationHistory) {
    tokens += estimateMessageTokens(body.conversationHistory);
  }

  // Add buffer for system prompt and response
  tokens += 500; // System prompt overhead
  tokens += 1000; // Expected response tokens

  return tokens;
}

/**
 * Wrapper to add limit checking to an API handler
 */
export function withTokenLimits<T>(
  handler: (
    request: NextRequest,
    context: RequestContext
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const ctx = getRequestContext(request);

    try {
      // Clone the request to read body
      const clonedRequest = request.clone();
      const body = await clonedRequest.json().catch(() => ({}));

      // Estimate tokens
      const estimatedTokens = estimateChatTokens(body);

      // Check limits
      const limitResult = await tokenLimitService.checkLimits(
        ctx.userId,
        ctx.sessionId,
        estimatedTokens,
        ctx.adminKey
      );

      if (!limitResult.allowed) {
        return createLimitErrorResponse(limitResult);
      }

      // Call the actual handler
      return handler(request, ctx);
    } catch (error) {
      console.error("Error in token limit middleware:", error);
      // On error, let the request through but log it
      return handler(request, ctx);
    }
  };
}
