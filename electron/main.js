const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Définir l'identité et le modèle d'application Windows pour la barre des tâches
app.name = 'Commerce Pro';
try {
  app.setAppUserModelId('com.hasoftwares.commercepro');
} catch (e) {}

// Définir le dossier persistant userData de Commerce Pro (avec migration automatique depuis commercepost si existant)
try {
  const appDataDir = app.getPath('appData');
  const customUserData = path.join(appDataDir, 'commercepro');
  const oldUserData = path.join(appDataDir, 'commercepost');

  if (!fs.existsSync(customUserData) && fs.existsSync(oldUserData)) {
    try {
      fs.cpSync(oldUserData, customUserData, { recursive: true });
    } catch (e) {}
  }

  if (!fs.existsSync(customUserData)) {
    fs.mkdirSync(customUserData, { recursive: true });
  }
  app.setPath('userData', customUserData);
} catch (e) {}

// Activer les accélérations matérielles et le démarrage instantané
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Empêcher les doublons d'instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

const { connectDB, getStatus } = require('./database/connection');
const { registerStockHandlers } = require('./ipc/stockHandler');
const { registerPurchaseHandlers } = require('./ipc/purchaseHandler');
const { registerInvoiceHandlers } = require('./ipc/invoiceHandler');
const { registerCustomerHandlers } = require('./ipc/customerHandler');
const { registerDashboardHandlers } = require('./ipc/dashboardHandler');
const { registerPrintHandlers } = require('./ipc/printHandler');
const { registerLicenseHandlers } = require('./ipc/licenseHandler');
const { registerReturnHandlers } = require('./ipc/returnHandler');
const { registerTreasuryHandlers } = require('./ipc/treasuryHandler');
const { registerLossHandlers } = require('./ipc/lossHandler');
const { registerSupplierHandlers } = require('./ipc/supplierHandler');
const { registerAuthHandlers } = require('./ipc/authHandler');
const { registerReparationHandlers } = require('./ipc/reparationHandler');
const { registerUpdateHandlers } = require('./ipc/updateHandler');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
let ipcRegistered = false;

function setupIPC(win) {
  if (ipcRegistered) return;
  ipcRegistered = true;

  registerAuthHandlers(win);
  registerReparationHandlers(win);
  registerStockHandlers(win);
  registerPurchaseHandlers(win);
  registerInvoiceHandlers(win);
  registerReturnHandlers(win);
  registerCustomerHandlers(win);
  registerSupplierHandlers(win);
  registerTreasuryHandlers(win);
  registerLossHandlers(win);
  registerDashboardHandlers(win);
  registerPrintHandlers(win);
  registerLicenseHandlers(win);
  registerUpdateHandlers(win);

  ipcMain.handle('db:getStatus', async () => {
    return getStatus();
  });

  ipcMain.handle('db:reconnect', async () => {
    return await connectDB();
  });
}

async function createWindow() {
  let winIcon = null;
  try {
    const exeDir = path.dirname(app.getPath('exe'));
    const diskIco = path.join(exeDir, 'icon.ico');
    const diskPng = path.join(exeDir, 'icon.png');
    const bundledIco = path.join(__dirname, '../assets/icon.ico');
    const bundledPng = path.join(__dirname, '../assets/icon.png');

    let iconFile = null;
    if (fs.existsSync(diskIco)) iconFile = diskIco;
    else if (fs.existsSync(diskPng)) iconFile = diskPng;
    else if (fs.existsSync(bundledIco)) iconFile = bundledIco;
    else if (fs.existsSync(bundledPng)) iconFile = bundledPng;

    if (iconFile) {
      winIcon = nativeImage.createFromPath(iconFile);
    }
  } catch (e) {}

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Commerce Pro - Gestion Commerciale, Stock & SAV',
    icon: winIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false
    },
    show: true,
    backgroundColor: '#0f172a'
  });

  setupIPC(mainWindow);

  const distIndex = path.join(__dirname, '../dist/index.html');

  if (app.isPackaged) {
    mainWindow.loadFile(distIndex);
  } else if (process.env.NODE_ENV === 'development') {
    const http = require('http');
    const checkVite = http.get('http://127.0.0.1:5173', (res) => {
      mainWindow.loadURL('http://127.0.0.1:5173');
    });
    checkVite.on('error', () => {
      console.warn('[Vite non démarré sur port 5173 -> Chargement depuis dist/index.html]');
      if (fs.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      }
    });
    checkVite.setTimeout(1000, () => {
      checkVite.destroy();
      if (fs.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      }
    });
  } else {
    if (fs.existsSync(distIndex)) {
      mainWindow.loadFile(distIndex);
    }
  }

  // Protection contre la fermeture accidentelle ou rafraîchissement destructif (F5 / Ctrl+W) tout en relayant F5 à l'app
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5') {
      event.preventDefault();
      if (input.type === 'keyDown') {
        mainWindow.webContents.send('shortcut:f5');
      }
    }
    if (input.control && input.key.toLowerCase() === 'w') {
      event.preventDefault();
    }
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
    if (input.control && input.key.toLowerCase() === 'r') {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE ${level}]: ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[PAGE LOADED SUCCESSFULLY]');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // Navigation intentionnellement avortée
    console.error(`[DID-FAIL-LOAD]: ${errorCode} - ${errorDescription} (${validatedURL})`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[RENDER PROCESS GONE]:', details);
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Initialisation de l'application
app.whenReady().then(async () => {
  try {
    await connectDB();
    await createWindow();
  } catch (err) {
    console.error('Erreur démarrage app:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
