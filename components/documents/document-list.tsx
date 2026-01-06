"use client";

import { useState, useEffect, useCallback } from "react";
import {
  File,
  FilePdf,
  FileText,
  FileDoc,
  Image,
  Spinner,
  CheckCircle,
  XCircle,
  Clock,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  filename: string;
  size: number;
  ingestionStatus: string;
  pageCount?: number;
  textLength?: number;
  chunkCount?: number;
}

interface DocumentListProps {
  vaultId: string;
  refreshTrigger?: number;
  className?: string;
}

export function DocumentList({
  vaultId,
  refreshTrigger,
  className,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?vaultId=${vaultId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      const data = await response.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  // Poll for status updates when documents are processing
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.ingestionStatus === "processing" || d.ingestionStatus === "pending"
    );

    if (!hasProcessing) return;

    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return <FilePdf className="h-5 w-5 text-red-500" />;
      case "txt":
        return <FileText className="h-5 w-5 text-gray-500" />;
      case "docx":
      case "doc":
        return <FileDoc className="h-5 w-5 text-blue-500" />;
      case "jpg":
      case "jpeg":
      case "png":
      case "tiff":
        return <Image className="h-5 w-5 text-green-500" />;
      default:
        return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-3 w-3" weight="fill" />
            Ready
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
            <Spinner className="h-3 w-3 animate-spin" />
            Processing
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <XCircle className="h-3 w-3" weight="fill" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center",
          className
        )}
      >
        <XCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-muted/30 p-8 text-center",
          className
        )}
      >
        <File className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-sm font-medium">No documents yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload documents to build your knowledge base.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-background overflow-hidden", className)}>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Document
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Details
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  {getFileIcon(doc.filename)}
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {doc.filename}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                {formatFileSize(doc.size)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {getStatusBadge(doc.ingestionStatus)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                {doc.ingestionStatus === "completed" && (
                  <span>
                    {doc.pageCount && `${doc.pageCount} pages`}
                    {doc.pageCount && doc.chunkCount && " • "}
                    {doc.chunkCount && `${doc.chunkCount} chunks`}
                  </span>
                )}
                {doc.ingestionStatus === "processing" && (
                  <span className="text-yellow-600">Processing...</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
