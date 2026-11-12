const { ipcMain, dialog } = require('electron');
const { getDB, persistToDisk } = require('../database/sqlite');
const { exportLossesToExcel } = require('../utils/excelService');
const { format, startOfWeek, startOfMonth, startOfYear } = require('date-fns');

function registerLossHandlers(mainWindow) {
  const db = getDB();

  // 1. Obtenir toutes les déclarations de pertes & casse avec filtres et statistiques
  ipcMain.handle('loss:getAll', async (event, filters = {}) => {
    try {
      let query = 'SELECT * FROM product_losses WHERE 1=1';
      const params = [];

      // Filtre par texte (recherche)
      if (filters.search) {
        query += ' AND (numeroDeclaration LIKE ? OR reference LIKE ? OR nom LIKE ? OR categorie LIKE ? OR motif LIKE ? OR declarePar LIKE ? OR taille LIKE ? OR pointure LIKE ? OR couleur LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term, term, term, term, term, term, term, term);
      }

      // Filtre par type de perte
      if (filters.typePerte && filters.typePerte !== 'TOUS') {
        query += ' AND typePerte = ?';
        params.push(filters.typePerte);
      }

      // Filtre par catégorie
      if (filters.categorie && filters.categorie !== 'TOUS') {
        query += ' AND categorie = ?';
        params.push(filters.categorie);
      }

      // Filtre par Date
      if (filters.dateFilter) {
        const now = new Date();
        if (filters.dateFilter === 'TODAY') {
          const todayStr = format(now, 'yyyy-MM-dd');
          query += ' AND dateDeclaration LIKE ?';
          params.push(`${todayStr}%`);
        } else if (filters.dateFilter === 'THIS_WEEK') {
          const weekStart = format(startOfWeek(now, { weekStartsOn: 6 }), 'yyyy-MM-dd');
          query += ' AND dateDeclaration >= ?';
          params.push(weekStart);
        } else if (filters.dateFilter === 'THIS_MONTH') {
          const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
          query += ' AND dateDeclaration >= ?';
          params.push(monthStart);
        } else if (filters.dateFilter === 'CUSTOM' && filters.startDate && filters.endDate) {
          query += ' AND dateDeclaration >= ? AND dateDeclaration <= ?';
          params.push(`${filters.startDate} 00:00:00`, `${filters.endDate} 23:59:59`);
        }
      }

      query += ' ORDER BY id DESC';

      const rows = db.prepare(query).all(...params);

      // Statistiques globales
      let totalQuantite = 0;
      let totalValeurPerte = 0;
      let countIncidents = rows.length;

      const currentMonthPrefix = format(new Date(), 'yyyy-MM');
      let countCeMois = 0;
      let valeurCeMois = 0;

      for (const r of rows) {
        totalQuantite += Number(r.quantite || 0);
        totalValeurPerte += Number(r.valeurPerte || 0);

        if (r.dateDeclaration && r.dateDeclaration.startsWith(currentMonthPrefix)) {
          countCeMois++;
          valeurCeMois += Number(r.valeurPerte || 0);
        }
      }

      return {
        success: true,
        data: rows,
        stats: {
          totalQuantite,
          totalValeurPerte,
          countIncidents,
          countCeMois,
          valeurCeMois
        }
      };
    } catch (error) {
      console.error('Erreur loss:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Déclarer une perte / casse avec décrémentation automatique du stock
  ipcMain.handle('loss:create', async (event, lossData) => {
    try {
      const productId = parseInt(lossData.product_id, 10);
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!product) {
        return { success: false, error: 'Produit introuvable en stock.' };
      }

      const quantitePerdue = Number(lossData.quantite) || 0;
      if (quantitePerdue <= 0) {
        return { success: false, error: 'La quantité déclarée doit être supérieure à zéro.' };
      }

      // Génération du numéro séquentiel PRT-YYYYMM-XXXX
      const datePrefix = format(new Date(), 'yyyyMM');
      const countRow = db.prepare("SELECT COUNT(*) as c FROM product_losses WHERE numeroDeclaration LIKE ?").get(`PRT-${datePrefix}%`);
      const nextNum = (countRow ? countRow.c : 0) + 1;
      const numeroDeclaration = `PRT-${datePrefix}-${String(nextNum).padStart(4, '0')}`;

      const prixAchat = Number(product.prixAchat || 0);
      const prixVente = Number(product.prixVente || 0);
      const valeurPerte = Number(lossData.valeurPerte !== undefined ? lossData.valeurPerte : (quantitePerdue * prixAchat));

      const dateDeclaration = lossData.dateDeclaration || new Date().toISOString().replace('T', ' ').substring(0, 19);

      // 1. Insertion dans product_losses
      const stmt = db.prepare(`
        INSERT INTO product_losses (
          numeroDeclaration, product_id, reference, nom, categorie,
          taille, pointure, couleur, genre, quantite,
          prixAchatUnitaire, prixVenteUnitaire, valeurPerte,
          typePerte, motif, declarePar, dateDeclaration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        numeroDeclaration,
        productId,
        product.reference,
        product.nom,
        product.categorie || '',
        product.taille || lossData.taille || '',
        product.pointure || lossData.pointure || '',
        product.couleur || lossData.couleur || '',
        product.genre || lossData.genre || '',
        quantitePerdue,
        prixAchat,
        prixVente,
        valeurPerte,
        lossData.typePerte || 'CASSE',
        lossData.motif || '',
        lossData.declarePar || 'Responsable Stock',
        dateDeclaration,
        dateDeclaration
      );

      const lossId = info.lastInsertRowid;

      // 2. Décrémentation automatique du stock
      const qteAvant = Number(product.quantite || 0);
      const qteApres = Math.max(0, qteAvant - quantitePerdue);

      db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qteApres, productId);

      // 3. Traçabilité dans stock_movements
      const typeLabel = lossData.typePerte === 'CASSE' ? 'Casse matériel' :
                        lossData.typePerte === 'PERTE_VOL' ? 'Perte / Vol' :
                        lossData.typePerte === 'DEFAUT_FABRICATION' ? 'Défaut fabrication' :
                        lossData.typePerte === 'PERIME_AVARIE' ? 'Produit avarié / périmé' :
                        lossData.typePerte === 'DEGAT_TRANSPORT' ? 'Dégât transport' : 'Perte / Dépréciation';

      db.prepare(`
        INSERT INTO stock_movements (
          product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire,
          referenceDocument, motif, dateMouvement, created_at
        ) VALUES (?, 'PERTE_CASSE', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        -quantitePerdue,
        qteAvant,
        qteApres,
        prixAchat,
        numeroDeclaration,
        `[${typeLabel}] ${lossData.motif || 'Déclaration de perte'}`,
        dateDeclaration,
        dateDeclaration
      );

      persistToDisk();

      const created = db.prepare('SELECT * FROM product_losses WHERE id = ?').get(lossId);
      return { success: true, data: created };
    } catch (error) {
      console.error('Erreur loss:create', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Annuler / Supprimer une déclaration de perte (ré-incrémentation du stock)
  ipcMain.handle('loss:delete', async (event, id) => {
    try {
      const lossId = parseInt(id, 10);
      const loss = db.prepare('SELECT * FROM product_losses WHERE id = ?').get(lossId);
      if (!loss) {
        return { success: false, error: 'Déclaration introuvable.' };
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(loss.product_id);
      if (product) {
        const qteAvant = Number(product.quantite || 0);
        const qteApres = qteAvant + Number(loss.quantite || 0);

        db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qteApres, loss.product_id);

        db.prepare(`
          INSERT INTO stock_movements (
            product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire,
            referenceDocument, motif, dateMouvement
          ) VALUES (?, 'ANNULATION_PERTE', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          loss.product_id,
          Number(loss.quantite || 0),
          qteAvant,
          qteApres,
          Number(loss.prixAchatUnitaire || 0),
          loss.numeroDeclaration,
          `Annulation de la déclaration de perte ${loss.numeroDeclaration}`
        );
      }

      db.prepare('DELETE FROM product_losses WHERE id = ?').run(lossId);
      persistToDisk();

      return { success: true, message: 'Déclaration annulée et stock ré-incrémenté.' };
    } catch (error) {
      console.error('Erreur loss:delete', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Exportation Excel des Pertes & Casse
  ipcMain.handle('loss:exportExcel', async (event, filters = {}) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter le Registre des Pertes & Casse',
        defaultPath: `Pertes_Casse_CommercePost_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
        filters: [{ name: 'Fichier Excel (*.xlsx)', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) {
        return { success: false, message: 'Exportation annulée.' };
      }

      let query = 'SELECT * FROM product_losses WHERE 1=1';
      const params = [];

      if (filters.search) {
        query += ' AND (numeroDeclaration LIKE ? OR reference LIKE ? OR nom LIKE ? OR categorie LIKE ? OR motif LIKE ? OR declarePar LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term, term, term, term, term);
      }

      if (filters.typePerte && filters.typePerte !== 'TOUS') {
        query += ' AND typePerte = ?';
        params.push(filters.typePerte);
      }

      query += ' ORDER BY id DESC';

      const rows = db.prepare(query).all(...params);
      const result = await exportLossesToExcel(rows, filePath);

      return result;
    } catch (error) {
      console.error('Erreur loss:exportExcel', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Modifier une déclaration de perte (ajustement différentiel du stock)
  ipcMain.handle('loss:update', async (event, { id, data }) => {
    try {
      const lossId = parseInt(id, 10);
      const existing = db.prepare('SELECT * FROM product_losses WHERE id = ?').get(lossId);
      if (!existing) return { success: false, error: 'Déclaration introuvable.' };

      const oldQty = Number(existing.quantite || 0);
      const newQty = Number(data.quantite !== undefined ? data.quantite : oldQty);
      const diffQty = newQty - oldQty;

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.product_id);
      if (product && diffQty !== 0) {
        const qteAvant = Number(product.quantite || 0);
        const qteApres = Math.max(0, qteAvant - diffQty);

        db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qteApres, existing.product_id);

        db.prepare(`
          INSERT INTO stock_movements (
            product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire,
            referenceDocument, motif, dateMouvement
          ) VALUES (?, 'MODIFICATION_PERTE', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          existing.product_id,
          -diffQty,
          qteAvant,
          qteApres,
          Number(existing.prixAchatUnitaire || 0),
          existing.numeroDeclaration,
          `Modification déclaration perte ${existing.numeroDeclaration} (anc: ${oldQty}, nouv: ${newQty})`
        );
      }

      const pu = Number(existing.prixAchatUnitaire || 0);
      const newValeurPerte = Math.round(newQty * pu * 100) / 100;

      db.prepare(`
        UPDATE product_losses SET
          typePerte = ?,
          quantite = ?,
          valeurPerte = ?,
          motif = ?,
          declarePar = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.typePerte || existing.typePerte,
        newQty,
        newValeurPerte,
        data.motif !== undefined ? data.motif : existing.motif,
        data.declarePar !== undefined ? data.declarePar : existing.declarePar,
        lossId
      );

      persistToDisk();
      const updated = db.prepare('SELECT * FROM product_losses WHERE id = ?').get(lossId);
      return { success: true, data: updated, message: 'Déclaration mise à jour.' };
    } catch (error) {
      console.error('Erreur loss:update', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerLossHandlers
};
