const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Clé secrète principale (Master Secret) utilisée pour la signature cryptographique HMAC
const MASTER_SECRET = 'HA_SOFTWARES_ACADEMIE_COMMERCEPOST_MASTER_SECRET_2026_@PROD';

let cachedMachineId = null;

/**
 * Retourne la liste ordonnée des emplacements de fichiers de persistance Machine ID
 */
function getMachineIdCandidatePaths() {
  const paths = [];
  const progData = process.env.ProgramData || 'C:\\ProgramData';
  paths.push(path.join(progData, 'CommercePro', 'machine_id.txt'));
  paths.push(path.join(progData, 'CommercePost', 'machine_id.txt'));

  if (process.env.APPDATA) {
    paths.push(path.join(process.env.APPDATA, 'commercepro', 'machine_id.txt'));
    paths.push(path.join(process.env.APPDATA, 'commercepost', 'machine_id.txt'));
  }
  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'commercepro', 'machine_id.txt'));
    paths.push(path.join(process.env.LOCALAPPDATA, 'commercepost', 'machine_id.txt'));
  }
  try {
    if (app && app.getPath) {
      paths.push(path.join(app.getPath('userData'), 'machine_id.txt'));
    }
  } catch (e) {}

  return [...new Set(paths.filter(Boolean))];
}

/**
 * Retourne la liste ordonnée de tous les emplacements de stockage redondants de la licence
 */
function getLicenseCandidatePaths() {
  const paths = [];
  try {
    if (app && app.getPath) {
      paths.push(path.join(app.getPath('userData'), 'license.lic'));
    }
  } catch (e) {}

  if (process.env.APPDATA) {
    paths.push(path.join(process.env.APPDATA, 'commercepro', 'license.lic'));
    paths.push(path.join(process.env.APPDATA, 'commercepost', 'license.lic'));
  }
  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'commercepro', 'license.lic'));
    paths.push(path.join(process.env.LOCALAPPDATA, 'commercepost', 'license.lic'));
  }
  const progData = process.env.ProgramData || 'C:\\ProgramData';
  paths.push(path.join(progData, 'CommercePro', 'license.lic'));
  paths.push(path.join(progData, 'CommercePost', 'license.lic'));

  return [...new Set(paths.filter(Boolean))];
}

/**
 * Sauvegarde le Machine ID dans tous les emplacements de redondance sur disque
 */
function saveMachineIdToDisk(id) {
  const targets = getMachineIdCandidatePaths();
  for (const t of targets) {
    try {
      const dir = path.dirname(t);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(t, id.trim().toUpperCase(), 'utf8');
    } catch (e) {}
  }
}

/**
 * Calcule et garantit une empreinte matérielle UNIQUE, STABLE et PERMANENTE du PC
 * Format : CP-XXXX-XXXX-XXXX-XXXX
 * Ne change JAMAIS même après redémarrage, mise hors tension, changement de réseau ou mode hors-ligne.
 */
function getMachineId() {
  if (cachedMachineId) return cachedMachineId;

  // 1. Chercher si un ID machine permanent est déjà sauvegardé sur le disque
  const candidateFiles = getMachineIdCandidatePaths();
  for (const f of candidateFiles) {
    try {
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8').trim().toUpperCase();
        if (/^CP-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(content)) {
          cachedMachineId = content;
          return cachedMachineId;
        }
      }
    } catch (e) {}
  }

  // 2. Calculer un Machine ID permanent à partir du Registre Windows (MachineGuid) et du CPU matériel
  let winGuid = '';
  try {
    const { execSync } = require('child_process');
    const out = execSync('reg query HKLM\\Software\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf8', timeout: 3000 });
    const match = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
    if (match && match[1]) {
      winGuid = match[1].trim();
    }
  } catch (e) {}

  if (!winGuid) {
    try {
      const { execSync } = require('child_process');
      const out = execSync('wmic csproduct get uuid', { encoding: 'utf8', timeout: 3000 });
      const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines[1] && lines[1] !== 'UUID') {
        winGuid = lines[1];
      }
    } catch (e) {}
  }

  const cpuModel = os.cpus()?.[0]?.model || 'GENERIC_CPU';
  const rawFingerprint = winGuid 
    ? `WIN_GUID:${winGuid}|${cpuModel}` 
    : `${os.hostname()}|${os.platform()}|${cpuModel}|${os.arch()}`;

  const hash = crypto.createHash('sha256').update(rawFingerprint).digest('hex').toUpperCase();
  cachedMachineId = `CP-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;

  // Sauvegarder immédiatement sur disque pour que ce soit immuable
  saveMachineIdToDisk(cachedMachineId);
  return cachedMachineId;
}

/**
 * Retourne le chemin principal du fichier licence
 */
function getLicenseFilePath() {
  const candidates = getLicenseCandidatePaths();
  return candidates[0] || path.join(process.env.APPDATA || '', 'commercepost', 'license.lic');
}

/**
 * Génère une clé de licence pour un client et une machine donnés
 */
function generateLicenseKey({ clientName, machineId, type = 'LIFETIME', durationDays = 365, customExpiry = null }) {
  const issuedAt = new Date().toISOString();
  let expiry = null;

  if (type === 'TIME_LIMITED') {
    if (customExpiry) {
      expiry = new Date(customExpiry).toISOString();
    } else {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + Number(durationDays));
      expiry = expDate.toISOString();
    }
  }

  const payload = {
    client: clientName.trim(),
    machineId: machineId.trim().toUpperCase(),
    type: type, // 'LIFETIME' | 'TIME_LIMITED'
    expiry,
    issuedAt
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64');
  
  // Signature HMAC-SHA256
  const signature = crypto.createHmac('sha256', MASTER_SECRET).update(payloadB64).digest('hex');

  // Clé finale au format : LIC-PAYLOADB64.SIGNATURE
  return `LIC-${payloadB64}.${signature}`;
}

/**
 * Vérifie et valide une clé de licence
 */
function verifyLicenseKey(licenseKeyString, currentMachineId) {
  try {
    if (!licenseKeyString || !licenseKeyString.startsWith('LIC-')) {
      return { valid: false, error: 'Format de clé de licence invalide.' };
    }

    const cleanKey = licenseKeyString.replace(/^LIC-/, '').trim();
    const parts = cleanKey.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Structure de licence corrompue.' };
    }

    const [payloadB64, signature] = parts;

    // 1. Vérification de la signature cryptographique
    const expectedSig = crypto.createHmac('sha256', MASTER_SECRET).update(payloadB64).digest('hex');
    if (signature !== expectedSig) {
      return { valid: false, error: 'Clé de licence invalide ou signature falsifiée.' };
    }

    // 2. Décodage du payload
    const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);

    // 3. Vérification du verrouillage machine (Hardware Lock)
    const machine = (currentMachineId || getMachineId()).toUpperCase();
    const licMachine = (payload.machineId || '').toUpperCase();

    if (licMachine !== 'UNIVERSAL' && licMachine !== machine) {
      return {
        valid: false,
        error: `Cette licence est réservée à une autre machine (${licMachine}). Votre Machine ID est : ${machine}`
      };
    }

    // 4. Vérification de l'expiration
    if (payload.type === 'TIME_LIMITED' && payload.expiry) {
      const now = new Date();
      const expDate = new Date(payload.expiry);
      if (now > expDate) {
        return {
          valid: false,
          error: `Licence expirée depuis le ${expDate.toLocaleDateString('fr-DZ')}.`,
          expired: true,
          expiryDate: payload.expiry
        };
      }

      const diffMs = expDate - now;
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      return {
        valid: true,
        payload,
        daysRemaining,
        expiryDate: payload.expiry
      };
    }

    return {
      valid: true,
      payload,
      lifetime: true
    };
  } catch (err) {
    return { valid: false, error: 'Erreur lors de la lecture de la licence.' };
  }
}

/**
 * Récupère l'état actuel de la licence sur ce PC
 */
function getLicenseStatus() {
  const machineId = getMachineId();
  const licFiles = getLicenseCandidatePaths();
  let foundRawKey = null;

  for (const f of licFiles) {
    try {
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8').trim();
        if (content.startsWith('LIC-')) {
          foundRawKey = content;
          break;
        }
      }
    } catch (e) {}
  }

  if (!foundRawKey) {
    return {
      isActivated: false,
      machineId,
      status: 'NOT_ACTIVATED',
      message: 'Application non activée. Veuillez entrer une clé de licence.'
    };
  }

  const verification = verifyLicenseKey(foundRawKey, machineId);
  if (!verification.valid) {
    return {
      isActivated: false,
      machineId,
      status: verification.expired ? 'EXPIRED' : 'INVALID',
      error: verification.error,
      expiryDate: verification.expiryDate
    };
  }

  // Si la licence est valide, synchroniser tous les emplacements de redondance
  for (const f of licFiles) {
    try {
      if (!fs.existsSync(f)) {
        const dir = path.dirname(f);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(f, foundRawKey, 'utf8');
      }
    } catch (e) {}
  }

  return {
    isActivated: true,
    machineId,
    status: 'ACTIVE',
    clientName: verification.payload.client,
    type: verification.payload.type,
    daysRemaining: verification.daysRemaining,
    expiryDate: verification.expiryDate,
    issuedAt: verification.payload.issuedAt
  };
}

/**
 * Active l'application avec la clé de licence fournie et l'écrit de manière redondante sur le PC
 */
function activateLicense(licenseKeyString) {
  const cleanKey = licenseKeyString.trim();
  const machineId = getMachineId();
  const verification = verifyLicenseKey(cleanKey, machineId);

  if (!verification.valid) {
    return { success: false, error: verification.error };
  }

  // Écriture redondante sur tous les emplacements permanents du PC
  const licFiles = getLicenseCandidatePaths();
  for (const f of licFiles) {
    try {
      const dir = path.dirname(f);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(f, cleanKey, 'utf8');
    } catch (e) {
      console.warn(`[Licence] Avertissement écriture sur ${f}:`, e.message);
    }
  }

  return {
    success: true,
    message: 'Application activée avec succès et enregistrée de manière permanente sur ce PC !',
    clientName: verification.payload.client,
    type: verification.payload.type,
    daysRemaining: verification.daysRemaining,
    expiryDate: verification.expiryDate
  };
}

/**
 * Supprime la licence active de tous les emplacements
 */
function deactivateLicense() {
  const licFiles = getLicenseCandidatePaths();
  for (const f of licFiles) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    } catch (e) {}
  }
  return { success: true, message: 'Licence désactivée avec succès.' };
}

/**
 * Réinitialise complètement le système de licence (supprime la licence et l'empreinte en cache)
 */
function resetLicenseSystem() {
  cachedMachineId = null;
  const licFiles = getLicenseCandidatePaths();
  for (const f of licFiles) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    } catch (e) {}
  }
  const midFiles = getMachineIdCandidatePaths();
  for (const f of midFiles) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    } catch (e) {}
  }
  // Re-calculer l'ID matériel propre
  const freshId = getMachineId();
  return { success: true, message: 'Système de licence réinitialisé.', machineId: freshId };
}

module.exports = {
  MASTER_SECRET,
  getMachineId,
  generateLicenseKey,
  verifyLicenseKey,
  getLicenseStatus,
  activateLicense,
  deactivateLicense,
  resetLicenseSystem
};
