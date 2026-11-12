const { ipcMain } = require('electron');
const {
  getMachineId,
  getLicenseStatus,
  activateLicense,
  deactivateLicense,
  resetLicenseSystem,
  generateLicenseKey
} = require('../licensing/licenseManager');

function registerLicenseHandlers() {
  // 1. Obtenir l'état de la licence et l'empreinte machine (Machine ID)
  ipcMain.handle('license:getStatus', async () => {
    try {
      const status = getLicenseStatus();
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 2. Activer l'application avec une clé
  ipcMain.handle('license:activate', async (event, licenseKey) => {
    try {
      const result = activateLicense(licenseKey);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 3. Désactiver la licence
  ipcMain.handle('license:deactivate', async () => {
    try {
      const result = deactivateLicense();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 4. Réinitialiser complètement la licence
  ipcMain.handle('license:reset', async () => {
    try {
      const result = resetLicenseSystem();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 5. Générer une clé (si exécuté en interne)
  ipcMain.handle('license:generate', async (event, params) => {
    try {
      const key = generateLicenseKey(params);
      return { success: true, key };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerLicenseHandlers };
