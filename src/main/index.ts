import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import { initDatabase } from './database';
import { registerIpcHandlers } from './ipc';
import { startFileWatcher, stopFileWatcher } from './file-watcher';
import * as queries from './database/queries';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

// Register custom protocol for efficient PDF loading (no base64, direct streaming)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-pdf',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Register protocol handler for local PDF files
  // This allows PDF.js to load PDFs directly from disk without base64 encoding
  protocol.handle('local-pdf', async (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-pdf://', ''));
    return net.fetch(`file://${filePath}`);
  });

  // Initialize database
  const db = await initDatabase();

  // Register IPC handlers
  registerIpcHandlers(db, mainWindow);

  // Start file watcher if folder is configured
  const pdfFolder = queries.getSetting(db, 'pdfFolder');
  if (pdfFolder) {
    startFileWatcher(pdfFolder, db, mainWindow);
  }

  // Load the app
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    // Show window when clicking dock icon on macOS
    mainWindow.show();
    mainWindow.focus();
  }
});
