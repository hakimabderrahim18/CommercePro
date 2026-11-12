const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { generateProductBarcode } = require('../utils/barcodeGenerator');
const { exportPurchasesToExcel } = require('../utils/excelService');

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

function registerPurchaseHandlers(mainWindow) {
  const db = getDB();

  // 1. Créer une facture d'achat fournisseur ou bon de commande
  ipcMain.handle('purchase:create', async (event, purchaseData) => {
    try {
      const {
        numeroFactureAchat = '',
        typeDocument = 'FACTURE_ACHAT',
        caisse = 'Caisse 1',
        supplier_id = null,
        fournisseur = '',
        contactFournisseur = '',
        items = [],
        tauxTva = 0,
        montantTimbre = 0,
        remise = 0,
        montantPaye = 0,
        modePaiement = 'ESPECES',
        notes = '',
        dateFactureAchat = new Date().toISOString()
      } = purchaseData;

      const nomFournisseur = fournisseur.trim();
      if (!nomFournisseur) {
        return { success: false, error: 'Veuillez saisir le nom du fournisseur.' };
      }

      if (!items || items.length === 0) {
        return { success: false, error: 'Veuillez ajouter au moins un article dans la facture d’achat.' };
      }

      // Générer numéro de facture / bon de commande d'achat si vide
      let numFac = numeroFactureAchat.trim();
      if (!numFac) {
        const prefix = typeDocument === 'BON_COMMANDE_ACHAT' ? 'BCA' : 'FA';
        const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
        const last = db.prepare("SELECT numeroFactureAchat FROM purchase_invoices WHERE numeroFactureAchat LIKE ? ORDER BY id DESC LIMIT 1").get(`${prefix}-${dateStr}-%`);
        let seq = 1;
        if (last && last.numeroFactureAchat) {
          const parts = last.numeroFactureAchat.split('-');
          if (parts.length === 3) seq = (parseInt(parts[2], 10) || 0) + 1;
        }
        numFac = `${prefix}-${dateStr}-${String(seq).padStart(4, '0')}`;
      }

      let totalHT = 0;
      const preparedItems = [];

      for (const item of items) {
        const qty = Number(item.quantite) || 1;
        const puAchat = Number(item.prixAchatUnitaire) || 0;
        const totalLigne = Math.round((puAchat * qty) * 100) / 100;
        totalHT += totalLigne;

        preparedItems.push({
          productId: item.productId ? parseInt(item.productId, 10) : null,
          reference: (item.reference || '').trim().toUpperCase(),
          nom: (item.nom || '').trim(),
          categorie: item.categorie || 'Général',
          quantite: qty,
          prixAchatUnitaire: puAchat,
          prixVente: Number(item.prixVente) || Math.round(puAchat * 1.3),
          prixDemiGros: Number(item.prixDemiGros) || Math.round(puAchat * 1.2),
          prixGros: Number(item.prixGros) || Math.round(puAchat * 1.15),
          prixSuperGros: Number(item.prixSuperGros) || Math.round(puAchat * 1.1),
          unite: item.unite || 'pcs',
          totalLigne
        });
      }

      const remiseVal = Number(remise) || 0;
      const netHT = Math.max(0, totalHT - remiseVal);
      const montantTva = Math.round((netHT * (Number(tauxTva) / 100)) * 100) / 100;
      const timbreVal = Number(montantTimbre) || 0;
      const totalTTC = Math.round((netHT + montantTva + timbreVal) * 100) / 100;
      const paye = Number(montantPaye) || 0;
      const montantReste = Math.max(0, Math.round((totalTTC - paye) * 100) / 100);
      const statutPaiement = montantReste === 0 ? 'PAYE' : paye > 0 ? 'PARTIEL' : 'NON_PAYE';

      const purchaseTx = db.transaction(() => {
        // Obtenir ou créer le fournisseur
        let finalSupplierId = supplier_id ? parseInt(supplier_id, 10) : null;
        if (!finalSupplierId) {
          const suppRow = db.prepare('SELECT id FROM suppliers WHERE UPPER(nom) = ?').get(nomFournisseur.toUpperCase());
          if (suppRow) {
            finalSupplierId = suppRow.id;
          } else {
            const insSupp = db.prepare('INSERT INTO suppliers (nom, telephone) VALUES (?, ?)').run(nomFournisseur, (contactFournisseur || '').trim());
            finalSupplierId = insSupp.lastInsertRowid;
          }
        }

        const pInfo = db.prepare(`
          INSERT INTO purchase_invoices (
            numeroFactureAchat, typeDocument, caisse, supplier_id, fournisseur, contactFournisseur,
            totalHT, remise, tauxTva, montantTva, montantTimbre, totalTTC, montantPaye, montantReste, statutPaiement, modePaiement, notes, dateFactureAchat
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          numFac,
          typeDocument,
          caisse || 'Caisse 1',
          finalSupplierId,
          nomFournisseur,
          (contactFournisseur || '').trim(),
          totalHT,
          remiseVal,
          Number(tauxTva) || 0,
          montantTva,
          timbreVal,
          totalTTC,
          paye,
          montantReste,
          statutPaiement,
          modePaiement,
          (notes || '').trim(),
          dateFactureAchat
        );

        const purchaseId = pInfo.lastInsertRowid;

        const itemStmt = db.prepare(`
          INSERT INTO purchase_items (
            purchase_id, product_id, reference, nom, quantite,
            prixAchatUnitaire, prixVente, prixDemiGros, prixGros, prixSuperGros,
            unite, totalLigne
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const movStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire, fournisseur, referenceDocument, motif)
          VALUES (?, 'ACHAT_FOURNISSEUR', ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const it of preparedItems) {
          let product = null;
          if (it.productId) {
            product = db.prepare('SELECT * FROM products WHERE id = ?').get(it.productId);
          }
          if (!product && it.reference) {
            product = db.prepare('SELECT * FROM products WHERE UPPER(reference) = ?').get(it.reference);
          }

          let prodId;
          let oldQty = 0;
          let newQty = it.quantite;

          if (product) {
            prodId = product.id;
            oldQty = product.quantite;
            newQty = oldQty + it.quantite;

            db.prepare(`
              UPDATE products 
              SET quantite = ?, prixAchat = ?, fournisseur = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(newQty, it.prixAchatUnitaire, nomFournisseur, prodId);
          } else {
            // Créer le produit s'il n'existe pas
            const ref = it.reference || `REF-${Date.now().toString().slice(-4)}`;
            const insProd = db.prepare(`
              INSERT INTO products (reference, codeBarre, nom, categorie, prixAchat, prixVente, prixDemiGros, prixGros, prixSuperGros, quantite, unite, seuilAlerte, fournisseur)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, ?)
            `).run(ref, ref, it.nom, it.categorie, it.prixAchatUnitaire, it.prixVente, it.prixDemiGros, it.prixGros, it.prixSuperGros, it.quantite, it.unite, nomFournisseur);

            prodId = insProd.lastInsertRowid;
          }

          itemStmt.run(
            purchaseId,
            prodId,
            it.reference,
            it.nom,
            it.quantite,
            it.prixAchatUnitaire,
            it.prixVente,
            it.prixDemiGros,
            it.prixGros,
            it.prixSuperGros,
            it.unite,
            it.totalLigne
          );

          movStmt.run(
            prodId,
            it.quantite,
            oldQty,
            newQty,
            it.prixAchatUnitaire,
            nomFournisseur,
            numFac,
            `Réception ${typeDocument === 'BON_COMMANDE_ACHAT' ? 'BC Achat' : 'Achat'} ${numFac}`
          );
        }

        // Si reste dû au fournisseur (crédit d'achat) ou si facture en négatif (avoir fournisseur déduisant la dette)
        if (finalSupplierId) {
          const supp = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(finalSupplierId);
          if (supp) {
            const oldDebt = Number(supp.soldeDette || 0);

            if (totalTTC < 0 && paye === 0) {
              // Avoir / retour fournisseur réduisant directement la dette du fournisseur
              const reduction = Math.abs(totalTTC);
              const newDebt = Math.max(0, Math.round((oldDebt - reduction) * 100) / 100);
              db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, finalSupplierId);

              db.prepare(`
                INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
                VALUES (?, 'AVOIR_FOURNISSEUR', ?, ?, ?, ?, ?)
              `).run(
                finalSupplierId,
                reduction,
                oldDebt,
                newDebt,
                numFac,
                `Déduction dette suite à bon/avoir fournisseur ${numFac}`
              );
            } else if (montantReste > 0) {
              const newDebt = oldDebt + montantReste;
              db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, finalSupplierId);

              db.prepare(`
                INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
                VALUES (?, 'DETTE_ACHAT', ?, ?, ?, ?, ?)
              `).run(
                finalSupplierId,
                montantReste,
                oldDebt,
                newDebt,
                numFac,
                `Crédit sur ${typeDocument === 'BON_COMMANDE_ACHAT' ? 'bon de commande achat' : 'facture achat'} ${numFac}`
              );
            }
          }
        }

        // Enregistrement des flux financiers de caisse pour achats (paiement ou remboursement fournisseur)
        if (paye > 0) {
          const catDec = typeDocument === 'BON_COMMANDE_ACHAT' ? 'ACOMPTE_COMMANDE_FOURNISSEUR' : 'REGLEMENT_FOURNISSEUR';
          const motifDec = typeDocument === 'BON_COMMANDE_ACHAT'
            ? `Versement / Acompte sur bon de commande achat ${numFac}`
            : `Paiement achat fournisseur ${numFac}`;

          const txNum = generateTxNumber('DEC');
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              fournisseur, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, 'DECAISSEMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txNum,
            catDec,
            paye,
            modePaiement,
            caisse || 'Caisse 1',
            nomFournisseur,
            nomFournisseur,
            numFac,
            motifDec,
            dateFactureAchat
          );
        } else if (paye < 0 || (totalTTC < 0 && paye !== 0)) {
          // Remboursement du fournisseur en espèces (encaissement)
          const montantRecu = Math.abs(paye || totalTTC);
          const txNum = generateTxNumber('ENC');
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              fournisseur, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, 'ENCAISSEMENT', 'RETOUR_ACHAT', ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txNum,
            montantRecu,
            modePaiement || 'ESPECES',
            caisse || 'Caisse 1',
            nomFournisseur,
            nomFournisseur,
            numFac,
            `Remboursement sur retour/avoir fournisseur ${numFac}`,
            dateFactureAchat
          );
        }

        return purchaseId;
      });

      const purchaseId = purchaseTx();
      const saved = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(purchaseId);
      const savedItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);

      return { success: true, data: { ...saved, _id: saved.id, items: savedItems } };
    } catch (error) {
      console.error('Erreur purchase:create', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Obtenir toutes les factures d'achat avec filtres
  ipcMain.handle('purchase:getAll', async (event, filters = {}) => {
    try {
      let query = 'SELECT * FROM purchase_invoices WHERE 1=1';
      const params = [];

      if (filters.search) {
        query += ' AND (numeroFactureAchat LIKE ? OR fournisseur LIKE ? OR contactFournisseur LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term, term);
      }

      if (filters.typeDocument && filters.typeDocument !== 'TOUS') {
        query += ' AND typeDocument = ?';
        params.push(filters.typeDocument);
      }

      if (filters.caisse && filters.caisse !== 'TOUS') {
        query += ' AND caisse = ?';
        params.push(filters.caisse);
      }

      if (filters.period && filters.period !== 'all') {
        if (filters.period === 'today') {
          query += " AND date(dateFactureAchat, 'localtime') = date('now', 'localtime')";
        } else if (filters.period === 'week') {
          query += " AND date(dateFactureAchat, 'localtime') >= date('now', '-7 days', 'localtime')";
        } else if (filters.period === 'month') {
          query += " AND date(dateFactureAchat, 'localtime') >= date('now', 'start of month', 'localtime')";
        } else if (filters.period === 'custom' && filters.startDate && filters.endDate) {
          query += " AND date(dateFactureAchat, 'localtime') BETWEEN ? AND ?";
          params.push(filters.startDate, filters.endDate);
        }
      }

      query += ' ORDER BY id DESC LIMIT 500';

      const rows = db.prepare(query).all(...params).map(p => {
        const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id);
        return {
          ...p,
          _id: p.id,
          items: items.map(it => ({ ...it, _id: it.id }))
        };
      });

      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 3. Règlement d'une facture d'achat / bon de commande fournisseur
  ipcMain.handle('purchase:recordPayment', async (event, paymentData) => {
    try {
      const { purchaseId, montant, modePaiement = 'ESPECES', caisse = 'Caisse 1', notes = '' } = paymentData;
      const pId = parseInt(purchaseId, 10);
      const purchase = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(pId);
      if (!purchase) return { success: false, error: 'Facture d’achat introuvable' };

      const montantPaiement = parseFloat(montant);
      if (isNaN(montantPaiement) || montantPaiement <= 0) {
        return { success: false, error: 'Le montant doit être supérieur à 0 DA.' };
      }

      const currentReste = Number(purchase.montantReste || (purchase.totalTTC - purchase.montantPaye));
      if (montantPaiement > currentReste) {
        return { success: false, error: `Le montant saisi (${montantPaiement} DA) dépasse le reste dû (${currentReste} DA).` };
      }

      const nowIso = new Date().toISOString();
      const newMontantPaye = Math.round((Number(purchase.montantPaye || 0) + montantPaiement) * 100) / 100;
      const newMontantReste = Math.max(0, Math.round((Number(purchase.totalTTC || 0) - newMontantPaye) * 100) / 100);
      const newStatut = newMontantReste === 0 ? 'PAYE' : 'PARTIEL';

      const payTx = db.transaction(() => {
        db.prepare(`
          UPDATE purchase_invoices
          SET montantPaye = ?, montantReste = ?, statutPaiement = ?
          WHERE id = ?
        `).run(newMontantPaye, newMontantReste, newStatut, pId);

        // Si lié à un fournisseur, déduire de sa dette
        if (purchase.supplier_id) {
          const supp = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(purchase.supplier_id);
          if (supp) {
            const oldDebt = Number(supp.soldeDette || 0);
            const newDebt = Math.max(0, Math.round((oldDebt - montantPaiement) * 100) / 100);
            db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, purchase.supplier_id);

            db.prepare(`
              INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
              VALUES (?, 'PAIEMENT_DETTE', ?, ?, ?, ?, ?)
            `).run(
              purchase.supplier_id,
              montantPaiement,
              oldDebt,
              newDebt,
              purchase.numeroFactureAchat,
              notes || `Règlement achat ${purchase.numeroFactureAchat} (${modePaiement})`
            );
          }
        }

        // Insertion dans cash_transactions
        const txNum = generateTxNumber('DEC');
        db.prepare(`
          INSERT INTO cash_transactions (
            numeroTransaction, type, categorie, montant, modePaiement, caisse,
            fournisseur, tiers, referenceDocument, motif, dateTransaction
          ) VALUES (?, 'DECAISSEMENT', 'REGLEMENT_FOURNISSEUR', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          txNum,
          montantPaiement,
          modePaiement,
          caisse || 'Caisse 1',
          purchase.fournisseur,
          purchase.fournisseur,
          purchase.numeroFactureAchat,
          notes || `Règlement facture achat ${purchase.numeroFactureAchat}`,
          nowIso
        );
      });

      payTx();
      const updated = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(pId);
      return { success: true, data: { ...updated, _id: updated.id } };
    } catch (error) {
      console.error('Erreur purchase:recordPayment', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Mettre à jour une facture d'achat / bon de commande fournisseur
  ipcMain.handle('purchase:update', async (event, { id, data }) => {
    try {
      const pId = parseInt(id, 10);
      const existing = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(pId);
      if (!existing) return { success: false, error: 'Facture d’achat introuvable' };

      const oldItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(pId);

      const {
        numeroFactureAchat = existing.numeroFactureAchat,
        typeDocument = existing.typeDocument,
        caisse = existing.caisse || 'Caisse 1',
        supplier_id = existing.supplier_id,
        fournisseur = existing.fournisseur,
        items = [],
        tauxTva = existing.tauxTva || 0,
        montantPaye = existing.montantPaye || 0,
        modePaiement = existing.modePaiement || 'ESPECES',
        dateFactureAchat = existing.dateFactureAchat || new Date().toISOString()
      } = data;

      if (!items || items.length === 0) {
        return { success: false, error: 'La facture d’achat doit contenir au moins un article.' };
      }

      const nomFournisseur = (fournisseur || existing.fournisseur || '').trim();

      const updateTx = db.transaction(() => {
        // 1. Restaurer le stock avant cet achat
        for (const oldIt of oldItems) {
          if (oldIt.product_id) {
            const p = db.prepare('SELECT quantite FROM products WHERE id = ?').get(oldIt.product_id);
            if (p) {
              const restoredQty = Math.max(0, Number(p.quantite || 0) - Number(oldIt.quantite || 0));
              db.prepare('UPDATE products SET quantite = ? WHERE id = ?').run(restoredQty, oldIt.product_id);
            }
          }
        }

        // 2. Traiter les nouveaux articles et calculs
        let totalHT = 0;
        const preparedItems = [];

        for (const item of items) {
          const qty = Number(item.quantite) || 1;
          const puAchat = Number(item.prixAchatUnitaire || item.prixAchat) || 0;
          const totalLigne = Math.round((puAchat * qty) * 100) / 100;
          totalHT += totalLigne;

          let finalProdId = item.productId ? parseInt(item.productId, 10) : (item.product_id ? parseInt(item.product_id, 10) : null);
          let product = null;
          if (finalProdId) {
            product = db.prepare('SELECT * FROM products WHERE id = ?').get(finalProdId);
          }
          if (!product && item.reference) {
            product = db.prepare('SELECT * FROM products WHERE UPPER(reference) = ?').get(String(item.reference).trim().toUpperCase());
            if (product) finalProdId = product.id;
          }

          preparedItems.push({
            productId: finalProdId,
            reference: (item.reference || (product?.reference) || '').trim().toUpperCase(),
            nom: (item.nom || (product?.nom) || 'Article').trim(),
            categorie: item.categorie || (product?.categorie) || 'Général',
            quantite: qty,
            prixAchatUnitaire: puAchat,
            prixVente: Number(item.prixVente) || (product?.prixVente) || Math.round(puAchat * 1.3),
            prixDemiGros: Number(item.prixDemiGros) || (product?.prixDemiGros) || Math.round(puAchat * 1.2),
            prixGros: Number(item.prixGros) || (product?.prixGros) || Math.round(puAchat * 1.15),
            prixSuperGros: Number(item.prixSuperGros) || (product?.prixSuperGros) || Math.round(puAchat * 1.1),
            unite: item.unite || (product?.unite) || 'pcs',
            totalLigne
          });
        }

        const montantTva = Math.round((totalHT * (Number(tauxTva) / 100)) * 100) / 100;
        const totalTTC = Math.round((totalHT + montantTva) * 100) / 100;
        const paye = Number(montantPaye) || 0;
        const montantReste = Math.max(0, Math.round((totalTTC - paye) * 100) / 100);
        const statutPaiement = montantReste === 0 ? 'PAYE' : paye > 0 ? 'PARTIEL' : 'NON_PAYE';

        // 4. Mettre à jour l'entête de la facture d'achat
        db.prepare(`
          UPDATE purchase_invoices SET
            numeroFactureAchat = ?,
            typeDocument = ?,
            caisse = ?,
            supplier_id = ?,
            fournisseur = ?,
            totalHT = ?,
            tauxTva = ?,
            montantTva = ?,
            totalTTC = ?,
            montantPaye = ?,
            montantReste = ?,
            statutPaiement = ?,
            modePaiement = ?,
            dateFactureAchat = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          numeroFactureAchat,
          typeDocument,
          caisse,
          supplier_id || null,
          nomFournisseur,
          totalHT,
          Number(tauxTva),
          montantTva,
          totalTTC,
          paye,
          montantReste,
          statutPaiement,
          modePaiement,
          dateFactureAchat,
          pId
        );

        // 5. Supprimer et réinsérer les articles
        db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(pId);

        const insItemStmt = db.prepare(`
          INSERT INTO purchase_items (
            purchase_id, product_id, reference, nom, quantite,
            prixAchatUnitaire, prixVente, prixDemiGros, prixGros, prixSuperGros,
            unite, totalLigne
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const it of preparedItems) {
          insItemStmt.run(
            pId,
            it.productId,
            it.reference,
            it.nom,
            it.quantite,
            it.prixAchatUnitaire,
            it.prixVente,
            it.prixDemiGros,
            it.prixGros,
            it.prixSuperGros,
            it.unite,
            it.totalLigne
          );

          // Ré-appliquer au stock du produit
          if (it.productId) {
            const p = db.prepare('SELECT quantite FROM products WHERE id = ?').get(it.productId);
            const currentQ = p ? Number(p.quantite || 0) : 0;
            const newQ = currentQ + it.quantite;

            db.prepare(`
              UPDATE products SET
                quantite = ?,
                prixAchat = ?,
                prixVente = ?,
                fournisseur = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(newQ, it.prixAchatUnitaire, it.prixVente, nomFournisseur, it.productId);

            db.prepare(`
              INSERT INTO stock_movements (
                product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire,
                referenceDocument, motif, dateMouvement
              ) VALUES (?, 'MODIFICATION_ACHAT', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
              it.productId,
              it.quantite,
              currentQ,
              newQ,
              it.prixAchatUnitaire,
              numeroFactureAchat,
              `Modification achat ${numeroFactureAchat}`
            );
          }
        }

        // 6. Réconciliation comptable complète Fournisseur et Caisse
        const oldReste = Number(existing.montantReste !== undefined ? existing.montantReste : Math.max(0, Number(existing.totalTTC || 0) - Number(existing.montantPaye || 0)));
        const newReste = Number(montantReste || 0);

        if (existing.supplier_id && existing.supplier_id !== supplier_id) {
          if (oldReste > 0) {
            const oldSupp = db.prepare('SELECT soldeDette FROM suppliers WHERE id = ?').get(existing.supplier_id);
            if (oldSupp) {
              const curDebt = Number(oldSupp.soldeDette || 0);
              const newDebt = Math.max(0, Math.round((curDebt - oldReste) * 100) / 100);
              db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, existing.supplier_id);
              db.prepare(`
                INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
                VALUES (?, 'AJUSTEMENT', ?, ?, ?, ?, ?)
              `).run(existing.supplier_id, -oldReste, curDebt, newDebt, numeroFactureAchat, `Annulation dette suite à changement fournisseur sur ${numeroFactureAchat}`);
            }
          }
          if (supplier_id && newReste > 0) {
            const newSupp = db.prepare('SELECT soldeDette FROM suppliers WHERE id = ?').get(supplier_id);
            if (newSupp) {
              const curDebt = Number(newSupp.soldeDette || 0);
              const newDebt = Math.round((curDebt + newReste) * 100) / 100;
              db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, supplier_id);
              db.prepare(`
                INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
                VALUES (?, 'DETTE_ACHAT', ?, ?, ?, ?, ?)
              `).run(supplier_id, newReste, curDebt, newDebt, numeroFactureAchat, `Dette achat ${numeroFactureAchat}`);
            }
          }
        } else if (supplier_id) {
          const deltaReste = Math.round((newReste - oldReste) * 100) / 100;
          if (deltaReste !== 0) {
            const supp = db.prepare('SELECT soldeDette FROM suppliers WHERE id = ?').get(supplier_id);
            if (supp) {
              const oldDebt = Number(supp.soldeDette || 0);
              const newDebt = Math.max(0, Math.round((oldDebt + deltaReste) * 100) / 100);
              db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, supplier_id);

              const movType = deltaReste > 0 ? 'DETTE_ACHAT' : 'REGLEMENT_FOURNISSEUR';
              const motifMov = deltaReste > 0
                ? `Ajustement hausse dette (+${deltaReste} DA) suite à modification ${numeroFactureAchat}`
                : `Ajustement baisse dette (-${Math.abs(deltaReste)} DA) suite à modification ${numeroFactureAchat}`;

              db.prepare(`
                INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(supplier_id, movType, Math.abs(deltaReste), oldDebt, newDebt, numeroFactureAchat, motifMov);
            }
          }
        }

        // Flux de caisse décaissement / ajustement
        const oldPaye = Number(existing.montantPaye || 0);
        const newPaye = Number(montantPaye || 0);
        const deltaPaye = Math.round((newPaye - oldPaye) * 100) / 100;
        if (deltaPaye !== 0) {
          const isDec = deltaPaye > 0;
          const txType = isDec ? 'DECAISSEMENT' : 'ENCAISSEMENT';
          const catTx = 'ACHAT_FOURNISSEUR';
          const motifTx = isDec
            ? `Décaissement complémentaire (+${deltaPaye} DA) suite à modification ${numeroFactureAchat}`
            : `Remboursement / avoir reçu suite à modification ${numeroFactureAchat}`;
          const txNum = `TRX-ACH-${Date.now().toString().slice(-6)}`;
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              client_id, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(txNum, txType, catTx, Math.abs(deltaPaye), modePaiement || 'ESPECES', caisse || 'Caisse 1', nomFournisseur, numeroFactureAchat, motifTx);
        }
      });

      updateTx();
      const updated = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(pId);
      const updatedItems = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(pId);
      return { success: true, data: { ...updated, _id: updated.id, items: updatedItems } };
    } catch (error) {
      console.error('Erreur purchase:update', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Supprimer / Annuler une facture d'achat
  ipcMain.handle('purchase:delete', async (event, id) => {
    try {
      const pId = parseInt(id, 10);
      const purchase = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(pId);
      if (!purchase) return { success: false, error: 'Facture d’achat introuvable' };

      const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(pId);

      const delTx = db.transaction(() => {
        // Déduire le stock apporté par cet achat
        for (const it of items) {
          if (it.product_id) {
            const p = db.prepare('SELECT quantite FROM products WHERE id = ?').get(it.product_id);
            if (p) {
              const currentQ = Number(p.quantite || 0);
              const newQ = Math.max(0, currentQ - Number(it.quantite || 0));
              db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQ, it.product_id);

              db.prepare(`
                INSERT INTO stock_movements (
                  product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire,
                  referenceDocument, motif, dateMouvement
                ) VALUES (?, 'ANNULATION_ACHAT', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).run(
                it.product_id,
                -Number(it.quantite || 0),
                currentQ,
                newQ,
                Number(it.prixAchatUnitaire || 0),
                purchase.numeroFactureAchat,
                `Annulation achat ${purchase.numeroFactureAchat}`
              );
            }
          }
        }

        // Annuler la dette fournisseur si existante
        if (purchase.supplier_id && Number(purchase.montantReste || 0) > 0) {
          const supp = db.prepare('SELECT soldeDette FROM suppliers WHERE id = ?').get(purchase.supplier_id);
          if (supp) {
            const newDebt = Math.max(0, Number(supp.soldeDette || 0) - Number(purchase.montantReste || 0));
            db.prepare('UPDATE suppliers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, purchase.supplier_id);

            db.prepare(`
              INSERT INTO supplier_movements (supplier_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
              VALUES (?, 'ANNULATION_DETTE', ?, ?, ?, ?, ?)
            `).run(
              purchase.supplier_id,
              Number(purchase.montantReste || 0),
              Number(supp.soldeDette || 0),
              newDebt,
              purchase.numeroFactureAchat,
              `Annulation dette suite à suppression achat ${purchase.numeroFactureAchat}`
            );
          }
        }

        db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(pId);
        db.prepare('DELETE FROM purchase_invoices WHERE id = ?').run(pId);
      });

      delTx();
      return { success: true, message: `Facture d’achat ${purchase.numeroFactureAchat} supprimée.` };
    } catch (error) {
      console.error('Erreur purchase:delete', error);
      return { success: false, error: error.message };
    }
  });

  // 6. Exporter la liste des achats vers Excel
  ipcMain.handle('purchase:exportExcel', async (event, filters = {}) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter le registre des achats vers Excel',
        defaultPath: `Achats_Fournisseurs_CommercePost_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel (*.xlsx)', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Export annulé.' };

      const purchases = db.prepare('SELECT * FROM purchase_invoices ORDER BY id DESC').all();
      return await exportPurchasesToExcel(purchases, filePath);
    } catch (error) {
      console.error('Erreur purchase:exportExcel', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerPurchaseHandlers };

