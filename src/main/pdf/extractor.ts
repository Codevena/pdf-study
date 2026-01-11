import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

// Use pdfjs-dist directly for reliable text extraction
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export interface ExtractedPage {
  pageNum: number;
  content: string;
}

export interface PDFInfo {
  pageCount: number;
  pages: ExtractedPage[];
}

export interface OutlineItem {
  title: string;
  pageIndex: number;
  children: OutlineItem[];
}

export async function extractTextFromPDF(filePath: string): Promise<PDFInfo> {
  const dataBuffer = await fs.readFile(filePath);
  const uint8Array = new Uint8Array(dataBuffer);

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  const pageCount = pdfDocument.numPages;

  // Extract text from each page
  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine all text items (filter for TextItem, not TextMarkedContent)
      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({
        pageNum,
        content: pageText,
      });
    } catch (err) {
      console.error(`Error extracting text from page ${pageNum}:`, err);
      // If page extraction fails, add empty page
      pages.push({
        pageNum,
        content: '',
      });
    }
  }

  return {
    pageCount,
    pages,
  };
}

/**
 * Extract text from specific pages of a PDF
 * @param filePath Path to the PDF file
 * @param pageNumbers Array of page numbers to extract (1-indexed)
 * @returns Combined text from the specified pages
 */
export async function extractTextFromPages(
  filePath: string,
  pageNumbers: number[]
): Promise<{ text: string; pageCount: number }> {
  const dataBuffer = await fs.readFile(filePath);
  const uint8Array = new Uint8Array(dataBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  const pageCount = pdfDocument.numPages;

  // Filter valid page numbers
  const validPageNumbers = pageNumbers.filter(n => n >= 1 && n <= pageCount);

  const textParts: string[] = [];

  for (const pageNum of validPageNumbers) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        textParts.push(`[Seite ${pageNum}]\n${pageText}`);
      }
    } catch (err) {
      console.error(`Error extracting text from page ${pageNum}:`, err);
    }
  }

  return {
    text: textParts.join('\n\n'),
    pageCount,
  };
}

export async function computeFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

export async function findPDFsInFolder(folderPath: string): Promise<string[]> {
  const pdfFiles: string[] = [];

  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
          pdfFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error);
    }
  }

  await scanDirectory(folderPath);
  return pdfFiles;
}

export async function extractOutline(filePath: string): Promise<OutlineItem[]> {
  const dataBuffer = await fs.readFile(filePath);
  const uint8Array = new Uint8Array(dataBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  const outline = await pdfDocument.getOutline();

  if (!outline) {
    return [];
  }

  return parseOutlineItems(outline, pdfDocument);
}

interface PDFOutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: PDFOutlineNode[];
}

async function parseOutlineItems(
  items: PDFOutlineNode[],
  pdfDocument: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>
): Promise<OutlineItem[]> {
  const result: OutlineItem[] = [];

  for (const item of items) {
    const pageIndex = await resolveDestination(item.dest, pdfDocument);
    result.push({
      title: item.title,
      pageIndex,
      children: item.items ? await parseOutlineItems(item.items, pdfDocument) : [],
    });
  }

  return result;
}

async function resolveDestination(
  dest: string | unknown[] | null,
  pdfDocument: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>
): Promise<number> {
  if (!dest) {
    return 0;
  }

  try {
    // If dest is a string, resolve it to an explicit destination
    let explicitDest: unknown[] | null = null;
    if (typeof dest === 'string') {
      explicitDest = await pdfDocument.getDestination(dest);
    } else if (Array.isArray(dest)) {
      explicitDest = dest;
    }

    if (!explicitDest || explicitDest.length === 0) {
      return 0;
    }

    // The first element is the page reference
    const pageRef = explicitDest[0] as Parameters<typeof pdfDocument.getPageIndex>[0];
    const pageIndex = await pdfDocument.getPageIndex(pageRef);
    return pageIndex;
  } catch {
    return 0;
  }
}
