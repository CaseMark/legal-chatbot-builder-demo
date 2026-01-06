"use client";

import React, { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PaperclipHorizontal,
  PaperPlaneRight,
  Square,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useAutosizeTextArea } from "@/hooks/use-autosize-textarea";
import { Button } from "@/components/ui/button";

interface MessageInputBaseProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  submitOnEnter?: boolean;
  stop?: () => void;
  isGenerating: boolean;
}

interface MessageInputWithoutAttachmentProps extends MessageInputBaseProps {
  allowAttachments?: false;
}

interface MessageInputWithAttachmentsProps extends MessageInputBaseProps {
  allowAttachments: true;
  files: File[] | null;
  setFiles: React.Dispatch<React.SetStateAction<File[] | null>>;
}

type MessageInputProps =
  | MessageInputWithoutAttachmentProps
  | MessageInputWithAttachmentsProps;

export function MessageInput({
  placeholder = "Ask a question...",
  className,
  onKeyDown: onKeyDownProp,
  submitOnEnter = true,
  stop,
  isGenerating,
  ...props
}: MessageInputProps) {
  const [isDragging, setIsDragging] = React.useState(false);

  const addFiles = (files: File[] | null) => {
    if (props.allowAttachments) {
      props.setFiles((currentFiles) => {
        if (currentFiles === null) {
          return files;
        }

        if (files === null) {
          return currentFiles;
        }

        return [...currentFiles, ...files];
      });
    }
  };

  const onDragOver = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    if (props.allowAttachments !== true) return;
    event.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (event: React.DragEvent) => {
    setIsDragging(false);
    if (props.allowAttachments !== true) return;
    event.preventDefault();
    const dataTransfer = event.dataTransfer;
    if (dataTransfer.files.length) {
      addFiles(Array.from(dataTransfer.files));
    }
  };

  const onPaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files = Array.from(items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file) => file !== null);

    if (props.allowAttachments && files.length > 0) {
      event.preventDefault();
      addFiles(files);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }

    onKeyDownProp?.(event);
  };

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const showFileList =
    props.allowAttachments && props.files && props.files.length > 0;

  useAutosizeTextArea({
    ref: textAreaRef as React.RefObject<HTMLTextAreaElement>,
    maxHeight: 240,
    borderWidth: 1,
    dependencies: [props.value, showFileList],
  });

  const textareaProps = props.allowAttachments
    ? {
        value: props.value,
        onChange: props.onChange,
        disabled: props.disabled,
      }
    : {
        value: props.value,
        onChange: props.onChange,
        disabled: props.disabled,
      };

  return (
    <div
      className="relative flex w-full"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="relative w-full">
        <div className="relative flex-1">
          <textarea
            aria-label="Write your message here"
            placeholder={placeholder}
            ref={textAreaRef}
            rows={1}
            wrap="soft"
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            className={cn(
              "z-10 w-full grow resize-none rounded-lg border bg-background px-4 py-3 pr-24 text-sm leading-relaxed ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              showFileList && "pb-16",
              className
            )}
            {...textareaProps}
          />

          {props.allowAttachments && (
            <div className="absolute inset-x-3 bottom-0 z-20 overflow-x-scroll py-3">
              <div className="flex space-x-3">
                <AnimatePresence mode="popLayout">
                  {props.files?.map((file) => {
                    return (
                      <motion.div
                        key={file.name + String(file.lastModified)}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        <span className="max-w-[100px] truncate">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            props.setFiles((files) => {
                              if (!files) return null;

                              const filtered = Array.from(files).filter(
                                (f) => f !== file
                              );
                              if (filtered.length === 0) return null;
                              return filtered;
                            });
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 gap-2">
          {props.allowAttachments && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Attach a file"
              onClick={async () => {
                const files = await showFileUploadDialog();
                addFiles(files);
              }}
            >
              <PaperclipHorizontal className="h-4 w-4" />
            </Button>
          )}

          {isGenerating && stop ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              aria-label="Stop generating"
              onClick={stop}
            >
              <Square className="h-3 w-3" weight="fill" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8"
              aria-label="Send message"
              disabled={!props.value?.trim() || isGenerating}
            >
              <PaperPlaneRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {props.allowAttachments && <FileUploadOverlay isDragging={isDragging} />}
    </div>
  );
}

interface FileUploadOverlayProps {
  isDragging: boolean;
}

function FileUploadOverlay({ isDragging }: FileUploadOverlayProps) {
  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center space-x-2 rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <PaperclipHorizontal className="h-4 w-4" />
          <span>Drop your files here to attach them.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function showFileUploadDialog() {
  const input = document.createElement("input");

  input.type = "file";
  input.multiple = true;
  input.accept = "*/*";
  input.click();

  return new Promise<File[] | null>((resolve) => {
    input.onchange = (e) => {
      const files = (e.currentTarget as HTMLInputElement).files;

      if (files) {
        resolve(Array.from(files));
        return;
      }

      resolve(null);
    };
  });
}

MessageInput.displayName = "MessageInput";
