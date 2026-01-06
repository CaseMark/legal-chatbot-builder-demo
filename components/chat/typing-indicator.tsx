"use client";

import { Circle } from "@phosphor-icons/react";

export function TypingIndicator() {
  return (
    <div className="justify-left flex space-x-1">
      <div className="rounded-lg bg-muted p-3">
        <div className="flex -space-x-2.5">
          <Circle
            weight="fill"
            className="h-3 w-3 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <Circle
            weight="fill"
            className="h-3 w-3 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <Circle
            weight="fill"
            className="h-3 w-3 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
