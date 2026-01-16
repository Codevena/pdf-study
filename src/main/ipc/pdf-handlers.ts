import { ipcMain } from 'electron';
import path from 'path';
import * as queries from '../database/queries';
import { extractTextFromPDF, extractTextFromPages, computeFileHash, findPDFsInFolder, extractOutline } from '../pdf/extractor';
import { generateOutlineFromText } from '../flashcards/ai-generator';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { HandlerContext } from './types';
import {
  indexingStatus,
  updateIndexingStatus,
  getCachedSearchResults,
  setCachedSearchResults,
  clearSearchCache,
} from './state';

export function registerPdfHandlers({ db, mainWindow }: HandlerContext): void {
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

  // AI-based outline generation
  ipcMain.handle(IPC_CHANNELS.GENERATE_AI_OUTLINE, async (_, filePath: string, pageCount: number) => {
    const apiKey = queries.getSetting(db, 'openaiApiKey');
    if (!apiKey) {
      return { success: false, error: 'Kein OpenAI API-Schlussel konfiguriert' };
    }

    const model = (queries.getSetting(db, 'openaiModel') as 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2') || 'gpt-5-mini';

    try {
      // Extract text from first 15 pages (usually contains TOC)
      const pagesToExtract = Math.min(15, pageCount);
      const pageNumbers = Array.from({ length: pagesToExtract }, (_, i) => i + 1);
      const { text } = await extractTextFromPages(filePath, pageNumbers);

      if (!text || text.length < 100) {
        return { success: false, error: 'Nicht genug Text gefunden. Moglicherweise ist OCR erforderlich.' };
      }

      const { outline, usage } = await generateOutlineFromText(apiKey, text, model, pageCount);

      // Track API usage
      queries.addApiUsage(
        db,
        usage.model,
        'outline_generation',
        usage.promptTokens,
        usage.completionTokens,
        usage.costUsd
      );

      return { success: true, outline };
    } catch (error: any) {
      console.error('AI Outline generation error:', error);
      return { success: false, error: error.message || 'Fehler bei der KI-Generierung' };
    }
  });

  // Get saved AI outline
  ipcMain.handle(IPC_CHANNELS.GET_AI_OUTLINE, (_, pdfId: number) => {
    const outlineJson = queries.getAiOutline(db, pdfId);
    if (outlineJson) {
      try {
        return { success: true, outline: JSON.parse(outlineJson) };
      } catch {
        return { success: false, error: 'Fehler beim Parsen des Outlines' };
      }
    }
    return { success: false, outline: null };
  });

  // Save AI outline
  ipcMain.handle(IPC_CHANNELS.SAVE_AI_OUTLINE, (_, pdfId: number, outline: any[]) => {
    try {
      queries.saveAiOutline(db, pdfId, JSON.stringify(outline));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Indexing
  ipcMain.handle(IPC_CHANNELS.INDEX_PDFS, async () => {
    const folderPath = queries.getSetting(db, 'pdfFolder');
    if (!folderPath) {
      throw new Error('Kein PDF-Ordner ausgewählt');
    }

    const pdfFiles = await findPDFsInFolder(folderPath);

    updateIndexingStatus({
      isIndexing: true,
      totalFiles: pdfFiles.length,
      processedFiles: 0,
      currentFile: null,
    });

    mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);

    for (const filePath of pdfFiles) {
      try {
        updateIndexingStatus({ currentFile: path.basename(filePath) });
        mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);

        const fileHash = await computeFileHash(filePath);
        const existingPdf = queries.getPdfByPath(db, filePath);

        // Skip if already indexed with same hash
        if (existingPdf && existingPdf.fileHash === fileHash && existingPdf.indexedAt) {
          updateIndexingStatus({ processedFiles: indexingStatus.processedFiles + 1 });
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
        const MIN_TEXT_PER_PAGE = 50;

        for (const page of pdfInfo.pages) {
          if (page.content.trim()) {
            queries.insertPageContent(db, pdfId, page.pageNum, page.content);
            if (page.content.trim().length >= MIN_TEXT_PER_PAGE) {
              pagesWithSufficientText++;
            }
          }
        }

        // Only mark as OCR completed if ALL pages have sufficient text
        if (pagesWithSufficientText === pdfInfo.pageCount) {
          queries.markPdfOcrCompleted(db, pdfId);
        }
        queries.updatePdfIndexed(db, pdfId);
        updateIndexingStatus({ processedFiles: indexingStatus.processedFiles + 1 });
        mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);
      } catch (error) {
        console.error(`Error indexing ${filePath}:`, error);
        updateIndexingStatus({ processedFiles: indexingStatus.processedFiles + 1 });
      }
    }

    updateIndexingStatus({
      isIndexing: false,
      currentFile: null,
    });
    mainWindow.webContents.send(IPC_CHANNELS.INDEXING_PROGRESS, indexingStatus);

    // Invalidate search cache after indexing
    clearSearchCache();

    return queries.getAllPdfs(db);
  });

  ipcMain.handle(IPC_CHANNELS.GET_INDEXING_STATUS, () => {
    return indexingStatus;
  });

  // Search (with caching for performance)
  ipcMain.handle(IPC_CHANNELS.SEARCH, (_, query: string) => {
    const searchLimit = parseInt(queries.getSetting(db, 'searchLimit') || '100', 10);
    const searchMode = (queries.getSetting(db, 'searchMode') as 'exact' | 'fuzzy' | 'intelligent') || 'intelligent';

    // Create cache key from query parameters
    const cacheKey = `${query}|${searchLimit}|${searchMode}`;

    // Check cache first
    const cachedResults = getCachedSearchResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    // Execute search and cache results
    const results = queries.search(db, query, searchLimit, searchMode);
    setCachedSearchResults(cacheKey, results);
    return results;
  });

  // PDF with progress
  ipcMain.handle(IPC_CHANNELS.PDF_GET_ALL_WITH_PROGRESS, () => {
    return queries.getAllPdfsWithProgress(db);
  });
}
