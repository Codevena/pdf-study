import { ipcMain, BrowserWindow } from 'electron';
import * as queries from '../database/queries';
import { pageNeedsOCR, processPageOCR, terminateWorker, clearPdfCache } from '../pdf/ocr';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { DatabaseInstance } from '../database';
import type { HandlerContext } from './types';
import { safeJsonParse } from './utils';
import {
  ocrStatus,
  ocrCancelled,
  setOcrCancelled,
  updateOcrStatus,
  setOcrStatus,
  clearSearchCache,
} from './state';

export function registerOcrHandlers({ db, mainWindow }: HandlerContext): void {
  // OCR Status
  ipcMain.handle(IPC_CHANNELS.GET_OCR_STATUS, () => {
    return ocrStatus;
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_OCR, async () => {
    setOcrCancelled(true);
    await terminateWorker();
    setOcrStatus({
      isProcessing: false,
      pdfId: null,
      fileName: null,
      currentPage: 0,
      totalPages: 0,
      pagesNeedingOCR: 0,
      processedPages: 0,
      queuedPdfs: 0,
    });
    mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
    return true;
  });

  // Start OCR for a specific PDF
  ipcMain.handle(IPC_CHANNELS.START_OCR_FOR_PDF, async (_, pdfId: number) => {
    const settings = {
      ocrEnabled: queries.getSetting(db, 'ocrEnabled') === 'true',
      ocrLanguages: safeJsonParse(queries.getSetting(db, 'ocrLanguages'), ['deu', 'eng']),
    };

    if (!settings.ocrEnabled) {
      return { success: false, error: 'OCR ist deaktiviert' };
    }

    const pdf = queries.getPdfById(db, pdfId);
    if (!pdf) {
      return { success: false, error: 'PDF nicht gefunden' };
    }

    if (ocrStatus.isProcessing) {
      return { success: false, error: 'OCR läuft bereits' };
    }

    // Start OCR in background
    processOCRForPdf(db, mainWindow, pdf, settings.ocrLanguages);
    return { success: true };
  });

  // Force OCR for all PDFs (reset ocrCompleted flag)
  ipcMain.handle(IPC_CHANNELS.FORCE_OCR, async () => {
    const settings = {
      ocrEnabled: queries.getSetting(db, 'ocrEnabled') === 'true',
      ocrLanguages: safeJsonParse(queries.getSetting(db, 'ocrLanguages'), ['deu', 'eng']),
    };

    if (!settings.ocrEnabled) {
      return { success: false, error: 'OCR ist deaktiviert' };
    }

    if (ocrStatus.isProcessing) {
      return { success: false, error: 'OCR läuft bereits' };
    }

    // Reset all ocrCompleted flags
    queries.resetAllOcrCompleted(db);

    // Get all PDFs (they all need OCR now)
    const allPdfs = queries.getAllPdfs(db).filter(pdf => pdf.indexedAt);
    if (allPdfs.length === 0) {
      return { success: true, message: 'Keine indexierten PDFs vorhanden' };
    }

    // Start processing in background
    processOCRQueue(db, mainWindow, allPdfs, settings.ocrLanguages);
    return { success: true, queuedPdfs: allPdfs.length };
  });

  // Start OCR for all PDFs that need it
  ipcMain.handle(IPC_CHANNELS.START_OCR, async () => {
    const settings = {
      ocrEnabled: queries.getSetting(db, 'ocrEnabled') === 'true',
      ocrLanguages: safeJsonParse(queries.getSetting(db, 'ocrLanguages'), ['deu', 'eng']),
    };

    if (!settings.ocrEnabled) {
      return { success: false, error: 'OCR ist deaktiviert' };
    }

    if (ocrStatus.isProcessing) {
      return { success: false, error: 'OCR läuft bereits' };
    }

    // Get all PDFs that need OCR
    const pdfsNeedingOCR = queries.getPdfsNeedingOCR(db);
    if (pdfsNeedingOCR.length === 0) {
      return { success: true, message: 'Keine PDFs benötigen OCR' };
    }

    // Start processing in background
    processOCRQueue(db, mainWindow, pdfsNeedingOCR, settings.ocrLanguages);
    return { success: true, queuedPdfs: pdfsNeedingOCR.length };
  });
}

// Process OCR for a single PDF
async function processOCRForPdf(
  db: DatabaseInstance,
  mainWindow: BrowserWindow,
  pdf: { id: number; filePath: string; fileName: string; pageCount: number },
  languages: string[]
): Promise<void> {
  setOcrCancelled(false);

  // Find pages that need OCR
  const pagesToProcess: number[] = [];
  for (let pageNum = 1; pageNum <= pdf.pageCount; pageNum++) {
    const existingContent = queries.getPageContent(db, pdf.id, pageNum);
    if (pageNeedsOCR(existingContent || '')) {
      pagesToProcess.push(pageNum);
    }
  }

  if (pagesToProcess.length === 0) {
    // No pages need OCR, mark as completed
    queries.markPdfOcrCompleted(db, pdf.id);
    return;
  }

  setOcrStatus({
    isProcessing: true,
    pdfId: pdf.id,
    fileName: pdf.fileName,
    currentPage: 0,
    totalPages: pdf.pageCount,
    pagesNeedingOCR: pagesToProcess.length,
    processedPages: 0,
    queuedPdfs: 0,
  });
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);

  let contentSaved = false;

  for (const pageNum of pagesToProcess) {
    if (ocrCancelled) break;

    updateOcrStatus({ currentPage: pageNum });
    mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);

    try {
      const result = await processPageOCR(pdf.filePath, pageNum, languages);

      if (result && result.content) {
        // Update the page content in the database
        queries.updatePageContent(db, pdf.id, pageNum, result.content);
        contentSaved = true;
        console.log(`OCR saved for page ${pageNum}: ${result.content.substring(0, 50)}...`);
      }

      updateOcrStatus({ processedPages: ocrStatus.processedPages + 1 });
      mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
    } catch (error) {
      console.error(`OCR error on page ${pageNum} of ${pdf.fileName}:`, error);
    }
  }

  // Only mark as completed if we actually saved some content or processed all pages
  if (!ocrCancelled && (contentSaved || pagesToProcess.length === 0)) {
    queries.markPdfOcrCompleted(db, pdf.id);
  }

  // Clear PDF cache after processing to free memory
  clearPdfCache();

  // Invalidate search cache since content changed
  clearSearchCache();

  updateOcrStatus({
    isProcessing: false,
    pdfId: null,
    fileName: null,
  });
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
}

// Process OCR queue for multiple PDFs
async function processOCRQueue(
  db: DatabaseInstance,
  mainWindow: BrowserWindow,
  pdfs: { id: number; filePath: string; fileName: string; pageCount: number }[],
  languages: string[]
): Promise<void> {
  setOcrCancelled(false);
  updateOcrStatus({ queuedPdfs: pdfs.length });
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);

  for (const pdf of pdfs) {
    if (ocrCancelled) break;

    await processOCRForPdf(db, mainWindow, pdf, languages);
    updateOcrStatus({ queuedPdfs: ocrStatus.queuedPdfs - 1 });
    mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
  }

  // Cleanup worker when done
  await terminateWorker();

  setOcrStatus({
    isProcessing: false,
    pdfId: null,
    fileName: null,
    currentPage: 0,
    totalPages: 0,
    pagesNeedingOCR: 0,
    processedPages: 0,
    queuedPdfs: 0,
  });
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
}
