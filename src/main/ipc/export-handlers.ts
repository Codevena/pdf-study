import { ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import * as queries from '../database/queries';
import * as linkQueries from '../database/link-queries';
import { generateMarkdown, generateMarkdownEnhanced } from '../export/markdown';
import { parseWikiLinks } from '../links/parser';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { ExportOptions } from '../../shared/types';
import type { HandlerContext } from './types';

export function registerExportHandlers({ db, mainWindow }: HandlerContext): void {
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

  // Batch Export All PDFs
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
    const parsedLinks = parseWikiLinks(linkText);

    if (parsedLinks.length === 0) {
      return null;
    }

    const parsed = parsedLinks[0];
    const pdf = queries.getPdfByFileName(db, parsed.fileName);

    if (!pdf) {
      return null;
    }

    // Validate page number is within range
    const pageNum = parsed.pageNum && parsed.pageNum >= 1 && parsed.pageNum <= pdf.pageCount
      ? parsed.pageNum
      : 1;

    return {
      pdf,
      pageNum,
    };
  });

  ipcMain.handle(IPC_CHANNELS.GET_LINK_GRAPH, (_, includeUnlinked: boolean = false) => {
    return linkQueries.getLinkGraph(db, includeUnlinked);
  });
}
