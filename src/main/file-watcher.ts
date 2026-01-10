import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { BrowserWindow } from 'electron';
import type { DatabaseInstance } from './database';
import * as queries from './database/queries';
import { extractTextFromPDF, computeFileHash } from './pdf/extractor';
import { IPC_CHANNELS } from '../shared/ipc-channels';

let watcher: FSWatcher | null = null;

export function startFileWatcher(
  folderPath: string,
  db: DatabaseInstance,
  mainWindow: BrowserWindow
) {
  // Stop existing watcher if any
  stopFileWatcher();

  console.log('Starting file watcher for:', folderPath);

  watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // don't trigger for existing files
    depth: 10, // scan subdirectories
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  // New PDF added
  watcher.on('add', async (filePath) => {
    if (!filePath.toLowerCase().endsWith('.pdf')) return;

    console.log('New PDF detected:', filePath);

    try {
      await indexSinglePdf(filePath, db);
      const pdfs = queries.getAllPdfs(db);
      mainWindow.webContents.send(IPC_CHANNELS.PDF_ADDED, pdfs);
    } catch (error) {
      console.error('Error indexing new PDF:', error);
    }
  });

  // PDF modified
  watcher.on('change', async (filePath) => {
    if (!filePath.toLowerCase().endsWith('.pdf')) return;

    console.log('PDF modified:', filePath);

    try {
      await indexSinglePdf(filePath, db);
      const pdfs = queries.getAllPdfs(db);
      mainWindow.webContents.send(IPC_CHANNELS.PDF_ADDED, pdfs);
    } catch (error) {
      console.error('Error re-indexing PDF:', error);
    }
  });

  // PDF deleted
  watcher.on('unlink', (filePath) => {
    if (!filePath.toLowerCase().endsWith('.pdf')) return;

    console.log('PDF removed:', filePath);

    try {
      const existingPdf = queries.getPdfByPath(db, filePath);
      if (existingPdf) {
        queries.deletePdf(db, existingPdf.id);
        const pdfs = queries.getAllPdfs(db);
        mainWindow.webContents.send(IPC_CHANNELS.PDF_REMOVED, pdfs);
      }
    } catch (error) {
      console.error('Error removing PDF from index:', error);
    }
  });

  watcher.on('error', (error) => {
    console.error('File watcher error:', error);
  });
}

export function stopFileWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('File watcher stopped');
  }
}

async function indexSinglePdf(filePath: string, db: DatabaseInstance) {
  const fileHash = await computeFileHash(filePath);
  const existingPdf = queries.getPdfByPath(db, filePath);

  // Skip if already indexed with same hash
  if (existingPdf && existingPdf.fileHash === fileHash && existingPdf.indexedAt) {
    return;
  }

  // Extract text from PDF
  const pdfInfo = await extractTextFromPDF(filePath);

  let pdfId: number;

  if (existingPdf) {
    // Update existing PDF
    queries.deletePageContent(db, existingPdf.id);
    queries.updatePdfHash(db, existingPdf.id, fileHash, pdfInfo.pageCount);
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
  for (const page of pdfInfo.pages) {
    if (page.content.trim()) {
      queries.insertPageContent(db, pdfId, page.pageNum, page.content);
    }
  }

  queries.updatePdfIndexed(db, pdfId);
}
