// Types for demo limits tracking and enforcement

export interface SessionStats {
  documentsUploaded: number;
  totalCharsProcessed: number;
  sessionPrice: number; // Total price in dollars for the session
  sessionStartAt: string; // ISO string - when the session started
  sessionResetAt: string; // ISO string - when the session should reset
}

export interface DemoLimits {
  pricing: {
    sessionHours: number;
    sessionPriceLimit: number; // dollars
    pricePerThousandChars: number; // dollars per 1000 characters
  };
  documents: {
    maxDocumentsPerSession: number;
    maxFileSize: number; // bytes
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  remainingUsage?: number;
  suggestedAction?: string;
}

export interface UsageStats {
  pricing: {
    sessionPriceUsed: number;
    sessionPriceLimit: number;
    percentUsed: number;
    timeRemaining: string; // e.g., "23h 45m"
  };
  documents: {
    documentsUsed: number;
    documentsLimit: number;
    percentUsed: number;
  };
}
