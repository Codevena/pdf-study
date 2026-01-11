// Shared constants used across main and renderer processes

/**
 * Wiki-link regex pattern for parsing [[links]] in notes
 * Supported formats:
 * - [[Book.pdf]] or [[Book]] - links to PDF
 * - [[Book#p50]] or [[Book#Page50]] - links to specific page
 * - Case-insensitive matching
 */
export const WIKI_LINK_REGEX = /\[\[([^\]#]+?)(?:\.pdf)?(?:#(?:p|Page)?(\d+))?\]\]/gi;

/**
 * Creates a fresh regex instance (resets lastIndex for global regex)
 */
export function createWikiLinkRegex(): RegExp {
  return new RegExp(WIKI_LINK_REGEX.source, WIKI_LINK_REGEX.flags);
}
