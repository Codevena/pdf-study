import type { BrowserWindow } from 'electron';
import type { DatabaseInstance } from '../database';
import type { HandlerContext } from './types';

import { registerSettingsHandlers } from './settings-handlers';
import { registerPdfHandlers } from './pdf-handlers';
import { registerAnnotationHandlers } from './annotation-handlers';
import { registerExportHandlers } from './export-handlers';
import { registerOcrHandlers } from './ocr-handlers';
import { registerFlashcardHandlers } from './flashcard-handlers';
import { registerAiHandlers } from './ai-handlers';
import { registerReadingHandlers } from './reading-handlers';

/**
 * Register all IPC handlers for the main process.
 * This is the main entry point for IPC handler registration.
 */
export function registerIpcHandlers(db: DatabaseInstance, mainWindow: BrowserWindow): void {
  const context: HandlerContext = { db, mainWindow };

  // Register handlers by feature area
  registerSettingsHandlers(context);
  registerPdfHandlers(context);
  registerAnnotationHandlers(context);
  registerExportHandlers(context);
  registerOcrHandlers(context);
  registerFlashcardHandlers(context);
  registerAiHandlers(context);
  registerReadingHandlers(context);
}

// Re-export types and state for external use
export type { HandlerContext } from './types';
export {
  indexingStatus,
  ocrStatus,
  ocrCancelled,
  getCachedSearchResults,
  setCachedSearchResults,
  clearSearchCache,
} from './state';
