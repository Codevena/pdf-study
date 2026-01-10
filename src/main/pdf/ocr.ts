import Tesseract from 'tesseract.js';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';

export interface OCRResult {
  pageNum: number;
  content: string;
  confidence: number;
}

export interface OCRProgress {
  pdfId: number;
  fileName: string;
  currentPage: number;
  totalPages: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

// Check if a page needs OCR (has no or almost no text)
// Only trigger OCR for pages that are essentially empty
export function pageNeedsOCR(textContent: string): boolean {
  const cleanedText = textContent.replace(/\s+/g, ' ').trim();
  // Only need OCR if page has less than 10 characters (essentially empty)
  return cleanedText.length < 10;
}

// Initialize tesseract worker
let worker: Tesseract.Worker | null = null;

async function getWorker(languages: string[]): Promise<Tesseract.Worker> {
  if (worker) {
    return worker;
  }

  // Get cache directory for tesseract data
  const cacheDir = path.join(app.getPath('userData'), 'tesseract-cache');
  try {
    await fs.access(cacheDir);
  } catch {
    await fs.mkdir(cacheDir, { recursive: true });
  }

  worker = await Tesseract.createWorker(languages.join('+'), 1, {
    cachePath: cacheDir,
    cacheMethod: 'readOnly',
  });

  return worker;
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

// Perform OCR on a single image buffer
export async function performOCR(
  imageBuffer: Buffer,
  languages: string[] = ['deu', 'eng']
): Promise<{ text: string; confidence: number }> {
  const tesseractWorker = await getWorker(languages);

  const { data } = await tesseractWorker.recognize(imageBuffer);

  return {
    text: data.text.replace(/\s+/g, ' ').trim(),
    confidence: data.confidence,
  };
}

// Render a PDF page to image using pdf.js
export async function renderPDFPageToImage(
  pdfData: Buffer,
  pageNum: number,
  scale: number = 2.0
): Promise<Buffer> {
  // Import pdfjs-dist dynamically to avoid issues with Electron
  const pdfjs = await import('pdfjs-dist');

  // Set up the worker
  const pdfjsWorkerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerPath;

  // Load the PDF
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfData) });
  const pdf = await loadingTask.promise;

  // Get the page
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Create a canvas using node-canvas or similar
  // For Electron, we'll use OffscreenCanvas if available, or create a canvas element
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  // Render the page
  await page.render({
    canvasContext: context as any,
    viewport,
  }).promise;

  // Convert to PNG buffer
  const pngBuffer = canvas.toBuffer('image/png');

  // Cleanup
  page.cleanup();
  await pdf.cleanup();
  await pdf.destroy();

  return pngBuffer;
}

// Cache PDF data to avoid re-reading the same file multiple times
let cachedPdfPath: string | null = null;
let cachedPdfData: Buffer | null = null;

async function getPdfData(pdfPath: string): Promise<Buffer> {
  if (cachedPdfPath === pdfPath && cachedPdfData) {
    return cachedPdfData;
  }
  cachedPdfData = await fs.readFile(pdfPath);
  cachedPdfPath = pdfPath;
  return cachedPdfData;
}

export function clearPdfCache(): void {
  cachedPdfPath = null;
  cachedPdfData = null;
}

// Process a PDF for OCR - returns pages that need OCR with their text
export async function processPageOCR(
  pdfPath: string,
  pageNum: number,
  languages: string[] = ['deu', 'eng'],
  onProgress?: (progress: { page: number; confidence: number }) => void
): Promise<OCRResult | null> {
  try {
    // Use cached PDF data for better performance when processing multiple pages
    const pdfData = await getPdfData(pdfPath);

    // Render page to image
    const imageBuffer = await renderPDFPageToImage(pdfData, pageNum);

    // Perform OCR
    const { text, confidence } = await performOCR(imageBuffer, languages);

    if (onProgress) {
      onProgress({ page: pageNum, confidence });
    }

    // Return result if we found any text
    if (text.length > 0) {
      return {
        pageNum,
        content: text,
        confidence,
      };
    }

    return null;
  } catch (error) {
    console.error(`OCR error on page ${pageNum}:`, error);
    return null;
  }
}
