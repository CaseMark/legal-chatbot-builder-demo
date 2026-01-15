'use client';

import { SessionStats } from '@/lib/types/demo-limits';

const STATS_KEY = 'chatbot-demo-session-stats';

// Helper function to get session reset time
function getSessionResetTime(sessionHours: number = 24): string {
  const resetTime = new Date();
  resetTime.setHours(resetTime.getHours() + sessionHours);
  return resetTime.toISOString();
}

// Get session statistics from localStorage
export function getSessionStats(): SessionStats {
  const defaultStats: SessionStats = {
    documentsUploaded: 0,
    totalCharsProcessed: 0,
    sessionPrice: 0,
    sessionStartAt: new Date().toISOString(),
    sessionResetAt: getSessionResetTime(24),
  };

  if (typeof window === 'undefined') {
    return defaultStats;
  }

  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (!stored) {
      // Initialize with default stats
      localStorage.setItem(STATS_KEY, JSON.stringify(defaultStats));
      return defaultStats;
    }

    const stats = JSON.parse(stored) as SessionStats;

    // Initialize price fields if they don't exist (backward compatibility)
    if (stats.sessionPrice === undefined) {
      stats.sessionPrice = 0;
      stats.sessionStartAt = new Date().toISOString();
      stats.sessionResetAt = getSessionResetTime(24);
    }

    // Check if session reset needed
    const now = new Date();
    if (now >= new Date(stats.sessionResetAt)) {
      const resetStats: SessionStats = {
        documentsUploaded: 0,
        totalCharsProcessed: 0,
        sessionPrice: 0,
        sessionStartAt: now.toISOString(),
        sessionResetAt: getSessionResetTime(24),
      };
      localStorage.setItem(STATS_KEY, JSON.stringify(resetStats));
      return resetStats;
    }

    return stats;
  } catch {
    return defaultStats;
  }
}

// Update session statistics
export function updateSessionStats(updates: Partial<SessionStats>): void {
  if (typeof window === 'undefined') return;

  const current = getSessionStats();
  const updated = { ...current, ...updates };
  localStorage.setItem(STATS_KEY, JSON.stringify(updated));
}

// Increment documents uploaded counter
export function incrementDocumentsUploaded(): void {
  const stats = getSessionStats();
  updateSessionStats({ documentsUploaded: stats.documentsUploaded + 1 });
}

// Increment session price by a given amount
export function incrementSessionPrice(price: number): void {
  const stats = getSessionStats();
  updateSessionStats({ sessionPrice: stats.sessionPrice + price });
}

// Increment characters processed
export function incrementCharsProcessed(chars: number): void {
  const stats = getSessionStats();
  updateSessionStats({ totalCharsProcessed: stats.totalCharsProcessed + chars });
}

// Calculate time remaining until session reset
export function calculateTimeRemaining(resetAt: string): string {
  const now = new Date();
  const reset = new Date(resetAt);
  const diff = reset.getTime() - now.getTime();

  if (diff <= 0) return '0h 0m';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

// Calculate cost based on characters processed
export function calculateCost(chars: number, pricePerThousandChars: number = 0.0005): number {
  return (chars / 1000) * pricePerThousandChars;
}

// Reset session stats (for testing or manual reset)
export function resetSessionStats(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STATS_KEY);
}

// Check if session price limit is exceeded
export function isSessionPriceLimitExceeded(priceLimit: number): boolean {
  const stats = getSessionStats();
  return stats.sessionPrice >= priceLimit;
}

// Check if document limit is exceeded
export function isDocumentLimitExceeded(docLimit: number): boolean {
  const stats = getSessionStats();
  return stats.documentsUploaded >= docLimit;
}

// Get remaining budget
export function getRemainingBudget(priceLimit: number): number {
  const stats = getSessionStats();
  return Math.max(0, priceLimit - stats.sessionPrice);
}

// Get remaining documents
export function getRemainingDocuments(docLimit: number): number {
  const stats = getSessionStats();
  return Math.max(0, docLimit - stats.documentsUploaded);
}
