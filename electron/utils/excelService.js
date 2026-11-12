const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

/**
 * Exporte la liste des produits en fichier Excel
 */
async function exportStockToExcel(products, filePath, selectedColumnKeys = null) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Stock Produits', {
    properties: { tabColor: { argb: '2563EB' } }
  });

  const availableColumns = [
    { key: 'reference', header: 'Référence', width: 16, getValue: (p) => p.reference || '' },
    { key: 'codeBarre', header: 'Code-Barres Principal', width: 18, getValue: (p) => p.codeBarre || p.reference || '' },
    { key: 'codesBarres', header: 'Tous Codes-Barres', width: 24, getValue: (p) => Array.isArray(p.codesBarres) ? p.codesBarres.join(', ') : (p.codesBarres || '') },
    { key: 'nom', header: 'Désignation', width: 32, getValue: (p) => p.nom || '' },
    { key: 'categorie', header: 'Catégorie', width: 18, getValue: (p) => p.categorie || 'Général' },
    { key: 'taille', header: 'Taille', width: 12, getValue: (p) => p.taille || '-' },
    { key: 'pointure', header: 'Pointure', width: 12, getValue: (p) => p.pointure || '-' },
    { key: 'couleur', header: 'Couleur', width: 14, getValue: (p) => p.couleur || '-' },
    { key: 'genre', header: 'Genre', width: 14, getValue: (p) => p.genre || '-' },
    { key: 'prixAchat', header: 'Prix d’Achat (DA)', width: 16, getValue: (p) => Number(p.prixAchat || 0) },
    { key: 'prixVente', header: 'Prix Détail (DA)', width: 16, getValue: (p) => Number(p.prixVente || 0) },
    { key: 'prixDemiGros', header: 'Prix Demi-Gros (DA)', width: 18, getValue: (p) => Number(p.prixDemiGros || 0) },
    { key: 'prixGros', header: 'Prix Gros (DA)', width: 16, getValue: (p) => Number(p.prixGros || 0) },
    { key: 'prixSuperGros', header: 'Prix Super Gros (DA)', width: 18, getValue: (p) => Number(p.prixSuperGros || 0) },
    { key: 'quantite', header: 'Quantité en Stock', width: 18, getValue: (p) => Number(p.quantite || 0) },
    { key: 'unite', header: 'Unité', width: 10, getValue: (p) => p.unite || 'pcs' },
    { key: 'seuilAlerte', header: 'Seuil d’Alerte', width: 14, getValue: (p) => Number(p.seuilAlerte || 5) },
    { key: 'fournisseur', header: 'Fournisseur', width: 22, getValue: (p) => p.fournisseur || '' },
    { key: 'valeurAchat', header: 'Valeur Stock Achat (DA)', width: 22, getValue: (p) => Math.round((Number(p.quantite || 0) * Number(p.prixAchat || 0)) * 100) / 100 },
    { key: 'valeurVente', header: 'Valeur Stock Vente (DA)', width: 22, getValue: (p) => Math.round((Number(p.quantite || 0) * Number(p.prixVente || 0)) * 100) / 100 },
    { key: 'beneficeStock', header: 'Bénéfice Stock (DA)', width: 20, getValue: (p) => Math.round((Number(p.quantite || 0) * (Number(p.prixVente || 0) - Number(p.prixAchat || 0))) * 100) / 100 },
    { key: 'statutRupture', header: 'Statut Rupture', width: 18, getValue: (p) => (Number(p.quantite || 0) <= Number(p.seuilAlerte || 5) ? 'ALERTE / RUPTURE' : 'CONFORME') }
  ];

  const columnsToExport = (Array.isArray(selectedColumnKeys) && selectedColumnKeys.length > 0)
    ? availableColumns.filter(c => selectedColumnKeys.includes(c.key))
    : availableColumns;

  worksheet.columns = columnsToExport.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width
  }));

  // Style de l'en-tête
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  products.forEach((p) => {
    const rowData = {};
    columnsToExport.forEach(c => {
      rowData[c.key] = c.getValue(p);
    });
    const row = worksheet.addRow(rowData);
    if (columnsToExport.some(c => c.key === 'statutRupture')) {
      if (Number(p.quantite || 0) <= Number(p.seuilAlerte || 5)) {
        const cell = row.getCell('statutRupture');
        if (cell) {
          cell.font = { color: { argb: 'DC2626' }, bold: true };
        }
      }
    }
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: products.length, filePath };
}

/**
 * Exporte l'historique des ventes / factures en Excel
 */
async function exportSalesToExcel(invoices, filePath, selectedColumnKeys = null) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Ventes & Factures');

  const availableColumns = [
    { key: 'numeroFacture', header: 'N° Facture', width: 18, getValue: (inv) => inv.numeroFacture || '' },
    { key: 'date', header: 'Date', width: 18, getValue: (inv) => new Date(inv.createdAt || inv.dateFacture).toLocaleString('fr-DZ') },
    { key: 'typeDocument', header: 'Type Document', width: 16, getValue: (inv) => inv.typeDocument || 'FACTURE' },
    { key: 'client', header: 'Client', width: 24, getValue: (inv) => inv.client?.nom || inv.nomClientLibre || 'Client Comptoir' },
    { key: 'caisse', header: 'Caisse', width: 14, getValue: (inv) => inv.caisse || 'Caisse 1' },
    { key: 'totalHT', header: 'Total HT (DA)', width: 16, getValue: (inv) => Number(inv.totalHT || 0) },
    { key: 'tauxTva', header: 'Taux TVA (%)', width: 14, getValue: (inv) => Number(inv.tauxTva || 0) },
    { key: 'montantTva', header: 'Montant TVA (DA)', width: 16, getValue: (inv) => Number(inv.montantTva || 0) },
    { key: 'totalTTC', header: 'Total TTC (DA)', width: 18, getValue: (inv) => Number(inv.totalTTC || 0) },
    { key: 'montantPaye', header: 'Montant Payé (DA)', width: 18, getValue: (inv) => Number(inv.montantPaye || 0) },
    { key: 'montantReste', header: 'Reste Dû (DA)', width: 16, getValue: (inv) => Number(inv.montantReste || 0) },
    { key: 'modePaiement', header: 'Mode de Règlement', width: 18, getValue: (inv) => inv.modePaiement || 'ESPECES' },
    { key: 'statutPaiement', header: 'Statut Paiement', width: 16, getValue: (inv) => inv.statutPaiement || 'PAYE' },
    { key: 'notes', header: 'Notes / Remarques', width: 26, getValue: (inv) => inv.notes || '' }
  ];

  const columnsToExport = (Array.isArray(selectedColumnKeys) && selectedColumnKeys.length > 0)
    ? availableColumns.filter(c => selectedColumnKeys.includes(c.key))
    : availableColumns;

  worksheet.columns = columnsToExport.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '047857' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  invoices.forEach((inv) => {
    const rowData = {};
    columnsToExport.forEach(c => {
      rowData[c.key] = c.getValue(inv);
    });
    worksheet.addRow(rowData);
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: invoices.length, filePath };
}

/**
 * Exporte l'historique des achats et mouvements de stock en Excel
 */
async function exportStockMovementsToExcel(movements, filePath, selectedColumnKeys = null) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Mouvements & Achats');

  const availableColumns = [
    { key: 'date', header: 'Date & Heure', width: 18, getValue: (m) => new Date(m.createdAt).toLocaleString('fr-DZ') },
    { key: 'type', header: 'Type de Mouvement', width: 22, getValue: (m) => m.type || '' },
    { key: 'refProduit', header: 'Réf Produit', width: 16, getValue: (m) => m.product?.reference || '' },
    { key: 'nomProduit', header: 'Nom Produit', width: 28, getValue: (m) => m.product?.nom || '' },
    { key: 'quantite', header: 'Quantité Mouvementée', width: 16, getValue: (m) => m.quantite || 0 },
    { key: 'avant', header: 'Stock Avant', width: 14, getValue: (m) => m.quantiteAvant ?? '' },
    { key: 'apres', header: 'Stock Après', width: 14, getValue: (m) => m.quantiteApres ?? '' },
    { key: 'prixAchat', header: 'Prix d’Achat (DA)', width: 16, getValue: (m) => Number(m.prixAchatUnitaire || 0) },
    { key: 'fournisseurDoc', header: 'Fournisseur / N° Doc', width: 24, getValue: (m) => m.fournisseur || m.referenceDocument || '' },
    { key: 'motif', header: 'Motif / Justificatif', width: 28, getValue: (m) => m.motif || '' }
  ];

  const columnsToExport = (Array.isArray(selectedColumnKeys) && selectedColumnKeys.length > 0)
    ? availableColumns.filter(c => selectedColumnKeys.includes(c.key))
    : availableColumns;

  worksheet.columns = columnsToExport.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4338CA' } // Indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  movements.forEach((m) => {
    const rowData = {};
    columnsToExport.forEach(c => {
      rowData[c.key] = c.getValue(m);
    });
    worksheet.addRow(rowData);
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: movements.length, filePath };
}

/**
 * Importe un fichier Excel ou CSV pour ajouter / mettre à jour les produits
 */
async function importStockFromExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Le fichier Excel ne contient aucune feuille de calcul.");
  }

  const rows = [];
  const headerMap = {};

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Trouver les en-têtes
      row.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('autre code') || val.includes('tous codes') || val.includes('codes-barres') || val.includes('codes barres') || val.includes('codesbarres')) headerMap.codesBarres = colNumber;
        else if (val.includes('code-barre') || val.includes('code barre') || val.includes('codebarre') || val.includes('barcode')) headerMap.codeBarre = colNumber;
        else if (val.includes('réf') || val.includes('ref') || val.includes('code') || val.includes('مرجع') || val.includes('رمز')) headerMap.reference = colNumber;
        else if (val.includes('nom') || val.includes('désignation') || val.includes('designation') || val.includes('article') || val.includes('produit') || val.includes('اسم') || val.includes('منتج') || val.includes('سلعة')) headerMap.nom = colNumber;
        else if (val.includes('cat') || val.includes('صنف') || val.includes('فئة')) headerMap.categorie = colNumber;
        else if (val.includes('taille') || val.includes('size') || val.includes('مقاس') || val.includes('حجم')) headerMap.taille = colNumber;
        else if (val.includes('pointure') || val.includes('shoe') || val.includes('حذاء') || val.includes('نمرة')) headerMap.pointure = colNumber;
        else if (val.includes('coul') || val.includes('color') || val.includes('لون')) headerMap.couleur = colNumber;
        else if (val.includes('genre') || val.includes('gender') || val.includes('public') || val.includes('نوع') || val.includes('جنس')) headerMap.genre = colNumber;
        else if (val.includes('achat') || val.includes('شراء')) headerMap.prixAchat = colNumber;
        else if (val.includes('vente') || val.includes('prix') || val.includes('بيع') || val.includes('سعر')) headerMap.prixVente = colNumber;
        else if (val.includes('quant') || val.includes('qte') || val.includes('stock') || val.includes('كمية') || val.includes('مخزون')) headerMap.quantite = colNumber;
        else if (val.includes('unit') || val.includes('وحدة')) headerMap.unite = colNumber;
        else if (val.includes('seuil') || val.includes('alerte') || val.includes('إنذار') || val.includes('حد')) headerMap.seuilAlerte = colNumber;
        else if (val.includes('fourn') || val.includes('مورد')) headerMap.fournisseur = colNumber;
      });
      return;
    }

    const ref = headerMap.reference ? row.getCell(headerMap.reference).value : null;
    const codeBarre = headerMap.codeBarre ? row.getCell(headerMap.codeBarre).value : null;
    const codesBarres = headerMap.codesBarres ? row.getCell(headerMap.codesBarres).value : null;
    const nom = headerMap.nom ? row.getCell(headerMap.nom).value : null;

    if (!nom && !ref && !codeBarre) return; // ignore empty rows

    const extractNumber = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const parsed = parseFloat(val.replace(',', '.').replace(/[^0-9.-]/g, ''));
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const finalRef = String(ref || codeBarre || `ART-${Date.now().toString().slice(-5)}-${rowNumber}`).trim().toUpperCase();

    rows.push({
      reference: finalRef,
      codeBarre: String(codeBarre || finalRef).trim().toUpperCase(),
      codesBarres: String(codesBarres || '').trim(),
      nom: String(nom || 'Article sans nom').trim(),
      categorie: headerMap.categorie ? String(row.getCell(headerMap.categorie).value || 'Général').trim() : 'Général',
      taille: headerMap.taille ? String(row.getCell(headerMap.taille).value || '').trim() : '',
      pointure: headerMap.pointure ? String(row.getCell(headerMap.pointure).value || '').trim() : '',
      couleur: headerMap.couleur ? String(row.getCell(headerMap.couleur).value || '').trim() : '',
      genre: headerMap.genre ? String(row.getCell(headerMap.genre).value || '').trim() : '',
      prixAchat: headerMap.prixAchat ? extractNumber(row.getCell(headerMap.prixAchat).value) : 0,
      prixVente: headerMap.prixVente ? extractNumber(row.getCell(headerMap.prixVente).value) : 0,
      quantite: headerMap.quantite ? extractNumber(row.getCell(headerMap.quantite).value) : 0,
      unite: headerMap.unite ? String(row.getCell(headerMap.unite).value || 'pcs').trim() : 'pcs',
      seuilAlerte: headerMap.seuilAlerte ? extractNumber(row.getCell(headerMap.seuilAlerte).value) : 5,
      fournisseur: headerMap.fournisseur ? String(row.getCell(headerMap.fournisseur).value || '').trim() : ''
    });
  });

  return rows;
}

/**
 * Exporte la liste des Avoirs (Ventes/BL ou Achats) en fichier Excel
 */
async function exportReturnsToExcel(returnsList, type = 'SALE', filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const isSale = type === 'SALE';
  const sheetTitle = isSale ? 'Avoirs Ventes & BL' : 'Avoirs Achats Fournisseurs';
  const worksheet = workbook.addWorksheet(sheetTitle, {
    properties: { tabColor: { argb: isSale ? 'DC2626' : 'D97706' } }
  });

  worksheet.columns = isSale
    ? [
        { header: 'N° Avoir / Retour', key: 'numeroRetour', width: 18 },
        { header: 'Type', key: 'typeDocument', width: 16 },
        { header: 'Date', key: 'dateRetour', width: 18 },
        { header: 'Client', key: 'client', width: 25 },
        { header: 'N° Vente / BL Réf.', key: 'invoiceNum', width: 18 },
        { header: 'Articles Retournés', key: 'articles', width: 35 },
        { header: 'Montant Remboursé (DA)', key: 'montantTotal', width: 22 },
        { header: 'Mode Règlement', key: 'modeRemboursement', width: 20 },
        { header: 'Motif', key: 'motif', width: 30 }
      ]
    : [
        { header: 'N° Avoir Achat', key: 'numeroAvoirAchat', width: 18 },
        { header: 'Date', key: 'dateAvoirAchat', width: 18 },
        { header: 'Fournisseur', key: 'fournisseur', width: 25 },
        { header: 'Contact', key: 'contactFournisseur', width: 18 },
        { header: 'N° Facture Achat', key: 'purchaseNum', width: 18 },
        { header: 'Articles Retournés', key: 'articles', width: 35 },
        { header: 'Montant Total (DA)', key: 'montantTotal', width: 22 },
        { header: 'Mode Règlement', key: 'modeRemboursement', width: 20 },
        { header: 'Motif', key: 'motif', width: 30 }
      ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: isSale ? '991B1B' : '92400E' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  returnsList.forEach((ret) => {
    const articlesSummary = (ret.items || [])
      .map((it) => `${it.nom || it.reference} (x${it.quantiteRetournee})`)
      .join(', ');

    const dateFormatted = new Date(ret.dateRetour || ret.dateAvoirAchat || ret.createdAt).toLocaleString('fr-DZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (isSale) {
      worksheet.addRow({
        numeroRetour: ret.numeroRetour,
        typeDocument: ret.typeDocument === 'AVOIR_BL' ? 'Avoir Bon Livraison' : 'Avoir Facture Vente',
        dateRetour: dateFormatted,
        client: ret.client?.nom || ret.clientLibre || 'Client Comptoir',
        invoiceNum: ret.invoice?.numeroFacture || '-',
        articles: articlesSummary || '-',
        montantTotal: ret.montantTotalRembourse || 0,
        modeRemboursement: ret.modeRemboursement || 'ESPECES',
        motif: ret.motif || '-'
      });
    } else {
      worksheet.addRow({
        numeroAvoirAchat: ret.numeroAvoirAchat,
        dateAvoirAchat: dateFormatted,
        fournisseur: ret.fournisseur,
        contactFournisseur: ret.contactFournisseur || '-',
        purchaseNum: ret.purchase?.numeroFactureAchat || '-',
        articles: articlesSummary || '-',
        montantTotal: ret.montantTotal || 0,
        modeRemboursement: ret.modeRemboursement || 'ESPECES',
        motif: ret.motif || '-'
      });
    }
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, filePath, count: returnsList.length };
}

/**
 * Exporte la liste des clients en fichier Excel
 */
async function exportCustomersToExcel(customers, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Clients & Dettes', {
    properties: { tabColor: { argb: '4F46E5' } }
  });

  worksheet.columns = [
    { header: 'Nom / Raison Sociale', key: 'nom', width: 30 },
    { header: 'Téléphone', key: 'telephone', width: 18 },
    { header: 'Email', key: 'email', width: 24 },
    { header: 'Adresse', key: 'adresse', width: 30 },
    { header: 'Solde Dette (DA)', key: 'soldeDette', width: 18 },
    { header: 'Plafond Crédit (DA)', key: 'plafondCredit', width: 18 },
    { header: 'Notes / Observations', key: 'notes', width: 28 },
    { header: 'Date Création', key: 'createdAt', width: 18 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4338CA' } // Indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  customers.forEach((c) => {
    worksheet.addRow({
      nom: c.nom,
      telephone: c.telephone || '',
      email: c.email || '',
      adresse: c.adresse || '',
      soldeDette: Number(c.soldeDette || 0),
      plafondCredit: Number(c.plafondCredit || 0),
      notes: c.notes || '',
      createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-DZ') : ''
    });
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: customers.length, filePath };
}

/**
 * Importe un fichier Excel de clients
 */
async function importCustomersFromExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Le fichier Excel ne contient aucune feuille de calcul.");
  }

  const rows = [];
  const headerMap = {};

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        const val = String(cell.value || '').trim().toLowerCase();
        if (val.includes('nom') || val.includes('client') || val.includes('raison') || val.includes('اسم')) headerMap.nom = colNumber;
        else if (val.includes('tél') || val.includes('tel') || val.includes('phone') || val.includes('هاتف')) headerMap.telephone = colNumber;
        else if (val.includes('mail') || val.includes('بريد')) headerMap.email = colNumber;
        else if (val.includes('adr') || val.includes('ville') || val.includes('عنوان')) headerMap.adresse = colNumber;
        else if (val.includes('dette') || val.includes('solde') || val.includes('créance') || val.includes('دين') || val.includes('رصيد')) headerMap.soldeDette = colNumber;
        else if (val.includes('plafond') || val.includes('credit') || val.includes('crédit') || val.includes('سقف')) headerMap.plafondCredit = colNumber;
        else if (val.includes('note') || val.includes('obs') || val.includes('ملاحظ')) headerMap.notes = colNumber;
      });
      return;
    }

    const nom = headerMap.nom ? row.getCell(headerMap.nom).value : null;
    if (!nom) return; // Ignore row without name

    const extractNumber = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const parsed = parseFloat(val.replace(',', '.').replace(/[^0-9.-]/g, ''));
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    rows.push({
      nom: String(nom).trim(),
      telephone: headerMap.telephone ? String(row.getCell(headerMap.telephone).value || '').trim() : '',
      email: headerMap.email ? String(row.getCell(headerMap.email).value || '').trim() : '',
      adresse: headerMap.adresse ? String(row.getCell(headerMap.adresse).value || '').trim() : '',
      soldeDette: headerMap.soldeDette ? extractNumber(row.getCell(headerMap.soldeDette).value) : 0,
      plafondCredit: headerMap.plafondCredit ? extractNumber(row.getCell(headerMap.plafondCredit).value) : 0,
      notes: headerMap.notes ? String(row.getCell(headerMap.notes).value || '').trim() : ''
    });
  });

  return rows;
}

/**
 * Exporte l'historique de trésorerie (Encaissements & Décaissements) en Excel
 */
async function exportTreasuryToExcel(transactions, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Trésorerie & Caisse', {
    properties: { tabColor: { argb: '059669' } }
  });

  worksheet.columns = [
    { header: 'N° Transaction', key: 'numeroTransaction', width: 20 },
    { header: 'Type de Flux', key: 'typeFlux', width: 18 },
    { header: 'Date & Heure', key: 'dateTransaction', width: 20 },
    { header: 'Catégorie', key: 'categorie', width: 24 },
    { header: 'Tiers / Bénéficiaire', key: 'tiers', width: 26 },
    { header: 'Montant (DA)', key: 'montant', width: 18 },
    { header: 'Mode de Paiement', key: 'modePaiement', width: 18 },
    { header: 'Réf Document / Pièce', key: 'referenceDocument', width: 22 },
    { header: 'Motif / Description', key: 'motif', width: 32 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '065F46' } // Deep Emerald
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  transactions.forEach((tx) => {
    const isEncaissement = tx.type === 'ENCAISSEMENT';
    const dateFormatted = new Date(tx.dateTransaction || tx.created_at || Date.now()).toLocaleString('fr-DZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const tiersName = tx.client?.nom || tx.fournisseur || tx.tiers || '-';

    const row = worksheet.addRow({
      numeroTransaction: tx.numeroTransaction,
      typeFlux: isEncaissement ? 'ENCAISSEMENT (+)' : 'DÉCAISSEMENT (-)',
      dateTransaction: dateFormatted,
      categorie: tx.categorie || 'AUTRE',
      tiers: tiersName,
      montant: (isEncaissement ? 1 : -1) * Number(tx.montant || 0),
      modePaiement: tx.modePaiement || 'ESPECES',
      referenceDocument: tx.referenceDocument || '-',
      motif: tx.motif || '-'
    });

    row.getCell('typeFlux').font = {
      color: { argb: isEncaissement ? '059669' : 'DC2626' },
      bold: true
    };
    row.getCell('montant').font = {
      color: { argb: isEncaissement ? '059669' : 'DC2626' },
      bold: true
    };
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: transactions.length, filePath };
}

/**
 * Exporte le registre des Pertes & Casse en fichier Excel
 */
async function exportLossesToExcel(losses, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Pertes et Casse', {
    properties: { tabColor: { argb: 'DC2626' } }
  });

  worksheet.columns = [
    { header: 'N° Déclaration', key: 'numeroDeclaration', width: 20 },
    { header: 'Date', key: 'dateDeclaration', width: 18 },
    { header: 'Référence', key: 'reference', width: 16 },
    { header: 'Désignation Produit', key: 'nom', width: 30 },
    { header: 'Catégorie', key: 'categorie', width: 18 },
    { header: 'Taille', key: 'taille', width: 12 },
    { header: 'Pointure', key: 'pointure', width: 12 },
    { header: 'Couleur', key: 'couleur', width: 14 },
    { header: 'Type de Perte', key: 'typePerte', width: 22 },
    { header: 'Quantité Perdue', key: 'quantite', width: 16 },
    { header: 'Prix Achat (DA)', key: 'prixAchatUnitaire', width: 16 },
    { header: 'Valeur Perte (DA)', key: 'valeurPerte', width: 18 },
    { header: 'Déclaré Par', key: 'declarePar', width: 20 },
    { header: 'Motif / Description', key: 'motif', width: 32 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '991B1B' } // Dark Red / Rose
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  losses.forEach((loss) => {
    const dateFormatted = new Date(loss.dateDeclaration || loss.created_at || Date.now()).toLocaleString('fr-DZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const typeLabel = loss.typePerte === 'CASSE' ? 'Casse matériel' :
                      loss.typePerte === 'PERTE_VOL' ? 'Perte / Vol' :
                      loss.typePerte === 'DEFAUT_FABRICATION' ? 'Défaut fabrication' :
                      loss.typePerte === 'PERIME_AVARIE' ? 'Périmé / Avarié' :
                      loss.typePerte === 'DEGAT_TRANSPORT' ? 'Dégât transport' : (loss.typePerte || 'Autre');

    const row = worksheet.addRow({
      numeroDeclaration: loss.numeroDeclaration,
      dateDeclaration: dateFormatted,
      reference: loss.reference,
      nom: loss.nom,
      categorie: loss.categorie || '-',
      taille: loss.taille || '-',
      pointure: loss.pointure || '-',
      couleur: loss.couleur || '-',
      typePerte: typeLabel,
      quantite: Number(loss.quantite || 0),
      prixAchatUnitaire: Number(loss.prixAchatUnitaire || 0),
      valeurPerte: Number(loss.valeurPerte || 0),
      declarePar: loss.declarePar || 'Responsable Stock',
      motif: loss.motif || '-'
    });

    row.getCell('quantite').font = { color: { argb: 'DC2626' }, bold: true };
    row.getCell('valeurPerte').font = { color: { argb: 'DC2626' }, bold: true };
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: losses.length, filePath };
}

/**
 * Exporte la liste des achats / factures fournisseurs en Excel
 */
async function exportPurchasesToExcel(purchases, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Achats Fournisseurs', {
    properties: { tabColor: { argb: '4338CA' } }
  });

  worksheet.columns = [
    { header: 'N° Bon / Facture Achat', key: 'numeroFactureAchat', width: 22 },
    { header: 'Type Document', key: 'typeDocument', width: 18 },
    { header: 'Date', key: 'dateFactureAchat', width: 16 },
    { header: 'Fournisseur', key: 'fournisseur', width: 26 },
    { header: 'Caisse', key: 'caisse', width: 14 },
    { header: 'Total HT (DA)', key: 'totalHT', width: 16 },
    { header: 'TVA (%)', key: 'tauxTva', width: 10 },
    { header: 'Montant TVA (DA)', key: 'montantTva', width: 16 },
    { header: 'Total TTC (DA)', key: 'totalTTC', width: 18 },
    { header: 'Montant Payé (DA)', key: 'montantPaye', width: 18 },
    { header: 'Reste Dû (DA)', key: 'montantReste', width: 18 },
    { header: 'Statut Paiement', key: 'statutPaiement', width: 16 },
    { header: 'Mode Paiement', key: 'modePaiement', width: 16 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '3730A3' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  let sumTTC = 0;
  let sumPaye = 0;
  let sumReste = 0;

  purchases.forEach((p) => {
    const totalTTC = Number(p.totalTTC || 0);
    const paye = Number(p.montantPaye || 0);
    const reste = Number(p.montantReste || 0);
    sumTTC += totalTTC;
    sumPaye += paye;
    sumReste += reste;

    const row = worksheet.addRow({
      numeroFactureAchat: p.numeroFactureAchat,
      typeDocument: p.typeDocument === 'BON_COMMANDE_ACHAT' ? 'Bon de Commande' : 'Facture Achat',
      dateFactureAchat: p.dateFactureAchat ? new Date(p.dateFactureAchat).toLocaleDateString('fr-DZ') : '-',
      fournisseur: p.fournisseur || '-',
      caisse: p.caisse || 'Caisse 1',
      totalHT: Number(p.totalHT || 0),
      tauxTva: Number(p.tauxTva || 0),
      montantTva: Number(p.montantTva || 0),
      totalTTC,
      montantPaye: paye,
      montantReste: reste,
      statutPaiement: p.statutPaiement === 'PAYE' ? 'PAYÉ' : p.statutPaiement === 'PARTIEL' ? 'PARTIEL' : 'NON PAYÉ',
      modePaiement: p.modePaiement || 'ESPECES'
    });

    if (reste > 0) {
      row.getCell('montantReste').font = { color: { argb: 'D97706' }, bold: true };
    }
  });

  const summaryRow = worksheet.addRow({
    numeroFactureAchat: 'TOTAL',
    fournisseur: `${purchases.length} achats`,
    totalTTC: sumTTC,
    montantPaye: sumPaye,
    montantReste: sumReste
  });
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E0E7FF' }
  };

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: purchases.length, filePath };
}

/**
 * Exporte le relevé de compte d'un client en Excel
 */
async function exportCustomerStatementToExcel(customer, movements, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Relevé Client', {
    properties: { tabColor: { argb: '10B981' } }
  });

  worksheet.addRow(['RELEVÉ DE COMPTE CLIENT - COMMERCE PRO']).font = { bold: true, size: 14 };
  worksheet.addRow([`Client : ${customer?.nom || ''}`, `Date : ${new Date().toLocaleDateString('fr-DZ')}`]);
  worksheet.addRow([`Téléphone : ${customer?.telephone || '-'}`, `Email : ${customer?.email || '-'}`]);
  worksheet.addRow([`Adresse : ${customer?.adresse || '-'}`, `Solde Dette Actuel : ${Number(customer?.soldeDette || 0).toLocaleString('fr-DZ')} DA`]);
  worksheet.addRow([]);

  const headers = ['Date', 'Type Mouvement', 'Débit (Vente)', 'Crédit (Règlement)', 'Solde Après (DA)', 'N° Facture / Pièce', 'Motif / Réf'];
  const hRow = worksheet.addRow(headers);
  hRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  hRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0F766E' }
  };

  movements.forEach((m) => {
    const isPayment = m.type === 'PAIEMENT' || m.type === 'REGLEMENT' || m.type === 'ENCAISSEMENT' || m.type === 'ENCAISSEMENT_REGLEMENT';
    const amount = Number(m.montant || 0);

    const dateStr = new Date(m.createdAt || m.dateMouvement || m.date).toLocaleString('fr-DZ', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const typeStr = isPayment ? 'RÈGLEMENT (-)' : 'VENTE / CRÉDIT (+)';
    const debit = !isPayment ? amount : '';
    const credit = isPayment ? amount : '';

    worksheet.addRow([
      dateStr,
      typeStr,
      debit,
      credit,
      Number(m.soldeApres || 0),
      m.referenceFacture || m.factureAssociee?.numeroFacture || '-',
      m.motif || '-'
    ]);
  });

  worksheet.columns.forEach((col, idx) => {
    col.width = idx === 0 ? 18 : idx === 1 ? 18 : idx === 4 ? 16 : idx === 5 ? 20 : idx === 6 ? 26 : 14;
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: movements.length, filePath };
}

/**
 * Exporte la situation / relevé d'un fournisseur en Excel
 */
async function exportSupplierStatementToExcel(supplier, movements, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Commerce Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Situation Fournisseur', {
    properties: { tabColor: { argb: '2563EB' } }
  });

  worksheet.addRow(['SITUATION & RELEVÉ FOURNISSEUR - COMMERCE PRO']).font = { bold: true, size: 14 };
  worksheet.addRow([`Fournisseur : ${supplier?.nom || ''}`, `Date : ${new Date().toLocaleDateString('fr-DZ')}`]);
  worksheet.addRow([`Téléphone : ${supplier?.telephone || '-'}`, `Email : ${supplier?.email || '-'}`]);
  worksheet.addRow([`Adresse : ${supplier?.adresse || '-'}`, `Solde Actuel Dû : ${Number(supplier?.soldeDette || 0).toLocaleString('fr-DZ')} DA`]);
  worksheet.addRow([]);

  const headers = ['Date', 'Opération', 'N° Pièce / Réf', 'Achat (+)', 'Versement (-)', 'Solde Après (DA)', 'Observations'];
  const hRow = worksheet.addRow(headers);
  hRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  hRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' }
  };

  movements.forEach((m) => {
    const isPay = m.type === 'VERSEMENT_FOURNISSEUR' || m.type === 'REGLEMENT' || m.type === 'VERSEMENT';
    const amount = Number(m.montant || 0);

    const dateStr = new Date(m.createdAt || m.dateMouvement).toLocaleString('fr-DZ', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const opStr = isPay ? 'VERSEMENT' : 'ACHAT';
    const achat = !isPay ? amount : '';
    const versement = isPay ? amount : '';

    worksheet.addRow([
      dateStr,
      opStr,
      m.numeroFacture || m.reference || '-',
      achat,
      versement,
      Number(m.soldeApres || 0),
      m.notes || m.motif || '-'
    ]);
  });

  worksheet.columns.forEach((col, idx) => {
    col.width = idx === 0 ? 18 : idx === 1 ? 16 : idx === 2 ? 18 : idx === 5 ? 16 : idx === 6 ? 26 : 14;
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, count: movements.length, filePath };
}

module.exports = {
  exportStockToExcel,
  exportSalesToExcel,
  exportStockMovementsToExcel,
  exportReturnsToExcel,
  exportCustomersToExcel,
  exportTreasuryToExcel,
  exportLossesToExcel,
  exportPurchasesToExcel,
  exportCustomerStatementToExcel,
  exportSupplierStatementToExcel,
  importStockFromExcel,
  importCustomersFromExcel
};
