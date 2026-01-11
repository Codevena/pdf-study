import type { ParsedWikiLink, ResolvedLink, PDFDocument } from '../../shared/types';
import { createWikiLinkRegex } from '../../shared/constants';

/**
 * Parse wiki-links from text content
 * Supports formats:
 * - [[Book.pdf]]
 * - [[Book.pdf#p50]]
 * - [[Book.pdf#Page50]]
 * - [[Book]] (auto-adds .pdf)
 * - [[Book#p50]]
 */
export function parseWikiLinks(content: string): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  const regex = createWikiLinkRegex();
  let match;

  while ((match = regex.exec(content)) !== null) {
    const fileName = match[1].trim();
    const normalizedFileName = fileName.toLowerCase().endsWith('.pdf')
      ? fileName
      : `${fileName}.pdf`;

    links.push({
      fullMatch: match[0],
      fileName: normalizedFileName,
      pageNum: match[2] ? parseInt(match[2], 10) : null,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return links;
}

/**
 * Resolve a parsed wiki-link to a PDF document
 * Returns null if the PDF is not found
 * @deprecated Use resolveLinkWithLookup for better performance
 */
export function resolveLink(
  link: ParsedWikiLink,
  allPdfs: PDFDocument[]
): ResolvedLink | null {
  // Case-insensitive filename matching
  const pdf = allPdfs.find(
    (p) => p.fileName.toLowerCase() === link.fileName.toLowerCase()
  );

  return resolveLinkFromPdf(link, pdf);
}

/**
 * Resolve a parsed wiki-link using a direct lookup function
 * More efficient than resolveLink when processing many links
 */
export function resolveLinkWithLookup(
  link: ParsedWikiLink,
  lookupPdf: (fileName: string) => PDFDocument | undefined
): ResolvedLink | null {
  const pdf = lookupPdf(link.fileName);
  return resolveLinkFromPdf(link, pdf);
}

/**
 * Internal helper to resolve link from a PDF document
 */
function resolveLinkFromPdf(
  link: ParsedWikiLink,
  pdf: PDFDocument | undefined
): ResolvedLink | null {
  if (!pdf) {
    return null;
  }

  // Validate page number is within range
  const pageNum =
    link.pageNum && link.pageNum >= 1 && link.pageNum <= pdf.pageCount
      ? link.pageNum
      : null;

  return {
    pdfId: pdf.id,
    pageNum,
  };
}

/**
 * Extract unique PDF names from content for quick reference
 */
export function extractLinkedPdfNames(content: string): string[] {
  const links = parseWikiLinks(content);
  const uniqueNames = new Set(links.map((l) => l.fileName.toLowerCase()));
  return Array.from(uniqueNames);
}

/**
 * Check if content contains any wiki-links
 */
export function hasWikiLinks(content: string): boolean {
  return createWikiLinkRegex().test(content);
}

/**
 * Format a wiki-link string
 */
export function formatWikiLink(fileName: string, pageNum?: number): string {
  const baseName = fileName.replace(/\.pdf$/i, '');
  return pageNum ? `[[${baseName}#p${pageNum}]]` : `[[${baseName}]]`;
}
