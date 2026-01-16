import { ipcMain, dialog } from 'electron';
import * as queries from '../database/queries';
import { startFileWatcher } from '../file-watcher';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { AppSettings } from '../../shared/types';
import type { HandlerContext } from './types';
import { safeJsonParse } from './utils';

export function registerSettingsHandlers({ db, mainWindow }: HandlerContext): void {
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
      // AI Provider Settings
      aiProvider: (queries.getSetting(db, 'aiProvider') as 'openai' | 'ollama') || 'openai',
      // OpenAI Settings
      openaiApiKey: queries.getSetting(db, 'openaiApiKey'),
      openaiModel: (queries.getSetting(db, 'openaiModel') as 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2') || 'gpt-5-mini',
      // Ollama Settings
      ollamaModel: queries.getSetting(db, 'ollamaModel') || 'llama3.1',
      ollamaBaseUrl: queries.getSetting(db, 'ollamaBaseUrl') || 'http://localhost:11434',
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
    // AI Provider Settings
    if (settings.aiProvider !== undefined) {
      queries.setSetting(db, 'aiProvider', settings.aiProvider);
    }
    // OpenAI Settings
    if (settings.openaiApiKey !== undefined) {
      queries.setSetting(db, 'openaiApiKey', settings.openaiApiKey || '');
    }
    if (settings.openaiModel !== undefined) {
      queries.setSetting(db, 'openaiModel', settings.openaiModel);
    }
    // Ollama Settings
    if (settings.ollamaModel !== undefined) {
      queries.setSetting(db, 'ollamaModel', settings.ollamaModel);
    }
    if (settings.ollamaBaseUrl !== undefined) {
      queries.setSetting(db, 'ollamaBaseUrl', settings.ollamaBaseUrl);
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
}
