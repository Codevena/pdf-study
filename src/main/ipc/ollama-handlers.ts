import { ipcMain } from 'electron';
import { checkOllamaStatus } from '../ai/ollama-detection';
import * as queries from '../database/queries';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { HandlerContext } from './types';

export function registerOllamaHandlers({ db }: HandlerContext): void {
  // Check Ollama status
  ipcMain.handle(IPC_CHANNELS.OLLAMA_CHECK_STATUS, async () => {
    const baseUrl = queries.getSetting(db, 'ollamaBaseUrl') || 'http://localhost:11434';
    return checkOllamaStatus(baseUrl);
  });
}
