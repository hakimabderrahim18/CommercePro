const { ipcMain, app, shell } = require('electron');
const https = require('https');
const semverCompare = (v1, v2) => {
  const clean = (v) => (v || '').replace(/^v/i, '').trim().split('.').map(n => parseInt(n, 10) || 0);
  const p1 = clean(v1);
  const p2 = clean(v2);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

const GITHUB_OWNER = 'hakimabderrahim18';
const GITHUB_REPO = 'CommercePro';

let autoUpdater = null;
try {
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
  }
} catch (e) {
  console.warn('[Updater] electron-updater non initialisé:', e.message);
}

/**
 * Interroge directement l'API GitHub pour obtenir la dernière release
 */
function fetchLatestGitHubRelease() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      headers: {
        'User-Agent': 'CommercePro-DesktopApp'
      },
      timeout: 8000
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const json = JSON.parse(data);
            resolve({ success: true, release: json });
          } else if (res.statusCode === 404) {
            resolve({ success: true, release: null, message: 'Aucune release publiée pour le moment sur GitHub.' });
          } else {
            resolve({ success: false, error: `GitHub API status ${res.statusCode}` });
          }
        } catch (err) {
          resolve({ success: false, error: err.message });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Délai d’attente dépassé (timeout).' });
    });
  });
}

function registerUpdateHandlers(mainWindow) {
  const currentVersion = app.getVersion();

  if (autoUpdater) {
    autoUpdater.on('download-progress', (progressObj) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:progress', {
          percent: Math.round(progressObj.percent || 0),
          transferred: progressObj.transferred,
          total: progressObj.total,
          bytesPerSecond: progressObj.bytesPerSecond
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:status', {
          status: 'DOWNLOADED',
          version: info.version,
          message: 'Mise à jour prête à être installée.'
        });
      }
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater Error]:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:status', {
          status: 'ERROR',
          error: err.message
        });
      }
    });
  }

  // 1. Obtenir la version actuelle
  ipcMain.handle('update:getVersion', async () => {
    return { version: currentVersion };
  });

  // 2. Vérifier si une mise à jour existe
  ipcMain.handle('update:check', async () => {
    try {
      // Tentative avec electron-updater si l'application est packagée avec config d'update
      if (app.isPackaged && autoUpdater) {
        try {
          const updateCheckResult = await autoUpdater.checkForUpdates();
          if (updateCheckResult && updateCheckResult.updateInfo) {
            const latestVer = updateCheckResult.updateInfo.version;
            const hasUpdate = semverCompare(latestVer, currentVersion) > 0;
            return {
              success: true,
              hasUpdate,
              currentVersion,
              latestVersion: latestVer,
              releaseNotes: updateCheckResult.updateInfo.releaseNotes || 'Améliorations des performances et corrections.',
              releaseDate: updateCheckResult.updateInfo.releaseDate,
              canAutoDownload: true
            };
          }
        } catch (updaterErr) {
          console.log('[AutoUpdater] Basculement vers API GitHub directe:', updaterErr.message);
        }
      }

      // Fallback via GitHub Releases API
      const ghRes = await fetchLatestGitHubRelease();
      if (!ghRes.success) {
        return { success: false, error: ghRes.error || 'Impossible de vérifier les mises à jour.' };
      }

      if (!ghRes.release) {
        return {
          success: true,
          hasUpdate: false,
          currentVersion,
          latestVersion: currentVersion,
          message: ghRes.message || 'Votre logiciel est à jour.'
        };
      }

      const release = ghRes.release;
      const latestVer = (release.tag_name || '').replace(/^v/i, '');
      const hasUpdate = semverCompare(latestVer, currentVersion) > 0;

      // Chercher le lien d'un installateur .exe dans les assets GitHub
      let downloadUrl = release.html_url;
      if (Array.isArray(release.assets)) {
        const exeAsset = release.assets.find(a => a.name && a.name.endsWith('.exe'));
        if (exeAsset && exeAsset.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
        }
      }

      return {
        success: true,
        hasUpdate,
        currentVersion,
        latestVersion: latestVer,
        releaseNotes: release.body || 'Mise à jour et améliorations de Commerce Pro.',
        releaseDate: release.published_at,
        releaseUrl: release.html_url,
        downloadUrl,
        canAutoDownload: false
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 3. Télécharger la mise à jour
  ipcMain.handle('update:download', async () => {
    try {
      if (app.isPackaged && autoUpdater) {
        await autoUpdater.downloadUpdate();
        return { success: true, message: 'Téléchargement démarré...' };
      }
      return { success: false, error: 'Téléchargement automatique non disponible dans ce mode.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 4. Installer et redémarrer
  ipcMain.handle('update:install', async () => {
    try {
      if (autoUpdater) {
        autoUpdater.quitAndInstall(false, true);
        return { success: true };
      }
      return { success: false, error: 'AutoUpdater non disponible.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 5. Ouvrir le lien de la release GitHub dans le navigateur
  ipcMain.handle('update:openReleaseUrl', async (event, url) => {
    const targetUrl = url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    try {
      await shell.openExternal(targetUrl);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerUpdateHandlers };
