const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { exportReturnsToExcel } = require('../utils/excelService');

function generateSequentialReturnNumber(prefix = 'AVR') {
  const db = getDB();
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const pattern = `${prefix}-${dateStr}-%`;

  let tableName = 'sale_returns';
  let colName = 'numeroRetour';
  if (prefix === 'AVF' || prefix === 'RETA') {
    tableName = 'purchase_returns';
    colName = 'numeroAvoirAchat';
  }

  const last = db.prepare(`SELECT ${colName} as num FROM ${tableName} WHERE ${colName} LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
  let nextSeq = 1;
  if (last && last.num) {
    const parts = last.num.split('-');
    if (parts.length === 3) {
      nextSeq = (parseInt(parts[2], 10) || 0) + 1;
    }
  }

  return `${prefix}-${dateStr}-${String(nextSeq).padStart(4, '0')}`;
}

function normalizeSaleReturn(ret) {
  if (!ret) return null;
  const db = getDB();
  const items = db.prepare(`
    SELECT sri.*, p.nom as product_nom, p.reference as product_reference, p.unite as product_unite
    FROM sale_return_items sri
    LEFT JOIN products p ON sri.product_id = p.id
    WHERE sri.return_id = ?
  `).all(ret.id).map(it => ({
    ...it,
    _id: it.id,
    prixUnitaire: Number(it.prixUnitaire || 0),
    quantiteRetournee: Number(it.quantiteRetournee || 0),
    totalLigne: Number(it.totalLigne || 0),
    product: it.product_id ? { _id: it.product_id, nom: it.nom, reference: it.reference, unite: it.unite } : null
  }));

  let client = null;
  if (ret.client_id) {
    const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(ret.client_id);
    if (c) client = { ...c, _id: c.id };
  }

  let invoice = null;
  if (ret.invoice_id) {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(ret.invoice_id);
    if (inv) invoice = { ...inv, _id: inv.id };
  }

  const dateStr = ret.dateRetour || ret.created_at || new Date().toISOString();

  return {
    ...ret,
    _id: ret.id,
    kind: 'SALE_RETURN',
    dateRetour: dateStr,
    createdAt: dateStr,
    montantTotalRembourse: Number(ret.montantTotalRembourse || 0),
    items,
    client,
    invoice
  };
}

function normalizePurchaseReturn(ret) {
  if (!ret) return null;
  const db = getDB();
  const items = db.prepare(`
    SELECT pri.*, p.nom as product_nom, p.reference as product_reference, p.unite as product_unite
    FROM purchase_return_items pri
    LEFT JOIN products p ON pri.product_id = p.id
    WHERE pri.purchase_return_id = ?
  `).all(ret.id).map(it => ({
    ...it,
    _id: it.id,
    prixAchatUnitaire: Number(it.prixAchatUnitaire || 0),
    quantiteRetournee: Number(it.quantiteRetournee || 0),
    totalLigne: Number(it.totalLigne || 0),
    product: it.product_id ? { _id: it.product_id, nom: it.nom, reference: it.reference, unite: it.unite } : null
  }));

  let purchase = null;
  if (ret.purchase_id) {
    const pur = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(ret.purchase_id);
    if (pur) purchase = { ...pur, _id: pur.id };
  }

  const dateStr = ret.dateAvoirAchat || ret.created_at || new Date().toISOString();

  return {
    ...ret,
    _id: ret.id,
    kind: 'PURCHASE_RETURN',
    dateAvoirAchat: dateStr,
    createdAt: dateStr,
    montantTotal: Number(ret.montantTotal || 0),
    items,
    purchase
  };
}

function registerReturnHandlers(mainWindow) {
  const db = getDB();

  // 1. Obtenir les Avoirs Ventes & Bons de Livraison avec filtres (Nom, Produit, Date)
  ipcMain.handle('returns:getSaleReturns', async (event, filters = {}) => {
    try {
      let query = `
        SELECT sr.*, c.nom as client_nom_db, inv.numeroFacture as invoice_num_db
        FROM sale_returns sr
        LEFT JOIN customers c ON sr.client_id = c.id
        LEFT JOIN invoices inv ON sr.invoice_id = inv.id
        WHERE 1=1
      `;
      const params = [];

      // Filtre par Nom (Client, N° Avoir, N° Facture/BL)
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query += ` AND (sr.numeroRetour LIKE ? OR sr.clientLibre LIKE ? OR c.nom LIKE ? OR inv.numeroFacture LIKE ? OR sr.motif LIKE ?)`;
        params.push(term, term, term, term, term);
      }

      // Filtre par Type (AVOIR_VENTE, AVOIR_BL, TOUS)
      if (filters.typeDocument && filters.typeDocument !== 'TOUS') {
        query += ` AND sr.typeDocument = ?`;
        params.push(filters.typeDocument);
      }

      // Filtre par Produit (Nom ou Référence dans les lignes d'avoir)
      if (filters.productSearch && filters.productSearch.trim()) {
        const prodTerm = `%${filters.productSearch.trim()}%`;
        query += ` AND sr.id IN (
          SELECT return_id FROM sale_return_items 
          WHERE reference LIKE ? OR nom LIKE ?
        )`;
        params.push(prodTerm, prodTerm);
      }

      // Filtre par Date
      if (filters.period && filters.period !== 'all') {
        if (filters.period === 'today') {
          query += " AND date(COALESCE(sr.dateRetour, sr.created_at)) = date('now', 'localtime')";
        } else if (filters.period === 'yesterday') {
          query += " AND date(COALESCE(sr.dateRetour, sr.created_at)) = date('now', '-1 day', 'localtime')";
        } else if (filters.period === 'week') {
          query += " AND date(COALESCE(sr.dateRetour, sr.created_at)) >= date('now', '-7 days', 'localtime')";
        } else if (filters.period === 'month') {
          query += " AND date(COALESCE(sr.dateRetour, sr.created_at)) >= date('now', 'start of month', 'localtime')";
        } else if (filters.period === 'custom' && filters.startDate && filters.endDate) {
          query += ' AND date(COALESCE(sr.dateRetour, sr.created_at)) BETWEEN ? AND ?';
          params.push(filters.startDate, filters.endDate);
        }
      }

      query += ' ORDER BY sr.id DESC LIMIT 500';

      const rows = db.prepare(query).all(...params).map(normalizeSaleReturn);
      return { success: true, data: rows };
    } catch (error) {
      console.error('Erreur returns:getSaleReturns', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Obtenir les Avoirs Achats Fournisseurs avec filtres (Nom, Produit, Date)
  ipcMain.handle('returns:getPurchaseReturns', async (event, filters = {}) => {
    try {
      let query = `
        SELECT pr.*, pi.numeroFactureAchat as purchase_num_db
        FROM purchase_returns pr
        LEFT JOIN purchase_invoices pi ON pr.purchase_id = pi.id
        WHERE 1=1
      `;
      const params = [];

      // Filtre par Nom (Fournisseur, N° Avoir, N° Facture Achat)
      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query += ` AND (pr.numeroAvoirAchat LIKE ? OR pr.fournisseur LIKE ? OR pr.contactFournisseur LIKE ? OR pi.numeroFactureAchat LIKE ? OR pr.motif LIKE ?)`;
        params.push(term, term, term, term, term);
      }

      // Filtre par Produit (Nom ou Référence dans les lignes d'avoir achat)
      if (filters.productSearch && filters.productSearch.trim()) {
        const prodTerm = `%${filters.productSearch.trim()}%`;
        query += ` AND pr.id IN (
          SELECT purchase_return_id FROM purchase_return_items 
          WHERE reference LIKE ? OR nom LIKE ?
        )`;
        params.push(prodTerm, prodTerm);
      }

      // Filtre par Date
      if (filters.period && filters.period !== 'all') {
        if (filters.period === 'today') {
          query += " AND date(COALESCE(pr.dateAvoirAchat, pr.created_at)) = date('now', 'localtime')";
        } else if (filters.period === 'yesterday') {
          query += " AND date(COALESCE(pr.dateAvoirAchat, pr.created_at)) = date('now', '-1 day', 'localtime')";
        } else if (filters.period === 'week') {
          query += " AND date(COALESCE(pr.dateAvoirAchat, pr.created_at)) >= date('now', '-7 days', 'localtime')";
        } else if (filters.period === 'month') {
          query += " AND date(COALESCE(pr.dateAvoirAchat, pr.created_at)) >= date('now', 'start of month', 'localtime')";
        } else if (filters.period === 'custom' && filters.startDate && filters.endDate) {
          query += ' AND date(COALESCE(pr.dateAvoirAchat, pr.created_at)) BETWEEN ? AND ?';
          params.push(filters.startDate, filters.endDate);
        }
      }

      query += ' ORDER BY pr.id DESC LIMIT 500';

      const rows = db.prepare(query).all(...params).map(normalizePurchaseReturn);
      return { success: true, data: rows };
    } catch (error) {
      console.error('Erreur returns:getPurchaseReturns', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Créer un Avoir Vente / Bon de Livraison (Avoir Client)
  ipcMain.handle('returns:createSaleReturn', async (event, returnData) => {
    try {
      const {
        typeDocument = 'AVOIR_VENTE', // 'AVOIR_VENTE' ou 'AVOIR_BL'
        invoiceId = null,
        clientId = null,
        nomClientLibre = 'Client Comptoir',
        caisse = 'Caisse 1',
        items = [],
        motif = 'Retour marchandise',
        modeRemboursement = 'ESPECES',
        dateRetour = new Date().toISOString()
      } = returnData;

      if (!items || items.length === 0) {
        return { success: false, error: 'Veuillez ajouter au moins un article à retourner.' };
      }

      let parsedInvId = invoiceId ? parseInt(invoiceId, 10) : null;
      let parsedClientId = clientId ? parseInt(clientId, 10) : null;
      let invoice = null;

      if (parsedInvId) {
        invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(parsedInvId);
        if (invoice && !parsedClientId && invoice.client_id) {
          parsedClientId = invoice.client_id;
        }
      }

      let clientLibreName = nomClientLibre || 'Client Comptoir';
      if (parsedClientId) {
        const cust = db.prepare('SELECT nom FROM customers WHERE id = ?').get(parsedClientId);
        if (cust && cust.nom) {
          clientLibreName = cust.nom;
        }
      } else if (invoice && (invoice.clientLibre || invoice.nomClientLibre)) {
        clientLibreName = invoice.clientLibre || invoice.nomClientLibre;
      }

      const prefix = typeDocument === 'AVOIR_BL' ? 'AVBL' : 'AVR';
      const numeroRetour = generateSequentialReturnNumber(prefix);
      let totalRembourse = 0;

      const preparedItems = [];
      for (const it of items) {
        const qty = Number(it.quantiteRetournee || it.quantite) || 0;
        if (qty <= 0) continue;

        let prod = null;
        if (it.productId) {
          prod = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(it.productId, 10));
        }
        if (!prod && it.reference) {
          prod = db.prepare('SELECT * FROM products WHERE UPPER(reference) = ?').get(String(it.reference).trim().toUpperCase());
        }

        const pu = Number(it.prixUnitaire) || (prod ? prod.prixVente : 0);
        const totalLigne = Math.round((pu * qty) * 100) / 100;
        totalRembourse += totalLigne;

        preparedItems.push({
          productId: prod ? prod.id : null,
          reference: prod ? prod.reference : (it.reference || 'REF'),
          nom: prod ? prod.nom : (it.nom || 'Article'),
          unite: prod ? (prod.unite || 'pcs') : (it.unite || 'pcs'),
          quantite: qty,
          prixUnitaire: pu,
          totalLigne,
          currentStock: prod ? prod.quantite : 0
        });
      }

      if (preparedItems.length === 0) {
        return { success: false, error: 'Aucun article valide avec une quantité > 0.' };
      }

      const saleReturnTx = db.transaction(() => {
        const retInfo = db.prepare(`
          INSERT INTO sale_returns (numeroRetour, typeDocument, invoice_id, client_id, clientLibre, montantTotalRembourse, modeRemboursement, motif, dateRetour)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          numeroRetour,
          typeDocument,
          parsedInvId,
          parsedClientId,
          clientLibreName,
          totalRembourse,
          modeRemboursement,
          motif.trim(),
          dateRetour
        );

        const returnId = retInfo.lastInsertRowid;

        const itemStmt = db.prepare(`
          INSERT INTO sale_return_items (return_id, product_id, reference, nom, quantiteRetournee, prixUnitaire, unite, totalLigne)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updateStockStmt = db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const movStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, referenceDocument, motif, dateMouvement)
          VALUES (?, 'RETOUR_VENTE', ?, ?, ?, ?, ?, ?)
        `);

        for (const item of preparedItems) {
          itemStmt.run(
            returnId,
            item.productId,
            item.reference,
            item.nom,
            item.quantite,
            item.prixUnitaire,
            item.unite,
            item.totalLigne
          );

          if (item.productId) {
            const newStock = item.currentStock + item.quantite;
            updateStockStmt.run(newStock, item.productId);

            movStmt.run(
              item.productId,
              item.quantite,
              item.currentStock,
              newStock,
              numeroRetour,
              `Avoir client ${numeroRetour} : ${motif}`,
              dateRetour
            );
          }

          // Si le retour est lié à un bon spécifique, mettre à jour la quantité retournée sur la ligne du bon
          if (parsedInvId) {
            try {
              let invItem = null;
              if (item.productId) {
                invItem = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? AND product_id = ? LIMIT 1').get(parsedInvId, item.productId);
              }
              if (!invItem && item.reference) {
                invItem = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? AND reference = ? LIMIT 1').get(parsedInvId, item.reference);
              }
              if (!invItem && item.nom) {
                invItem = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? AND nom = ? LIMIT 1').get(parsedInvId, item.nom);
              }

              if (invItem) {
                const currentRet = Number(invItem.quantiteRetournee || 0);
                const newRet = currentRet + item.quantite;
                db.prepare('UPDATE invoice_items SET quantiteRetournee = ? WHERE id = ?').run(newRet, invItem.id);
              }
            } catch (errIt) {
              console.warn('Erreur mise à jour ligne bon retour:', errIt);
            }
          }
        }

        // Si le retour est lié à un bon, ajuster le totalTTC et le statut du bon
        if (parsedInvId) {
          try {
            const invRecord = db.prepare('SELECT * FROM invoices WHERE id = ?').get(parsedInvId);
            if (invRecord) {
              const newTotalTTC = Math.max(0, Math.round(((invRecord.totalTTC || 0) - totalRembourse) * 100) / 100);
              const newTotalHT = Math.max(0, Math.round(((invRecord.totalHT || 0) - totalRembourse) * 100) / 100);
              const newPaye = Math.min(newTotalTTC, Number(invRecord.montantPaye || 0));
              const newReste = Math.max(0, Math.round((newTotalTTC - newPaye) * 100) / 100);
              const newStatut = newTotalTTC === 0 ? 'ANNULE_RETOUR' : (newReste === 0 ? 'PAYE' : 'PARTIEL');

              db.prepare(`
                UPDATE invoices 
                SET totalTTC = ?, totalHT = ?, montantPaye = ?, montantReste = ?, statutPaiement = ?
                WHERE id = ?
              `).run(newTotalTTC, newTotalHT, newPaye, newReste, newStatut, parsedInvId);
            }
          } catch (errInv) {
            console.warn('Erreur mise à jour facture liée au retour:', errInv);
          }
        }

        // Si déduction sur dette client
        if (parsedClientId && modeRemboursement === 'DEDUCTION_DETTE') {
          const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(parsedClientId);
          if (cust) {
            const oldDebt = Number(cust.soldeDette || 0);
            const newDebt = Math.max(0, Math.round((oldDebt - totalRembourse) * 100) / 100);
            db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, parsedClientId);

            db.prepare(`
              INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
              VALUES (?, 'DECAISSEMENT_AVOIR', ?, ?, ?, ?, ?, ?)
            `).run(
              parsedClientId,
              totalRembourse,
              oldDebt,
              newDebt,
              numeroRetour,
              `Déduction suite à l'avoir ${numeroRetour}`,
              dateRetour
            );
          }
        }

        // Si remboursement en espèces, enregistrer une sortie de caisse (décaissement)
        if (modeRemboursement === 'ESPECES' && totalRembourse > 0) {
          const now = new Date();
          const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
          const last = db.prepare(`SELECT numeroTransaction FROM cash_transactions WHERE numeroTransaction LIKE ? ORDER BY id DESC LIMIT 1`).get(`DEC-${yyyymm}-%`);
          let seq = 1;
          if (last && last.numeroTransaction) {
            const parts = last.numeroTransaction.split('-');
            if (parts.length >= 3) {
              seq = parseInt(parts[2], 10) + 1;
            }
          }
          const txNum = `DEC-${yyyymm}-${String(seq).padStart(4, '0')}`;
          const activeCaisse = caisse || (invoice ? invoice.caisse : 'Caisse 1') || 'Caisse 1';

          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              client_id, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, 'DECAISSEMENT', 'RETOUR_VENTE', ?, 'ESPECES', ?, ?, ?, ?, ?, ?)
          `).run(
            txNum,
            totalRembourse,
            activeCaisse,
            parsedClientId,
            clientLibreName,
            numeroRetour,
            `Remboursement retour vente ${numeroRetour} : ${motif.trim()}`,
            dateRetour
          );
        }

        return returnId;
      });

      const returnId = saleReturnTx();
      const saved = db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(returnId);

      return { success: true, data: normalizeSaleReturn(saved) };
    } catch (error) {
      console.error('Erreur returns:createSaleReturn', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Créer un Avoir sur Achat Fournisseur (Retour Fournisseur)
  ipcMain.handle('returns:createPurchaseReturn', async (event, returnData) => {
    try {
      const {
        purchaseId = null,
        fournisseur = '',
        contactFournisseur = '',
        items = [],
        motif = 'Retour fournisseur pour non-conformité',
        modeRemboursement = 'ESPECES',
        dateAvoirAchat = new Date().toISOString()
      } = returnData;

      if (!fournisseur || !fournisseur.trim()) {
        return { success: false, error: 'Le nom du fournisseur est obligatoire.' };
      }

      if (!items || items.length === 0) {
        return { success: false, error: 'Veuillez ajouter au moins un article à retourner au fournisseur.' };
      }

      const parsedPurchaseId = purchaseId ? parseInt(purchaseId, 10) : null;
      const numeroAvoirAchat = generateSequentialReturnNumber('AVF');
      let montantTotal = 0;

      const preparedItems = [];
      for (const it of items) {
        const qty = Number(it.quantiteRetournee || it.quantite) || 0;
        if (qty <= 0) continue;

        let prod = null;
        if (it.productId) {
          prod = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(it.productId, 10));
        }
        if (!prod && it.reference) {
          prod = db.prepare('SELECT * FROM products WHERE UPPER(reference) = ?').get(String(it.reference).trim().toUpperCase());
        }

        const puAchat = Number(it.prixAchatUnitaire) || (prod ? prod.prixAchat : 0);
        const totalLigne = Math.round((puAchat * qty) * 100) / 100;
        montantTotal += totalLigne;

        preparedItems.push({
          productId: prod ? prod.id : null,
          reference: prod ? prod.reference : (it.reference || 'REF'),
          nom: prod ? prod.nom : (it.nom || 'Article'),
          unite: prod ? (prod.unite || 'pcs') : (it.unite || 'pcs'),
          quantite: qty,
          prixAchatUnitaire: puAchat,
          totalLigne,
          currentStock: prod ? prod.quantite : 0
        });
      }

      if (preparedItems.length === 0) {
        return { success: false, error: 'Aucun article valide avec une quantité > 0.' };
      }

      const purchaseReturnTx = db.transaction(() => {
        const pInfo = db.prepare(`
          INSERT INTO purchase_returns (numeroAvoirAchat, purchase_id, fournisseur, contactFournisseur, montantTotal, modeRemboursement, motif, dateAvoirAchat)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          numeroAvoirAchat,
          parsedPurchaseId,
          fournisseur.trim(),
          (contactFournisseur || '').trim(),
          montantTotal,
          modeRemboursement,
          motif.trim(),
          dateAvoirAchat
        );

        const returnId = pInfo.lastInsertRowid;

        const itemStmt = db.prepare(`
          INSERT INTO purchase_return_items (purchase_return_id, product_id, reference, nom, quantiteRetournee, prixAchatUnitaire, unite, totalLigne)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updateStockStmt = db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const movStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire, fournisseur, referenceDocument, motif, dateMouvement)
          VALUES (?, 'RETOUR_ACHAT_FOURNISSEUR', ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of preparedItems) {
          itemStmt.run(
            returnId,
            item.productId,
            item.reference,
            item.nom,
            item.quantite,
            item.prixAchatUnitaire,
            item.unite,
            item.totalLigne
          );

          if (item.productId) {
            // Décrémenter le stock car les articles retournent chez le fournisseur
            const newStock = Number(item.currentStock || 0) - item.quantite;
            updateStockStmt.run(newStock, item.productId);

            movStmt.run(
              item.productId,
              -item.quantite,
              item.currentStock,
              newStock,
              item.prixAchatUnitaire,
              fournisseur.trim(),
              numeroAvoirAchat,
              `Retour fournisseur ${numeroAvoirAchat} : ${motif}`,
              dateAvoirAchat
            );
          }
        }

        // Si remboursement en espèces, enregistrer une entrée en caisse (encaissement)
        if (modeRemboursement === 'ESPECES' && montantTotal > 0) {
          const now = new Date();
          const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
          const last = db.prepare(`SELECT numeroTransaction FROM cash_transactions WHERE numeroTransaction LIKE ? ORDER BY id DESC LIMIT 1`).get(`ENC-${yyyymm}-%`);
          let seq = 1;
          if (last && last.numeroTransaction) {
            const parts = last.numeroTransaction.split('-');
            if (parts.length >= 3) {
              seq = parseInt(parts[2], 10) + 1;
            }
          }
          const txNum = `ENC-${yyyymm}-${String(seq).padStart(4, '0')}`;

          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              fournisseur, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, 'ENCAISSEMENT', 'AVOIR_FOURNISSEUR', ?, 'ESPECES', 'Caisse 1', ?, ?, ?, ?, ?)
          `).run(
            txNum,
            montantTotal,
            fournisseur.trim(),
            fournisseur.trim(),
            numeroAvoirAchat,
            `Remboursement avoir fournisseur ${numeroAvoirAchat} : ${motif.trim()}`,
            dateAvoirAchat
          );
        }

        // Si déduction sur dette fournisseur
        if (modeRemboursement === 'DEDUCTION_DETTE' && montantTotal > 0) {
          const supp = db.prepare('SELECT * FROM suppliers WHERE UPPER(nom) = UPPER(?)').get(fournisseur.trim());
          if (supp) {
            const oldDebt = Number(supp.soldeDette || 0);
            const newDebt = Math.max(0, Math.round((oldDebt - montantTotal) * 100) / 100);
            db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, supp.id);

            db.prepare(`
              INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
              VALUES (?, 'DEDUCTION_AVOIR', ?, ?, ?, ?, ?, ?)
            `).run(
              supp.id,
              montantTotal,
              oldDebt,
              newDebt,
              numeroAvoirAchat,
              `Déduction suite à l'avoir fournisseur ${numeroAvoirAchat}`,
              dateAvoirAchat
            );
          }
        }

        return returnId;
      });

      const returnId = purchaseReturnTx();
      const saved = db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(returnId);

      return { success: true, data: normalizePurchaseReturn(saved) };
    } catch (error) {
      console.error('Erreur returns:createPurchaseReturn', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Supprimer / Annuler un Avoir Vente / BL
  ipcMain.handle('returns:deleteSaleReturn', async (event, id) => {
    try {
      const retId = parseInt(id, 10);
      const ret = normalizeSaleReturn(db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(retId));
      if (!ret) return { success: false, error: 'Avoir introuvable' };

      const deleteTx = db.transaction(() => {
        // Restaurer le stock (décrémenter la quantité qui avait été rajoutée)
        for (const item of ret.items) {
          if (item.product_id) {
            const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
            if (prod) {
              const newQty = Number(prod.quantite || 0) - item.quantiteRetournee;
              db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, prod.id);

              db.prepare(`
                INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, referenceDocument, motif)
                VALUES (?, 'AJUSTEMENT_INVENTAIRE', ?, ?, ?, ?, ?)
              `).run(
                prod.id,
                -item.quantiteRetournee,
                prod.quantite,
                newQty,
                `ANNULATION-${ret.numeroRetour}`,
                `Annulation avoir client ${ret.numeroRetour}`
              );
            }
          }
        }

        // Si déduction sur dette client, la remettre
        if (ret.client_id && ret.modeRemboursement === 'DEDUCTION_DETTE') {
          const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(ret.client_id);
          if (cust) {
            const oldDebt = Number(cust.soldeDette || 0);
            const newDebt = oldDebt + ret.montantTotalRembourse;
            db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, ret.client_id);
          }
        }

        // Supprimer la transaction de trésorerie associée
        db.prepare('DELETE FROM cash_transactions WHERE referenceDocument = ?').run(ret.numeroRetour);

        db.prepare('DELETE FROM sale_return_items WHERE return_id = ?').run(retId);
        db.prepare('DELETE FROM sale_returns WHERE id = ?').run(retId);
      });

      deleteTx();
      return { success: true, message: 'Avoir annulé et stock réajusté.' };
    } catch (error) {
      console.error('Erreur returns:deleteSaleReturn', error);
      return { success: false, error: error.message };
    }
  });

  // 6. Supprimer / Annuler un Avoir Achat Fournisseur
  ipcMain.handle('returns:deletePurchaseReturn', async (event, id) => {
    try {
      const retId = parseInt(id, 10);
      const ret = normalizePurchaseReturn(db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(retId));
      if (!ret) return { success: false, error: 'Avoir fournisseur introuvable' };

      const deleteTx = db.transaction(() => {
        // Restaurer le stock (ré-incrémenter le stock)
        for (const item of ret.items) {
          if (item.product_id) {
            const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
            if (prod) {
              const newQty = prod.quantite + item.quantiteRetournee;
              db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, prod.id);

              db.prepare(`
                INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, referenceDocument, motif)
                VALUES (?, 'AJUSTEMENT_INVENTAIRE', ?, ?, ?, ?, ?)
              `).run(
                prod.id,
                item.quantiteRetournee,
                prod.quantite,
                newQty,
                `ANNULATION-${ret.numeroAvoirAchat}`,
                `Annulation retour fournisseur ${ret.numeroAvoirAchat}`
              );
            }
          }
        }

        // Si déduction sur dette fournisseur, la remettre
        if (ret.fournisseur && ret.modeRemboursement === 'DEDUCTION_DETTE') {
          const supp = db.prepare('SELECT * FROM suppliers WHERE UPPER(nom) = UPPER(?)').get(ret.fournisseur.trim());
          if (supp) {
            const oldDebt = Number(supp.soldeDette || 0);
            const newDebt = oldDebt + ret.montantTotal;
            db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, supp.id);
          }
        }

        // Supprimer la transaction de trésorerie associée
        db.prepare('DELETE FROM cash_transactions WHERE referenceDocument = ?').run(ret.numeroAvoirAchat);

        db.prepare('DELETE FROM purchase_return_items WHERE purchase_return_id = ?').run(retId);
        db.prepare('DELETE FROM purchase_returns WHERE id = ?').run(retId);
      });

      deleteTx();
      return { success: true, message: 'Avoir fournisseur annulé et stock réajusté.' };
    } catch (error) {
      console.error('Erreur returns:deletePurchaseReturn', error);
      return { success: false, error: error.message };
    }
  });

  // 7. Exporter les avoirs en Excel
  ipcMain.handle('returns:exportExcel', async (event, { type = 'SALE', filters = {} }) => {
    try {
      const isSale = type === 'SALE';
      const defaultFilename = isSale 
        ? `Avoirs_Ventes_BL_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Avoirs_Achats_Fournisseurs_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: isSale ? 'Exporter les Avoirs Ventes / BL' : 'Exporter les Avoirs Achats Fournisseurs',
        defaultPath: defaultFilename,
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Export annulé' };

      let list = [];
      if (isSale) {
        list = db.prepare('SELECT * FROM sale_returns ORDER BY id DESC').all().map(normalizeSaleReturn);
      } else {
        list = db.prepare('SELECT * FROM purchase_returns ORDER BY id DESC').all().map(normalizePurchaseReturn);
      }

      return await exportReturnsToExcel(list, type, filePath);
    } catch (error) {
      console.error('Erreur returns:exportExcel', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerReturnHandlers };
