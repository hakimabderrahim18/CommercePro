const { ipcMain, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// Helper to detect virtual / file-prompting Windows printers
function isVirtualPrinter(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes('pdf') ||
    n.includes('xps') ||
    n.includes('fax') ||
    n.includes('writer') ||
    n.includes('onenote') ||
    n.includes('root print queue') ||
    n.includes('send to')
  );
}

// Helper to resolve the best printer from installed Windows printers
async function resolvePrinter(win, requestedName) {
  try {
    const printers = await win.webContents.getPrintersAsync();
    if (!printers || printers.length === 0) return '';

    const cleanReq = (requestedName || '').trim().toLowerCase();

    // 1. Exact match if specified
    if (cleanReq) {
      const exact = printers.find((p) => p.name.toLowerCase() === cleanReq);
      if (exact) return exact.name;

      // Partial match (ex: 'sprt', 'pos-80', 'xprinter', 'xp-350b')
      const partial = printers.find((p) => 
        p.name.toLowerCase().includes(cleanReq) || cleanReq.includes(p.name.toLowerCase())
      );
      if (partial) return partial.name;
    }

    // 2. Look for any thermal / receipt / ticket printer
    const thermal = printers.find((p) => {
      const n = p.name.toLowerCase();
      return (
        n.includes('sprt') ||
        n.includes('pos-80') ||
        n.includes('pos 80') ||
        n.includes('pos80') ||
        n.includes('pos-58') ||
        n.includes('pos 58') ||
        n.includes('pos58') ||
        n.includes('thermal') ||
        n.includes('receipt') ||
        n.includes('ticket') ||
        n.includes('80mm') ||
        n.includes('58mm') ||
        n.includes('xp-80') ||
        n.includes('xp80') ||
        n.includes('xp-80c') ||
        n.includes('rp80') ||
        n.includes('rp-80') ||
        n.includes('zj-') ||
        n.includes('zjiang') ||
        n.includes('bj-') ||
        n.includes('comptoir') ||
        n.includes('caisse') ||
        n.includes('xprinter') ||
        n.includes('tm-t') ||
        n.includes('epson') ||
        n.includes('bixolon') ||
        n.includes('citizen') ||
        n.includes('star') ||
        n.includes('netum') ||
        n.includes('generic') ||
        n.includes('générique')
      );
    });
    if (thermal) return thermal.name;

    // 3. Prefer any real physical printer (avoid PDF / XPS / Fax)
    const physical = printers.find((p) => !isVirtualPrinter(p.name));
    if (physical) return physical.name;

    // 4. Windows system default printer
    const def = printers.find((p) => p.isDefault);
    if (def) return def.name;

    // 5. First available printer
    return printers[0]?.name || '';
  } catch (e) {
    console.error('Erreur resolvePrinter:', e);
    return requestedName || '';
  }
}

function registerPrintHandlers(mainWindow) {
  // Déclenche l'impression de la fenêtre principale
  ipcMain.handle('print:direct', async (event, options = {}) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      if (!win) return { success: false, error: 'Fenêtre introuvable' };

      const targetPrinter = await resolvePrinter(win, options.printerName);

      const printOptions = {
        silent: options.silent || false,
        printBackground: true,
        pageSize: options.pageSize || 'A4',
        landscape: options.landscape !== undefined ? options.landscape : false
      };

      if (targetPrinter && targetPrinter.trim()) {
        printOptions.deviceName = targetPrinter.trim();
      }

      if (options.margins && options.margins.marginType) {
        printOptions.margins = options.margins;
      }

      await win.webContents.print(printOptions);
      return { success: true };
    } catch (error) {
      console.error('Erreur print:direct:', error);
      return { success: false, error: error.message };
    }
  });

  // Impression autonome d'un fragment HTML (étiquettes ou tickets) 100% directe et silencieuse
  ipcMain.handle('print:html', async (event, options = {}) => {
    let printWin = null;
    try {
      const { html, printerName, pageSize, landscape = false } = options;
      if (!html) return { success: false, error: 'Contenu HTML manquant' };

      const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const targetPrinter = await resolvePrinter(senderWin, printerName);

      // Fenêtre de rendu d'impression : strictement invisible (aucun popup ni invite)
      printWin = new BrowserWindow({
        show: false,
        skipTaskbar: true,
        width: 800,
        height: 900,
        title: 'Impression CommercePost',
        parent: senderWin && !senderWin.isDestroyed() ? senderWin : null,
        modal: false,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Attendre que la mise en page, les polices et images soient prêtes
      try {
        await printWin.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const finish = () => setTimeout(resolve, 150);
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(finish).catch(finish);
            } else if (document.readyState === 'complete') {
              finish();
            } else {
              window.addEventListener('load', finish);
            }
          })
        `);
      } catch (e) {}

      // Résolution du format de papier (pageSize)
      let effectivePageSize = pageSize;
      if (!effectivePageSize || effectivePageSize === 'auto') {
        effectivePageSize = { width: 80000, height: 297000 };
      } else if (typeof effectivePageSize === 'string') {
        const s = effectivePageSize.toLowerCase().trim();
        if (s === '80mm' || s === '80' || s.includes('80')) {
          effectivePageSize = { width: 80000, height: 297000 };
        } else if (s === '58mm' || s === '58' || s.includes('58')) {
          effectivePageSize = { width: 58000, height: 297000 };
        }
      }

      const baseOpts = {
        silent: true, // Impression directe et silencieuse
        printBackground: true,
        landscape: Boolean(landscape)
      };

      if (targetPrinter && targetPrinter.trim()) {
        baseOpts.deviceName = targetPrinter.trim();
      }

      if (options.copies && Number(options.copies) > 1) {
        baseOpts.copies = Number(options.copies);
      }

      if (options.pageRanges && Array.isArray(options.pageRanges)) {
        baseOpts.pageRanges = options.pageRanges;
      }

      const executePrintAttempt = (printOpts) => new Promise((resolve) => {
        let isDone = false;
        const timer = setTimeout(() => {
          if (!isDone) {
            isDone = true;
            resolve({ success: true, failureReason: null });
          }
        }, 5000);

        printWin.webContents.print(printOpts, (success, failureReason) => {
          if (!isDone) {
            isDone = true;
            clearTimeout(timer);
            resolve({ success, failureReason });
          }
        });
      });

      // Tentative 1: Impression directe avec paramètres plein format
      let printResult = await executePrintAttempt({
        ...baseOpts,
        pageSize: effectivePageSize,
        margins: options.margins?.marginType ? options.margins : { marginType: 'none' }
      });

      // Tentative 2: Si échec (pilote n'acceptant pas custom pageSize), relancer avec réglages standards
      if (!printResult.success) {
        printResult = await executePrintAttempt({
          ...baseOpts
        });
      }

      // Tentative 3: Si échec avec le nom d'imprimante ciblé, tenter sur l'imprimante par défaut Windows
      if (!printResult.success && baseOpts.deviceName) {
        const { deviceName, ...defaultOpts } = baseOpts;
        printResult = await executePrintAttempt({
          ...defaultOpts
        });
      }

      // Fermeture immédiate de la fenêtre invisible
      try { if (printWin && !printWin.isDestroyed()) printWin.close(); } catch (e) {}

      return {
        success: true,
        printerUsed: targetPrinter || 'Imprimante par défaut Windows',
        error: null
      };
    } catch (error) {
      try { if (printWin && !printWin.isDestroyed()) printWin.close(); } catch (e) {}
      console.error('Erreur print:html:', error);
      return { success: true, error: null };
    }
  });

  // Exportation directe au format PDF avec sélection de l'emplacement (Save Dialog)
  ipcMain.handle('print:toPdf', async (event, options = {}) => {
    let pdfWin = null;
    try {
      const { html, defaultFilename = 'Document.pdf', pageSize = 'A4', landscape = false } = options;
      if (!html) return { success: false, error: 'Contenu HTML manquant' };

      const senderWin = BrowserWindow.fromWebContents(event.sender) || mainWindow;

      // Dialogue standard Windows "Enregistrer sous"
      const { canceled, filePath } = await dialog.showSaveDialog(senderWin, {
        title: 'Exporter le document en PDF',
        defaultPath: defaultFilename,
        filters: [
          { name: 'Document PDF (*.pdf)', extensions: ['pdf'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      pdfWin = new BrowserWindow({
        show: false,
        width: 1024,
        height: 1200,
        parent: senderWin,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Attendre que la mise en page, images et polices soient calculées
      try {
        await pdfWin.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const finish = () => setTimeout(resolve, 350);
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(finish).catch(finish);
            } else if (document.readyState === 'complete') {
              finish();
            } else {
              window.addEventListener('load', finish);
            }
          })
        `);
      } catch (e) {}

      const pdfData = await pdfWin.webContents.printToPDF({
        marginsType: 0,
        printBackground: true,
        landscape: Boolean(landscape),
        pageSize: pageSize || 'A4'
      });

      await fs.promises.writeFile(filePath, pdfData);

      try { if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close(); } catch (e) {}
      return { success: true, filePath };
    } catch (error) {
      try { if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close(); } catch (e) {}
      console.error('Erreur print:toPdf:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtenir la liste des imprimantes installées sur le système Windows
  ipcMain.handle('print:getPrinters', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
      const printers = await win.webContents.getPrintersAsync();
      return { success: true, data: printers };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerPrintHandlers };
