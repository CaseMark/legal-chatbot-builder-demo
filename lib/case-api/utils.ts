/**
 * Utility functions for Case.dev API
 * These are pure helper functions that don't need to be server actions
 */

/**
 * Metadata files that should be filtered out from document lists
 */
export const METADATA_FILES = [".chat-history.json", ".chatbot-metadata.json"];

/**
 * Helper to filter out metadata files from document lists
 */
export function filterMetadataFiles<T extends { id: string; filename: string }>(
  objects: T[]
): T[] {
  return objects.filter((obj) => !METADATA_FILES.includes(obj.filename));
}

/**
 * Check if a file is a metadata file
 */
export function isMetadataFile(filename: string): boolean {
  return METADATA_FILES.includes(filename);
}
