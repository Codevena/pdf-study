import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import type { DatabaseInstance } from './database';
import * as queries from './database/queries';
import * as linkQueries from './database/link-queries';
import * as flashcardQueries from './flashcards/queries';
import { dbToFsrsCard, fsrsCardToDb, getNextReview, getNextIntervals } from './flashcards/fsrs';
import { generateFlashcards, generateOutlineFromText } from './flashcards/ai-generator';
import { extractTextFromPDF, extractTextFromPages, computeFileHash, findPDFsInFolder, extractOutline } from './pdf/extractor';
import { pageNeedsOCR, processPageOCR, terminateWorker, clearPdfCache } from './pdf/ocr';
import { startFileWatcher } from './file-watcher';
import { generateMarkdown, generateMarkdownEnhanced } from './export/markdown';
import { parseWikiLinks, resolveLink } from './links/parser';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { AppSettings, IndexingStatus, OCRStatus, HighlightRect, FSRSRating, OpenAIModel, GeneratedCard, ExportOptions, SearchResult } from '../shared/types';

/**
 * Safely parse JSON with a fallback value.
 * Prevents crashes from malformed JSON in database or external sources.
 */
function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn('Failed to parse JSON, using fallback:', error);
    return fallback;
  }
}

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

// LRU cache for search results (performance optimization)
// Uses Map's insertion order + delete/re-insert pattern for true LRU behavior
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const SEARCH_CACHE_MAX_SIZE = 50;
const SEARCH_CACHE_TTL = 60000; // 1 minute

function getCachedSearchResults(cacheKey: string): SearchResult[] | null {
  const cached = searchCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  // Check TTL
  if (Date.now() - cached.timestamp >= SEARCH_CACHE_TTL) {
    searchCache.delete(cacheKey);
    return null;
  }

  // LRU: Move to end by deleting and re-inserting (Map maintains insertion order)
  searchCache.delete(cacheKey);
  searchCache.set(cacheKey, cached);

  return cached.results;
}

function setCachedSearchResults(cacheKey: string, results: SearchResult[]): void {
  // If key already exists, delete first to update position
  if (searchCache.has(cacheKey)) {
    searchCache.delete(cacheKey);
  }

  // Evict oldest entries (first in Map) if cache is full
  while (searchCache.size >= SEARCH_CACHE_MAX_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) {
      searchCache.delete(oldestKey);
    } else {
      break;
    }
  }

  searchCache.set(cacheKey, { results, timestamp: Date.now() });
}

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
      ocrLanguages: safeJsonParse(queries.getSetting(db, 'ocrLanguages'), ['deu', 'eng']),
      searchLimit: parseInt(queries.getSetting(db, 'searchLimit') || '100', 10),
      searchMode: (queries.getSetting(db, 'searchMode') as 'exact' | 'fuzzy' | 'intelligent') || 'intelligent',
      // OpenAI Settings
      openaiApiKey: queries.getSetting(db, 'openaiApiKey'),
      openaiModel: (queries.getSetting(db, 'openaiModel') as 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2') || 'gpt-5-mini',
      // Flashcard Settings
      flashcardLanguage: (queries.getSetting(db, 'flashcardLanguage') as 'de' | 'en') || 'de',
      dailyNewCards: parseInt(queries.getSetting(db, 'dailyNewCards') || '20', 10),
      dailyReviewCards: parseInt(queries.getSetting(db, 'dailyReviewCards') || '100', 10),
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
    // OpenAI Settings
    if (settings.openaiApiKey !== undefined) {
      queries.setSetting(db, 'openaiApiKey', settings.openaiApiKey || '');
    }
    if (settings.openaiModel !== undefined) {
      queries.setSetting(db, 'openaiModel', settings.openaiModel);
    }
    // Flashcard Settings
    if (settings.flashcardLanguage !== undefined) {
      queries.setSetting(db, 'flashcardLanguage', settings.flashcardLanguage);
    }
    if (settings.dailyNewCards !== undefined) {
      queries.setSetting(db, 'dailyNewCards', String(settings.dailyNewCards));
    }
    if (settings.dailyReviewCards !== undefined) {
      queries.setSetting(db, 'dailyReviewCards', String(settings.dailyReviewCards));
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

    // Invalidate search cache after indexing (content may have changed)
    searchCache.clear();

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
    const noteId = queries.addNote(db, pdfId, pageNum, content);

    // Index any wiki-links in the note
    const allPdfs = queries.getAllPdfs(db);
    const parsedLinks = parseWikiLinks(content);
    if (parsedLinks.length > 0) {
      const links = parsedLinks.map(link => {
        const resolved = resolveLink(link, allPdfs);
        return {
          targetPdfId: resolved?.pdfId || null,
          targetPageNum: resolved?.pageNum || null,
          linkText: link.fullMatch,
        };
      });
      linkQueries.indexNoteLinks(db, noteId, pdfId, pageNum, links);
    }

    return noteId;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_NOTE, (_, id: number, content: string) => {
    queries.updateNote(db, id, content);

    // Re-index links for this note
    const note = queries.getNoteById(db, id);
    if (note) {
      const allPdfs = queries.getAllPdfs(db);
      const parsedLinks = parseWikiLinks(content);
      const links = parsedLinks.map(link => {
        const resolved = resolveLink(link, allPdfs);
        return {
          targetPdfId: resolved?.pdfId || null,
          targetPageNum: resolved?.pageNum || null,
          linkText: link.fullMatch,
        };
      });
      linkQueries.indexNoteLinks(db, id, note.pdfId, note.pageNum, links);
    }

    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_NOTE, (_, id: number) => {
    linkQueries.deleteNoteLinks(db, id);
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

  ipcMain.handle(IPC_CHANNELS.GET_ALL_PDF_TAGS, () => {
    return queries.getAllPdfTagsMap(db);
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

  // Enhanced Export with Options
  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF_DATA_ENHANCED, async (_, pdfId: number, options: ExportOptions) => {
    const pdf = queries.getPdfById(db, pdfId);
    if (!pdf) {
      return { success: false, error: 'PDF nicht gefunden' };
    }

    const bookmarks = queries.getBookmarks(db, pdfId);
    const notes = queries.getNotes(db, pdfId);
    const tags = queries.getPdfTags(db, pdfId);
    const highlights = queries.getHighlights(db, pdfId);
    const allPdfs = queries.getAllPdfs(db);

    const markdown = generateMarkdownEnhanced(pdf, bookmarks, notes, highlights, tags, options, allPdfs);

    // Show save dialog
    const defaultFileName = pdf.fileName.replace(/\.pdf$/i, '.md');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options.format === 'obsidian' ? 'Obsidian Export speichern' : 'Export speichern',
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
      console.error('Enhanced export error:', error);
      return { success: false, error: 'Fehler beim Speichern' };
    }
  });

  // Batch Export All PDFs - Optimized with batch queries (4 queries instead of 4*N)
  ipcMain.handle(IPC_CHANNELS.EXPORT_ALL_PDFS, async (_, options: ExportOptions) => {
    const allPdfs = queries.getAllPdfs(db);

    if (allPdfs.length === 0) {
      return { success: false, error: 'Keine PDFs zum Exportieren vorhanden' };
    }

    // Show folder selection dialog
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: options.format === 'obsidian' ? 'Obsidian Vault auswählen' : 'Export-Ordner auswählen',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const outputFolder = result.filePaths[0];
    let exportedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Fetch all data in 4 batch queries instead of 4*N queries
    const batchData = queries.getBatchExportData(db);

    for (const pdf of allPdfs) {
      try {
        // Get data from pre-fetched maps (O(1) lookup)
        const bookmarks = batchData.bookmarksByPdf.get(pdf.id) || [];
        const notes = batchData.notesByPdf.get(pdf.id) || [];
        const highlights = batchData.highlightsByPdf.get(pdf.id) || [];
        const tags = batchData.tagsByPdf[pdf.id] || [];

        const markdown = generateMarkdownEnhanced(pdf, bookmarks, notes, highlights, tags, options, allPdfs);
        const fileName = pdf.fileName.replace(/\.pdf$/i, '.md');
        await fs.writeFile(path.join(outputFolder, fileName), markdown, 'utf-8');
        exportedCount++;
      } catch (error: any) {
        failedCount++;
        errors.push(`${pdf.fileName}: ${error.message || 'Unbekannter Fehler'}`);
      }
    }

    return { success: true, exportedCount, failedCount, outputFolder, errors };
  });

  // Smart Links Handlers
  ipcMain.handle(IPC_CHANNELS.GET_LINK_SUGGESTIONS, (_, searchTerm: string) => {
    const allPdfs = queries.getAllPdfs(db);
    const term = searchTerm.toLowerCase();

    return allPdfs
      .filter(pdf => pdf.fileName.toLowerCase().includes(term))
      .slice(0, 10)
      .map(pdf => ({
        pdfId: pdf.id,
        fileName: pdf.fileName,
        pageCount: pdf.pageCount,
      }));
  });

  ipcMain.handle(IPC_CHANNELS.GET_BACKLINKS, (_, pdfId: number, pageNum?: number) => {
    return linkQueries.getBacklinks(db, pdfId, pageNum);
  });

  ipcMain.handle(IPC_CHANNELS.RESOLVE_LINK, (_, linkText: string) => {
    const allPdfs = queries.getAllPdfs(db);
    const parsedLinks = parseWikiLinks(linkText);

    if (parsedLinks.length === 0) {
      return null;
    }

    const parsed = parsedLinks[0];
    const resolved = resolveLink(parsed, allPdfs);

    if (!resolved) {
      return null;
    }

    const pdf = queries.getPdfById(db, resolved.pdfId);
    if (!pdf) {
      return null;
    }

    return {
      pdf,
      pageNum: resolved.pageNum || 1,
    };
  });

  ipcMain.handle(IPC_CHANNELS.GET_LINK_GRAPH, (_, includeUnlinked: boolean = false) => {
    return linkQueries.getLinkGraph(db, includeUnlinked);
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

  // ============ FLASHCARD HANDLERS ============

  // Deck Handlers
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_DECKS, (_, pdfId?: number) => {
    return flashcardQueries.getAllDecks(db, pdfId);
  });

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_DECK, (_, id: number) => {
    return flashcardQueries.getDeckById(db, id);
  });

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_CREATE_DECK,
    (_, name: string, pdfId?: number, description?: string) => {
      return flashcardQueries.createDeck(db, name, pdfId, description);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_UPDATE_DECK,
    (_, id: number, name: string, description?: string) => {
      flashcardQueries.updateDeck(db, id, name, description);
      return true;
    }
  );

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_DELETE_DECK, (_, id: number) => {
    flashcardQueries.deleteDeck(db, id);
    return true;
  });

  // Card Handlers
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_CARDS, (_, deckId: number) => {
    return flashcardQueries.getCardsByDeck(db, deckId);
  });

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_CARD, (_, id: number) => {
    return flashcardQueries.getCardById(db, id);
  });

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_ADD_CARD,
    (
      _,
      deckId: number,
      front: string,
      back: string,
      cardType?: 'basic' | 'cloze',
      highlightId?: number,
      sourcePage?: number,
      clozeData?: string
    ) => {
      return flashcardQueries.addCard(
        db,
        deckId,
        front,
        back,
        cardType || 'basic',
        highlightId,
        sourcePage,
        clozeData
      );
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_UPDATE_CARD,
    (_, id: number, front: string, back: string, cardType?: 'basic' | 'cloze', clozeData?: string) => {
      flashcardQueries.updateCard(db, id, front, back, cardType, clozeData);
      return true;
    }
  );

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_DELETE_CARD, (_, id: number) => {
    flashcardQueries.deleteCard(db, id);
    return true;
  });

  // FSRS / Study Handlers
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_DUE, (_, deckId?: number, limit?: number) => {
    const cards = flashcardQueries.getDueCards(db, deckId, limit);
    // Add next intervals preview for each card
    return cards.map(card => ({
      ...card,
      nextIntervals: getNextIntervals(dbToFsrsCard(card.fsrs)),
    }));
  });

  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_SUBMIT_REVIEW,
    (_, flashcardId: number, rating: FSRSRating) => {
      const card = flashcardQueries.getCardById(db, flashcardId);
      if (!card) {
        throw new Error('Karte nicht gefunden');
      }

      // Get current FSRS card state
      const fsrsCard = dbToFsrsCard(card.fsrs);

      // Calculate next review
      const { card: nextCard } = getNextReview(fsrsCard, rating);

      // Convert back to DB format
      const nextFsrsData = fsrsCardToDb(nextCard);

      // Update FSRS data in database
      flashcardQueries.updateFSRS(db, flashcardId, nextFsrsData);

      // Record the review
      flashcardQueries.addReview(
        db,
        flashcardId,
        rating,
        nextFsrsData.scheduledDays,
        nextFsrsData.elapsedDays,
        nextFsrsData.state
      );

      // Return updated card with next intervals
      const updatedCard = flashcardQueries.getCardById(db, flashcardId);
      return {
        ...updatedCard,
        nextIntervals: updatedCard ? getNextIntervals(dbToFsrsCard(updatedCard.fsrs)) : null,
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.FLASHCARD_GET_STATS, (_, deckId?: number) => {
    return flashcardQueries.getStats(db, deckId);
  });

  // Heatmap Handler
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GET_HEATMAP,
    (_, timeframe: 'week' | 'month' | 'year', deckId?: number) => {
      return flashcardQueries.getHeatmapData(db, timeframe, deckId);
    }
  );

  // LearnBuddy Export Handler
  ipcMain.handle(IPC_CHANNELS.FLASHCARD_EXPORT_LEARNBUDDY, async (_, deckId: number) => {
    const cards = flashcardQueries.getCardsByDeck(db, deckId);
    const deck = flashcardQueries.getDeckById(db, deckId);

    if (!deck) {
      return { success: false, error: 'Deck nicht gefunden' };
    }

    // Generate LearnBuddy CSV format
    const csvLines = cards.map(card => {
      // Escape fields with quotes if they contain commas or quotes
      const escapeField = (field: string) => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      return `${escapeField(card.front)},${escapeField(card.back)}`;
    });

    const csvContent = csvLines.join('\n');

    // Show save dialog
    const defaultFileName = `${deck.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\-_\s]/g, '')}.csv`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'LearnBuddy Export speichern',
      defaultPath: defaultFileName,
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    try {
      await fs.writeFile(result.filePath, csvContent, 'utf-8');
      return { success: true, filePath: result.filePath, cardCount: cards.length };
    } catch (error) {
      console.error('Export error:', error);
      return { success: false, error: 'Fehler beim Speichern' };
    }
  });

  // AI Generation Handler
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GENERATE_AI,
    async (
      _,
      text: string,
      options: {
        model: OpenAIModel;
        language: 'de' | 'en';
        count: number;
      }
    ): Promise<{ success: boolean; cards?: GeneratedCard[]; error?: string }> => {
      const apiKey = queries.getSetting(db, 'openaiApiKey');

      if (!apiKey) {
        return { success: false, error: 'OpenAI API-Schlussel nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' };
      }

      try {
        const { cards, usage } = await generateFlashcards(apiKey, text, options);

        // Track API usage
        queries.addApiUsage(
          db,
          usage.model,
          'flashcard_generation',
          usage.promptTokens,
          usage.completionTokens,
          usage.costUsd
        );

        return { success: true, cards };
      } catch (error: any) {
        console.error('AI generation error:', error);
        return { success: false, error: error.message || 'Fehler bei der KI-Generierung' };
      }
    }
  );

  // Get PDF page text for AI generation
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GET_PDF_PAGE_TEXT,
    async (
      _,
      filePath: string,
      pageNumbers: number[]
    ): Promise<{ success: boolean; text?: string; pageCount?: number; error?: string }> => {
      try {
        const result = await extractTextFromPages(filePath, pageNumbers);
        return { success: true, text: result.text, pageCount: result.pageCount };
      } catch (error: any) {
        console.error('PDF text extraction error:', error);
        return { success: false, error: error.message || 'Fehler beim Extrahieren des PDF-Textes' };
      }
    }
  );

  // Generate flashcards from PDF pages
  ipcMain.handle(
    IPC_CHANNELS.FLASHCARD_GENERATE_FROM_PDF,
    async (
      _,
      filePath: string,
      pageNumbers: number[],
      options: {
        model: OpenAIModel;
        language: 'de' | 'en';
        count: number;
      }
    ): Promise<{ success: boolean; cards?: GeneratedCard[]; error?: string }> => {
      const apiKey = queries.getSetting(db, 'openaiApiKey');

      if (!apiKey) {
        return { success: false, error: 'OpenAI API-Schlussel nicht konfiguriert. Bitte in den Einstellungen hinterlegen.' };
      }

      try {
        // Extract text from the specified pages
        const { text } = await extractTextFromPages(filePath, pageNumbers);

        if (!text.trim()) {
          return { success: false, error: 'Kein Text auf den ausgewahlten Seiten gefunden.' };
        }

        // Generate flashcards from the extracted text
        const { cards, usage } = await generateFlashcards(apiKey, text, options);

        // Track API usage
        queries.addApiUsage(
          db,
          usage.model,
          'flashcard_generation_pdf',
          usage.promptTokens,
          usage.completionTokens,
          usage.costUsd
        );

        return { success: true, cards };
      } catch (error: any) {
        console.error('PDF AI generation error:', error);
        return { success: false, error: error.message || 'Fehler bei der KI-Generierung' };
      }
    }
  );

  // API Usage Stats
  ipcMain.handle(IPC_CHANNELS.API_GET_USAGE_STATS, () => {
    return queries.getApiUsageStats(db);
  });

  ipcMain.handle(IPC_CHANNELS.API_CLEAR_USAGE, () => {
    queries.clearApiUsage(db);
    return { success: true };
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

  // Clear PDF cache after processing to free memory
  clearPdfCache();

  // Invalidate search cache since content changed
  searchCache.clear();

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
