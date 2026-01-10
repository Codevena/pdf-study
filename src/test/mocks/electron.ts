// Mock for Electron modules in tests
export const app = {
  getPath: (name: string) => `/tmp/pdf-study-test/${name}`,
  isPackaged: false,
};

export const ipcMain = {
  handle: () => {},
  on: () => {},
};

export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
};

export const BrowserWindow = class {
  webContents = {
    send: () => {},
    openDevTools: () => {},
  };
  loadURL = async () => {};
  loadFile = async () => {};
  show = () => {};
  on = () => {};
  once = () => {};
};

export const protocol = {
  registerSchemesAsPrivileged: () => {},
  handle: () => {},
};

export const net = {
  fetch: async () => new Response(),
};

export default {
  app,
  ipcMain,
  dialog,
  BrowserWindow,
  protocol,
  net,
};
