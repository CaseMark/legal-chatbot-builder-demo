"use client";

import { useState } from "react";
import { CaretRight, File, FileText } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Source {
  text: string;
  filename: string;
  objectId: string;
  page?: number;
  score: number;
}

interface SourceCitationsProps {
  sources: Source[];
  className?: string;
}

export function SourceCitations({ sources, className }: SourceCitationsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  // Group sources by filename
  const groupedSources = sources.reduce((acc, source) => {
    if (!acc[source.filename]) {
      acc[source.filename] = [];
    }
    acc[source.filename].push(source);
    return acc;
  }, {} as Record<string, Source[]>);

  const fileCount = Object.keys(groupedSources).length;

  return (
    <div className={cn("mt-3 rounded-lg border bg-muted/30", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          {fileCount} source{fileCount !== 1 ? "s" : ""} referenced
        </span>
        <CaretRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-3">
          {Object.entries(groupedSources).map(([filename, fileSources]) => (
            <div key={filename}>
              <div className="flex items-center gap-2 mb-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{filename}</span>
              </div>
              <div className="space-y-2 ml-6">
                {fileSources.map((source, index) => (
                  <div
                    key={`${source.objectId}-${index}`}
                    className="rounded border bg-background p-2 text-xs"
                  >
                    {source.page && (
                      <span className="inline-block mb-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary font-medium">
                        Page {source.page}
                      </span>
                    )}
                    <p className="text-muted-foreground line-clamp-3">
                      {source.text}
                    </p>
                    <div className="mt-1 text-muted-foreground/60">
                      Relevance: {Math.round(source.score * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
