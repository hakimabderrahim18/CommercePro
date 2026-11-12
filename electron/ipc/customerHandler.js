const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { exportCustomersToExcel, importCustomersFromExcel, exportCustomerStatementToExcel } = require('../utils/excelService');

function normalizeCustomer(c) {
  if (!c) return null;
  return {
    ...c,
    _id: c.id,
    plafondCredit: Number(c.plafondCredit || 0),
    soldeDette: Number(c.soldeDette || 0)
  };
}

function registerCustomerHandlers(mainWindow) {
  const db = getDB();

  // 1. Obtenir tous les clients
  ipcMain.handle('customer:getAll', async (event, filters = {}) => {
    try {
      let query = 'SELECT * FROM customers WHERE 1=1';
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

      const customers = db.prepare(query).all(...params).map(normalizeCustomer);
      const totalDettes = customers.reduce((sum, c) => sum + (c.soldeDette || 0), 0);

      return { success: true, data: customers, totalDettes };
    } catch (error) {
      console.error('Erreur customer:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Obtenir un client par ID
  ipcMain.handle('customer:getById', async (event, id) => {
    try {
      const customerId = parseInt(id, 10);
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      if (!customer) return { success: false, error: 'Client introuvable' };

      const movements = db.prepare(`
        SELECT m.*, i.numeroFacture as invoice_numero, i.totalTTC as invoice_totalTTC
        FROM account_movements m
        LEFT JOIN invoices i ON m.referenceFacture = i.numeroFacture
        WHERE m.client_id = ?
        ORDER BY m.id DESC LIMIT 100
      `).all(customerId).map(m => ({
        ...m,
        _id: m.id,
        factureAssociee: m.invoice_numero ? { numeroFacture: m.invoice_numero, totalTTC: m.invoice_totalTTC } : null
      }));

      // Factures et bons de vente du client avec leurs articles
      const invoices = db.prepare(`
        SELECT * FROM invoices 
        WHERE client_id = ?
        ORDER BY id DESC
      `).all(customerId).map(inv => {
        const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
        return {
          ...inv,
          _id: inv.id,
          totalHT: Number(inv.totalHT || 0),
          totalTTC: Number(inv.totalTTC || 0),
          montantPaye: Number(inv.montantPaye || 0),
          montantReste: Number(inv.montantReste !== undefined ? inv.montantReste : (inv.totalTTC - inv.montantPaye)),
          items: items.map(it => ({ ...it, _id: it.id }))
        };
      });

      return { success: true, data: normalizeCustomer(customer), movements, invoices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 3. Créer un nouveau client
  ipcMain.handle('customer:create', async (event, customerData) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO customers (nom, telephone, email, adresse, plafondCredit, soldeDette, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const initialDebt = Number(customerData.soldeDetteInitial) || 0;
      const info = stmt.run(
        customerData.nom.trim(),
        (customerData.telephone || '').trim(),
        (customerData.email || '').trim(),
        (customerData.adresse || '').trim(),
        Number(customerData.plafondCredit) || 0,
        initialDebt,
        customerData.notes || ''
      );

      const customerId = info.lastInsertRowid;

      if (initialDebt > 0) {
        db.prepare(`
          INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, motif)
          VALUES (?, 'AJUSTEMENT', ?, 0, ?, 'Solde initial à la création du compte')
        `).run(customerId, initialDebt, initialDebt);
      }

      const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      return { success: true, data: normalizeCustomer(created) };
    } catch (error) {
      console.error('Erreur customer:create', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Mettre à jour un client
  ipcMain.handle('customer:update', async (event, { id, updates }) => {
    try {
      const customerId = parseInt(id, 10);
      const current = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      if (!current) return { success: false, error: 'Client introuvable' };

      db.prepare(`
        UPDATE customers 
        SET nom = ?, telephone = ?, email = ?, adresse = ?, plafondCredit = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        updates.nom !== undefined ? updates.nom.trim() : current.nom,
        updates.telephone !== undefined ? updates.telephone.trim() : current.telephone,
        updates.email !== undefined ? updates.email.trim() : current.email,
        updates.adresse !== undefined ? updates.adresse.trim() : current.adresse,
        updates.plafondCredit !== undefined ? Number(updates.plafondCredit) : current.plafondCredit,
        updates.notes !== undefined ? updates.notes : current.notes,
        customerId
      );

      const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      return { success: true, data: normalizeCustomer(updated) };
    } catch (error) {
      console.error('Erreur customer:update', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Encaisser un règlement
  ipcMain.handle('customer:addPayment', async (event, paymentData) => {
    try {
      const { clientId, montant, modeReglement = 'ESPECES', motif = '' } = paymentData;
      const customerId = parseInt(clientId, 10);
      const amount = Number(montant);

      if (!amount || amount <= 0) {
        return { success: false, error: 'Le montant du versement doit être supérieur à 0.' };
      }

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      if (!customer) return { success: false, error: 'Client introuvable' };

      const oldDebt = Number(customer.soldeDette || 0);
      const newDebt = Math.max(0, Math.round((oldDebt - amount) * 100) / 100);

      db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, customerId);

      const movInfo = db.prepare(`
        INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, motif)
        VALUES (?, 'ENCAISSEMENT_REGLEMENT', ?, ?, ?, ?)
      `).run(
        customerId,
        amount,
        oldDebt,
        newDebt,
        motif || `Règlement dette client (${modeReglement})`
      );

      const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      const movement = db.prepare('SELECT * FROM account_movements WHERE id = ?').get(movInfo.lastInsertRowid);

      return { success: true, data: normalizeCustomer(updated), movement: { ...movement, _id: movement.id } };
    } catch (error) {
      console.error('Erreur customer:addPayment', error);
      return { success: false, error: error.message };
    }
  });

  // 6. Décaisser un avoir / Remboursement
  ipcMain.handle('customer:addRefund', async (event, refundData) => {
    try {
      const { clientId, montant, motif = '' } = refundData;
      const customerId = parseInt(clientId, 10);
      const amount = Number(montant);

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      if (!customer) return { success: false, error: 'Client introuvable' };

      const oldDebt = Number(customer.soldeDette || 0);
      const newDebt = Math.round((oldDebt + amount) * 100) / 100;

      db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, customerId);

      const movInfo = db.prepare(`
        INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, motif)
        VALUES (?, 'DECAISSEMENT_AVOIR', ?, ?, ?, ?)
      `).run(
        customerId,
        amount,
        oldDebt,
        newDebt,
        motif || 'Avoir / Remboursement client'
      );

      const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      const movement = db.prepare('SELECT * FROM account_movements WHERE id = ?').get(movInfo.lastInsertRowid);

      return { success: true, data: normalizeCustomer(updated), movement: { ...movement, _id: movement.id } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 7. Obtenir les mouvements de compte (Relevé client)
  ipcMain.handle('customer:getMovements', async (event, filters = {}) => {
    try {
      let query = `
        SELECT m.*, c.nom as client_nom, c.telephone as client_tel, c.email as client_email,
               i.numeroFacture as invoice_numero, i.totalTTC as invoice_totalTTC
        FROM account_movements m
        JOIN customers c ON m.client_id = c.id
        LEFT JOIN invoices i ON m.referenceFacture = i.numeroFacture
        WHERE 1=1
      `;
      const params = [];

      if (filters.clientId) {
        query += ' AND m.client_id = ?';
        params.push(parseInt(filters.clientId, 10));
      }

      if (filters.type && filters.type !== 'TOUS') {
        query += ' AND m.type = ?';
        params.push(filters.type);
      }

      query += ' ORDER BY m.id DESC LIMIT 500';

      const movements = db.prepare(query).all(...params).map(m => ({
        ...m,
        _id: m.id,
        client: { _id: m.client_id, nom: m.client_nom, telephone: m.client_tel, email: m.client_email },
        factureAssociee: m.invoice_numero ? { numeroFacture: m.invoice_numero, totalTTC: m.invoice_totalTTC } : null
      }));

      return { success: true, data: movements };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 8. Supprimer un client
  ipcMain.handle('customer:delete', async (event, id) => {
    try {
      const customerId = parseInt(id, 10);
      const count = db.prepare('SELECT COUNT(*) as cnt FROM invoices WHERE client_id = ?').get(customerId).cnt;
      if (count > 0) {
        return {
          success: false,
          error: `Impossible de supprimer ce client car il possède ${count} facture(s) enregistrée(s).`
        };
      }

      db.prepare('DELETE FROM account_movements WHERE client_id = ?').run(customerId);
      db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);

      return { success: true, message: 'Client supprimé avec succès' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 9. Exporter les clients en Excel
  ipcMain.handle('customer:exportExcel', async (event, filters = {}) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter la liste des clients vers Excel',
        defaultPath: `Clients_CommercePost_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Exportation annulée.' };

      let query = 'SELECT * FROM customers WHERE 1=1';
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

      const customers = db.prepare(query).all(...params).map(normalizeCustomer);
      return await exportCustomersToExcel(customers, filePath);
    } catch (error) {
      console.error('Erreur customer:exportExcel', error);
      return { success: false, error: error.message };
    }
  });

  // 10. Importer des clients depuis un fichier Excel / CSV
  ipcMain.handle('customer:importExcel', async () => {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Importer un fichier Excel de clients',
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile']
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, message: 'Importation annulée.' };
      }

      const rows = await importCustomersFromExcel(filePaths[0]);
      if (!rows || rows.length === 0) {
        return { success: false, error: 'Aucun client valide trouvé dans le fichier Excel.' };
      }

      let inserted = 0;
      let updated = 0;

      const importTx = db.transaction(() => {
        for (const row of rows) {
          const existing = db.prepare('SELECT * FROM customers WHERE LOWER(nom) = ? OR (telephone != "" AND telephone = ?)').get(
            row.nom.toLowerCase(),
            row.telephone
          );

          if (existing) {
            db.prepare(`
              UPDATE customers 
              SET telephone = CASE WHEN ? != '' THEN ? ELSE telephone END,
                  email = CASE WHEN ? != '' THEN ? ELSE email END,
                  adresse = CASE WHEN ? != '' THEN ? ELSE adresse END,
                  plafondCredit = CASE WHEN ? > 0 THEN ? ELSE plafondCredit END,
                  notes = CASE WHEN ? != '' THEN ? ELSE notes END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(
              row.telephone, row.telephone,
              row.email, row.email,
              row.adresse, row.adresse,
              row.plafondCredit, row.plafondCredit,
              row.notes, row.notes,
              existing.id
            );
            updated++;
          } else {
            const info = db.prepare(`
              INSERT INTO customers (nom, telephone, email, adresse, plafondCredit, soldeDette, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              row.nom,
              row.telephone,
              row.email,
              row.adresse,
              row.plafondCredit,
              row.soldeDette,
              row.notes
            );

            if (row.soldeDette > 0) {
              db.prepare(`
                INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, motif)
                VALUES (?, 'DETTE_VENTE', ?, 0, ?, 'Solde de départ importé via Excel')
              `).run(info.lastInsertRowid, row.soldeDette, row.soldeDette);
            }

            inserted++;
          }
        }
      });

      importTx();

      return {
        success: true,
        count: inserted + updated,
        inserted,
        updated,
        message: `${inserted} nouveau(x) client(s) ajouté(s) et ${updated} mis à jour.`
      };
    } catch (error) {
      console.error('Erreur customer:importExcel', error);
      return { success: false, error: error.message };
    }
  });

  // 11. Exporter le relevé de compte client vers Excel
  ipcMain.handle('customer:exportStatementExcel', async (event, clientId) => {
    try {
      const cId = parseInt(clientId, 10);
      const customer = normalizeCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(cId));
      if (!customer) return { success: false, error: 'Client introuvable' };

      const movements = db.prepare('SELECT * FROM account_movements WHERE client_id = ? ORDER BY id ASC').all(cId);

      const safeName = (customer.nom || 'Client').replace(/[\\/:*?"<>|]/g, '_');
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: `Exporter le relevé du client ${customer.nom}`,
        defaultPath: `Releve_${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel (*.xlsx)', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Export annulé.' };

      return await exportCustomerStatementToExcel(customer, movements, filePath);
    } catch (error) {
      console.error('Erreur customer:exportStatementExcel', error);
      return { success: false, error: error.message };
    }
  });

  // 12. Supprimer un mouvement / opération de compte client
  ipcMain.handle('customer:deleteMovement', async (event, movementId) => {
    try {
      const mId = parseInt(movementId, 10);
      const movement = db.prepare('SELECT * FROM account_movements WHERE id = ?').get(mId);
      if (!movement) return { success: false, error: 'Mouvement introuvable' };

      const customerId = movement.client_id;
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      if (!customer) return { success: false, error: 'Client introuvable' };

      const montant = Number(movement.montant || 0);
      let oldDebt = Number(customer.soldeDette || 0);
      let newDebt = oldDebt;

      // Si c'était un règlement, l'annuler remet la dette
      if (movement.type === 'ENCAISSEMENT_REGLEMENT') {
        newDebt = Math.round((oldDebt + montant) * 100) / 100;
      } else if (movement.type === 'DETTE_VENTE' || movement.type === 'AJUSTEMENT' || movement.type === 'DECAISSEMENT_AVOIR') {
        newDebt = Math.max(0, Math.round((oldDebt - montant) * 100) / 100);
      }

      db.transaction(() => {
        db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, customerId);
        db.prepare('DELETE FROM account_movements WHERE id = ?').run(mId);
      })();

      const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      return { success: true, message: 'Opération supprimée avec succès', data: normalizeCustomer(updated) };
    } catch (error) {
      console.error('Erreur customer:deleteMovement', error);
      return { success: false, error: error.message };
    }
  });

  // 13. Mettre à jour un mouvement / opération de compte client
  ipcMain.handle('customer:updateMovement', async (event, { id, updates }) => {
    try {
      const mId = parseInt(id, 10);
      const movement = db.prepare('SELECT * FROM account_movements WHERE id = ?').get(mId);
      if (!movement) return { success: false, error: 'Mouvement introuvable' };

      const customerId = movement.client_id;
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      if (!customer) return { success: false, error: 'Client introuvable' };

      const oldMontant = Number(movement.montant || 0);
      const newMontant = updates.montant !== undefined ? Number(updates.montant) : oldMontant;
      const delta = newMontant - oldMontant;

      let oldDebt = Number(customer.soldeDette || 0);
      let newDebt = oldDebt;

      if (movement.type === 'ENCAISSEMENT_REGLEMENT') {
        // Si le versement a augmenté, la dette diminue
        newDebt = Math.max(0, Math.round((oldDebt - delta) * 100) / 100);
      } else if (movement.type === 'DETTE_VENTE' || movement.type === 'AJUSTEMENT') {
        newDebt = Math.max(0, Math.round((oldDebt + delta) * 100) / 100);
      }

      const newMotif = updates.motif !== undefined ? updates.motif : movement.motif;

      db.transaction(() => {
        db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, customerId);
        db.prepare(`
          UPDATE account_movements 
          SET montant = ?, motif = ?, soldeApres = ?
          WHERE id = ?
        `).run(newMontant, newMotif, newDebt, mId);
      })();

      const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      return { success: true, message: 'Opération mise à jour avec succès', data: normalizeCustomer(updated) };
    } catch (error) {
      console.error('Erreur customer:updateMovement', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCustomerHandlers };
