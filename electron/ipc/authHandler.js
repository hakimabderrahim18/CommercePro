const { ipcMain } = require('electron');
const { getDB } = require('../database/sqlite');

/**
 * Enregistre une entrée dans le journal d'audit
 */
function logAudit(db, { userId = null, username = 'Système', action, module, reference = '', details = '', caisse = '' }) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, module, reference, details, caisse, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, username, action, module, reference, typeof details === 'object' ? JSON.stringify(details) : String(details), caisse);
  } catch (err) {
    console.warn('[Audit Log Warning]', err.message);
  }
}

function registerAuthHandlers(mainWindow) {
  const db = getDB();

  // 1. Connexion (Login)
  ipcMain.handle('auth:login', async (event, { username, password }) => {
    try {
      if (!username || !password) {
        return { success: false, error: 'Identifiant et mot de passe requis.' };
      }

      const user = db.prepare(`
        SELECT id, username, password, nom, role, caisse, actif, COALESCE(soldeTechnicien, 0) as soldeTechnicien, created_at 
        FROM users 
        WHERE LOWER(username) = LOWER(?)
      `).get(username.trim());

      if (!user) {
        logAudit(db, {
          username: username.trim(),
          action: 'ECHEC_CONNEXION',
          module: 'AUTH',
          details: 'Utilisateur inexistant'
        });
        return { success: false, error: 'Identifiant ou mot de passe incorrect.' };
      }

      if (!user.actif) {
        logAudit(db, {
          userId: user.id,
          username: user.username,
          action: 'ECHEC_CONNEXION',
          module: 'AUTH',
          details: 'Compte désactivé'
        });
        return { success: false, error: 'Ce compte utilisateur a été désactivé. Contactez l’administrateur.' };
      }

      // Vérification mot de passe
      if (user.password !== password.trim()) {
        logAudit(db, {
          userId: user.id,
          username: user.username,
          action: 'ECHEC_CONNEXION',
          module: 'AUTH',
          details: 'Mot de passe erroné'
        });
        return { success: false, error: 'Identifiant ou mot de passe incorrect.' };
      }

      // Connexion réussie
      logAudit(db, {
        userId: user.id,
        username: user.username,
        action: 'CONNEXION_REUSSIE',
        module: 'AUTH',
        caisse: user.caisse || '',
        details: `Rôle: ${user.role}`
      });

      const { password: _, ...safeUser } = user;
      return { success: true, user: safeUser };
    } catch (error) {
      console.error('Erreur auth:login', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Récupérer tous les utilisateurs
  ipcMain.handle('users:getAll', async () => {
    try {
      const users = db.prepare(`
        SELECT id, username, nom, role, caisse, actif, COALESCE(soldeTechnicien, 0) as soldeTechnicien, created_at, updated_at
        FROM users
        ORDER BY id ASC
      `).all();
      return { success: true, data: users };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 3. Créer un utilisateur
  ipcMain.handle('users:create', async (event, userData, currentUser) => {
    try {
      const { username, password, nom, role = 'VENDEUR', caisse = 'Caisse 1 (Magasin)', actif = 1 } = userData || {};

      if (!username || !username.trim()) {
        return { success: false, error: 'Identifiant / Login obligatoire.' };
      }
      if (!password || !password.trim()) {
        return { success: false, error: 'Mot de passe obligatoire.' };
      }
      if (!nom || !nom.trim()) {
        return { success: false, error: 'Nom complet obligatoire.' };
      }

      const cleanUsername = username.trim().toLowerCase();
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername);
      if (existing) {
        return { success: false, error: 'Cet identifiant est déjà utilisé par un autre compte.' };
      }

      const cleanActif = (actif === 0 || actif === false || actif === '0') ? 0 : 1;
      const cleanCaisse = (caisse && String(caisse).trim()) || 'Caisse 1 (Magasin)';

      const res = db.prepare(`
        INSERT INTO users (username, password, nom, role, caisse, actif)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cleanUsername, password.trim(), nom.trim(), role, cleanCaisse, cleanActif);

      const created = db.prepare('SELECT id, username, nom, role, caisse, actif, created_at FROM users WHERE id = ?').get(res.lastInsertRowid);

      logAudit(db, {
        userId: currentUser?.id,
        username: currentUser?.username || 'Admin',
        action: 'CREATION_UTILISATEUR',
        module: 'USERS',
        reference: `USER-${created?.id || res.lastInsertRowid}`,
        details: `Création du compte ${created?.username || cleanUsername} (${created?.role || role}, caisse: ${created?.caisse || cleanCaisse})`
      });

      return { success: true, data: created };
    } catch (error) {
      console.error('Erreur users:create', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Modifier un utilisateur
  ipcMain.handle('users:update', async (event, { id, updates }, currentUser) => {
    try {
      if (!id) return { success: false, error: 'ID utilisateur requis.' };
      const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!current) return { success: false, error: 'Utilisateur introuvable.' };

      const nom = updates.nom !== undefined ? updates.nom.trim() : current.nom;
      const role = updates.role !== undefined ? updates.role : current.role;
      const caisse = updates.caisse !== undefined ? updates.caisse : current.caisse;
      const actif = updates.actif !== undefined ? (updates.actif ? 1 : 0) : current.actif;
      const password = (updates.password && updates.password.trim()) ? updates.password.trim() : current.password;

      // Si le username change, vérifier unicité
      let username = current.username;
      if (updates.username && updates.username.trim().toLowerCase() !== current.username.toLowerCase()) {
        const cleanUser = updates.username.trim().toLowerCase();
        const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?').get(cleanUser, id);
        if (existing) {
          return { success: false, error: 'Cet identifiant est déjà attribué.' };
        }
        username = cleanUser;
      }

      db.prepare(`
        UPDATE users 
        SET username = ?, password = ?, nom = ?, role = ?, caisse = ?, actif = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(username, password, nom, role, caisse, actif, id);

      const updated = db.prepare('SELECT id, username, nom, role, caisse, actif, created_at, updated_at FROM users WHERE id = ?').get(id);

      logAudit(db, {
        userId: currentUser?.id,
        username: currentUser?.username || 'Admin',
        action: 'MODIFICATION_UTILISATEUR',
        module: 'USERS',
        reference: `USER-${id}`,
        details: `Mise à jour compte ${updated.username} (${updated.role}, caisse: ${updated.caisse}, actif: ${updated.actif})`
      });

      return { success: true, data: updated };
    } catch (error) {
      console.error('Erreur users:update', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Supprimer un utilisateur
  ipcMain.handle('users:delete', async (event, id, currentUser) => {
    try {
      if (!id) return { success: false, error: 'ID requis.' };
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!user) return { success: false, error: 'Utilisateur introuvable.' };

      // Empêcher la suppression du dernier admin
      if (user.role === 'ADMIN') {
        const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "ADMIN" AND actif = 1').get();
        if (adminCount.count <= 1) {
          return { success: false, error: 'Impossible de supprimer le seul compte Administrateur actif.' };
        }
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);

      logAudit(db, {
        userId: currentUser?.id,
        username: currentUser?.username || 'Admin',
        action: 'SUPPRESSION_UTILISATEUR',
        module: 'USERS',
        reference: `USER-${id}`,
        details: `Suppression du compte ${user.username} (${user.nom})`
      });

      return { success: true };
    } catch (error) {
      console.error('Erreur users:delete', error);
      return { success: false, error: error.message };
    }
  });

  // 6. Historique des Modifications & Journal d'Audit
  ipcMain.handle('audit:getAll', async (event, filters = {}) => {
    try {
      let query = `SELECT * FROM audit_logs WHERE 1=1`;
      const params = [];

      if (filters.module && filters.module !== 'TOUS') {
        query += ` AND module = ?`;
        params.push(filters.module);
      }

      if (filters.username && filters.username !== 'TOUS') {
        query += ` AND username = ?`;
        params.push(filters.username);
      }

      if (filters.caisse && filters.caisse !== 'TOUS') {
        query += ` AND caisse = ?`;
        params.push(filters.caisse);
      }

      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query += ` AND (action LIKE ? OR details LIKE ? OR reference LIKE ? OR username LIKE ?)`;
        params.push(term, term, term, term);
      }

      query += ` ORDER BY id DESC LIMIT ?`;
      params.push(filters.limit || 200);

      const logs = db.prepare(query).all(...params);
      return { success: true, data: logs };
    } catch (error) {
      console.error('Erreur audit:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 7. Enregistrement personnalisé d'un log
  ipcMain.handle('audit:log', async (event, logData) => {
    try {
      logAudit(db, logData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerAuthHandlers,
  logAudit
};
