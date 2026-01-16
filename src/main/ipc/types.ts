import type { BrowserWindow } from 'electron';
import type { DatabaseInstance } from '../database';

/**
 * Context passed to all handler registration functions
 */
export interface HandlerContext {
  db: DatabaseInstance;
  mainWindow: BrowserWindow;
}
