"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CloudArrowUp,
  File,
  Spinner,
  CheckCircle,
  XCircle,
  Warning,
  Info,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface UploadedDocument {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  ingestionStatus: string;
  estimatedPages?: number;
  requiresOCR?: boolean;
}

interface FileValidation {
  valid: boolean;
  error?: string;
  warnings?: string[];
  fileInfo: {
    name: string;
    size: number;
    sizeFormatted: string;
    type: string;
    requiresOCR: boolean;
    estimatedPages: number;
  };
}

interface OCRLimits {
  maxFileSizeMB: number;
  maxPagesPerDocument: number;
  maxDocumentsPerSession: number;
}

interface DocumentUploadProps {
  vaultId: string;
  onUploadComplete?: (document: UploadedDocument) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  showLimits?: boolean;
  className?: string;
}

export function DocumentUpload({
  vaultId,
  onUploadComplete,
  onError,
  maxFiles = 5,
  showLimits = true,
  className,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [limits, setLimits] = useState<OCRLimits | null>(null);
  const [uploadQueue, setUploadQueue] = useState<
    Array<{
      file: File;
      status: "validating" | "pending" | "uploading" | "success" | "error";
      error?: string;
      warnings?: string[];
      validation?: FileValidation;
    }>
  >([]);

  // Fetch OCR limits on mount
  useEffect(() => {
    async function fetchLimits() {
      try {
        const response = await fetch("/api/ocr/validate");
        if (response.ok) {
          const data = await response.json();
          setLimits({
            maxFileSizeMB: data.config.maxFileSizeMB,
            maxPagesPerDocument: data.config.maxPagesPerDocument,
            maxDocumentsPerSession: data.config.maxDocumentsPerSession,
          });
        }
      } catch {
        // Use defaults
        setLimits({
          maxFileSizeMB: 5,
          maxPagesPerDocument: 10,
          maxDocumentsPerSession: 5,
        });
      }
    }
    fetchLimits();
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const validateFiles = async (
    files: Array<{ name: string; size: number; type: string }>
  ): Promise<{
    valid: FileValidation[];
    invalid: FileValidation[];
  }> => {
    try {
      const response = await fetch("/api/ocr/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.validation;
      }
    } catch {
      // Fall through to local validation
    }

    // Fallback: basic local validation
    const valid: FileValidation[] = [];
    const invalid: FileValidation[] = [];

    for (const file of files) {
      const maxSize = (limits?.maxFileSizeMB || 5) * 1024 * 1024;
      if (file.size > maxSize) {
        invalid.push({
          valid: false,
          error: `File exceeds ${limits?.maxFileSizeMB || 5}MB limit`,
          fileInfo: {
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.type,
            requiresOCR: false,
            estimatedPages: 1,
          },
        });
      } else {
        valid.push({
          valid: true,
          fileInfo: {
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.type,
            requiresOCR: file.type.startsWith("image/") || file.type === "application/pdf",
            estimatedPages: 1,
          },
        });
      }
    }

    return { valid, invalid };
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).slice(0, maxFiles);

    // Add files to queue in validating state
    setUploadQueue(
      files.map((file) => ({ file, status: "validating" as const }))
    );

    // Validate all files first
    const fileInfos = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    const validation = await validateFiles(fileInfos);

    // Update queue with validation results
    setUploadQueue((prev) =>
      prev.map((item) => {
        const validResult = validation.valid.find(
          (v) => v.fileInfo.name === item.file.name
        );
        const invalidResult = validation.invalid.find(
          (v) => v.fileInfo.name === item.file.name
        );

        if (invalidResult) {
          return {
            ...item,
            status: "error" as const,
            error: invalidResult.error,
            validation: invalidResult,
          };
        }

        return {
          ...item,
          status: "pending" as const,
          warnings: validResult?.warnings,
          validation: validResult,
        };
      })
    );

    // Filter to only valid files
    const validFiles = files.filter((file) =>
      validation.valid.some((v) => v.fileInfo.name === file.name)
    );

    if (validFiles.length === 0) {
      // All files failed validation
      setTimeout(() => setUploadQueue([]), 5000);
      return;
    }

    setUploading(true);

    // Upload valid files sequentially
    for (const file of validFiles) {
      const queueIndex = files.indexOf(file);

      // Update status to uploading
      setUploadQueue((prev) =>
        prev.map((item, idx) =>
          idx === queueIndex ? { ...item, status: "uploading" as const } : item
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("vaultId", vaultId);

        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || errorData.error || "Upload failed"
          );
        }

        const data = await response.json();

        // Update status to success
        setUploadQueue((prev) =>
          prev.map((item, idx) =>
            idx === queueIndex
              ? {
                  ...item,
                  status: "success" as const,
                  warnings: data.warnings,
                }
              : item
          )
        );

        onUploadComplete?.(data.document);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";

        // Update status to error
        setUploadQueue((prev) =>
          prev.map((item, idx) =>
            idx === queueIndex
              ? { ...item, status: "error" as const, error: message }
              : item
          )
        );

        onError?.(message);
      }
    }

    setUploading(false);

    // Clear queue after 5 seconds
    setTimeout(() => {
      setUploadQueue([]);
    }, 5000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className={className}>
      {/* Limits Info */}
      {showLimits && limits && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Info className="h-3 w-3" />
            Max {limits.maxFileSizeMB}MB
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            Max {limits.maxPagesPerDocument} pages/doc
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            {limits.maxDocumentsPerSession} docs/session
          </span>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          type="file"
          id="document-upload"
          multiple
          accept=".pdf,.txt,.jpg,.jpeg,.png,.tiff,.docx"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={uploading}
        />
        <label htmlFor="document-upload" className="cursor-pointer">
          <CloudArrowUp className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            {uploading ? (
              <span className="text-primary">Uploading...</span>
            ) : (
              <>
                <span className="font-medium text-primary">Click to upload</span>{" "}
                or drag and drop
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, TXT, DOCX, JPEG, PNG, TIFF
          </p>
        </label>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadQueue.map((item, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                item.status === "error"
                  ? "border-destructive/30 bg-destructive/5"
                  : "bg-background"
              )}
            >
              <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(item.file.size)}</span>
                  {item.validation?.fileInfo.requiresOCR && (
                    <span className="text-orange-500">• OCR required</span>
                  )}
                  {item.validation?.fileInfo.estimatedPages && (
                    <span>
                      • ~{item.validation.fileInfo.estimatedPages} page
                      {item.validation.fileInfo.estimatedPages !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {/* Warnings */}
                {item.warnings && item.warnings.length > 0 && (
                  <div className="mt-1 flex items-start gap-1 text-xs text-yellow-600">
                    <Warning className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{item.warnings[0]}</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {item.status === "validating" && (
                  <span className="text-xs text-muted-foreground">
                    Validating...
                  </span>
                )}
                {item.status === "pending" && (
                  <span className="text-xs text-muted-foreground">
                    Waiting...
                  </span>
                )}
                {item.status === "uploading" && (
                  <Spinner className="h-5 w-5 animate-spin text-primary" />
                )}
                {item.status === "success" && (
                  <CheckCircle
                    className="h-5 w-5 text-green-500"
                    weight="fill"
                  />
                )}
                {item.status === "error" && (
                  <div className="flex items-center gap-1">
                    <XCircle
                      className="h-5 w-5 text-destructive"
                      weight="fill"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Error details */}
          {uploadQueue.some((item) => item.status === "error") && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive mb-1">
                Some files could not be uploaded:
              </p>
              <ul className="list-disc list-inside text-xs text-destructive/80 space-y-1">
                {uploadQueue
                  .filter((item) => item.status === "error")
                  .map((item, i) => (
                    <li key={i}>
                      {item.file.name}: {item.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
