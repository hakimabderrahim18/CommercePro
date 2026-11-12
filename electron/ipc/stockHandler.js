const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { generateProductBarcode, decodeAzertyBarcode } = require('../utils/barcodeGenerator');
const { exportStockToExcel, importStockFromExcel, exportStockMovementsToExcel } = require('../utils/excelService');

function normalizeProduct(p) {
  if (!p) return null;

  let parsedCodes = [];
  if (p.codesBarres) {
    if (Array.isArray(p.codesBarres)) {
      parsedCodes = p.codesBarres.map(c => String(c).trim()).filter(Boolean);
    } else if (typeof p.codesBarres === 'string') {
      try {
        const parsed = JSON.parse(p.codesBarres);
        if (Array.isArray(parsed)) {
          parsedCodes = parsed.map(c => String(c).trim()).filter(Boolean);
        } else {
          parsedCodes = p.codesBarres.split(/[,;\n\s]+/).map(c => c.trim()).filter(Boolean);
        }
      } catch (e) {
        parsedCodes = p.codesBarres.split(/[,;\n\s]+/).map(c => c.trim()).filter(Boolean);
      }
    }
  }
  const mainCode = p.codeBarre ? String(p.codeBarre).trim() : '';
  if (mainCode && !parsedCodes.includes(mainCode)) {
    parsedCodes.unshift(mainCode);
  }
  parsedCodes = Array.from(new Set(parsedCodes));

  return {
    ...p,
    _id: p.id,
    codesBarres: parsedCodes,
    taille: p.taille || '',
    pointure: p.pointure || '',
    couleur: p.couleur || '',
    genre: p.genre || '',
    prixAchat: Number(p.prixAchat || 0),
    prixVente: Number(p.prixVente || 0),
    prixDemiGros: Number(p.prixDemiGros || 0),
    prixGros: Number(p.prixGros || 0),
    prixSuperGros: Number(p.prixSuperGros || 0),
    prixSerie: Number(p.prixSerie || 0),
    piecesParSerie: Number(p.piecesParSerie || 1),
    image: p.image || '',
    quantite: Number(p.quantite || 0),
    seuilAlerte: Number(p.seuilAlerte || 5),
    createdAt: p.created_at || p.createdAt || new Date().toISOString()
  };
}

function registerStockHandlers(mainWindow) {
  const db = getDB();

  // 1. Obtenir tous les produits
  ipcMain.handle('stock:getAll', async (event, filters = {}) => {
    try {
      let query = 'SELECT * FROM products WHERE 1=1';
      const params = [];

      if (filters.search) {
        query += ' AND (nom LIKE ? OR reference LIKE ? OR codeBarre LIKE ? OR codesBarres LIKE ? OR categorie LIKE ? OR fournisseur LIKE ? OR taille LIKE ? OR pointure LIKE ? OR couleur LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term, term, term, term, term, term, term, term);
      }

      if (filters.categorie && filters.categorie !== 'TOUS') {
        query += ' AND UPPER(TRIM(categorie)) = UPPER(TRIM(?))';
        params.push(String(filters.categorie).trim());
      }

      query += ' ORDER BY id DESC';

      let rows = db.prepare(query).all(...params).map(normalizeProduct);

      if (filters.lowStockOnly) {
        rows = rows.filter((p) => p.quantite <= (p.seuilAlerte || 5));
      }

      const categories = db.prepare('SELECT DISTINCT categorie FROM products WHERE categorie IS NOT NULL AND TRIM(categorie) != ""').all().map(r => String(r.categorie).trim());

      return { success: true, data: rows, categories };
    } catch (error) {
      console.error('Erreur stock:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Obtenir un produit par ID, Référence ou Code-barres
  ipcMain.handle('stock:getByRefOrId', async (event, identifier) => {
    try {
      if (!identifier) return { success: false, error: 'Identifiant invalide' };
      
      let cleanRef = String(identifier).trim();
      if (cleanRef.startsWith('PROD:')) {
        cleanRef = cleanRef.substring(5).split('|')[0].trim();
      }

      const azertyRef = decodeAzertyBarcode ? decodeAzertyBarcode(cleanRef).trim() : cleanRef;

      let row = null;

      // 1. Chercher d'abord par Code-Barres ou Référence exacte ou codesBarres
      row = db.prepare('SELECT * FROM products WHERE codeBarre = ? OR reference = ? OR codesBarres LIKE ? LIMIT 1').get(cleanRef, cleanRef, `%${cleanRef}%`);

      // 1b. Si non trouvé, recherche insensible à la casse
      if (!row) {
        row = db.prepare('SELECT * FROM products WHERE UPPER(codeBarre) = ? OR UPPER(reference) = ? OR UPPER(codesBarres) LIKE ? LIMIT 1').get(cleanRef.toUpperCase(), cleanRef.toUpperCase(), `%${cleanRef.toUpperCase()}%`);
      }

      // 1c. Si non trouvé et code AZERTY différent (cas douchette US sur Windows AZERTY)
      if (!row && azertyRef && azertyRef !== cleanRef) {
        row = db.prepare('SELECT * FROM products WHERE codeBarre = ? OR reference = ? OR codesBarres LIKE ? LIMIT 1').get(azertyRef, azertyRef, `%${azertyRef}%`);
        if (!row) {
          row = db.prepare('SELECT * FROM products WHERE UPPER(codeBarre) = ? OR UPPER(reference) = ? OR UPPER(codesBarres) LIKE ? LIMIT 1').get(azertyRef.toUpperCase(), azertyRef.toUpperCase(), `%${azertyRef.toUpperCase()}%`);
        }
      }

      // 2. Si non trouvé et numérique pur, chercher par ID de base de données
      if (!row && /^\d+$/.test(cleanRef)) {
        row = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(cleanRef, 10));
      }
      if (!row && azertyRef && /^\d+$/.test(azertyRef)) {
        row = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(azertyRef, 10));
      }

      // 3. Sinon chercher par nom exact ou partiel
      if (!row) {
        row = db.prepare('SELECT * FROM products WHERE LOWER(nom) = ? LIMIT 1').get(cleanRef.toLowerCase());
      }
      if (!row) {
        row = db.prepare('SELECT * FROM products WHERE LOWER(nom) LIKE ? LIMIT 1').get(`%${cleanRef.toLowerCase()}%`);
      }

      if (!row) {
        return { success: false, error: `Produit non trouvé pour : ${cleanRef}` };
      }

      return { success: true, data: normalizeProduct(row) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 3. Créer un nouveau produit avec Code-Barres
  ipcMain.handle('stock:create', async (event, productData) => {
    try {
      const ref = productData.reference.trim().toUpperCase();
      const existing = db.prepare('SELECT id FROM products WHERE UPPER(reference) = ?').get(ref);
      if (existing) {
        return { success: false, error: `La référence "${productData.reference}" existe déjà.` };
      }

      const { barcodeData, barcodeImage } = await generateProductBarcode(productData);

      let codesBarresStr = '';
      if (Array.isArray(productData.codesBarres)) {
        codesBarresStr = productData.codesBarres.map(c => String(c).trim()).filter(Boolean).join(', ');
      } else if (productData.codesBarres) {
        codesBarresStr = String(productData.codesBarres).trim();
      }

      const stmt = db.prepare(`
        INSERT INTO products (reference, codeBarre, codesBarres, nom, categorie, taille, pointure, couleur, genre, prixAchat, prixVente, prixDemiGros, prixGros, prixSuperGros, prixSerie, piecesParSerie, quantite, unite, seuilAlerte, fournisseur, barcodeData, barcodeImage, qrCodeData, qrCodeImage, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const info = stmt.run(
        ref,
        (productData.codeBarre || ref).trim().toUpperCase(),
        codesBarresStr,
        productData.nom.trim(),
        productData.categorie || 'Général',
        productData.taille || '',
        productData.pointure || '',
        productData.couleur || '',
        productData.genre || '',
        Number(productData.prixAchat) || 0,
        Number(productData.prixVente) || 0,
        Number(productData.prixDemiGros) || 0,
        Number(productData.prixGros) || 0,
        Number(productData.prixSuperGros) || 0,
        Number(productData.prixSerie) || 0,
        Number(productData.piecesParSerie) || 1,
        Number(productData.quantite) || 0,
        productData.unite || 'pcs',
        Number(productData.seuilAlerte) || 5,
        productData.fournisseur || '',
        barcodeData || '',
        barcodeImage || '',
        barcodeData || '',
        barcodeImage || '',
        productData.image || ''
      );

      const productId = info.lastInsertRowid;

      // Enregistrer le mouvement initial si quantite > 0
      const initialQty = Number(productData.quantite) || 0;
      if (initialQty > 0) {
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire, fournisseur, referenceDocument, motif)
          VALUES (?, 'ACHAT_FOURNISSEUR', ?, 0, ?, ?, ?, 'STOCK-INITIAL', 'Création de l’article')
        `).run(
          productId,
          initialQty,
          initialQty,
          Number(productData.prixAchat) || 0,
          productData.fournisseur || 'Stock Initial'
        );
      }

      const saved = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      return { success: true, data: normalizeProduct(saved) };
    } catch (error) {
      console.error('Erreur stock:create', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Modifier un produit existant
  ipcMain.handle('stock:update', async (event, { id, updates, updateData }) => {
    try {
      const data = updates || updateData || {};
      const productId = parseInt(id, 10);
      const current = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!current) return { success: false, error: 'Produit non trouvé' };

      const ref = (data.reference || current.reference).trim().toUpperCase();
      const { barcodeData, barcodeImage } = await generateProductBarcode({ ...current, ...data, reference: ref });

      let codesBarresStr = current.codesBarres || '';
      if (data.codesBarres !== undefined) {
        if (Array.isArray(data.codesBarres)) {
          codesBarresStr = data.codesBarres.map(c => String(c).trim()).filter(Boolean).join(', ');
        } else {
          codesBarresStr = String(data.codesBarres || '').trim();
        }
      }

      db.prepare(`
        UPDATE products 
        SET reference = ?, codeBarre = ?, codesBarres = ?, nom = ?, categorie = ?, taille = ?, pointure = ?, couleur = ?, genre = ?, prixAchat = ?, prixVente = ?, prixDemiGros = ?, prixGros = ?, prixSuperGros = ?, prixSerie = ?, piecesParSerie = ?, quantite = ?, unite = ?, seuilAlerte = ?, fournisseur = ?, barcodeData = ?, barcodeImage = ?, qrCodeData = ?, qrCodeImage = ?, image = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        ref,
        (data.codeBarre || ref).trim().toUpperCase(),
        codesBarresStr,
        (data.nom || current.nom).trim(),
        data.categorie !== undefined ? data.categorie : current.categorie,
        data.taille !== undefined ? data.taille : current.taille,
        data.pointure !== undefined ? data.pointure : current.pointure,
        data.couleur !== undefined ? data.couleur : current.couleur,
        data.genre !== undefined ? data.genre : current.genre,
        data.prixAchat !== undefined ? Number(data.prixAchat) : current.prixAchat,
        data.prixVente !== undefined ? Number(data.prixVente) : current.prixVente,
        data.prixDemiGros !== undefined ? Number(data.prixDemiGros) : (current.prixDemiGros || 0),
        data.prixGros !== undefined ? Number(data.prixGros) : (current.prixGros || 0),
        data.prixSuperGros !== undefined ? Number(data.prixSuperGros) : (current.prixSuperGros || 0),
        data.prixSerie !== undefined ? Number(data.prixSerie) : (current.prixSerie || 0),
        data.piecesParSerie !== undefined ? Number(data.piecesParSerie) : (current.piecesParSerie || 1),
        data.quantite !== undefined ? Number(data.quantite) : current.quantite,
        data.unite || current.unite,
        data.seuilAlerte !== undefined ? Number(data.seuilAlerte) : current.seuilAlerte,
        data.fournisseur !== undefined ? data.fournisseur : current.fournisseur,
        barcodeData || current.barcodeData,
        barcodeImage || current.barcodeImage,
        barcodeData || current.barcodeData,
        barcodeImage || current.barcodeImage,
        data.image !== undefined ? data.image : (current.image || ''),
        productId
      );

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      return { success: true, data: normalizeProduct(updated) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 5. Supprimer un produit
  ipcMain.handle('stock:delete', async (event, id) => {
    try {
      const productId = parseInt(id, 10);
      db.prepare('DELETE FROM products WHERE id = ?').run(productId);
      return { success: true, message: 'Produit supprimé avec succès' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 6. Ajustement manuel de stock
  const handleStockAdjustment = async (event, { productId, type, quantite, motif, prixAchatUnitaire, fournisseur }) => {
    try {
      const pId = parseInt(productId, 10);
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(pId);
      if (!prod) return { success: false, error: 'Produit introuvable' };

      const qty = Number(quantite) || 0;
      if (qty <= 0) return { success: false, error: 'La quantité doit être supérieure à zéro.' };

      let nouvelleQte = prod.quantite;
      if (type === 'AJUSTEMENT_POSITIF' || type === 'ACHAT_FOURNISSEUR' || type === 'RETOUR_CLIENT') {
        nouvelleQte += qty;
      } else {
        if (prod.quantite < qty) {
          return { success: false, error: `Stock insuffisant (${prod.quantite} dispo).` };
        }
        nouvelleQte -= qty;
      }

      db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nouvelleQte, pId);

      db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire, fournisseur, referenceDocument, motif)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUEL', ?)
      `).run(
        pId,
        type,
        qty,
        prod.quantite,
        nouvelleQte,
        Number(prixAchatUnitaire) || prod.prixAchat,
        fournisseur || prod.fournisseur,
        motif || 'Ajustement manuel'
      );

      return { success: true, data: { nouveauStock: nouvelleQte } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  ipcMain.handle('stock:adjust', handleStockAdjustment);
  ipcMain.handle('stock:addPurchaseOrAdjustment', handleStockAdjustment);

  // Rapprochement d'inventaire physique & logiciel
  ipcMain.handle('stock:reconcileInventory', async (event, { items = [], motifGeneral = '' }) => {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        return { success: false, error: 'Aucun article à ajuster.' };
      }

      const reconcileTx = db.transaction(() => {
        let countAdjusted = 0;
        for (const item of items) {
          const pId = parseInt(item.productId, 10);
          const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(pId);
          if (!prod) continue;

          const stockPhysique = Number(item.stockPhysique);
          if (isNaN(stockPhysique)) continue;

          const stockTheorique = Number(prod.quantite) || 0;
          const ecart = Math.round((stockPhysique - stockTheorique) * 100) / 100;

          if (ecart === 0) continue;

          // Mettre à jour le stock produit
          db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(stockPhysique, pId);

          // Enregistrer le mouvement d'ajustement
          const motif = item.motif || motifGeneral || `Rapprochement inventaire physique: ${ecart > 0 ? '+' : ''}${ecart} ${prod.unite || 'pcs'}`;
          db.prepare(`
            INSERT INTO stock_movements (
              product_id, type, quantite, quantiteAvant, quantiteApres, 
              prixAchatUnitaire, referenceDocument, motif, dateMouvement
            ) VALUES (?, 'AJUSTEMENT_INVENTAIRE', ?, ?, ?, ?, 'INV-PHYSIQUE', ?, CURRENT_TIMESTAMP)
          `).run(
            pId,
            ecart,
            stockTheorique,
            stockPhysique,
            Number(prod.prixAchat) || 0,
            motif
          );

          countAdjusted++;
        }
        return countAdjusted;
      });

      const adjustedCount = reconcileTx();
      return { success: true, count: adjustedCount };
    } catch (error) {
      console.error('Erreur stock:reconcileInventory', error);
      return { success: false, error: error.message };
    }
  });

  // 7. Obtenir l'historique des mouvements de stock
  ipcMain.handle('stock:getMovements', async (event, filters = {}) => {
    try {
      let query = `
        SELECT m.*, 
          p.nom as product_nom, 
          p.reference as product_reference, 
          p.codeBarre as product_codeBarre,
          p.categorie as product_categorie,
          p.unite as product_unite,
          p.prixVente as product_prixVente,
          p.prixAchat as product_prixAchat,
          p.quantite as product_stock_actuel,
          p.seuilAlerte as product_stockAlerte,
          p.fournisseur as product_fournisseur_habituel
        FROM stock_movements m
        LEFT JOIN products p ON m.product_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.productId) {
        query += ' AND m.product_id = ?';
        params.push(parseInt(filters.productId, 10));
      }

      if (filters.type && filters.type !== 'TOUS') {
        if (filters.type === 'PIECE_REPARATION_SAV' || filters.type === 'SORTIE_REPARATION') {
          query += " AND (m.type = 'PIECE_REPARATION_SAV' OR m.type = 'SORTIE_REPARATION' OR m.type = 'RETOUR_SAV' OR m.type = 'ANNULATION_REPARATION')";
        } else if (filters.type === 'PERTE') {
          query += " AND (m.type = 'PERTE' OR m.type = 'PERTE_CASSE' OR m.type = 'MODIFICATION_PERTE' OR m.type = 'ANNULATION_PERTE')";
        } else {
          query += ' AND m.type = ?';
          params.push(filters.type);
        }
      }

      if (filters.search) {
        query += ' AND (p.nom LIKE ? OR p.reference LIKE ? OR p.codeBarre LIKE ? OR m.motif LIKE ? OR m.referenceDocument LIKE ? OR m.fournisseur LIKE ?)';
        const term = `%${filters.search}%`;
        params.push(term, term, term, term, term, term);
      }

      if (filters.startDate && filters.endDate) {
        query += ' AND date(m.dateMouvement) BETWEEN ? AND ?';
        params.push(filters.startDate, filters.endDate);
      } else if (filters.startDate) {
        query += ' AND date(m.dateMouvement) >= ?';
        params.push(filters.startDate);
      } else if (filters.endDate) {
        query += ' AND date(m.dateMouvement) <= ?';
        params.push(filters.endDate);
      } else if (filters.period && filters.period !== 'all') {
        if (filters.period === 'today') {
          query += " AND date(m.dateMouvement) = date('now', 'localtime')";
        } else if (filters.period === 'week') {
          query += " AND date(m.dateMouvement) >= date('now', '-7 days', 'localtime')";
        } else if (filters.period === 'month') {
          query += " AND date(m.dateMouvement) >= date('now', 'start of month', 'localtime')";
        } else if (filters.period === 'year') {
          query += " AND date(m.dateMouvement) >= date('now', 'start of year', 'localtime')";
        }
      }

      const limit = Number(filters.limit) || 1000;
      query += ` ORDER BY m.dateMouvement DESC, m.id DESC LIMIT ${limit}`;

      const rows = db.prepare(query).all(...params).map(r => ({
        ...r,
        _id: r.id,
        createdAt: r.dateMouvement || r.created_at,
        dateMouvement: r.dateMouvement || r.created_at,
        product: {
          _id: r.product_id,
          id: r.product_id,
          nom: r.product_nom || 'Article supprimé',
          reference: r.product_reference || '---',
          codeBarre: r.product_codeBarre || '',
          categorie: r.product_categorie || '',
          unite: r.product_unite || 'pcs',
          prixVente: Number(r.product_prixVente || 0),
          prixAchat: Number(r.product_prixAchat || 0),
          quantite: Number(r.product_stock_actuel || 0),
          stockAlerte: Number(r.product_stockAlerte || 0),
          emplacement: r.product_emplacement || '',
          fournisseur: r.product_fournisseur_habituel || ''
        }
      }));

      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 8. Exporter les mouvements de stock en Excel
  ipcMain.handle('stock:exportMovementsExcel', async (event, filters = {}) => {
    try {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter l’historique des mouvements de stock',
        defaultPath: `Mouvements_Stock_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx'] }]
      });

      if (!filePath) return { success: false, cancelled: true };

      let query = `
        SELECT m.*, p.nom as product_nom, p.reference as product_reference, p.unite as product_unite 
        FROM stock_movements m
        LEFT JOIN products p ON m.product_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.productId) {
        query += ' AND m.product_id = ?';
        params.push(parseInt(filters.productId, 10));
      }

      if (filters.type && filters.type !== 'TOUS') {
        if (filters.type === 'PIECE_REPARATION_SAV' || filters.type === 'SORTIE_REPARATION') {
          query += " AND (m.type = 'PIECE_REPARATION_SAV' OR m.type = 'SORTIE_REPARATION' OR m.type = 'RETOUR_SAV' OR m.type = 'ANNULATION_REPARATION')";
        } else if (filters.type === 'PERTE') {
          query += " AND (m.type = 'PERTE' OR m.type = 'PERTE_CASSE' OR m.type = 'MODIFICATION_PERTE' OR m.type = 'ANNULATION_PERTE')";
        } else {
          query += ' AND m.type = ?';
          params.push(filters.type);
        }
      }

      if (filters.startDate && filters.endDate) {
        query += ' AND date(m.dateMouvement) BETWEEN ? AND ?';
        params.push(filters.startDate, filters.endDate);
      } else if (filters.startDate) {
        query += ' AND date(m.dateMouvement) >= ?';
        params.push(filters.startDate);
      } else if (filters.endDate) {
        query += ' AND date(m.dateMouvement) <= ?';
        params.push(filters.endDate);
      }

      query += ' ORDER BY m.dateMouvement DESC, m.id DESC';

      const rows = db.prepare(query).all(...params).map(r => ({
        ...r,
        _id: r.id,
        createdAt: r.dateMouvement || r.created_at,
        product: {
          _id: r.product_id,
          nom: r.product_nom || 'Article supprimé',
          reference: r.product_reference || '---',
          unite: r.product_unite || 'pcs'
        }
      }));

      await exportStockMovementsToExcel(rows, filePath, filters?.columns);
      return { success: true, filePath, count: rows.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 9. Exporter le catalogue de stock en Excel
  ipcMain.handle('stock:exportExcel', async (event, options = {}) => {
    try {
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter le catalogue des stocks',
        defaultPath: `Catalogue_Stocks_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx'] }]
      });

      if (!filePath) return { success: false, cancelled: true };

      const products = db.prepare('SELECT * FROM products ORDER BY nom ASC').all().map(normalizeProduct);
      await exportStockToExcel(products, filePath, options?.columns);

      return { success: true, filePath, count: products.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 10. Importer des articles depuis un fichier Excel
  ipcMain.handle('stock:importExcel', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Importer des produits depuis Excel',
        filters: [{ name: 'Fichiers Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile']
      });

      if (!filePaths || filePaths.length === 0) return { success: false, cancelled: true };

      const items = await importStockFromExcel(filePaths[0]);
      let insertedCount = 0;
      let updatedCount = 0;

      for (const item of items) {
        if (!item.reference || !item.nom) continue;
        const ref = item.reference.trim().toUpperCase();
        const existing = db.prepare('SELECT id FROM products WHERE UPPER(reference) = ?').get(ref);

        const { barcodeData, barcodeImage } = await generateProductBarcode(item);

        if (existing) {
          db.prepare(`
            UPDATE products 
            SET nom = ?, categorie = ?, prixAchat = ?, prixVente = ?, quantite = ?, unite = ?, seuilAlerte = ?, fournisseur = ?, barcodeData = ?, barcodeImage = ?, codesBarres = CASE WHEN ? != '' THEN ? ELSE codesBarres END, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            item.nom,
            item.categorie || 'Général',
            Number(item.prixAchat) || 0,
            Number(item.prixVente) || 0,
            Number(item.quantite) || 0,
            item.unite || 'pcs',
            Number(item.seuilAlerte) || 5,
            item.fournisseur || '',
            barcodeData || '',
            barcodeImage || '',
            item.codesBarres || '',
            item.codesBarres || '',
            existing.id
          );
          updatedCount++;
        } else {
          db.prepare(`
            INSERT INTO products (reference, codeBarre, codesBarres, nom, categorie, prixAchat, prixVente, quantite, unite, seuilAlerte, fournisseur, barcodeData, barcodeImage, qrCodeData, qrCodeImage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ref,
            (item.codeBarre || ref).trim().toUpperCase(),
            item.codesBarres || '',
            item.nom,
            item.categorie || 'Général',
            Number(item.prixAchat) || 0,
            Number(item.prixVente) || 0,
            Number(item.quantite) || 0,
            item.unite || 'pcs',
            Number(item.seuilAlerte) || 5,
            item.fournisseur || '',
            barcodeData || '',
            barcodeImage || '',
            barcodeData || '',
            barcodeImage || ''
          );
          insertedCount++;
        }
      }

      return { success: true, count: insertedCount, updated: updatedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerStockHandlers };
