import { ipcMain } from 'electron';
import * as queries from '../database/queries';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { HandlerContext } from './types';

export function registerReadingHandlers({ db }: HandlerContext): void {
  ipcMain.handle(IPC_CHANNELS.READING_ADD_SESSION, (_, pdfId: number, pagesRead: number) => {
    queries.addReadingSession(db, pdfId, pagesRead);
    return { success: true };
  });

  ipcMain.handle(
    IPC_CHANNELS.READING_GET_HEATMAP,
    (_, timeframe: 'week' | 'month' | 'year') => {
      return queries.getReadingHeatmapData(db, timeframe);
    }
  );

  ipcMain.handle(IPC_CHANNELS.READING_GET_STATS, () => {
    return queries.getReadingStats(db);
  });

  ipcMain.handle(IPC_CHANNELS.READING_GET_GOAL, () => {
    return queries.getReadingGoal(db);
  });

  ipcMain.handle(IPC_CHANNELS.READING_SET_GOAL, (_, dailyPages: number) => {
    queries.setReadingGoal(db, dailyPages);
    return { success: true };
  });
}
