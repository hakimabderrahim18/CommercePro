const { ipcMain, app, shell } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

// Variables d'état
let latestAssetDownloadUrl = null;
let downloadedInstallerPath = null;

/**
 * Télécharge un fichier binaire avec suivi de la progression et gestion des redirections
 */
function downloadAssetWithProgress(fileUrl, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const doDownload = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 10) {
        return reject(new Error('Trop de redirections'));
      }

      const client = currentUrl.startsWith('https') ? https : http;
      const req = client.get(currentUrl, {
        headers: {
          'User-Agent': 'CommercePro-DesktopApp'
        }
      }, (res) => {
        // Suivre les redirections (GitHub Releases redirige vers AWS S3)
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          const redirectUrl = res.headers.location;
          if (!redirectUrl) return reject(new Error('Redirection sans destination.'));
          return doDownload(redirectUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Erreur serveur de téléchargement: HTTP ${res.statusCode}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let transferredBytes = 0;
        let lastTime = Date.now();
        let lastTransferred = 0;
        let bytesPerSecond = 0;

        // Créer les dossiers parents si nécessaire
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          transferredBytes += chunk.length;
          const now = Date.now();
          if (now - lastTime >= 250) {
            bytesPerSecond = Math.round(((transferredBytes - lastTransferred) / (now - lastTime)) * 1000);
            lastTime = now;
            lastTransferred = transferredBytes;

            const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0;
            if (onProgress) {
              onProgress({
                percent,
                transferred: transferredBytes,
                total: totalBytes,
                bytesPerSecond
              });
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          if (onProgress) {
            onProgress({
              percent: 100,
              transferred: transferredBytes,
              total: totalBytes || transferredBytes,
              bytesPerSecond: 0
            });
          }
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    doDownload(fileUrl);
  });
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
            // Vérifier s'il y a des releases en liste générale (ex: pre-release ou draft)
            checkAllReleasesFallback().then(resolve);
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

/**
 * Fallback si releases/latest retourne 404 (par ex. si release marquée comme pre-release)
 */
function checkAllReleasesFallback() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
      headers: { 'User-Agent': 'CommercePro-DesktopApp' },
      timeout: 8000
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const list = JSON.parse(data);
            if (Array.isArray(list) && list.length > 0) {
              resolve({ success: true, release: list[0] });
              return;
            }
          }
          resolve({ success: true, release: null, message: 'Aucune mise à jour publiée sur GitHub.' });
        } catch (err) {
          resolve({ success: true, release: null, message: 'Aucune mise à jour publiée sur GitHub.' });
        }
      });
    });

    req.on('error', () => {
      resolve({ success: true, release: null, message: 'Aucune mise à jour publiée sur GitHub.' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: true, release: null, message: 'Aucune mise à jour publiée sur GitHub.' });
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
      latestAssetDownloadUrl = null;
      downloadedInstallerPath = null;

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

      // Chercher le lien d'un exécutable .exe ou .zip dans les assets GitHub
      let downloadUrl = release.html_url;
      let hasDirectAsset = false;
      if (Array.isArray(release.assets)) {
        const exeAsset = release.assets.find(a => a.name && (a.name.endsWith('.exe') || a.name.endsWith('.zip')));
        if (exeAsset && exeAsset.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
          latestAssetDownloadUrl = downloadUrl;
          hasDirectAsset = true;
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
        canAutoDownload: hasDirectAsset || (app.isPackaged && !!autoUpdater)
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 3. Télécharger la mise à jour
  ipcMain.handle('update:download', async (event, customUrl) => {
    try {
      const targetUrl = customUrl || latestAssetDownloadUrl;

      // Si on a un lien de fichier binaire direct (.exe / .zip)
      if (targetUrl && (targetUrl.endsWith('.exe') || targetUrl.endsWith('.zip') || targetUrl.includes('/download/'))) {
        const fileName = path.basename(new URL(targetUrl).pathname) || 'CommercePro-Update.exe';
        const destPath = path.join(app.getPath('temp'), 'CommercePro-Update', fileName);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update:progress', {
            percent: 0,
            transferred: 0,
            total: 0,
            bytesPerSecond: 0
          });
        }

        downloadAssetWithProgress(targetUrl, destPath, (prog) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:progress', prog);
          }
        }).then((savedPath) => {
          downloadedInstallerPath = savedPath;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:status', {
              status: 'DOWNLOADED',
              message: 'Mise à jour prête à être installée.'
            });
          }
        }).catch((err) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:status', {
              status: 'ERROR',
              error: err.message
            });
          }
        });

        return { success: true, message: 'Téléchargement direct démarré...' };
      }

      // Si electron-updater est disponible
      if (app.isPackaged && autoUpdater) {
        await autoUpdater.downloadUpdate();
        return { success: true, message: 'Téléchargement démarré...' };
      }

      // Si pas de lien direct, ouvrir le navigateur
      if (targetUrl) {
        await shell.openExternal(targetUrl);
        return { success: true, openedBrowser: true };
      }

      return { success: false, error: 'Aucun fichier de mise à jour disponible.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 4. Installer et redémarrer
  ipcMain.handle('update:install', async () => {
    try {
      if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
        if (downloadedInstallerPath.endsWith('.exe')) {
          spawn(downloadedInstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
          app.quit();
          return { success: true };
        } else {
          await shell.openPath(downloadedInstallerPath);
          return { success: true };
        }
      }

      if (autoUpdater) {
        autoUpdater.quitAndInstall(false, true);
        return { success: true };
      }

      return { success: false, error: 'Installateur non trouvé.' };
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
