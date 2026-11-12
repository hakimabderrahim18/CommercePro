const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { exportSupplierStatementToExcel } = require('../utils/excelService');

function generateTxNumber(prefix = 'DEC') {
  const db = getDB();
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const last = db.prepare(`SELECT numeroTransaction FROM cash_transactions WHERE numeroTransaction LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}-${yyyymm}-%`);
  let seq = 1;
  if (last && last.numeroTransaction) {
    const parts = last.numeroTransaction.split('-');
    if (parts.length >= 3) seq = parseInt(parts[2], 10) + 1;
  }
  return `${prefix}-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

function normalizeSupplier(s) {
  if (!s) return null;
  return {
    ...s,
    _id: s.id,
    soldeDette: Number(s.soldeDette || 0)
  };
}

function registerSupplierHandlers(mainWindow) {
  const db = getDB();

  // 1. Obtenir tous les fournisseurs avec totaux
  ipcMain.handle('supplier:getAll', async (event, filters = {}) => {
    try {
      let query = 'SELECT * FROM suppliers WHERE 1=1';
      const params = [];

      if (filters.search) {
        query += ' AND (nom LIKE ? OR telephone LIKE ? OR email LIKE ? OR adresse LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term, term, term);
      }

      if (filters.onlyWithDebt) {
        query += ' AND soldeDette > 0';
      }

      query += ' ORDER BY nom ASC';

      const suppliers = db.prepare(query).all(...params).map(s => {
        // Calcul des achats cumulés
        const stats = db.prepare(`
          SELECT 
            COALESCE(SUM(totalTTC), 0) as totalAchats,
            COALESCE(SUM(montantPaye), 0) as totalPaye,
            COUNT(*) as nbFactures
          FROM purchase_invoices 
          WHERE supplier_id = ? OR UPPER(fournisseur) = UPPER(?)
        `).get(s.id, s.nom);

        return {
          ...normalizeSupplier(s),
          totalAchats: Number(stats?.totalAchats || 0),
          totalPaye: Number(stats?.totalPaye || 0),
          nbFactures: Number(stats?.nbFactures || 0)
        };
      });

      const totalDettesFournisseurs = suppliers.reduce((sum, s) => sum + (s.soldeDette || 0), 0);

      return { success: true, data: suppliers, totalDettesFournisseurs };
    } catch (error) {
      console.error('Erreur supplier:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Obtenir un fournisseur par ID avec historique complet (Situation Fournisseur)
  ipcMain.handle('supplier:getById', async (event, id) => {
    try {
      const supplierId = parseInt(id, 10);
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      if (!supplier) return { success: false, error: 'Fournisseur introuvable' };

      // Factures d'achat du fournisseur
      const invoices = db.prepare(`
        SELECT * FROM purchase_invoices 
        WHERE supplier_id = ? OR UPPER(fournisseur) = UPPER(?)
        ORDER BY id DESC
      `).all(supplierId, supplier.nom).map(p => {
        const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id);
        return {
          ...p,
          _id: p.id,
          totalHT: Number(p.totalHT || 0),
          totalTTC: Number(p.totalTTC || 0),
          montantPaye: Number(p.montantPaye || 0),
          montantReste: Number(p.montantReste || (p.totalTTC - p.montantPaye)),
          items: items.map(it => ({ ...it, _id: it.id }))
        };
      });

      // Mouvements de compte fournisseur (dettes et règlements)
      const movements = db.prepare(`
        SELECT * FROM supplier_movements
        WHERE supplier_id = ?
        ORDER BY id DESC LIMIT 200
      `).all(supplierId).map(m => ({
        ...m,
        _id: m.id,
        montant: Number(m.montant || 0),
        soldeAvant: Number(m.soldeAvant || 0),
        soldeApres: Number(m.soldeApres || 0)
      }));

      // Décaissements associés au fournisseur dans cash_transactions
      const transactions = db.prepare(`
        SELECT * FROM cash_transactions
        WHERE UPPER(fournisseur) = UPPER(?) OR UPPER(tiers) = UPPER(?)
        ORDER BY id DESC LIMIT 100
      `).all(supplier.nom, supplier.nom).map(t => ({
        ...t,
        _id: t.id,
        montant: Number(t.montant || 0)
      }));

      return {
        success: true,
        data: normalizeSupplier(supplier),
        invoices,
        movements,
        transactions
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 3. Créer un fournisseur
  ipcMain.handle('supplier:create', async (event, supplierData) => {
    try {
      const nom = (supplierData.nom || '').trim();
      if (!nom) return { success: false, error: 'Le nom du fournisseur est obligatoire.' };

      const existing = db.prepare('SELECT id FROM suppliers WHERE UPPER(nom) = ?').get(nom.toUpperCase());
      if (existing) return { success: false, error: 'Un fournisseur avec ce nom existe déjà.' };

      const initialDebt = Number(supplierData.soldeDetteInitial || supplierData.soldeDette) || 0;

      const info = db.prepare(`
        INSERT INTO suppliers (nom, telephone, email, adresse, soldeDette, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        nom,
        (supplierData.telephone || '').trim(),
        (supplierData.email || '').trim(),
        (supplierData.adresse || '').trim(),
        initialDebt,
        supplierData.notes || ''
      );

      const supplierId = info.lastInsertRowid;

      if (initialDebt > 0) {
        db.prepare(`
          INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, motif)
          VALUES (?, 'SOLDE_INITIAL', ?, 0, ?, 'Solde initial de dette fournisseur')
        `).run(supplierId, initialDebt, initialDebt);
      }

      const created = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      return { success: true, data: normalizeSupplier(created) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 4. Mettre à jour un fournisseur
  ipcMain.handle('supplier:update', async (event, { id, updates }) => {
    try {
      const supplierId = parseInt(id, 10);
      const current = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      if (!current) return { success: false, error: 'Fournisseur introuvable' };

      db.prepare(`
        UPDATE suppliers 
        SET nom = ?, telephone = ?, email = ?, adresse = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        updates.nom !== undefined ? updates.nom.trim() : current.nom,
        updates.telephone !== undefined ? updates.telephone.trim() : current.telephone,
        updates.email !== undefined ? updates.email.trim() : current.email,
        updates.adresse !== undefined ? updates.adresse.trim() : current.adresse,
        updates.notes !== undefined ? updates.notes : current.notes,
        supplierId
      );

      const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      return { success: true, data: normalizeSupplier(updated) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 5. Supprimer un fournisseur
  ipcMain.handle('supplier:delete', async (event, id) => {
    try {
      const supplierId = parseInt(id, 10);
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      if (!supplier) return { success: false, error: 'Fournisseur introuvable' };

      if (Number(supplier.soldeDette || 0) > 0) {
        return { success: false, error: 'Impossible de supprimer un fournisseur ayant un solde de dette impayé.' };
      }

      db.transaction(() => {
        db.prepare('DELETE FROM supplier_movements WHERE supplier_id = ?').run(supplierId);
        db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
      })();

      return { success: true, message: 'Fournisseur supprimé avec succès.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 6. Effectuer un versement / règlement au fournisseur
  ipcMain.handle('supplier:recordPayment', async (event, paymentData) => {
    try {
      const { supplierId, montant, modePaiement = 'ESPECES', caisse = 'Caisse 1', notes = '', referenceDocument = '' } = paymentData;
      const sId = parseInt(supplierId, 10);
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(sId);
      if (!supplier) return { success: false, error: 'Fournisseur introuvable' };

      const montantPaye = parseFloat(montant);
      if (isNaN(montantPaye) || montantPaye <= 0) {
        return { success: false, error: 'Le montant du versement doit être supérieur à 0 DA.' };
      }

      const nowIso = new Date().toISOString();
      const oldDebt = Number(supplier.soldeDette || 0);
      const newDebt = Math.max(0, Math.round((oldDebt - montantPaye) * 100) / 100);

      const payTx = db.transaction(() => {
        // 1. Déduire la dette du fournisseur
        db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, sId);

        // 2. Mouvement de compte fournisseur
        const txNum = generateTxNumber('DEC');
        db.prepare(`
          INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
          VALUES (?, 'PAIEMENT_DETTE', ?, ?, ?, ?, ?, ?)
        `).run(
          sId,
          montantPaye,
          oldDebt,
          newDebt,
          referenceDocument || txNum,
          notes || `Versement au fournisseur ${supplier.nom} (${modePaiement})`,
          nowIso
        );

        // 3. Enregistrer le décaissement en trésorerie / caisse
        db.prepare(`
          INSERT INTO cash_transactions (
            numeroTransaction, type, categorie, montant, modePaiement, caisse,
            fournisseur, tiers, referenceDocument, motif, dateTransaction
          ) VALUES (?, 'DECAISSEMENT', 'REGLEMENT_FOURNISSEUR', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          txNum,
          montantPaye,
          modePaiement,
          caisse || 'Caisse 1',
          supplier.nom,
          supplier.nom,
          referenceDocument || txNum,
          notes || `Versement au fournisseur ${supplier.nom}`,
          nowIso
        );
      });

      payTx();
      const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(sId);
      return { success: true, data: normalizeSupplier(updated), message: 'Versement enregistré avec succès.' };
    } catch (error) {
      console.error('Erreur supplier:recordPayment', error);
      return { success: false, error: error.message };
    }
  });

  // 7. Exporter la situation fournisseur vers Excel
  ipcMain.handle('supplier:exportStatementExcel', async (event, supplierId) => {
    try {
      const sId = parseInt(supplierId, 10);
      const supplier = normalizeSupplier(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(sId));
      if (!supplier) return { success: false, error: 'Fournisseur introuvable' };

      const movements = db.prepare('SELECT * FROM supplier_movements WHERE supplier_id = ? ORDER BY id ASC').all(sId);

      const safeName = (supplier.nom || 'Fournisseur').replace(/[\\/:*?"<>|]/g, '_');
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: `Exporter la situation du fournisseur ${supplier.nom}`,
        defaultPath: `Situation_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel (*.xlsx)', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Export annulé.' };

      return await exportSupplierStatementToExcel(supplier, movements, filePath);
    } catch (error) {
      console.error('Erreur supplier:exportStatementExcel', error);
      return { success: false, error: error.message };
    }
  });

  // 8. Supprimer un mouvement / versement fournisseur
  ipcMain.handle('supplier:deleteMovement', async (event, movementId) => {
    try {
      const mId = parseInt(movementId, 10);
      const movement = db.prepare('SELECT * FROM supplier_movements WHERE id = ?').get(mId);
      if (!movement) return { success: false, error: 'Mouvement introuvable' };

      const supplierId = movement.supplier_id;
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      if (!supplier) return { success: false, error: 'Fournisseur introuvable' };

      const montant = Number(movement.montant || 0);
      let oldDebt = Number(supplier.soldeDette || 0);
      let newDebt = oldDebt;

      const isPayment = movement.type === 'PAIEMENT_DETTE' || movement.type === 'REGLEMENT' || movement.type === 'VERSEMENT';
      if (isPayment) {
        // Annuler le versement remet la dette due au fournisseur
        newDebt = Math.round((oldDebt + montant) * 100) / 100;
      } else {
        // Annuler une dette achat ou solde initial diminue la dette
        newDebt = Math.max(0, Math.round((oldDebt - montant) * 100) / 100);
      }

      db.transaction(() => {
        db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, supplierId);
        
        // Nettoyage de la transaction de trésorerie associée si existante
        if (movement.referenceFacture) {
          db.prepare('DELETE FROM cash_transactions WHERE referenceDocument = ? OR numeroTransaction = ?').run(
            movement.referenceFacture,
            movement.referenceFacture
          );
        }

        db.prepare('DELETE FROM supplier_movements WHERE id = ?').run(mId);
      })();

      const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      return { success: true, message: 'Opération supprimée avec succès', data: normalizeSupplier(updated) };
    } catch (error) {
      console.error('Erreur supplier:deleteMovement', error);
      return { success: false, error: error.message };
    }
  });

  // 9. Mettre à jour un mouvement / versement fournisseur
  ipcMain.handle('supplier:updateMovement', async (event, { id, updates }) => {
    try {
      const mId = parseInt(id, 10);
      const movement = db.prepare('SELECT * FROM supplier_movements WHERE id = ?').get(mId);
      if (!movement) return { success: false, error: 'Mouvement introuvable' };

      const supplierId = movement.supplier_id;
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      if (!supplier) return { success: false, error: 'Fournisseur introuvable' };

      const oldMontant = Number(movement.montant || 0);
      const newMontant = updates.montant !== undefined ? Number(updates.montant) : oldMontant;
      const delta = newMontant - oldMontant;

      let oldDebt = Number(supplier.soldeDette || 0);
      let newDebt = oldDebt;

      const isPayment = movement.type === 'PAIEMENT_DETTE' || movement.type === 'REGLEMENT' || movement.type === 'VERSEMENT';
      if (isPayment) {
        // Si le versement augmente, la dette diminue
        newDebt = Math.max(0, Math.round((oldDebt - delta) * 100) / 100);
      } else {
        newDebt = Math.max(0, Math.round((oldDebt + delta) * 100) / 100);
      }

      const newMotif = updates.motif !== undefined ? updates.motif : (updates.notes !== undefined ? updates.notes : movement.motif);

      db.transaction(() => {
        db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, supplierId);
        db.prepare(`
          UPDATE supplier_movements
          SET montant = ?, motif = ?, soldeApres = ?
          WHERE id = ?
        `).run(newMontant, newMotif, newDebt, mId);

        if (movement.referenceFacture) {
          db.prepare(`
            UPDATE cash_transactions
            SET montant = ?
            WHERE referenceDocument = ? OR numeroTransaction = ?
          `).run(newMontant, movement.referenceFacture, movement.referenceFacture);
        }
      })();

      const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
      return { success: true, message: 'Opération mise à jour avec succès', data: normalizeSupplier(updated) };
    } catch (error) {
      console.error('Erreur supplier:updateMovement', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerSupplierHandlers };