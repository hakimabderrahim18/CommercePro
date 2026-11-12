const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { exportTreasuryToExcel } = require('../utils/excelService');

function generateTransactionNumber(type) {
  const db = getDB();
  const prefix = type === 'ENCAISSEMENT' ? 'ENC' : 'DEC';
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const last = db.prepare(`
    SELECT numeroTransaction FROM cash_transactions 
    WHERE numeroTransaction LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}-${yyyymm}-%`);

  let seq = 1;
  if (last && last.numeroTransaction) {
    const parts = last.numeroTransaction.split('-');
    if (parts.length >= 3) {
      seq = parseInt(parts[2], 10) + 1;
    }
  }
  return `${prefix}-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

function registerTreasuryHandlers(mainWindow) {
  const db = getDB();

  // 1. Obtenir les transactions de trésorerie filtrées
  ipcMain.handle('treasury:getAll', async (event, filters = {}) => {
    try {
      let query = `
        SELECT t.*, c.nom as client_nom, c.telephone as client_tel, c.soldeDette as client_dette
        FROM cash_transactions t
        LEFT JOIN customers c ON t.client_id = c.id
        WHERE 1=1
      `;
      const params = [];

      // Filtre Type
      if (filters.type && filters.type !== 'TOUS') {
        query += ' AND t.type = ?';
        params.push(filters.type);
      }

      // Filtre Mode Paiement
      if (filters.modePaiement && filters.modePaiement !== 'TOUS') {
        query += ' AND t.modePaiement = ?';
        params.push(filters.modePaiement);
      }

      // Filtre Catégorie
      if (filters.categorie && filters.categorie !== 'TOUS') {
        query += ' AND t.categorie = ?';
        params.push(filters.categorie);
      }

      // Filtre Caisse
      if (filters.caisse && filters.caisse !== 'TOUS') {
        query += ' AND t.caisse = ?';
        params.push(filters.caisse);
      }

      // Filtre Recherche
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query += ` AND (
          t.numeroTransaction LIKE ? OR 
          t.tiers LIKE ? OR 
          t.fournisseur LIKE ? OR 
          c.nom LIKE ? OR 
          t.referenceDocument LIKE ? OR 
          t.motif LIKE ?
        )`;
        params.push(term, term, term, term, term, term);
      }

      // Filtre Période / Date
      if (filters.period && filters.period !== 'all') {
        const now = new Date();
        let startStr = '';
        let endStr = '';

        if (filters.period === 'today') {
          startStr = `${now.toISOString().slice(0, 10)} 00:00:00`;
          endStr = `${now.toISOString().slice(0, 10)} 23:59:59`;
        } else if (filters.period === 'yesterday') {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          startStr = `${y.toISOString().slice(0, 10)} 00:00:00`;
          endStr = `${y.toISOString().slice(0, 10)} 23:59:59`;
        } else if (filters.period === 'week') {
          const w = new Date(now);
          w.setDate(w.getDate() - 7);
          startStr = `${w.toISOString().slice(0, 10)} 00:00:00`;
          endStr = `${now.toISOString().slice(0, 10)} 23:59:59`;
        } else if (filters.period === 'month') {
          const m = new Date(now.getFullYear(), now.getMonth(), 1);
          startStr = `${m.toISOString().slice(0, 10)} 00:00:00`;
          endStr = `${now.toISOString().slice(0, 10)} 23:59:59`;
        } else if (filters.period === 'custom' && filters.startDate) {
          startStr = `${filters.startDate} 00:00:00`;
          endStr = filters.endDate ? `${filters.endDate} 23:59:59` : `${filters.startDate} 23:59:59`;
        }

        if (startStr && endStr) {
          query += ' AND (t.dateTransaction BETWEEN ? AND ? OR t.created_at BETWEEN ? AND ?)';
          params.push(startStr, endStr, startStr, endStr);
        }
      }

      query += ' ORDER BY t.id DESC';

      const rows = db.prepare(query).all(...params).map((row) => ({
        ...row,
        _id: row.id,
        montant: Number(row.montant || 0),
        client: row.client_id ? {
          _id: row.client_id,
          nom: row.client_nom,
          telephone: row.client_tel,
          soldeDette: Number(row.client_dette || 0)
        } : null
      }));

      // Calcul des statistiques agrégées sur les résultats
      let totalEncaissements = 0;
      let totalDecaissements = 0;
      let totalEspeces = 0;
      let totalCheques = 0;
      let totalVirements = 0;
      let totalCartes = 0;

      const recettesParCaisse = {};

      rows.forEach((r) => {
        if (r.type === 'ENCAISSEMENT') {
          totalEncaissements += r.montant;
        } else {
          totalDecaissements += r.montant;
        }

        const net = (r.type === 'ENCAISSEMENT' ? 1 : -1) * r.montant;
        if (r.modePaiement === 'ESPECES') totalEspeces += net;
        else if (r.modePaiement === 'CHEQUE') totalCheques += net;
        else if (r.modePaiement === 'VIREMENT') totalVirements += net;
        else if (r.modePaiement === 'CARTE') totalCartes += net;

        const regName = r.caisse || 'Caisse 1';
        if (!recettesParCaisse[regName]) {
          recettesParCaisse[regName] = { encaissements: 0, decaissements: 0, solde: 0 };
        }
        if (r.type === 'ENCAISSEMENT') {
          recettesParCaisse[regName].encaissements += r.montant;
        } else {
          recettesParCaisse[regName].decaissements += r.montant;
        }
        recettesParCaisse[regName].solde += net;
      });

      const stats = {
        totalEncaissements,
        totalDecaissements,
        soldeNet: totalEncaissements - totalDecaissements,
        totalEspeces,
        totalCheques,
        totalVirements,
        totalCartes,
        recettesParCaisse,
        count: rows.length
      };

      return { success: true, data: rows, stats };
    } catch (error) {
      console.error('Erreur treasury:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Créer une nouvelle transaction (Encaissement ou Décaissement)
  ipcMain.handle('treasury:create', async (event, data) => {
    try {
      if (!data.type || !['ENCAISSEMENT', 'DECAISSEMENT'].includes(data.type)) {
        return { success: false, error: 'Type de flux invalide (ENCAISSEMENT ou DECAISSEMENT attendu).' };
      }

      const montant = parseFloat(data.montant);
      if (isNaN(montant) || montant <= 0) {
        return { success: false, error: 'Veuillez saisir un montant supérieur à 0.' };
      }

      const numeroTransaction = generateTransactionNumber(data.type);
      const dateTransaction = data.dateTransaction || new Date().toISOString();
      const categorie = (data.categorie || (data.type === 'ENCAISSEMENT' ? 'AUTRE_ENCAISSEMENT' : 'AUTRE_DECAISSEMENT')).trim();
      const caisse = data.caisse || 'Caisse 1';
      const modePaiement = data.modePaiement || 'ESPECES';
      const clientId = data.client_id ? parseInt(data.client_id, 10) : null;
      const fournisseur = data.fournisseur ? data.fournisseur.trim() : '';
      const tiers = data.tiers ? data.tiers.trim() : '';
      const referenceDocument = data.referenceDocument ? data.referenceDocument.trim() : '';
      const motif = data.motif ? data.motif.trim() : '';

      let createdId = null;

      const createTx = db.transaction(() => {
        // Enregistrer la catégorie dans custom_categories si nouvelle
        if (categorie) {
          const exists = db.prepare('SELECT id FROM custom_categories WHERE UPPER(nom) = ?').get(categorie.toUpperCase());
          if (!exists) {
            try {
              db.prepare('INSERT INTO custom_categories (nom, type) VALUES (?, ?)').run(categorie, data.type === 'ENCAISSEMENT' ? 'RECETTE' : 'DEPENSE');
            } catch (e) {}
          }
        }

        // Insertion transaction
        const stmt = db.prepare(`
          INSERT INTO cash_transactions (
            numeroTransaction, type, categorie, montant, modePaiement, caisse,
            client_id, fournisseur, tiers, referenceDocument, motif, dateTransaction
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = stmt.run(
          numeroTransaction,
          data.type,
          categorie,
          montant,
          modePaiement,
          caisse,
          clientId,
          fournisseur,
          tiers,
          referenceDocument,
          motif,
          dateTransaction
        );

        createdId = info.lastInsertRowid;

        // Si c'est un règlement client pour dette
        if (data.type === 'ENCAISSEMENT' && clientId && (categorie === 'REGLEMENT_CLIENT' || data.deduireDetteClient)) {
          const client = db.prepare('SELECT * FROM customers WHERE id = ?').get(clientId);
          if (client) {
            const soldeAvant = Number(client.soldeDette || 0);
            const soldeApres = Math.max(0, soldeAvant - montant);

            db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(soldeApres, clientId);

            db.prepare(`
              INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
              VALUES (?, 'PAIEMENT_DETTE', ?, ?, ?, ?, ?)
            `).run(
              clientId,
              montant,
              soldeAvant,
              soldeApres,
              numeroTransaction,
              motif || `Encaissement ${numeroTransaction}`
            );
          }
        }
      });

      createTx();

      const created = db.prepare(`
        SELECT t.*, c.nom as client_nom, c.telephone as client_tel, c.soldeDette as client_dette
        FROM cash_transactions t
        LEFT JOIN customers c ON t.client_id = c.id
        WHERE t.id = ?
      `).get(createdId);

      return {
        success: true,
        data: {
          ...created,
          _id: created.id,
          montant: Number(created.montant || 0),
          client: created.client_id ? {
            _id: created.client_id,
            nom: created.client_nom,
            telephone: created.client_tel,
            soldeDette: Number(created.client_dette || 0)
          } : null
        }
      };
    } catch (error) {
      console.error('Erreur treasury:create', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Supprimer une transaction
  ipcMain.handle('treasury:delete', async (event, id) => {
    try {
      const txId = parseInt(id, 10);
      const tx = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(txId);
      if (!tx) return { success: false, error: 'Transaction introuvable' };

      const deleteTx = db.transaction(() => {
        // Si c'était un règlement client, réajuster la dette
        if (tx.type === 'ENCAISSEMENT' && tx.client_id && tx.categorie === 'REGLEMENT_CLIENT') {
          const client = db.prepare('SELECT * FROM customers WHERE id = ?').get(tx.client_id);
          if (client) {
            const soldeAvant = Number(client.soldeDette || 0);
            const soldeApres = soldeAvant + Number(tx.montant || 0);

            db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(soldeApres, tx.client_id);

            db.prepare(`
              INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
              VALUES (?, 'ANNULATION_PAIEMENT', ?, ?, ?, ?, ?)
            `).run(
              tx.client_id,
              tx.montant,
              soldeAvant,
              soldeApres,
              tx.numeroTransaction,
              `Annulation encaissement ${tx.numeroTransaction}`
            );
          }
        }

        db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(txId);
      });

      deleteTx();
      return { success: true, message: 'Transaction supprimée avec succès' };
    } catch (error) {
      console.error('Erreur treasury:delete', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Exporter en Excel
  ipcMain.handle('treasury:exportExcel', async (event, filters = {}) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter le journal de trésorerie vers Excel',
        defaultPath: `Tresorerie_CommercePost_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Exportation annulée.' };

      const allRes = await ipcMain.handlers['treasury:getAll'](event, filters);
      if (!allRes.success) return allRes;

      return await exportTreasuryToExcel(allRes.data, filePath);
    } catch (error) {
      console.error('Erreur treasury:exportExcel', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Gestion des Caisses Multiples
  ipcMain.handle('caisse:getAll', async () => {
    try {
      const caisses = db.prepare('SELECT * FROM cash_registers WHERE actif = 1 ORDER BY id ASC').all();
      
      // Calculer pour chaque caisse les encaissements et décaissements totaux cumulés
      const enriched = caisses.map(c => {
        const stats = db.prepare(`
          SELECT 
            COALESCE(SUM(CASE WHEN type = 'ENCAISSEMENT' THEN montant ELSE 0 END), 0) as totalEnc,
            COALESCE(SUM(CASE WHEN type = 'DECAISSEMENT' THEN montant ELSE 0 END), 0) as totalDec
          FROM cash_transactions 
          WHERE caisse = ?
        `).get(c.nom);

        const totalEnc = Number(stats?.totalEnc || 0);
        const totalDec = Number(stats?.totalDec || 0);
        const soldeInitial = Number(c.soldeInitial || 0);
        const soldeActuel = Math.round((soldeInitial + totalEnc - totalDec) * 100) / 100;

        return {
          ...c,
          totalEncaissements: totalEnc,
          totalDecaissements: totalDec,
          soldeActuel
        };
      });

      return { success: true, data: enriched };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('caisse:create', async (event, { nom, code, soldeInitial = 0 }, currentUser) => {
    try {
      if (!nom || !nom.trim()) return { success: false, error: 'Nom de caisse requis.' };
      const codeClean = (code || `CAISSE-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
      const sInit = Number(soldeInitial) || 0;
      
      const info = db.prepare('INSERT INTO cash_registers (nom, code, soldeInitial, actif) VALUES (?, ?, ?, 1)')
        .run(nom.trim(), codeClean, sInit);
      const created = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(info.lastInsertRowid);

      try {
        const { logAudit } = require('./authHandler');
        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Admin',
          action: 'CREATION_CAISSE',
          module: 'CAISSE',
          reference: codeClean,
          caisse: nom.trim(),
          details: `Création de la caisse ${nom.trim()} (Solde initial: ${sInit} DA)`
        });
      } catch (e) {}

      return { success: true, data: created };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('caisse:update', async (event, { id, nom, code, soldeInitial }, currentUser) => {
    try {
      if (!id) return { success: false, error: 'ID requis' };
      const current = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(id);
      if (!current) return { success: false, error: 'Caisse introuvable' };

      const cleanNom = nom !== undefined ? nom.trim() : current.nom;
      const cleanCode = code !== undefined ? code.trim().toUpperCase() : current.code;
      const sInit = soldeInitial !== undefined ? Number(soldeInitial) : current.soldeInitial;

      db.prepare(`
        UPDATE cash_registers 
        SET nom = ?, code = ?, soldeInitial = ?
        WHERE id = ?
      `).run(cleanNom, cleanCode, sInit, id);

      // Si le nom a changé, mettre à jour dans les utilisateurs assignés
      if (cleanNom !== current.nom) {
        db.prepare('UPDATE users SET caisse = ? WHERE caisse = ?').run(cleanNom, current.nom);
      }

      try {
        const { logAudit } = require('./authHandler');
        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Admin',
          action: 'MODIFICATION_CAISSE',
          module: 'CAISSE',
          reference: cleanCode,
          caisse: cleanNom,
          details: `Modification caisse ${cleanNom} (Solde initial: ${sInit} DA)`
        });
      } catch (e) {}

      const updated = db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(id);
      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Transfert de fonds entre deux caisses
  ipcMain.handle('caisse:transfert', async (event, { sourceCaisse, destinationCaisse, montant, motif = '' }, currentUser) => {
    try {
      const val = Number(montant);
      if (!val || val <= 0) return { success: false, error: 'Montant de transfert invalide.' };
      if (!sourceCaisse || !destinationCaisse || sourceCaisse === destinationCaisse) {
        return { success: false, error: 'Veuillez sélectionner deux caisses distinctes.' };
      }

      const transferTx = db.transaction(() => {
        const txDecNum = `DEC-TRF-${Date.now().toString().slice(-6)}`;
        const txEncNum = `ENC-TRF-${Date.now().toString().slice(-6)}`;

        // Décaissement sur la caisse source
        db.prepare(`
          INSERT INTO cash_transactions (
            numeroTransaction, type, categorie, montant, modePaiement,
            tiers, referenceDocument, motif, caisse, dateTransaction
          ) VALUES (?, 'DECAISSEMENT', 'TRANSFERT_CAISSE', ?, 'VIREMENT_INTERNE', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          txDecNum, val, `Vers ${destinationCaisse}`, txEncNum,
          `Transfert vers ${destinationCaisse}: ${motif || 'Virement interne'}`,
          sourceCaisse
        );

        // Encaissement sur la caisse destination
        db.prepare(`
          INSERT INTO cash_transactions (
            numeroTransaction, type, categorie, montant, modePaiement,
            tiers, referenceDocument, motif, caisse, dateTransaction
          ) VALUES (?, 'ENCAISSEMENT', 'TRANSFERT_CAISSE', ?, 'VIREMENT_INTERNE', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          txEncNum, val, `Depuis ${sourceCaisse}`, txDecNum,
          `Réception transfert depuis ${sourceCaisse}: ${motif || 'Virement interne'}`,
          destinationCaisse
        );

        try {
          const { logAudit } = require('./authHandler');
          logAudit(db, {
            userId: currentUser?.id,
            username: currentUser?.username || 'Admin',
            action: 'TRANSFERT_CAISSE',
            module: 'CAISSE',
            reference: `${sourceCaisse} -> ${destinationCaisse}`,
            details: `Transfert de ${val} DA de [${sourceCaisse}] vers [${destinationCaisse}]. Motif: ${motif}`
          });
        } catch (e) {}
      });

      transferTx();
      return { success: true, message: `Transfert de ${val} DA effectué avec succès.` };
    } catch (error) {
      console.error('Erreur caisse:transfert', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('caisse:getDailyStats', async () => {
    try {
      const caisses = db.prepare('SELECT * FROM cash_registers WHERE actif = 1 ORDER BY id ASC').all();
      const dailyRows = db.prepare(`
        SELECT caisse, type, COALESCE(SUM(montant), 0) as total
        FROM cash_transactions
        WHERE date(dateTransaction) = date('now', 'localtime')
        GROUP BY caisse, type
      `).all();

      const statsByCaisse = {};
      caisses.forEach(c => {
        statsByCaisse[c.nom] = {
          nom: c.nom,
          code: c.code,
          encaissements: 0,
          decaissements: 0,
          soldeJour: 0
        };
      });

      dailyRows.forEach(r => {
        const cName = r.caisse || 'Caisse 1 (Comptoir)';
        if (!statsByCaisse[cName]) {
          statsByCaisse[cName] = { nom: cName, code: cName, encaissements: 0, decaissements: 0, soldeJour: 0 };
        }
        if (r.type === 'ENCAISSEMENT') {
          statsByCaisse[cName].encaissements += Number(r.total || 0);
          statsByCaisse[cName].soldeJour += Number(r.total || 0);
        } else {
          statsByCaisse[cName].decaissements += Number(r.total || 0);
          statsByCaisse[cName].soldeJour -= Number(r.total || 0);
        }
      });

      const totalRecettesJour = Object.values(statsByCaisse).reduce((sum, c) => sum + c.encaissements, 0);

      return {
        success: true,
        data: Object.values(statsByCaisse),
        totalRecettesJour
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 6. Gestion des Catégories Libres (Charges & Recettes)
  ipcMain.handle('categories:getAll', async () => {
    try {
      const customCats = db.prepare('SELECT nom, type FROM custom_categories ORDER BY nom ASC').all();
      const usedCats = db.prepare('SELECT DISTINCT categorie as nom, type FROM cash_transactions WHERE categorie IS NOT NULL AND categorie != ""').all();
      
      const map = new Map();
      customCats.forEach(c => map.set(c.nom.toUpperCase(), { nom: c.nom, type: c.type || 'DEPENSE' }));
      usedCats.forEach(c => {
        if (!map.has(c.nom.toUpperCase())) {
          map.set(c.nom.toUpperCase(), { nom: c.nom, type: c.type === 'ENCAISSEMENT' ? 'RECETTE' : 'DEPENSE' });
        }
      });

      return { success: true, data: Array.from(map.values()) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('categories:create', async (event, { nom, type = 'DEPENSE' }) => {
    try {
      if (!nom || !nom.trim()) return { success: false, error: 'Nom de catégorie requis.' };
      const cleanNom = nom.trim();
      const exists = db.prepare('SELECT id FROM custom_categories WHERE UPPER(nom) = ?').get(cleanNom.toUpperCase());
      if (exists) return { success: true, message: 'Catégorie déjà existante' };

      db.prepare('INSERT INTO custom_categories (nom, type) VALUES (?, ?)').run(cleanNom, type);
      return { success: true, data: { nom: cleanNom, type } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerTreasuryHandlers };
