import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import type { DatabaseInstance } from './database';
import * as queries from './database/queries';
import { extractTextFromPDF, computeFileHash, findPDFsInFolder, extractOutline } from './pdf/extractor';
import { pageNeedsOCR, processPageOCR, terminateWorker } from './pdf/ocr';
import { startFileWatcher } from './file-watcher';
import { generateMarkdown } from './export/markdown';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { AppSettings, IndexingStatus, OCRStatus, HighlightRect } from '../shared/types';

let indexingStatus: IndexingStatus = {
  isIndexing: false,
  totalFiles: 0,
  processedFiles: 0,
  currentFile: null,
};

let ocrStatus: OCRStatus = {
  isProcessing: false,
  pdfId: null,
  fileName: null,
  currentPage: 0,
  totalPages: 0,
  pagesNeedingOCR: 0,
  processedPages: 0,
  queuedPdfs: 0,
};

let ocrCancelled = false;

export function registerIpcHandlers(db: DatabaseInstance, mainWindow: BrowserWindow) {
  // Folder Selection
  ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'PDF-Ordner auswählen',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0];
    queries.setSetting(db, 'pdfFolder', folderPath);

    // Start file watcher for the new folder
    startFileWatcher(folderPath, db, mainWindow);

    return folderPath;
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): AppSettings => {
    return {
      pdfFolder: queries.getSetting(db, 'pdfFolder'),
      theme: (queries.getSetting(db, 'theme') as 'light' | 'dark') || 'light',
      ocrEnabled: queries.getSetting(db, 'ocrEnabled') === 'true',
      ocrLanguages: JSON.parse(queries.getSetting(db, 'ocrLanguages') || '["deu", "eng"]'),
      searchLimit: parseInt(queries.getSetting(db, 'searchLimit') || '100', 10),
      searchMode: (queries.getSetting(db, 'searchMode') as 'exact' | 'fuzzy' | 'intelligent') || 'intelligent',
    };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_, settings: Partial<AppSettings>) => {
    if (settings.pdfFolder !== undefined && settings.pdfFolder !== null) {
      queries.setSetting(db, 'pdfFolder', settings.pdfFolder);
    }
    if (settings.theme !== undefined) {
      queries.setSetting(db, 'theme', settings.theme);
    }
    if (settings.ocrEnabled !== undefined) {
      queries.setSetting(db, 'ocrEnabled', String(settings.ocrEnabled));
    }
    if (settings.ocrLanguages !== undefined) {
      queries.setSetting(db, 'ocrLanguages', JSON.stringify(settings.ocrLanguages));
    }
    if (settings.searchLimit !== undefined) {
      queries.setSetting(db, 'searchLimit', String(settings.searchLimit));
    }
    if (settings.searchMode !== undefined) {
      queries.setSetting(db, 'searchMode', settings.searchMode);
    }
    return true;
  });

  // PDFs
  ipcMain.handle(IPC_CHANNELS.GET_PDFS, () => {
    return queries.getAllPdfs(db);
  });

  ipcMain.handle(IPC_CHANNELS.GET_PDF, (_, id: number) => {
    return queries.getPdfById(db, id);
  });

  ipcMain.handle(IPC_CHANNELS.GET_PDF_OUTLINE, async (_, filePath: string) => {
    return extractOutline(filePath);
  });

  // Note: PDF data is now loaded via custom protocol (local-pdf://)
  // registered in main/index.ts - no base64 overhead!

  // Indexing
  ipcMain.handle(IPC_CHANNELS.INDEX_PDFS, async () => {
    const folderPath = queries.getSetting(db, 'pdfFolder');
    if (!folderPath) {
      throw new Error('Kein PDF-Ordner ausgewählt');
    }

    const pdfFiles = await findPDFsInFolder(folderPath);

    indexingStatus = {
      isIndexing: true,
      totalFiles: pdfFiles.length,
      processedFiles: 0,
      currentFile: null,
    };

    mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);

    for (const filePath of pdfFiles) {
      try {
        indexingStatus.currentFile = path.basename(filePath);
        mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);

        const fileHash = await computeFileHash(filePath);
        const existingPdf = queries.getPdfByPath(db, filePath);

        // Skip if already indexed with same hash
        if (existingPdf && existingPdf.fileHash === fileHash && existingPdf.indexedAt) {
          indexingStatus.processedFiles++;
          continue;
        }

        // Extract text from PDF
        const pdfInfo = await extractTextFromPDF(filePath);

        let pdfId: number;

        if (existingPdf) {
          // Update existing PDF
          queries.deletePageContent(db, existingPdf.id);
          pdfId = existingPdf.id;
        } else {
          // Insert new PDF
          pdfId = queries.insertPdf(db, {
            filePath,
            fileName: path.basename(filePath),
            fileHash,
            pageCount: pdfInfo.pageCount,
          });
        }

        // Insert page content for search
        let pagesWithSufficientText = 0;
        const MIN_TEXT_PER_PAGE = 50; // Minimum characters to consider a page as having text

        for (const page of pdfInfo.pages) {
          if (page.content.trim()) {
            queries.insertPageContent(db, pdfId, page.pageNum, page.content);
            if (page.content.trim().length >= MIN_TEXT_PER_PAGE) {
              pagesWithSufficientText++;
            }
          }
        }

        // Only mark as OCR completed if ALL pages have sufficient text
        // This ensures scanned PDFs (which may have some OCR text but not enough)
        // will still be processed by OCR
        if (pagesWithSufficientText === pdfInfo.pageCount) {
          queries.markPdfOcrCompleted(db, pdfId);
        }
        queries.updatePdfIndexed(db, pdfId);
        indexingStatus.processedFiles++;
        mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);
      } catch (error) {
        console.error(`Error indexing ${filePath}:`, error);
        indexingStatus.processedFiles++;
      }
    }

    indexingStatus.isIndexing = false;
    indexingStatus.currentFile = null;
    mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);

    return queries.getAllPdfs(db);
  });

  ipcMain.handle(IPC_CHANNELS.GET_INDEXING_STATUS, () => {
    return indexingStatus;
  });

  // Search
  ipcMain.handle(IPC_CHANNELS.SEARCH, (_, query: string) => {
    const searchLimit = parseInt(queries.getSetting(db, 'searchLimit') || '100', 10);
    const searchMode = (queries.getSetting(db, 'searchMode') as 'exact' | 'fuzzy' | 'intelligent') || 'intelligent';
    return queries.search(db, query, searchLimit, searchMode);
  });

  // Bookmarks
  ipcMain.handle(IPC_CHANNELS.GET_BOOKMARKS, (_, pdfId?: number) => {
    return queries.getBookmarks(db, pdfId);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_BOOKMARK, (_, pdfId: number, pageNum: number, title?: string) => {
    return queries.addBookmark(db, pdfId, pageNum, title);
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_BOOKMARK, (_, pdfId: number, pageNum: number) => {
    queries.removeBookmark(db, pdfId, pageNum);
    return true;
  });

  // Notes
  ipcMain.handle(IPC_CHANNELS.GET_NOTES, (_, pdfId: number, pageNum?: number) => {
    return queries.getNotes(db, pdfId, pageNum);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_NOTE, (_, pdfId: number, pageNum: number, content: string) => {
    return queries.addNote(db, pdfId, pageNum, content);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_NOTE, (_, id: number, content: string) => {
    queries.updateNote(db, id, content);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_NOTE, (_, id: number) => {
    queries.deleteNote(db, id);
    return true;
  });

  // Recent Views
  ipcMain.handle(IPC_CHANNELS.GET_RECENT_VIEWS, (_, limit?: number) => {
    return queries.getRecentViews(db, limit);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_RECENT_VIEW, (_, pdfId: number, pageNum?: number) => {
    queries.addRecentView(db, pdfId, pageNum);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_RECENT_VIEW_PAGE, (_, pdfId: number, pageNum: number) => {
    queries.updateRecentViewPage(db, pdfId, pageNum);
    return true;
  });

  // Search History
  ipcMain.handle(IPC_CHANNELS.GET_SEARCH_HISTORY, (_, limit?: number) => {
    return queries.getSearchHistory(db, limit);
  });

  ipcMain.handle(IPC_CHANNELS.ADD_SEARCH_HISTORY, (_, query: string, resultCount: number) => {
    queries.addSearchHistory(db, query, resultCount);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_SEARCH_HISTORY_ITEM, (_, id: number) => {
    queries.deleteSearchHistoryItem(db, id);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_SEARCH_HISTORY, () => {
    queries.clearSearchHistory(db);
    return true;
  });

  // Tags
  ipcMain.handle(IPC_CHANNELS.GET_TAGS, () => {
    return queries.getAllTags(db);
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_TAG, (_, name: string, color?: string) => {
    return queries.createTag(db, name, color);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_TAG, (_, id: number) => {
    queries.deleteTag(db, id);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.ADD_TAG_TO_PDF, (_, pdfId: number, tagId: number) => {
    queries.addTagToPdf(db, pdfId, tagId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_TAG_FROM_PDF, (_, pdfId: number, tagId: number) => {
    queries.removeTagFromPdf(db, pdfId, tagId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_PDF_TAGS, (_, pdfId: number) => {
    return queries.getPdfTags(db, pdfId);
  });

  // Export
  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF_DATA, async (_, pdfId: number) => {
    const pdf = queries.getPdfById(db, pdfId);
    if (!pdf) {
      return { success: false, error: 'PDF nicht gefunden' };
    }

    const bookmarks = queries.getBookmarks(db, pdfId);
    const notes = queries.getNotes(db, pdfId);
    const tags = queries.getPdfTags(db, pdfId);
    const highlights = queries.getHighlights(db, pdfId);

    const markdown = generateMarkdown(pdf, bookmarks, notes, highlights, tags);

    // Show save dialog
    const defaultFileName = pdf.fileName.replace(/\.pdf$/i, '.md');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export speichern',
      defaultPath: defaultFileName,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      await fs.writeFile(result.filePath, markdown, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error('Export error:', error);
      return { success: false, error: 'Fehler beim Speichern' };
    }
  });

  // Highlight Handlers
  ipcMain.handle(IPC_CHANNELS.GET_HIGHLIGHTS, (_, pdfId: number, pageNum?: number) => {
    return queries.getHighlights(db, pdfId, pageNum);
  });

  ipcMain.handle(
    IPC_CHANNELS.ADD_HIGHLIGHT,
    (_, pdfId: number, pageNum: number, color: string, textContent: string, rects: HighlightRect[]) => {
      return queries.addHighlight(db, pdfId, pageNum, color, textContent, rects);
    }
  );

  ipcMain.handle(IPC_CHANNELS.UPDATE_HIGHLIGHT_COLOR, (_, id: number, color: string) => {
    queries.updateHighlightColor(db, id, color);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_HIGHLIGHT, (_, id: number) => {
    queries.deleteHighlight(db, id);
    return true;
  });

  // OCR Handlers
  ipcMain.handle(IPC_CHANNELS.GET_OCR_STATUS, () => {
    return ocrStatus;
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_OCR, async () => {
    ocrCancelled = true;
    await terminateWorker();
    ocrStatus = {
      isProcessing: false,
      pdfId: null,
      fileName: null,
      currentPage: 0,
      totalPages: 0,
      pagesNeedingOCR: 0,
      processedPages: 0,
      queuedPdfs: 0,
    };
    mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
    return true;
  });

  // Start OCR for a specific PDF
  ipcMain.handle(IPC_CHANNELS.START_OCR_FOR_PDF, async (_, pdfId: number) => {
    const settings = {
      ocrEnabled: queries.getSetting(db, 'ocrEnabled') === 'true',
      ocrLanguages: JSON.parse(queries.getSetting(db, 'ocrLanguages') || '["deu", "eng"]'),
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
      ocrLanguages: JSON.parse(queries.getSetting(db, 'ocrLanguages') || '["deu", "eng"]'),
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
      ocrLanguages: JSON.parse(queries.getSetting(db, 'ocrLanguages') || '["deu", "eng"]'),
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
) {
  ocrCancelled = false;

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

  ocrStatus = {
    isProcessing: true,
    pdfId: pdf.id,
    fileName: pdf.fileName,
    currentPage: 0,
    totalPages: pdf.pageCount,
    pagesNeedingOCR: pagesToProcess.length,
    processedPages: 0,
    queuedPdfs: 0,
  };
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);

  let contentSaved = false;

  for (const pageNum of pagesToProcess) {
    if (ocrCancelled) break;

    ocrStatus.currentPage = pageNum;
    mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);

    try {
      const result = await processPageOCR(pdf.filePath, pageNum, languages);

      if (result && result.content) {
        // Update the page content in the database
        queries.updatePageContent(db, pdf.id, pageNum, result.content);
        contentSaved = true;
        console.log(`OCR saved for page ${pageNum}: ${result.content.substring(0, 50)}...`);
      }

      ocrStatus.processedPages++;
      mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
    } catch (error) {
      console.error(`OCR error on page ${pageNum} of ${pdf.fileName}:`, error);
    }
  }

  // Only mark as completed if we actually saved some content or processed all pages
  if (!ocrCancelled && (contentSaved || pagesToProcess.length === 0)) {
    queries.markPdfOcrCompleted(db, pdf.id);
  }

  ocrStatus.isProcessing = false;
  ocrStatus.pdfId = null;
  ocrStatus.fileName = null;
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
}

// Process OCR queue for multiple PDFs
async function processOCRQueue(
  db: DatabaseInstance,
  mainWindow: BrowserWindow,
  pdfs: { id: number; filePath: string; fileName: string; pageCount: number }[],
  languages: string[]
) {
  ocrCancelled = false;
  ocrStatus.queuedPdfs = pdfs.length;
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);

  for (const pdf of pdfs) {
    if (ocrCancelled) break;

    await processOCRForPdf(db, mainWindow, pdf, languages);
    ocrStatus.queuedPdfs--;
    mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
  }

  // Cleanup worker when done
  await terminateWorker();

  ocrStatus = {
    isProcessing: false,
    pdfId: null,
    fileName: null,
    currentPage: 0,
    totalPages: 0,
    pagesNeedingOCR: 0,
    processedPages: 0,
    queuedPdfs: 0,
  };
  mainWindow.webContents.send(IPC_CHANNELS.OCR_PROGRESS, ocrStatus);
}
