const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { generateInvoiceQRCode } = require('../utils/qrGenerator');
const { exportSalesToExcel } = require('../utils/excelService');
const { decodeAzertyBarcode } = require('../utils/barcodeGenerator');
const { logAudit } = require('./authHandler');

function generateSequentialNumber(prefix = 'FAC') {
  const db = getDB();
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
  const pattern = `${prefix}-${dateStr}-%`;
  
  const last = db.prepare('SELECT numeroFacture FROM invoices WHERE numeroFacture LIKE ? ORDER BY id DESC LIMIT 1').get(pattern);
  let nextSeq = 1;
  if (last && last.numeroFacture) {
    const parts = last.numeroFacture.split('-');
    if (parts.length === 3) {
      nextSeq = (parseInt(parts[2], 10) || 0) + 1;
    }
  }

  return `${prefix}-${dateStr}-${String(nextSeq).padStart(4, '0')}`;
}

function generateTxNumber(prefix = 'ENC') {
  const db = getDB();
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const last = db.prepare(`SELECT numeroTransaction FROM cash_transactions WHERE numeroTransaction LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}-${yyyymm}-%`);
  let seq = 1;
  if (last && last.numeroTransaction) {
    const parts = last.numeroTransaction.split('-');
    if (parts.length >= 3) seq = (parseInt(parts[2], 10) || 0) + 1;
  }
  return `${prefix}-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

function normalizeInvoice(inv) {
  if (!inv) return null;
  const db = getDB();
  const items = db.prepare(`
    SELECT i.*, p.nom as product_nom, p.reference as product_reference, p.unite as product_unite, p.prixAchat as product_prixAchat
    FROM invoice_items i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE i.invoice_id = ?
  `).all(inv.id).map(it => {
    const qteInitiale = Number(it.quantite || 1);
    const qteRetournee = Number(it.quantiteRetournee || 0);
    // Quand le retour affecte un bon, les produits retournés tombent à 0 (ou quantité restante nette)
    const qty = Math.max(0, qteInitiale - qteRetournee);
    const prixAchat = Number(
      it.prixAchatUnitaire !== undefined && it.prixAchatUnitaire !== null
        ? it.prixAchatUnitaire
        : (it.product_prixAchat || 0)
    );
    const coutTotalLigne = Math.round((prixAchat * qty) * 100) / 100;
    const totalLigne = Number(qty * (it.prixUnitaire || 0));
    const beneficeLigne = Math.round((totalLigne - coutTotalLigne) * 100) / 100;

    return {
      ...it,
      _id: it.id,
      quantiteInitiale: qteInitiale,
      quantiteRetournee: qteRetournee,
      quantite: qty,
      prixUnitaire: Number(it.prixUnitaire || 0),
      prixAchatUnitaire: prixAchat,
      coutTotalLigne,
      beneficeLigne,
      totalLigne,
      isSerie: Boolean(it.isSerie),
      piecesParSerie: Number(it.piecesParSerie || 1),
      product: it.product_id ? { _id: it.product_id, nom: it.nom, reference: it.reference, unite: it.unite, prixAchat: it.product_prixAchat } : null
    };
  });

  let client = null;
  if (inv.client_id) {
    const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(inv.client_id);
    if (c) client = { ...c, _id: c.id };
  }

  const dateStr = inv.dateFacture || inv.created_at || new Date().toISOString();
  const totalCoutAchat = Math.round(items.reduce((sum, it) => sum + (Number(it.coutTotalLigne) || 0), 0) * 100) / 100;
  const totalTTC = Number(inv.totalTTC || 0);
  const benefice = Math.round((totalTTC - totalCoutAchat) * 100) / 100;

  return {
    ...inv,
    _id: inv.id,
    caisse: inv.caisse || 'Caisse 1',
    vendeur: inv.vendeur || 'ILYES',
    caissier: inv.vendeur || 'ILYES',
    nomClientLibre: inv.clientLibre || inv.nomClientLibre || 'Client Comptoir',
    clientLibre: inv.clientLibre || inv.nomClientLibre || 'Client Comptoir',
    dateFacture: dateStr,
    createdAt: dateStr,
    totalHT: Number(inv.totalHT || 0),
    totalTTC,
    montantPaye: Number(inv.montantPaye || 0),
    montantReste: Number(inv.montantReste || 0),
    tauxTva: Number(inv.tauxTva || 0),
    montantTva: Number(inv.montantTva || 0),
    remise: Number(inv.remise || 0),
    totalCoutAchat,
    benefice,
    items,
    client
  };
}

function registerInvoiceHandlers(mainWindow) {
  const db = getDB();

  // 1. Créer une facture / ticket de vente
  ipcMain.handle('invoice:create', async (event, invoiceData) => {
    try {
      const {
        typeDocument = 'FACTURE',
        caisse = 'Caisse 1',
        vendeur = '',
        caissier = '',
        creePar = '',
        clientId = null,
        nomClientLibre = 'Client Comptoir',
        items = [],
        tauxTva = 0,
        montantPaye = 0,
        modePaiement = 'ESPECES',
        notes = ''
      } = invoiceData;

      const nomVendeur = (vendeur || caissier || creePar || 'ILYES').trim();

      if (!items || items.length === 0) {
        return { success: false, error: 'La facture doit contenir au moins un article.' };
      }

      let parsedClientId = null;
      if (clientId && !isNaN(parseInt(clientId, 10))) {
        parsedClientId = parseInt(clientId, 10);
      }

      // 1. Vérifier et préparer les lignes
      let totalHT = 0;
      const preparedItems = [];
      const belowCostItems = [];

      for (const item of items) {
        let product = null;
        if (item.productId && !isNaN(parseInt(item.productId, 10))) {
          product = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(item.productId, 10));
        }
        if (!product && item.reference) {
          product = db.prepare('SELECT * FROM products WHERE UPPER(reference) = ?').get(String(item.reference).trim().toUpperCase());
        }
        if (!product && item.nom) {
          product = db.prepare('SELECT * FROM products WHERE nom = ?').get(String(item.nom).trim());
        }

        if (!product) {
          return { success: false, error: `Produit introuvable: ${item.nom || item.reference || 'Article inconnu'}` };
        }

        const qty = Number(item.quantite) || 1;
        // On autorise la vente / bon de commande même si le stock en magasin est temporairement à 0
        const currentStock = Number(product.quantite) || 0;

        const pu = Number(item.prixUnitaire) || 0;
        const totalLigne = Math.round((pu * qty) * 100) / 100;
        totalHT += totalLigne;

        const puAchat = Number(product.prixAchat || 0);
        if (qty > 0 && pu < puAchat) {
          belowCostItems.push({
            nom: product.nom,
            reference: product.reference,
            prixVente: pu,
            prixAchat: puAchat
          });
        }

        const isSerie = Boolean(item.isSerie);
        const piecesParSerie = Number(item.piecesParSerie) > 0 
          ? Number(item.piecesParSerie) 
          : (Number(product.piecesParSerie) > 0 ? Number(product.piecesParSerie) : 1);

        preparedItems.push({
          productId: product.id,
          reference: product.reference,
          nom: product.nom,
          prixUnitaire: pu,
          prixAchatUnitaire: puAchat,
          unite: product.unite || 'pcs',
          quantite: qty,
          isSerie: isSerie ? 1 : 0,
          piecesParSerie,
          totalLigne,
          currentStock: product.quantite
        });
      }

      // 2. Calcul des montants
      const montantTva = Math.round((totalHT * (Number(tauxTva) / 100)) * 100) / 100;
      const totalTTC = Math.round((totalHT + montantTva) * 100) / 100;
      const paye = Number(montantPaye);
      const montantReste = Math.max(0, Math.round((totalTTC - paye) * 100) / 100);

      let statutPaiement = 'PAYE';
      if (montantReste > 0) {
        statutPaiement = paye > 0 ? 'PARTIEL' : 'NON_PAYE';
      }

      let prefix = 'FAC';
      if (typeDocument === 'TICKET') prefix = 'TCK';
      else if (typeDocument === 'BON_COMMANDE') prefix = 'BC';
      else if (typeDocument === 'BON_LIVRAISON') prefix = 'BL';

      const numeroFacture = generateSequentialNumber(prefix);
      const nowIso = new Date().toISOString();

      // 3. Générer le QR Code
      const { qrData, qrImage } = await generateInvoiceQRCode({
        numeroFacture,
        totalTTC,
        dateFacture: nowIso,
        items: preparedItems
      });

      // 4. Exécuter la transaction atomique SQLite
      const insertTransaction = db.transaction(() => {
        const invStmt = db.prepare(`
          INSERT INTO invoices (numeroFacture, typeDocument, caisse, vendeur, client_id, clientLibre, totalHT, tauxTva, montantTva, remise, totalTTC, montantPaye, montantReste, modePaiement, statutPaiement, notes, qrCodeData, qrCodeImage, dateFacture, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const invInfo = invStmt.run(
          numeroFacture,
          typeDocument,
          caisse || 'Caisse 1',
          nomVendeur,
          parsedClientId,
          parsedClientId ? null : nomClientLibre,
          totalHT,
          Number(tauxTva) || 0,
          montantTva,
          totalTTC,
          paye,
          montantReste,
          modePaiement,
          statutPaiement,
          notes,
          qrData,
          qrImage,
          nowIso,
          nowIso
        );

        const invoiceId = invInfo.lastInsertRowid;

        // Insérer les lignes et décrémenter le stock
        const itemStmt = db.prepare(`
          INSERT INTO invoice_items (invoice_id, product_id, reference, nom, quantite, prixUnitaire, prixAchatUnitaire, unite, isSerie, piecesParSerie, totalLigne)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const updateStockStmt = db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const movStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire, referenceDocument, motif, dateMouvement)
          VALUES (?, 'VENTE', ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of preparedItems) {
          itemStmt.run(
            invoiceId,
            item.productId,
            item.reference,
            item.nom,
            item.quantite,
            item.prixUnitaire,
            item.prixAchatUnitaire || 0,
            item.unite,
            item.isSerie ? 1 : 0,
            item.piecesParSerie || 1,
            item.totalLigne
          );

          const stockDecrement = (item.isSerie && Number(item.piecesParSerie) > 0)
            ? (Number(item.quantite) * Number(item.piecesParSerie))
            : Number(item.quantite);

          // Si stockDecrement est négatif (produit retourné), le stock augmente bien : newStock = currentStock - (-X) = currentStock + X
          const newStock = Number(item.currentStock || 0) - stockDecrement;
          updateStockStmt.run(newStock, item.productId);

          const typeMouv = stockDecrement < 0 ? 'RETOUR_VENTE' : 'VENTE';
          const motifMouv = stockDecrement < 0 
            ? `Retour article sur ${typeDocument} ${numeroFacture}`
            : `${typeDocument} ${numeroFacture}${item.isSerie ? ` (Série de ${item.piecesParSerie} pcs)` : ''}`;

          movStmt.run(
            item.productId,
            -stockDecrement,
            item.currentStock,
            newStock,
            item.prixAchatUnitaire,
            numeroFacture,
            motifMouv,
            nowIso
          );
        }

        // Si le client a une dette restante ou si le bon est en négatif (avoir/retour réduisant sa dette)
        if (parsedClientId) {
          const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(parsedClientId);
          if (cust) {
            const oldDebt = Number(cust.soldeDette || 0);

            if (totalTTC < 0 && paye === 0) {
              // Le bon est négatif (ex: -2 000 DA) et non remboursé en cash => il déduit directement la dette du client !
              const reduction = Math.abs(totalTTC);
              const newDebt = Math.max(0, Math.round((oldDebt - reduction) * 100) / 100);
              db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, parsedClientId);

              db.prepare(`
                INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
                VALUES (?, 'DECAISSEMENT_AVOIR', ?, ?, ?, ?, ?, ?)
              `).run(
                parsedClientId,
                reduction,
                oldDebt,
                newDebt,
                numeroFacture,
                `Déduction suite à bon/retour ${numeroFacture}`,
                nowIso
              );
            } else if (montantReste > 0) {
              // Vente à crédit normale
              const newDebt = oldDebt + montantReste;
              db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, parsedClientId);

              db.prepare(`
                INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
                VALUES (?, 'DETTE_VENTE', ?, ?, ?, ?, ?, ?)
              `).run(
                parsedClientId,
                montantReste,
                oldDebt,
                newDebt,
                numeroFacture,
                `Crédit sur ${typeDocument} ${numeroFacture}`,
                nowIso
              );
            }
          }
        }

        // Enregistrement des flux financiers en caisse (positifs ou négatifs pour remboursement)
        let tiersNom = nomClientLibre;
        if (parsedClientId) {
          const cRow = db.prepare('SELECT nom FROM customers WHERE id = ?').get(parsedClientId);
          if (cRow) tiersNom = cRow.nom;
        }

        if (paye > 0) {
          const catEnc = typeDocument === 'BON_COMMANDE' ? 'ACOMPTE_COMMANDE' : 'VENTE_DIRECTE';
          const motifEnc = typeDocument === 'BON_COMMANDE'
            ? `Acompte / Versement sur bon de commande ${numeroFacture}`
            : `Encaissement vente ${numeroFacture}`;

          const txNum = generateTxNumber('ENC');
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              client_id, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, 'ENCAISSEMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txNum,
            catEnc,
            paye,
            modePaiement,
            caisse || 'Caisse 1',
            parsedClientId,
            tiersNom,
            numeroFacture,
            motifEnc,
            nowIso
          );
        } else if (paye < 0 || (totalTTC < 0 && paye !== 0)) {
          // Remboursement client en cash (décaissement)
          const montantRembourse = Math.abs(paye || totalTTC);
          const txNum = generateTxNumber('DEC');
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              client_id, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, 'DECAISSEMENT', 'RETOUR_VENTE', ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txNum,
            montantRembourse,
            modePaiement || 'ESPECES',
            caisse || 'Caisse 1',
            parsedClientId,
            tiersNom,
            numeroFacture,
            `Remboursement sur bon/retour ${numeroFacture}`,
            nowIso
          );
        }

        return invoiceId;
      });

      const invoiceId = insertTransaction();
      const saved = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);

      try {
        logAudit(db, {
          action: 'CREATION_VENTE',
          module: 'POS',
          reference: numeroFacture,
          caisse: caisse || 'Caisse 1',
          details: `Vente ${numeroFacture} (${totalTTC} DA, payé: ${paye} DA, ${items.length} article(s))`
        });
      } catch (e) {}

      return { success: true, data: normalizeInvoice(saved) };
    } catch (error) {
      console.error('Erreur invoice:create', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Obtenir toutes les factures avec filtres
  ipcMain.handle('invoice:getAll', async (event, filters = {}) => {
    try {
      let query = `
        SELECT i.*, c.nom as client_nom_db 
        FROM invoices i
        LEFT JOIN customers c ON i.client_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.search) {
        query += ' AND (i.numeroFacture LIKE ? OR i.clientLibre LIKE ? OR c.nom LIKE ? OR c.telephone LIKE ? OR i.notes LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term, term, term, term);
      }

      if (filters.typeDocument && filters.typeDocument !== 'TOUS') {
        query += ' AND i.typeDocument = ?';
        params.push(filters.typeDocument);
      }

      if (filters.statutPaiement && filters.statutPaiement !== 'TOUS') {
        query += ' AND i.statutPaiement = ?';
        params.push(filters.statutPaiement);
      }

      if (filters.clientId) {
        query += ' AND i.client_id = ?';
        params.push(parseInt(filters.clientId, 10));
      }

      if (filters.period && filters.period !== 'all') {
        if (filters.period === 'today') {
          query += " AND date(i.dateFacture, 'localtime') = date('now', 'localtime')";
        } else if (filters.period === 'week') {
          query += " AND date(i.dateFacture, 'localtime') >= date('now', '-7 days', 'localtime')";
        } else if (filters.period === 'month') {
          query += " AND date(i.dateFacture, 'localtime') >= date('now', 'start of month', 'localtime')";
        } else if (filters.period === 'custom' && filters.startDate && filters.endDate) {
          query += " AND date(i.dateFacture, 'localtime') BETWEEN ? AND ?";
          params.push(filters.startDate, filters.endDate);
        }
      }

      query += ' ORDER BY i.id DESC LIMIT ?';
      params.push(filters.limit || 500);

      const rows = db.prepare(query).all(...params).map(normalizeInvoice);
      return { success: true, data: rows };
    } catch (error) {
      console.error('Erreur invoice:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Obtenir une facture par ID ou Numéro (ou scan douchette / QR)
  ipcMain.handle('invoice:getById', async (event, identifier) => {
    try {
      if (!identifier) return { success: false, error: 'Identifiant invalide' };

      const rawStr = String(identifier).trim();
      const azertyStr = decodeAzertyBarcode ? decodeAzertyBarcode(rawStr).trim() : rawStr;

      // Créer une liste de candidats à tester pour la douchette
      const rawCandidates = [rawStr, azertyStr];
      const cleanCandidates = [];

      for (const cand of rawCandidates) {
        if (!cand) continue;
        cleanCandidates.push(cand);
        // Retirer les préfixes éventuels
        if (cand.startsWith('FAC:') || cand.startsWith('TCK:') || cand.startsWith('BC:')) {
          cleanCandidates.push(cand.substring(4).split('|')[0].trim());
        }
      }

      let row = null;
      for (const cand of Array.from(new Set(cleanCandidates))) {
        if (!cand) continue;

        // 1. Recherche par Numéro de Facture exact (ex: "BC2026100349", "BC-202610-0001", "FAC...")
        row = db.prepare('SELECT * FROM invoices WHERE UPPER(numeroFacture) = ?').get(cand.toUpperCase());
        if (row) break;

        // 2. Recherche par ID entier (ex: "349")
        if (/^\d+$/.test(cand)) {
          row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(parseInt(cand, 10));
          if (row) break;
        }

        // 3. Recherche par qrCodeData
        row = db.prepare('SELECT * FROM invoices WHERE qrCodeData = ?').get(cand);
        if (row) break;
      }

      if (!row) return { success: false, error: `Facture non trouvée pour : ${rawStr}` };

      return { success: true, data: normalizeInvoice(row) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 4. Annuler / Supprimer une facture
  ipcMain.handle('invoice:delete', async (event, id) => {
    try {
      const invId = parseInt(id, 10);
      const invoice = normalizeInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId));
      if (!invoice) return { success: false, error: 'Facture introuvable' };

      const deleteTx = db.transaction(() => {
        // 1. Ré-incrémenter le stock
        for (const item of invoice.items) {
          if (item.product_id) {
            const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
            if (prod) {
              const newQty = prod.quantite + item.quantite;
              db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, prod.id);

              db.prepare(`
                INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, referenceDocument, motif)
                VALUES (?, 'RETOUR_VENTE', ?, ?, ?, ?, ?)
              `).run(
                prod.id,
                item.quantite,
                prod.quantite,
                newQty,
                `ANNULATION-${invoice.numeroFacture}`,
                `Annulation de la vente ${invoice.numeroFacture}`
              );
            }
          }
        }

        // 2. Annuler la dette client si applicable
        if (invoice.client_id && invoice.montantReste > 0) {
          const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(invoice.client_id);
          if (cust) {
            const oldDebt = Number(cust.soldeDette || 0);
            const newDebt = Math.max(0, oldDebt - invoice.montantReste);
            db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, invoice.client_id);

            db.prepare(`
              INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, motif)
              VALUES (?, 'AJUSTEMENT', ?, ?, ?, ?)
            `).run(
              invoice.client_id,
              -invoice.montantReste,
              oldDebt,
              newDebt,
              `Annulation facture ${invoice.numeroFacture}`
            );
          }
        }

        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invId);
        db.prepare('DELETE FROM invoices WHERE id = ?').run(invId);
      });

      deleteTx();
      return { success: true, message: 'Facture annulée et stock réajusté avec succès.' };
    } catch (error) {
      console.error('Erreur invoice:delete', error);
      return { success: false, error: error.message };
    }
  });

  // 4b. Modifier une facture / bon de commande déjà passé
  ipcMain.handle('invoice:update', async (event, { id, data }) => {
    try {
      const invId = parseInt(id, 10);
      const existing = normalizeInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId));
      if (!existing) return { success: false, error: 'Facture / Bon introuvable' };

      const {
        typeDocument = existing.typeDocument,
        caisse = existing.caisse || 'Caisse 1',
        clientId = existing.client_id,
        nomClientLibre = existing.nomClientLibre || 'Client Comptoir',
        items = [],
        tauxTva = existing.tauxTva || 0,
        montantPaye = existing.montantPaye || 0,
        modePaiement = existing.modePaiement || 'ESPECES',
        notes = existing.notes || ''
      } = data;

      if (!items || items.length === 0) {
        return { success: false, error: 'Le bon doit contenir au moins un article.' };
      }

      let parsedClientId = null;
      if (clientId && !isNaN(parseInt(clientId, 10))) {
        parsedClientId = parseInt(clientId, 10);
      }

      const updateTx = db.transaction(() => {
        // 1. Restaurer temporairement le stock de l'ancienne facture
        for (const oldIt of existing.items) {
          if (oldIt.product_id) {
            const p = db.prepare('SELECT quantite FROM products WHERE id = ?').get(oldIt.product_id);
            if (p) {
              const oldQtyDeducted = (oldIt.isSerie && Number(oldIt.piecesParSerie) > 0)
                ? (Number(oldIt.quantite) * Number(oldIt.piecesParSerie))
                : (Number(oldIt.quantite) || 0);
              db.prepare('UPDATE products SET quantite = quantite + ? WHERE id = ?').run(oldQtyDeducted, oldIt.product_id);
            }
          }
        }

        // 2. Préparer les nouveaux articles
        let totalHT = 0;
        const preparedItems = [];

        for (const item of items) {
          let product = null;
          if (item.productId && !isNaN(parseInt(item.productId, 10))) {
            product = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(item.productId, 10));
          }
          if (!product && item.reference) {
            product = db.prepare('SELECT * FROM products WHERE UPPER(reference) = ?').get(String(item.reference).trim().toUpperCase());
          }
          const qty = Number(item.quantite) || 1;
          const pu = Number(item.prixUnitaire) || 0;
          const totalLigne = Math.round((pu * qty) * 100) / 100;
          totalHT += totalLigne;

          const puAchat = Number(
            item.prixAchatUnitaire !== undefined && item.prixAchatUnitaire !== null && item.prixAchatUnitaire > 0
              ? item.prixAchatUnitaire
              : (product?.prixAchat || item.prixAchat || 0)
          );

          const isSerie = Boolean(item.isSerie);
          const piecesParSerie = Number(item.piecesParSerie) > 0 
            ? Number(item.piecesParSerie) 
            : (Number(product?.piecesParSerie) > 0 ? Number(product.piecesParSerie) : 1);

          preparedItems.push({
            productId: product ? product.id : (item.productId || null),
            reference: product ? product.reference : (item.reference || ''),
            nom: product ? product.nom : (item.nom || 'Article'),
            prixUnitaire: pu,
            prixAchatUnitaire: puAchat,
            unite: product ? (product.unite || 'pcs') : (item.unite || 'pcs'),
            quantite: qty,
            isSerie: isSerie ? 1 : 0,
            piecesParSerie,
            totalLigne,
            currentStock: product ? product.quantite : 0
          });
        }

        // 4. Calculs des montants mis à jour
        const montantTva = Math.round((totalHT * (Number(tauxTva) / 100)) * 100) / 100;
        const totalTTC = Math.round((totalHT + montantTva) * 100) / 100;
        const paye = Number(montantPaye);
        const montantReste = Math.max(0, Math.round((totalTTC - paye) * 100) / 100);

        let statutPaiement = 'PAYE';
        if (montantReste > 0) {
          statutPaiement = paye > 0 ? 'PARTIEL' : 'NON_PAYE';
        }

        const nowIso = new Date().toISOString();

        // 5. Mettre à jour la facture
        db.prepare(`
          UPDATE invoices SET
            typeDocument = ?,
            caisse = ?,
            client_id = ?,
            clientLibre = ?,
            totalHT = ?,
            tauxTva = ?,
            montantTva = ?,
            totalTTC = ?,
            montantPaye = ?,
            montantReste = ?,
            modePaiement = ?,
            statutPaiement = ?,
            notes = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          typeDocument,
          caisse,
          parsedClientId,
          parsedClientId ? null : nomClientLibre,
          totalHT,
          Number(tauxTva) || 0,
          montantTva,
          totalTTC,
          paye,
          montantReste,
          modePaiement,
          statutPaiement,
          notes,
          nowIso,
          invId
        );

        // 6. Remplacer les lignes d'articles
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invId);

        const itemStmt = db.prepare(`
          INSERT INTO invoice_items (invoice_id, product_id, reference, nom, quantite, prixUnitaire, prixAchatUnitaire, unite, isSerie, piecesParSerie, totalLigne)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateStockStmt = db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const movStmt = db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire, referenceDocument, motif, dateMouvement)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of preparedItems) {
          itemStmt.run(
            invId,
            item.productId,
            item.reference,
            item.nom,
            item.quantite,
            item.prixUnitaire,
            item.prixAchatUnitaire,
            item.unite,
            item.isSerie ? 1 : 0,
            item.piecesParSerie || 1,
            item.totalLigne
          );

          if (item.productId) {
            const deductionQty = (item.isSerie && Number(item.piecesParSerie) > 0)
              ? (Number(item.quantite) * Number(item.piecesParSerie))
              : Number(item.quantite);

            const newStock = Number(item.currentStock || 0) - deductionQty;
            updateStockStmt.run(newStock, item.productId);

            const movType = deductionQty < 0 ? 'RETOUR_VENTE' : 'VENTE';
            movStmt.run(
              item.productId,
              movType,
              -deductionQty,
              item.currentStock,
              newStock,
              item.prixAchatUnitaire,
              existing.numeroFacture,
              `Modification ${existing.numeroFacture}${item.isSerie ? ` (Série de ${item.piecesParSerie} pcs)` : ''}`,
              nowIso
            );
          }
        }

        // 7. Réconciliation comptable complète du Compte Client
        const oldReste = Number(existing.montantReste !== undefined ? existing.montantReste : Math.max(0, Number(existing.totalTTC || 0) - Number(existing.montantPaye || 0)));
        const newReste = Number(montantReste || 0);

        if (existing.client_id && existing.client_id !== parsedClientId) {
          // A. Le client a été changé sur le bon => annuler la dette sur l'ancien client
          if (oldReste > 0) {
            const oldCust = db.prepare('SELECT soldeDette FROM customers WHERE id = ?').get(existing.client_id);
            if (oldCust) {
              const curDebt = Number(oldCust.soldeDette || 0);
              const newDebt = Math.max(0, Math.round((curDebt - oldReste) * 100) / 100);
              db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, existing.client_id);
              db.prepare(`
                INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
                VALUES (?, 'AJUSTEMENT', ?, ?, ?, ?, ?, ?)
              `).run(
                existing.client_id,
                -oldReste,
                curDebt,
                newDebt,
                existing.numeroFacture,
                `Annulation dette suite à transfert client sur bon ${existing.numeroFacture}`,
                nowIso
              );
            }
          }
          // Et appliquer la nouvelle dette au nouveau client
          if (parsedClientId && newReste > 0) {
            const newCust = db.prepare('SELECT soldeDette FROM customers WHERE id = ?').get(parsedClientId);
            if (newCust) {
              const curDebt = Number(newCust.soldeDette || 0);
              const newDebt = Math.round((curDebt + newReste) * 100) / 100;
              db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, parsedClientId);
              db.prepare(`
                INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
                VALUES (?, 'DETTE_VENTE', ?, ?, ?, ?, ?, ?)
              `).run(
                parsedClientId,
                newReste,
                curDebt,
                newDebt,
                existing.numeroFacture,
                `Dette bon de commande ${existing.numeroFacture}`,
                nowIso
              );
            }
          }
        } else if (parsedClientId) {
          // B. Même client => calculer le delta exact de dette (hausse ou baisse)
          const deltaReste = Math.round((newReste - oldReste) * 100) / 100;
          if (deltaReste !== 0) {
            const cust = db.prepare('SELECT soldeDette FROM customers WHERE id = ?').get(parsedClientId);
            if (cust) {
              const oldDebt = Number(cust.soldeDette || 0);
              const newDebt = Math.max(0, Math.round((oldDebt + deltaReste) * 100) / 100);
              db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, parsedClientId);

              const movType = deltaReste > 0 ? 'DETTE_VENTE' : 'ENCAISSEMENT_REGLEMENT';
              const motifMov = deltaReste > 0 
                ? `Ajustement hausse dette (+${deltaReste} DA) suite à modification ${existing.numeroFacture}`
                : `Ajustement baisse dette (-${Math.abs(deltaReste)} DA) suite à modification ${existing.numeroFacture}`;

              db.prepare(`
                INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                parsedClientId,
                movType,
                Math.abs(deltaReste),
                oldDebt,
                newDebt,
                existing.numeroFacture,
                motifMov,
                nowIso
              );
            }
          }
        }

        // 8. Réconciliation des flux de Caisse (cash_transactions)
        const oldPaye = Number(existing.montantPaye || 0);
        const newPaye = Number(paye || 0);
        const deltaPaye = Math.round((newPaye - oldPaye) * 100) / 100;

        if (deltaPaye !== 0) {
          let tiersNom = nomClientLibre;
          if (parsedClientId) {
            const cRow = db.prepare('SELECT nom FROM customers WHERE id = ?').get(parsedClientId);
            if (cRow) tiersNom = cRow.nom;
          }

          const isEnc = deltaPaye > 0;
          const txType = isEnc ? 'ENCAISSEMENT' : 'DECAISSEMENT';
          const catTx = isEnc ? 'VENTE_DIRECTE' : 'RETOUR_VENTE';
          const motifTx = isEnc
            ? `Encaissement complémentaire (+${deltaPaye} DA) suite à modification ${existing.numeroFacture}`
            : `Remboursement / déduction (-${Math.abs(deltaPaye)} DA) suite à modification ${existing.numeroFacture}`;

          const txNum = generateTxNumber(isEnc ? 'ENC' : 'DEC');
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement, caisse,
              client_id, tiers, referenceDocument, motif, dateTransaction
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            txNum,
            txType,
            catTx,
            Math.abs(deltaPaye),
            modePaiement || 'ESPECES',
            caisse || 'Caisse 1',
            parsedClientId,
            tiersNom,
            existing.numeroFacture,
            motifTx,
            nowIso
          );
        }
      });

      updateTx();
      const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
      return { success: true, data: normalizeInvoice(updated), message: 'Bon de commande modifié avec succès.' };
    } catch (error) {
      console.error('Erreur invoice:update', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Créer un retour sur vente
  ipcMain.handle('invoice:createReturn', async (event, returnData) => {
    try {
      const { invoiceId, items = [], motif = 'Retour client', modeRemboursement = 'ESPECES' } = returnData;
      const invId = parseInt(invoiceId, 10);
      const invoice = normalizeInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId));
      if (!invoice) return { success: false, error: 'Facture introuvable' };

      if (!items.length) return { success: false, error: 'Veuillez sélectionner au moins un article à retourner.' };

      let totalRembourse = 0;
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
      const lastRet = db.prepare("SELECT numeroRetour FROM sale_returns WHERE numeroRetour LIKE ? ORDER BY id DESC LIMIT 1").get(`RET-${dateStr}-%`);
      let retSeq = 1;
      if (lastRet && lastRet.numeroRetour) {
        retSeq = (parseInt(lastRet.numeroRetour.split('-')[2], 10) || 0) + 1;
      }
      const numeroRetour = `RET-${dateStr}-${String(retSeq).padStart(4, '0')}`;

      const returnTx = db.transaction(() => {
        const retInfo = db.prepare(`
          INSERT INTO sale_returns (numeroRetour, invoice_id, client_id, montantTotalRembourse, motif)
          VALUES (?, ?, ?, 0, ?)
        `).run(numeroRetour, invId, invoice.client_id || null, motif);

        const returnId = retInfo.lastInsertRowid;

        for (const it of items) {
          const pId = parseInt(it.productId, 10);
          const product = db.prepare('SELECT * FROM products WHERE id = ?').get(pId);
          if (!product) continue;

          const qty = Number(it.quantite) || 1;
          const pu = Number(it.prixUnitaire) || 0;
          const totalLigne = Math.round((pu * qty) * 100) / 100;
          totalRembourse += totalLigne;

          db.prepare(`
            INSERT INTO sale_return_items (return_id, product_id, reference, nom, quantiteRetournee, prixUnitaire, totalLigne)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(returnId, pId, product.reference, product.nom, qty, pu, totalLigne);

          const newQty = product.quantite + qty;
          db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, pId);

          db.prepare(`
            INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, referenceDocument, motif)
            VALUES (?, 'RETOUR_VENTE', ?, ?, ?, ?, ?)
          `).run(
            pId,
            qty,
            product.quantite,
            newQty,
            invoice.numeroFacture,
            `Retour vente: ${motif}`
          );
          // Mettre à jour la quantité retournée sur la ligne du bon
          try {
            let invItem = null;
            if (pId) {
              invItem = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? AND product_id = ? LIMIT 1').get(invId, pId);
            }
            if (!invItem && product.reference) {
              invItem = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? AND reference = ? LIMIT 1').get(invId, product.reference);
            }
            if (!invItem && product.nom) {
              invItem = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? AND nom = ? LIMIT 1').get(invId, product.nom);
            }
            if (invItem) {
              const currentRet = Number(invItem.quantiteRetournee || 0);
              db.prepare('UPDATE invoice_items SET quantiteRetournee = ? WHERE id = ?').run(currentRet + qty, invItem.id);
            }
          } catch (errIt) {
            console.warn('Erreur mise à jour ligne bon retour:', errIt);
          }
        }

        db.prepare('UPDATE sale_returns SET montantTotalRembourse = ? WHERE id = ?').run(totalRembourse, returnId);

        // Mettre à jour les totaux du bon
        try {
          const invRecord = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
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
            `).run(newTotalTTC, newTotalHT, newPaye, newReste, newStatut, invId);
          }
        } catch (errInv) {
          console.warn('Erreur mise à jour facture:', errInv);
        }

        if (invoice.client_id && modeRemboursement === 'DEDUCTION_DETTE') {
          const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(invoice.client_id);
          if (cust) {
            const oldDebt = Number(cust.soldeDette || 0);
            const newDebt = Math.max(0, oldDebt - totalRembourse);
            db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, invoice.client_id);

            db.prepare(`
              INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, motif)
              VALUES (?, 'DECAISSEMENT_AVOIR', ?, ?, ?, ?)
            `).run(
              invoice.client_id,
              totalRembourse,
              oldDebt,
              newDebt,
              `Déduction suite à retour ${numeroRetour}`
            );
          }
        }

        return returnId;
      });

      const returnId = returnTx();
      const savedRet = db.prepare('SELECT * FROM sale_returns WHERE id = ?').get(returnId);

      return { success: true, data: { ...savedRet, _id: savedRet.id } };
    } catch (error) {
      console.error('Erreur invoice:createReturn', error);
      return { success: false, error: error.message };
    }
  });

  // 6. Exporter les ventes en Excel
  ipcMain.handle('invoice:exportExcel', async (event, filters = {}) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter les ventes vers Excel',
        defaultPath: `Ventes_CommercePost_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, message: 'Export annulé' };

      const invoices = db.prepare('SELECT * FROM invoices ORDER BY id DESC').all().map(normalizeInvoice);
      return await exportSalesToExcel(invoices, filePath, filters?.columns);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 7. Régler / Encaisser une facture (changer l'état avec un encaissement / règlement)
  ipcMain.handle('invoice:recordPayment', async (event, paymentData) => {
    try {
      const { invoiceId, montant, modePaiement = 'ESPECES', notes = '' } = paymentData;
      const invId = parseInt(invoiceId, 10);
      const invoice = normalizeInvoice(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId));
      if (!invoice) return { success: false, error: 'Facture introuvable' };

      const montantAEncaisser = parseFloat(montant);
      if (isNaN(montantAEncaisser) || montantAEncaisser <= 0) {
        return { success: false, error: 'Le montant d’encaissement doit être supérieur à 0 DA.' };
      }

      if (montantAEncaisser > invoice.montantReste) {
        return {
          success: false,
          error: `Le montant saisi (${montantAEncaisser} DA) dépasse le reste dû (${invoice.montantReste} DA).`
        };
      }

      const nowIso = new Date().toISOString();
      const newMontantPaye = Math.round((invoice.montantPaye + montantAEncaisser) * 100) / 100;
      const newMontantReste = Math.max(0, Math.round((invoice.totalTTC - newMontantPaye) * 100) / 100);
      const newStatut = newMontantReste === 0 ? 'PAYE' : 'PARTIEL';

      const paymentTx = db.transaction(() => {
        // 1. Mettre à jour la facture
        db.prepare(`
          UPDATE invoices 
          SET montantPaye = ?, montantReste = ?, statutPaiement = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newMontantPaye, newMontantReste, newStatut, invId);

        // 2. Si rattachée à un client avec dette, mettre à jour le compte client
        if (invoice.client_id) {
          const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(invoice.client_id);
          if (cust) {
            const oldDebt = Number(cust.soldeDette || 0);
            const newDebt = Math.max(0, Math.round((oldDebt - montantAEncaisser) * 100) / 100);
            db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newDebt, invoice.client_id);

            db.prepare(`
              INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
              VALUES (?, 'PAIEMENT_DETTE', ?, ?, ?, ?, ?, ?)
            `).run(
              invoice.client_id,
              montantAEncaisser,
              oldDebt,
              newDebt,
              invoice.numeroFacture,
              notes || `Encaissement / Règlement facture ${invoice.numeroFacture} (${modePaiement})`,
              nowIso
            );
          }
        }

        // Enregistrement systématique du versement dans les comptes de trésorerie / caisse
        const caissePmt = paymentData.caisse || invoice.caisse || 'Caisse 1';
        const txNum = generateTxNumber('ENC');
        const clientName = invoice.client?.nom || invoice.clientLibre || 'Client';
        const motifEnc = notes || `Règlement / Versement sur ${invoice.typeDocument || 'facture'} ${invoice.numeroFacture}`;

        db.prepare(`
          INSERT INTO cash_transactions (
            numeroTransaction, type, categorie, montant, modePaiement, caisse,
            client_id, tiers, referenceDocument, motif, dateTransaction
          ) VALUES (?, 'ENCAISSEMENT', 'REGLEMENT_CLIENT', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          txNum,
          montantAEncaisser,
          modePaiement,
          caissePmt,
          invoice.client_id || null,
          clientName,
          invoice.numeroFacture,
          motifEnc,
          nowIso
        );
      });

      paymentTx();
      const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
      return { success: true, data: normalizeInvoice(updated), message: 'Encaissement enregistré avec succès.' };
    } catch (error) {
      console.error('Erreur invoice:recordPayment', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerInvoiceHandlers };
