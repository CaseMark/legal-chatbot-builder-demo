"use client";

import { useState, useEffect } from "react";
import {
  Info,
  File,
  Warning,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface LimitDescriptions {
  fileSize: string;
  pagesPerDocument: string;
  pagesPerSession: string;
  pagesPerDay: string;
  documentsPerSession: string;
  documentsPerDay: string;
  supportedTypes: string;
}

interface OCRConfig {
  maxFileSizeMB: number;
  maxPagesPerDocument: number;
  maxPagesPerSession: number;
  maxPagesPerDay: number;
  maxDocumentsPerSession: number;
  maxDocumentsPerDay: number;
  supportedTypes: string[];
}

interface OCRUploadRestrictionsProps {
  className?: string;
  variant?: "card" | "inline" | "tooltip";
}

export function OCRUploadRestrictions({
  className,
  variant = "card",
}: OCRUploadRestrictionsProps) {
  const [limits, setLimits] = useState<LimitDescriptions | null>(null);
  const [config, setConfig] = useState<OCRConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLimits() {
      try {
        const response = await fetch("/api/ocr/validate");
        if (response.ok) {
          const data = await response.json();
          setLimits(data.limits);
          setConfig(data.config);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchLimits();
  }, []);

  if (loading || !limits) {
    return null;
  }

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap gap-2 text-xs", className)}>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          <File className="h-3 w-3" />
          Max {config?.maxFileSizeMB || 5}MB
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          <File className="h-3 w-3" />
          Max {config?.maxPagesPerDocument || 10} pages
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
          PDF, JPEG, PNG, TIFF
        </span>
      </div>
    );
  }

  if (variant === "tooltip") {
    return (
      <div className={cn("text-xs space-y-1", className)}>
        <p>• {limits.fileSize}</p>
        <p>• {limits.pagesPerDocument}</p>
        <p>• {limits.supportedTypes}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-4 text-sm",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Upload Restrictions</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium text-xs">File Size</p>
            <p className="text-xs text-muted-foreground">{limits.fileSize}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium text-xs">Pages per Document</p>
            <p className="text-xs text-muted-foreground">
              {limits.pagesPerDocument}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium text-xs">Session Limit</p>
            <p className="text-xs text-muted-foreground">
              {limits.documentsPerSession}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium text-xs">Daily Limit</p>
            <p className="text-xs text-muted-foreground">{limits.pagesPerDay}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Supported formats:</span>{" "}
          {limits.supportedTypes}
        </p>
      </div>
    </div>
  );
}

// Pre-upload file validation component
interface FileValidationProps {
  files: Array<{ name: string; size: number; type: string }>;
  className?: string;
  onValidationComplete?: (results: {
    valid: boolean;
    validFiles: number;
    invalidFiles: number;
  }) => void;
}

export function FileValidationStatus({
  files,
  className,
  onValidationComplete,
}: FileValidationProps) {
  const [validation, setValidation] = useState<{
    valid: Array<{ fileInfo: { name: string }; warnings?: string[] }>;
    invalid: Array<{ fileInfo: { name: string }; error?: string }>;
    summary: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (files.length === 0) {
      setValidation(null);
      return;
    }

    async function validate() {
      setLoading(true);
      try {
        const response = await fetch("/api/ocr/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files }),
        });

        if (response.ok) {
          const data = await response.json();
          setValidation(data.validation);
          onValidationComplete?.({
            valid: data.validation.invalid.length === 0,
            validFiles: data.validation.valid.length,
            invalidFiles: data.validation.invalid.length,
          });
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    validate();
  }, [files, onValidationComplete]);

  if (loading) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Validating files...
      </div>
    );
  }

  if (!validation || files.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{validation.summary}</p>

      {/* Invalid files */}
      {validation.invalid.length > 0 && (
        <div className="space-y-1">
          {validation.invalid.map((file, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded bg-destructive/10 p-2 text-xs"
            >
              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">{file.fileInfo.name}</p>
                <p className="text-destructive">{file.error}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Valid files with warnings */}
      {validation.valid.filter((f) => f.warnings?.length).length > 0 && (
        <div className="space-y-1">
          {validation.valid
            .filter((f) => f.warnings?.length)
            .map((file, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded bg-yellow-50 dark:bg-yellow-950 p-2 text-xs"
              >
                <Warning className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium">{file.fileInfo.name}</p>
                  {file.warnings?.map((warning, wIndex) => (
                    <p key={wIndex} className="text-yellow-700 dark:text-yellow-300">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* All valid message */}
      {validation.invalid.length === 0 &&
        !validation.valid.some((f) => f.warnings?.length) && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            All files are valid and ready to upload
          </div>
        )}
    </div>
  );
}
