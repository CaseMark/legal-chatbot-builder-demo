"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  File,
  Download,
  Eye,
  CaretDown,
  CaretUp,
  Sparkle,
  Briefcase,
  House,
  Handshake,
  ShieldCheck,
  Buildings,
  ArrowRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface SampleDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  pages: number;
  fileSize: string;
  previewUrl?: string;
  downloadUrl?: string;
  sampleQueries: string[];
}

const sampleDocuments: SampleDocument[] = [
  {
    id: "nda-template",
    title: "Non-Disclosure Agreement",
    description:
      "A standard mutual NDA template for business partnerships and confidential discussions.",
    category: "Contracts",
    icon: <Handshake className="h-5 w-5" weight="duotone" />,
    pages: 4,
    fileSize: "156 KB",
    sampleQueries: [
      "What are the confidentiality obligations?",
      "How long does the NDA last?",
      "What information is excluded from protection?",
    ],
  },
  {
    id: "employment-contract",
    title: "Employment Agreement",
    description:
      "Standard employment contract template with compensation, benefits, and termination clauses.",
    category: "Employment",
    icon: <Briefcase className="h-5 w-5" weight="duotone" />,
    pages: 8,
    fileSize: "284 KB",
    sampleQueries: [
      "What are the termination notice requirements?",
      "Is there a non-compete clause?",
      "What benefits are included?",
    ],
  },
  {
    id: "lease-agreement",
    title: "Commercial Lease Agreement",
    description:
      "Commercial property lease with terms, rent escalation, and maintenance responsibilities.",
    category: "Real Estate",
    icon: <Buildings className="h-5 w-5" weight="duotone" />,
    pages: 12,
    fileSize: "412 KB",
    sampleQueries: [
      "What is the rent escalation schedule?",
      "Who is responsible for maintenance?",
      "What are the lease renewal terms?",
    ],
  },
  {
    id: "privacy-policy",
    title: "Privacy Policy Template",
    description:
      "GDPR and CCPA compliant privacy policy for web applications and SaaS products.",
    category: "Compliance",
    icon: <ShieldCheck className="h-5 w-5" weight="duotone" />,
    pages: 6,
    fileSize: "198 KB",
    sampleQueries: [
      "How is user data collected and stored?",
      "What are the user's rights under GDPR?",
      "How can users request data deletion?",
    ],
  },
  {
    id: "rental-agreement",
    title: "Residential Rental Agreement",
    description:
      "Standard residential lease agreement with security deposit and maintenance terms.",
    category: "Real Estate",
    icon: <House className="h-5 w-5" weight="duotone" />,
    pages: 5,
    fileSize: "172 KB",
    sampleQueries: [
      "What is the security deposit amount?",
      "Can the tenant sublease the property?",
      "What are the move-out requirements?",
    ],
  },
];

interface SampleDocumentsProps {
  /** Display variant */
  variant?: "grid" | "list" | "compact";
  /** Maximum number of documents to show */
  maxItems?: number;
  /** Custom class name */
  className?: string;
  /** Callback when a document is selected for loading */
  onLoadDocument?: (doc: SampleDocument) => void;
  /** Callback when a sample query is selected */
  onSelectQuery?: (query: string) => void;
  /** Show as collapsible section */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
}

function DocumentCard({
  document,
  variant,
  onLoad,
  onQuerySelect,
}: {
  document: SampleDocument;
  variant: "grid" | "list" | "compact";
  onLoad?: () => void;
  onQuerySelect?: (query: string) => void;
}) {
  const [showQueries, setShowQueries] = useState(false);

  if (variant === "compact") {
    return (
      <button
        onClick={onLoad}
        className="flex items-center gap-3 w-full rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors group"
        aria-label={`Load ${document.title}`}
      >
        <div className="flex-shrink-0 rounded-lg bg-muted p-2 text-muted-foreground group-hover:text-foreground transition-colors">
          {document.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{document.title}</p>
          <p className="text-xs text-muted-foreground">
            {document.pages} pages
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>
    );
  }

  if (variant === "list") {
    return (
      <div className="flex items-start gap-4 rounded-lg border p-4">
        <div className="flex-shrink-0 rounded-lg bg-muted p-2.5 text-muted-foreground">
          {document.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{document.title}</h4>
            <Badge variant="secondary" className="text-xs">
              {document.category}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {document.description}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {document.pages} pages
            </span>
            <span>{document.fileSize}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={onLoad}>
              <File className="h-3.5 w-3.5 mr-1.5" />
              Load Document
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowQueries(!showQueries)}
            >
              {showQueries ? "Hide" : "Sample"} Queries
              {showQueries ? (
                <CaretUp className="h-3.5 w-3.5 ml-1" />
              ) : (
                <CaretDown className="h-3.5 w-3.5 ml-1" />
              )}
            </Button>
          </div>
          {showQueries && (
            <div className="mt-3 space-y-1.5">
              {document.sampleQueries.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => onQuerySelect?.(query)}
                  className="block w-full text-left text-sm text-primary hover:underline"
                >
                  → {query}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid variant
  return (
    <Card className="group hover:ring-2 hover:ring-primary/20 transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground group-hover:text-foreground transition-colors">
            {document.icon}
          </div>
          <Badge variant="secondary" className="text-xs">
            {document.category}
          </Badge>
        </div>
        <CardTitle className="text-base mt-2">{document.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {document.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {document.pages} pages
          </span>
          <span>{document.fileSize}</span>
        </div>

        <div className="space-y-2">
          <Button size="sm" className="w-full" onClick={onLoad}>
            <File className="h-3.5 w-3.5 mr-1.5" />
            Load Document
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setShowQueries(!showQueries)}
          >
            {showQueries ? "Hide" : "Try"} Sample Queries
            {showQueries ? (
              <CaretUp className="h-3.5 w-3.5 ml-1.5" />
            ) : (
              <CaretDown className="h-3.5 w-3.5 ml-1.5" />
            )}
          </Button>
        </div>

        {showQueries && (
          <div className="mt-3 pt-3 border-t space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Try asking:
            </p>
            {document.sampleQueries.map((query, idx) => (
              <button
                key={idx}
                onClick={() => onQuerySelect?.(query)}
                className="flex items-start gap-2 w-full text-left text-sm text-foreground hover:text-primary transition-colors p-1.5 rounded hover:bg-muted"
              >
                <Sparkle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                <span className="line-clamp-2">{query}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SampleDocuments({
  variant = "grid",
  maxItems,
  className,
  onLoadDocument,
  onSelectQuery,
  collapsible = false,
  defaultCollapsed = true,
}: SampleDocumentsProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const displayedDocs = maxItems
    ? sampleDocuments.slice(0, maxItems)
    : sampleDocuments;

  const handleLoadDocument = useCallback(
    (doc: SampleDocument) => {
      onLoadDocument?.(doc);
    },
    [onLoadDocument]
  );

  const content = (
    <div
      className={cn(
        variant === "grid" && "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        variant === "list" && "space-y-3",
        variant === "compact" && "space-y-2"
      )}
    >
      {displayedDocs.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          variant={variant}
          onLoad={() => handleLoadDocument(doc)}
          onQuerySelect={onSelectQuery}
        />
      ))}
    </div>
  );

  if (collapsible) {
    return (
      <div
        className={cn("rounded-lg border bg-background", className)}
        data-tour="sample-documents"
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between p-4 text-left"
          aria-expanded={!collapsed}
          aria-controls="sample-docs-content"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Sparkle className="h-5 w-5" weight="fill" />
            </div>
            <div>
              <h3 className="font-semibold">Sample Documents</h3>
              <p className="text-sm text-muted-foreground">
                {sampleDocuments.length} legal templates to explore
              </p>
            </div>
          </div>
          {collapsed ? (
            <CaretDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <CaretUp className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {!collapsed && (
          <div id="sample-docs-content" className="border-t p-4">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className} data-tour="sample-documents">
      {content}
    </div>
  );
}

/**
 * Minimal sample document trigger button
 */
export function SampleDocumentsTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 px-4 py-3 text-sm text-muted-foreground hover:border-muted-foreground/50 hover:bg-muted/50 hover:text-foreground transition-colors",
        className
      )}
    >
      <Sparkle className="h-4 w-4 text-purple-500" weight="fill" />
      <span>Not sure where to start? Try sample documents</span>
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}

/**
 * Sample queries component for chat empty state
 */
export function SampleQueries({
  queries,
  onSelect,
  className,
}: {
  queries?: string[];
  onSelect: (query: string) => void;
  className?: string;
}) {
  const defaultQueries = [
    "Summarize the key terms of this agreement",
    "What are the termination clauses?",
    "Identify any potential risks or concerns",
    "What obligations does each party have?",
  ];

  const displayQueries = queries || defaultQueries;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Sparkle className="h-4 w-4 text-amber-500" weight="fill" />
        Try asking:
      </p>
      <div className="flex flex-wrap gap-2">
        {displayQueries.map((query, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(query)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            {query}
          </button>
        ))}
      </div>
    </div>
  );
}
