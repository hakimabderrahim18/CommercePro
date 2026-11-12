const { initDatabase, persistToDisk } = require('./sqlite');
const { generateProductBarcode } = require('../utils/barcodeGenerator');
const { generateInvoiceQRCode } = require('../utils/qrGenerator');

const sampleProducts = [
  // 1. Boucherie & Viandes
  { reference: 'ART-BOUCH-001', nom: 'Viande Bovine Locale (Bœuf Frais)', categorie: 'Boucherie & Viandes', prixAchat: 2100, prixVente: 2500, quantite: 45.5, seuilAlerte: 10, unite: 'kg', fournisseur: 'Abattoir Régional Alger' },
  { reference: 'ART-BOUCH-002', nom: 'Viande Ovine (Agneau Frais)', categorie: 'Boucherie & Viandes', prixAchat: 2600, prixVente: 3100, quantite: 32.8, seuilAlerte: 8, unite: 'kg', fournisseur: 'Élevage des Hauts Plateaux' },
  { reference: 'ART-BOUCH-003', nom: 'Escalope de Dinde / Poulet Frais', categorie: 'Boucherie & Viandes', prixAchat: 850, prixVente: 1050, quantite: 60.25, seuilAlerte: 15, unite: 'kg', fournisseur: 'Aviculture du Centre' },
  { reference: 'ART-BOUCH-004', nom: 'Viande Hachée Pur Bœuf Préparée', categorie: 'Boucherie & Viandes', prixAchat: 2200, prixVente: 2650, quantite: 18.5, seuilAlerte: 5, unite: 'kg', fournisseur: 'Abattoir Régional Alger' },
  { reference: 'ART-BOUCH-005', nom: 'Merguez Traditionnelle Maison', categorie: 'Boucherie & Viandes', prixAchat: 1400, prixVente: 1800, quantite: 25.0, seuilAlerte: 5, unite: 'kg', fournisseur: 'Abattoir Régional Alger' },

  // 2. Alimentation Générale
  { reference: 'ART-ALIM-001', nom: 'Huile de table Elio 5L', categorie: 'Alimentation', prixAchat: 600, prixVente: 650, quantite: 45, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Cevital SPA' },
  { reference: 'ART-ALIM-002', nom: 'Sucre Blanc En Poudre 1kg', categorie: 'Alimentation', prixAchat: 85, prixVente: 95, quantite: 120, seuilAlerte: 20, unite: 'kg', fournisseur: 'Cevital SPA' },
  { reference: 'ART-ALIM-003', nom: 'Café Moulu Familial 250g', categorie: 'Alimentation', prixAchat: 220, prixVente: 260, quantite: 60, seuilAlerte: 15, unite: 'pcs', fournisseur: 'Café Facto' },
  { reference: 'ART-ALIM-004', nom: 'Lait Pasteurisé Soummam 1L', categorie: 'Alimentation', prixAchat: 110, prixVente: 125, quantite: 8, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Laiterie Soummam' },
  { reference: 'ART-ALIM-005', nom: 'Couscous Moyen Le Renard 1kg', categorie: 'Alimentation', prixAchat: 130, prixVente: 160, quantite: 75, seuilAlerte: 15, unite: 'pcs', fournisseur: 'Groupe Amor Benamor' },
  { reference: 'ART-ALIM-006', nom: 'Pâtes Spaghetti Extra Benamor 500g', categorie: 'Alimentation', prixAchat: 55, prixVente: 70, quantite: 150, seuilAlerte: 25, unite: 'pcs', fournisseur: 'Groupe Amor Benamor' },
  { reference: 'ART-ALIM-007', nom: 'Double Concentré de Tomate 800g', categorie: 'Alimentation', prixAchat: 210, prixVente: 260, quantite: 50, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Conserverie Cab' },
  { reference: 'ART-ALIM-008', nom: 'Fromage Portion La Vache Qui Rit (x16)', categorie: 'Alimentation', prixAchat: 290, prixVente: 340, quantite: 3, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Bel Algérie' },

  // 3. Boissons & Jus
  { reference: 'ART-BOIS-001', nom: 'Eau Minérale Ifri 1.5L (Pack 6)', categorie: 'Boissons', prixAchat: 190, prixVente: 230, quantite: 80, seuilAlerte: 15, unite: 'pack', fournisseur: 'Ifri SARL' },
  { reference: 'ART-BOIS-002', nom: 'Jus Ramy Fraise-Banane 1L', categorie: 'Boissons', prixAchat: 135, prixVente: 160, quantite: 40, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Ramy Boissons' },
  { reference: 'ART-BOIS-003', nom: 'Soda Hamoud Boualem Blanc 1L', categorie: 'Boissons', prixAchat: 95, prixVente: 120, quantite: 4, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Hamoud Boualem' },
  { reference: 'ART-BOIS-004', nom: 'Boisson Gazeuse Selecto 1L', categorie: 'Boissons', prixAchat: 95, prixVente: 120, quantite: 50, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Hamoud Boualem' },
  { reference: 'ART-BOIS-005', nom: 'Eau Gazeuse Royale Lalla Khedidja 1L', categorie: 'Boissons', prixAchat: 65, prixVente: 85, quantite: 60, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Agrodiv SPA' },

  // 4. Hygiène & Entretien
  { reference: 'ART-HYG-001', nom: 'Lessive Poudre Omo 3kg', categorie: 'Hygiène & Entretien', prixAchat: 750, prixVente: 880, quantite: 25, seuilAlerte: 5, unite: 'pcs', fournisseur: 'Unilever Algérie' },
  { reference: 'ART-HYG-002', nom: 'Savon Liquide Mains 500ml', categorie: 'Hygiène & Entretien', prixAchat: 180, prixVente: 240, quantite: 50, seuilAlerte: 8, unite: 'pcs', fournisseur: 'Laboratoires Venus' },
  { reference: 'ART-HYG-003', nom: 'Liquide Vaisselle Isis Citron 1.5L', categorie: 'Hygiène & Entretien', prixAchat: 160, prixVente: 210, quantite: 35, seuilAlerte: 8, unite: 'pcs', fournisseur: 'Henkel Algérie' },
  { reference: 'ART-HYG-004', nom: 'Eau de Javel Bref 2L Désinfectant', categorie: 'Hygiène & Entretien', prixAchat: 110, prixVente: 150, quantite: 40, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Henkel Algérie' },

  // 5. Électronique & Informatique
  { reference: 'ART-ELEC-001', nom: 'Câble USB Type-C Charge Rapide', categorie: 'Électronique', prixAchat: 350, prixVente: 650, quantite: 35, seuilAlerte: 5, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'ART-ELEC-002', nom: 'Écouteurs Bluetooth TWS Pro', categorie: 'Électronique', prixAchat: 1800, prixVente: 2800, quantite: 15, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'ART-ELEC-003', nom: 'Chargeur Rapide 20W Original', categorie: 'Électronique', prixAchat: 900, prixVente: 1500, quantite: 20, seuilAlerte: 5, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'ART-ELEC-004', nom: 'Souris Optique Sans Fil 2.4GHz', categorie: 'Électronique', prixAchat: 650, prixVente: 1100, quantite: 18, seuilAlerte: 4, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'ART-ELEC-005', nom: 'Clavier USB Ergonomique AZERTY', categorie: 'Électronique', prixAchat: 850, prixVente: 1400, quantite: 12, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Tech Import Alger' },

  // 6. Bureautique & Papeterie
  { reference: 'ART-PAP-001', nom: 'Rame Papier A4 80g (500 feuilles)', categorie: 'Bureautique', prixAchat: 720, prixVente: 850, quantite: 50, seuilAlerte: 10, unite: 'pcs', fournisseur: 'Papeterie Centrale' },
  { reference: 'ART-PAP-002', nom: 'Rouleaux Papier Thermique 80x80 (Lot 10)', categorie: 'Bureautique', prixAchat: 1100, prixVente: 1450, quantite: 30, seuilAlerte: 5, unite: 'pack', fournisseur: 'Papeterie Centrale' },
  { reference: 'ART-PAP-003', nom: 'Stylos à Bille Bleu Schneider (Boîte 50)', categorie: 'Bureautique', prixAchat: 1250, prixVente: 1600, quantite: 15, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Papeterie Centrale' },

  // 7. Vêtements & Habillement (Textile)
  { reference: 'ART-VET-001', nom: 'T-Shirt Coton Col Rond Premium', categorie: 'Vêtements Homme', taille: 'L', pointure: '', couleur: 'Noir', genre: 'HOMME', prixAchat: 950, prixVente: 1600, quantite: 25, seuilAlerte: 5, unite: 'pcs', fournisseur: 'Textile Algérie Nord' },
  { reference: 'ART-VET-002', nom: 'Jean Denim Slim Fit Stretch', categorie: 'Vêtements Homme', taille: '32', pointure: '', couleur: 'Bleu marine', genre: 'HOMME', prixAchat: 2200, prixVente: 3400, quantite: 18, seuilAlerte: 4, unite: 'pcs', fournisseur: 'Textile Algérie Nord' },
  { reference: 'ART-VET-003', nom: 'Robe Longue Fleurie d’Été', categorie: 'Vêtements Femme', taille: 'M', pointure: '', couleur: 'Rouge', genre: 'FEMME', prixAchat: 2800, prixVente: 4500, quantite: 12, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Mode & Style Constantine' },
  { reference: 'ART-VET-004', nom: 'Veste Sportwear Zippée Capuche', categorie: 'Vêtements Homme', taille: 'XL', pointure: '', couleur: 'Gris', genre: 'HOMME', prixAchat: 3200, prixVente: 4900, quantite: 15, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Mode & Style Constantine' },

  // 8. Chaussures & Maroquinerie
  { reference: 'ART-CHAU-001', nom: 'Baskets Running Air Cushion', categorie: 'Chaussures Sport', taille: '', pointure: '42', couleur: 'Noir', genre: 'HOMME', prixAchat: 3800, prixVente: 5800, quantite: 14, seuilAlerte: 4, unite: 'pcs', fournisseur: 'Footwear Import Oran' },
  { reference: 'ART-CHAU-002', nom: 'Baskets Sneaker Blanche Urban', categorie: 'Chaussures Sport', taille: '', pointure: '39', couleur: 'Blanc', genre: 'FEMME', prixAchat: 3400, prixVente: 5200, quantite: 10, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Footwear Import Oran' },
  { reference: 'ART-CHAU-003', nom: 'Mocassins Cuir Véritable Ville', categorie: 'Chaussures Ville', taille: '', pointure: '43', couleur: 'Marron', genre: 'HOMME', prixAchat: 4500, prixVente: 6900, quantite: 8, seuilAlerte: 2, unite: 'pcs', fournisseur: 'Chaussures Cuir Blida' },
  { reference: 'ART-CHAU-004', nom: 'Sandales Confort Cuir Souple', categorie: 'Chaussures Ville', taille: '', pointure: '38', couleur: 'Beige', genre: 'FEMME', prixAchat: 1900, prixVente: 2900, quantite: 16, seuilAlerte: 4, unite: 'pcs', fournisseur: 'Chaussures Cuir Blida' },

  // 9. Pièces Détachées & Atelier Réparation (SAV)
  { reference: '036009', codeBarre: '036009', nom: 'LCD SAM A13/M13/F13 BLINDE', categorie: 'Pièces Téléphonie', prixAchat: 1400, prixVente: 2000, quantite: 25, seuilAlerte: 5, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'PCE-ECR-IP13', nom: 'Écran OLED / Vitre Tactile iPhone 13 Pro', categorie: 'Pièces Réparation', prixAchat: 6500, prixVente: 9500, quantite: 14, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'PCE-BAT-S22', nom: 'Batterie Originale Samsung Galaxy S22 (3700mAh)', categorie: 'Pièces Réparation', prixAchat: 2200, prixVente: 3800, quantite: 19, seuilAlerte: 4, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'PCE-CHG-TYPC', nom: 'Connecteur de Charge Universel Type-C Haute Qualité', categorie: 'Pièces Réparation', prixAchat: 350, prixVente: 900, quantite: 35, seuilAlerte: 5, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'PCE-SSD-512', nom: 'Disque SSD 512GB NVMe M.2 Kingston SNV2S', categorie: 'Pièces Réparation', prixAchat: 4200, prixVente: 6200, quantite: 12, seuilAlerte: 3, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'PCE-PAT-MX4', nom: 'Pâte Thermique Arctic MX-4 (Seringue 4g)', categorie: 'Pièces Réparation', prixAchat: 850, prixVente: 1600, quantite: 22, seuilAlerte: 5, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'PCE-FAN-ASUS', nom: 'Ventilateur CPU & GPU Asus TUF Gaming FX505', categorie: 'Pièces Réparation', prixAchat: 1800, prixVente: 2900, quantite: 8, seuilAlerte: 2, unite: 'pcs', fournisseur: 'Tech Import Alger' },
  { reference: 'PCE-ECR-156', nom: 'Écran 15.6" LED Slim 30 Pins Full HD 1080p', categorie: 'Pièces Réparation', prixAchat: 7500, prixVente: 11500, quantite: 6, seuilAlerte: 2, unite: 'pcs', fournisseur: 'Tech Import Alger' }
];

const sampleCustomers = [
  { nom: 'R MOHAMED YESREF', telephone: '0550245000', email: 'mohamed.yesref@gmail.com', adresse: 'Tiaret Centre', soldeDette: 0, plafondCredit: 50000, notes: 'Client fidèle comptoir' },
  { nom: 'Établissement Benali & Frères', telephone: '0550 12 34 56', email: 'contact@benali.dz', adresse: 'Rue Didouche Mourad, Alger Centre', soldeDette: 35000, plafondCredit: 100000, notes: 'Client grossiste régulier' },
  { nom: 'Supérette El Bahia', telephone: '0770 98 76 54', email: 'elbahia.oran@gmail.com', adresse: 'Boulevard Front de Mer, Oran', soldeDette: 18500, plafondCredit: 50000, notes: 'Règlement bi-mensuel' },
  { nom: 'Khelil Mohamed (Alimentation)', telephone: '0661 45 67 89', email: 'khelil.commerce@yahoo.fr', adresse: 'Cité Belle Vue, Constantine', soldeDette: 0, plafondCredit: 30000, notes: 'Paiement toujours comptant' },
  { nom: 'Sarl Atlas Distribution', telephone: '0560 22 44 66', email: 'atlas.distrib@gmail.com', adresse: 'Zone Industrielle, Sétif', soldeDette: 52000, plafondCredit: 150000, notes: 'Gros volumes de commande' },
  { nom: 'Hamidi Yacine', telephone: '0799 11 22 33', email: 'yacine.h@hotmail.com', adresse: 'Bordj Bou Arreridj', soldeDette: 4200, plafondCredit: 10000, notes: 'Détaillant local' },
  { nom: 'Restaurant Le Gourmand', telephone: '0555 33 22 11', email: 'legourmand.alger@gmail.com', adresse: 'Hydra, Alger', soldeDette: 14800, plafondCredit: 40000, notes: 'Commandes hebdomadaires viandes & huiles' },
  { nom: 'Hôtel Les Pins Bleus', telephone: '0662 77 88 99', email: 'comptabilite@pinsbleus.dz', adresse: 'Route de la Corniche, Bejaia', soldeDette: 28000, plafondCredit: 80000, notes: 'Facturation mensuelle consolidée' },
  { nom: 'Boucherie Moderne Chéraga', telephone: '0540 88 12 34', email: 'moderne.cheraga@gmail.com', adresse: 'Centre-Ville, Chéraga', soldeDette: 9500, plafondCredit: 35000, notes: 'Client semi-gros' }
];

async function seedDatabase() {
  console.log('===============================================================');
  console.log('   DÉMARRAGE DU SEEDING GLOBAL COMMERCEPOST (TOUT INCLUS)      ');
  console.log('===============================================================\n');

  const db = await initDatabase();

  // 1. Nettoyage complet des tables
  console.log('[1/9] Nettoyage complet des tables existantes...');
  db.exec(`
    DELETE FROM reparation_pieces;
    DELETE FROM reparations;
    DELETE FROM audit_logs;
    DELETE FROM users;
    DELETE FROM cash_registers;
    DELETE FROM product_losses;
    DELETE FROM cash_transactions;
    DELETE FROM sale_return_items;
    DELETE FROM sale_returns;
    DELETE FROM purchase_return_items;
    DELETE FROM purchase_returns;
    DELETE FROM invoice_items;
    DELETE FROM invoices;
    DELETE FROM purchase_items;
    DELETE FROM purchase_invoices;
    DELETE FROM stock_movements;
    DELETE FROM account_movements;
    DELETE FROM products;
    DELETE FROM customers;
  `);

  // Dates échelonnées sur le dernier mois pour enrichir les filtres de dates
  const now = new Date();
  const dToday = now.toISOString();
  const dYesterday = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
  const d3DaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const d5DaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
  const d10DaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  const d15DaysAgo = new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString();
  const d25DaysAgo = new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString();

  // 2. Insertion des Produits avec Barcode & QR Code
  console.log('[2/9] Création de 35 produits variés avec vêtements, chaussures et codes-barres 1D...');
  const prodStmt = db.prepare(`
    INSERT INTO products (reference, codeBarre, nom, categorie, taille, pointure, couleur, genre, prixAchat, prixVente, quantite, unite, seuilAlerte, fournisseur, barcodeData, barcodeImage, qrCodeData, qrCodeImage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const movStmt = db.prepare(`
    INSERT INTO stock_movements (product_id, type, quantite, quantiteAvant, quantiteApres, prixAchatUnitaire, fournisseur, referenceDocument, motif, dateMouvement)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const createdProducts = [];
  for (const p of sampleProducts) {
    const { barcodeData, barcodeImage } = await generateProductBarcode(p);
    const info = prodStmt.run(
      p.reference,
      p.reference,
      p.nom,
      p.categorie,
      p.taille || null,
      p.pointure || null,
      p.couleur || null,
      p.genre || 'UNISEXE',
      p.prixAchat,
      p.prixVente,
      p.quantite,
      p.unite,
      p.seuilAlerte,
      p.fournisseur,
      barcodeData,
      barcodeImage,
      barcodeData,
      barcodeImage
    );

    const prodId = info.lastInsertRowid;
    createdProducts.push({ id: prodId, ...p });

    movStmt.run(
      prodId,
      'ACHAT_FOURNISSEUR',
      p.quantite,
      0,
      p.quantite,
      p.prixAchat,
      p.fournisseur,
      'STOCK-INITIAL',
      'Inventaire initial du magasin',
      d25DaysAgo
    );
  }

  // 3. Insertion des Clients
  console.log('[3/8] Création des fiches clients avec soldes débiteurs en DA...');
  const custStmt = db.prepare(`
    INSERT INTO customers (nom, telephone, email, adresse, plafondCredit, soldeDette, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const accMovStmt = db.prepare(`
    INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif, dateMouvement)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const createdCustomers = [];
  for (const c of sampleCustomers) {
    const info = custStmt.run(c.nom, c.telephone, c.email, c.adresse, c.plafondCredit, c.soldeDette, c.notes);
    const custId = info.lastInsertRowid;
    createdCustomers.push({ id: custId, ...c });

    if (c.soldeDette > 0) {
      accMovStmt.run(
        custId,
        'DETTE_VENTE',
        c.soldeDette,
        0,
        c.soldeDette,
        'SOLDE-INITIAL',
        'Solde de créance initial reporté',
        d25DaysAgo
      );
    }
  }

  // 4. Factures d'Achat Fournisseurs (6 factures réparties dans le mois)
  console.log('[4/8] Création des factures d’achat fournisseurs et réceptions...');
  const samplePurchases = [
    {
      num: 'FA-202608-0001',
      fournisseur: 'Cevital SPA',
      contact: '034 21 00 00',
      date: d25DaysAgo,
      items: [
        { prod: createdProducts[5], qty: 50, pu: 600 },
        { prod: createdProducts[6], qty: 100, pu: 85 }
      ]
    },
    {
      num: 'FA-202608-0002',
      fournisseur: 'Abattoir Régional Alger',
      contact: '023 45 67 89',
      date: d15DaysAgo,
      items: [
        { prod: createdProducts[0], qty: 30, pu: 2100 },
        { prod: createdProducts[1], qty: 20, pu: 2600 }
      ]
    },
    {
      num: 'FA-202608-0003',
      fournisseur: 'Tech Import Alger',
      contact: '0550 99 88 77',
      date: d10DaysAgo,
      items: [
        { prod: createdProducts[21], qty: 25, pu: 350 },
        { prod: createdProducts[22], qty: 15, pu: 1800 },
        { prod: createdProducts[24], qty: 10, pu: 650 }
      ]
    },
    {
      num: 'FA-202608-0004',
      fournisseur: 'Ifri SARL',
      contact: '034 35 11 22',
      date: d5DaysAgo,
      items: [
        { prod: createdProducts[13], qty: 60, pu: 190 },
        { prod: createdProducts[14], qty: 40, pu: 135 }
      ]
    },
    {
      num: 'FA-202608-0005',
      fournisseur: 'Papeterie Centrale',
      contact: '021 66 77 88',
      date: d3DaysAgo,
      items: [
        { prod: createdProducts[26], qty: 40, pu: 720 },
        { prod: createdProducts[27], qty: 20, pu: 1100 }
      ]
    },
    {
      num: 'FA-202608-0006',
      fournisseur: 'Laboratoires Venus',
      contact: '024 81 23 45',
      date: dYesterday,
      items: [
        { prod: createdProducts[18], qty: 30, pu: 180 },
        { prod: createdProducts[19], qty: 20, pu: 160 }
      ]
    }
  ];

  const createdPurchases = [];
  for (const p of samplePurchases) {
    let totalHT = 0;
    for (const it of p.items) {
      totalHT += it.qty * it.pu;
    }

    const pInfo = db.prepare(`
      INSERT INTO purchase_invoices (numeroFactureAchat, fournisseur, contactFournisseur, totalHT, tauxTva, montantTva, totalTTC, montantPaye, modePaiement, dateFactureAchat, created_at)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'VIREMENT', ?, ?)
    `).run(p.num, p.fournisseur, p.contact, totalHT, totalHT, totalHT, p.date, p.date);

    const purchaseId = pInfo.lastInsertRowid;
    createdPurchases.push({ id: purchaseId, ...p, totalTTC: totalHT });

    for (const it of p.items) {
      const totLigne = it.qty * it.pu;
      db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, reference, nom, quantite, prixAchatUnitaire, unite, totalLigne)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(purchaseId, it.prod.id, it.prod.reference, it.prod.nom, it.qty, it.pu, it.prod.unite, totLigne);

      movStmt.run(
        it.prod.id,
        'ACHAT_FOURNISSEUR',
        it.qty,
        it.prod.quantite,
        it.prod.quantite + it.qty,
        it.pu,
        p.fournisseur,
        p.num,
        `Réception achat ${p.num}`,
        p.date
      );
    }
  }

  // 5. Factures & Tickets de Vente (8 ventes variées)
  console.log('[5/8] Création des factures et tickets de caisse avec QR Codes...');
  const sampleSales = [
    {
      num: 'FAC-202608-0001',
      type: 'FACTURE',
      client: createdCustomers[0], // Benali
      date: d25DaysAgo,
      paye: 8500,
      mode: 'ESPECES',
      items: [
        { prod: createdProducts[0], qty: 2, pu: 2500 },
        { prod: createdProducts[5], qty: 4, pu: 650 },
        { prod: createdProducts[13], qty: 4, pu: 230 }
      ]
    },
    {
      num: 'TCK-202608-0001',
      type: 'TICKET',
      client: null,
      clientLibre: 'Client Comptoir',
      date: d15DaysAgo,
      paye: 2800,
      mode: 'ESPECES',
      items: [
        { prod: createdProducts[22], qty: 1, pu: 2800 }
      ]
    },
    {
      num: 'FAC-202608-0002',
      type: 'FACTURE',
      client: createdCustomers[1], // Supérette El Bahia
      date: d10DaysAgo,
      paye: 10000,
      mode: 'VIREMENT',
      items: [
        { prod: createdProducts[1], qty: 3, pu: 3100 },
        { prod: createdProducts[17], qty: 5, pu: 880 }
      ]
    },
    {
      num: 'FAC-202608-0003',
      type: 'FACTURE',
      client: createdCustomers[3], // Atlas
      date: d5DaysAgo,
      paye: 0,
      mode: 'A_CREDIT',
      items: [
        { prod: createdProducts[23], qty: 4, pu: 1500 },
        { prod: createdProducts[26], qty: 10, pu: 850 }
      ]
    },
    {
      num: 'TCK-202608-0002',
      type: 'TICKET',
      client: null,
      clientLibre: 'Client Comptoir',
      date: d3DaysAgo,
      paye: 1450,
      mode: 'ESPECES',
      items: [
        { prod: createdProducts[27], qty: 1, pu: 1450 }
      ]
    },
    {
      num: 'FAC-202608-0004',
      type: 'FACTURE',
      client: createdCustomers[5], // Le Gourmand
      date: dYesterday,
      paye: 15000,
      mode: 'CHEQUE',
      items: [
        { prod: createdProducts[0], qty: 5, pu: 2500 },
        { prod: createdProducts[5], qty: 5, pu: 650 }
      ]
    },
    {
      num: 'TCK-202608-0003',
      type: 'TICKET',
      client: null,
      clientLibre: 'Client Comptoir',
      date: dToday,
      paye: 1750,
      mode: 'CARTE_BANCAIRE',
      items: [
        { prod: createdProducts[2], qty: 1, pu: 1050 },
        { prod: createdProducts[14], qty: 2, pu: 160 },
        { prod: createdProducts[15], qty: 3, pu: 120 }
      ]
    },
    {
      num: 'FAC-202608-0005',
      type: 'FACTURE',
      client: createdCustomers[6], // Pins Bleus
      date: dToday,
      paye: 0,
      mode: 'A_CREDIT',
      items: [
        { prod: createdProducts[17], qty: 10, pu: 880 },
        { prod: createdProducts[19], qty: 15, pu: 210 }
      ]
    }
  ];

  const createdSales = [];
  for (const s of sampleSales) {
    let totalHT = 0;
    const prepItems = [];
    for (const it of s.items) {
      const totLigne = it.qty * it.pu;
      totalHT += totLigne;
      prepItems.push({
        productId: it.prod.id,
        reference: it.prod.reference,
        nom: it.prod.nom,
        quantite: it.qty,
        prixUnitaire: it.pu,
        unite: it.prod.unite,
        totalLigne: totLigne
      });
    }

    const totalTTC = totalHT;
    const montantReste = Math.max(0, totalTTC - s.paye);
    const statut = montantReste === 0 ? 'PAYE' : s.paye > 0 ? 'PARTIEL' : 'NON_PAYE';

    const { qrData, qrImage } = await generateInvoiceQRCode({
      numeroFacture: s.num,
      totalTTC,
      dateFacture: s.date,
      items: prepItems
    });

    const invInfo = db.prepare(`
      INSERT INTO invoices (numeroFacture, typeDocument, client_id, clientLibre, totalHT, tauxTva, montantTva, remise, totalTTC, montantPaye, montantReste, modePaiement, statutPaiement, qrCodeData, qrCodeImage, dateFacture, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      s.num,
      s.type,
      s.client ? s.client.id : null,
      s.client ? null : s.clientLibre,
      totalHT,
      totalTTC,
      s.paye,
      montantReste,
      s.mode,
      statut,
      qrData,
      qrImage,
      s.date,
      s.date
    );

    const invId = invInfo.lastInsertRowid;
    createdSales.push({ id: invId, ...s, totalTTC, items: prepItems });

    for (const it of prepItems) {
      db.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, reference, nom, quantite, prixUnitaire, unite, totalLigne)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invId, it.productId, it.reference, it.nom, it.quantite, it.prixUnitaire, it.unite, it.totalLigne);

      movStmt.run(
        it.productId,
        'VENTE',
        -it.quantite,
        it.quantite + 10,
        10,
        0,
        '',
        s.num,
        `Vente ${s.num}`,
        s.date
      );
    }
  }

  // 6. Avoirs Ventes & Bons de Livraison (BL) (4 Avoirs)
  console.log('[6/8] Création des Avoirs Ventes & Bons de Livraison (BL)...');
  const sampleSaleReturns = [
    {
      num: 'AVBL-202608-0001',
      type: 'AVOIR_BL',
      invoiceId: createdSales[0].id,
      clientId: createdCustomers[0].id,
      clientLibre: null,
      date: d15DaysAgo,
      motif: 'Produit défectueux / Non conforme au Bon de Livraison',
      mode: 'DEDUCTION_DETTE',
      items: [
        { prod: createdProducts[5], qty: 1, pu: 650 }
      ]
    },
    {
      num: 'AVR-202608-0001',
      type: 'AVOIR_VENTE',
      invoiceId: createdSales[1].id,
      clientId: null,
      clientLibre: 'Client Comptoir',
      date: d10DaysAgo,
      motif: 'Erreur modèle / Restitution immédiate',
      mode: 'ESPECES',
      items: [
        { prod: createdProducts[22], qty: 1, pu: 2800 }
      ]
    },
    {
      num: 'AVBL-202608-0002',
      type: 'AVOIR_BL',
      invoiceId: createdSales[2].id,
      clientId: createdCustomers[1].id,
      clientLibre: null,
      date: d3DaysAgo,
      motif: 'Carton lessive abîmé pendant transport',
      mode: 'DEDUCTION_DETTE',
      items: [
        { prod: createdProducts[17], qty: 2, pu: 880 }
      ]
    },
    {
      num: 'AVR-202608-0002',
      type: 'AVOIR_VENTE',
      invoiceId: createdSales[4].id,
      clientId: null,
      clientLibre: 'Client Comptoir',
      date: dToday,
      motif: 'Mauvaise dimension rouleau caisse',
      mode: 'ESPECES',
      items: [
        { prod: createdProducts[27], qty: 1, pu: 1450 }
      ]
    }
  ];

  for (const sr of sampleSaleReturns) {
    let totRemb = 0;
    for (const it of sr.items) {
      totRemb += it.qty * it.pu;
    }

    const retInfo = db.prepare(`
      INSERT INTO sale_returns (numeroRetour, typeDocument, invoice_id, client_id, clientLibre, montantTotalRembourse, modeRemboursement, motif, dateRetour, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sr.num, sr.type, sr.invoiceId, sr.clientId, sr.clientLibre, totRemb, sr.mode, sr.motif, sr.date, sr.date);

    const retId = retInfo.lastInsertRowid;

    for (const it of sr.items) {
      db.prepare(`
        INSERT INTO sale_return_items (return_id, product_id, reference, nom, quantiteRetournee, prixUnitaire, unite, totalLigne)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(retId, it.prod.id, it.prod.reference, it.prod.nom, it.qty, it.pu, it.prod.unite, it.qty * it.pu);

      movStmt.run(
        it.prod.id,
        'RETOUR_VENTE',
        it.qty,
        it.prod.quantite,
        it.prod.quantite + it.qty,
        0,
        '',
        sr.num,
        `Avoir vente ${sr.num} : ${sr.motif}`,
        sr.date
      );
    }
  }

  // 7. Avoirs sur Achats Fournisseurs (4 Avoirs Fournisseurs)
  console.log('[7/8] Création des Avoirs sur Achats Fournisseurs...');
  const samplePurchaseReturns = [
    {
      num: 'AVF-202608-0001',
      purchaseId: createdPurchases[0].id,
      fournisseur: 'Cevital SPA',
      contact: '034 21 00 00',
      date: d25DaysAgo,
      motif: 'Emballage percé lors de la livraison usine',
      mode: 'AVOIR_FOURNISSEUR',
      items: [
        { prod: createdProducts[5], qty: 2, pu: 600 }
      ]
    },
    {
      num: 'AVF-202608-0002',
      purchaseId: createdPurchases[2].id,
      fournisseur: 'Tech Import Alger',
      contact: '0550 99 88 77',
      date: d10DaysAgo,
      motif: 'Câbles non-conformes à la fiche technique',
      mode: 'ESPECES',
      items: [
        { prod: createdProducts[21], qty: 5, pu: 350 }
      ]
    },
    {
      num: 'AVF-202608-0003',
      purchaseId: createdPurchases[3].id,
      fournisseur: 'Ifri SARL',
      contact: '034 35 11 22',
      date: d3DaysAgo,
      motif: 'Bouteilles jus écrasées dans la palette',
      mode: 'AVOIR_FOURNISSEUR',
      items: [
        { prod: createdProducts[14], qty: 6, pu: 135 }
      ]
    },
    {
      num: 'AVF-202608-0004',
      purchaseId: createdPurchases[4].id,
      fournisseur: 'Papeterie Centrale',
      contact: '021 66 77 88',
      date: dToday,
      motif: 'Rames papier 70g reçues au lieu de 80g',
      mode: 'ESPECES',
      items: [
        { prod: createdProducts[26], qty: 4, pu: 720 }
      ]
    }
  ];

  for (const pr of samplePurchaseReturns) {
    let totAvoir = 0;
    for (const it of pr.items) {
      totAvoir += it.qty * it.pu;
    }

    const pRetInfo = db.prepare(`
      INSERT INTO purchase_returns (numeroAvoirAchat, purchase_id, fournisseur, contactFournisseur, montantTotal, modeRemboursement, motif, dateAvoirAchat, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(pr.num, pr.purchaseId, pr.fournisseur, pr.contact, totAvoir, pr.mode, pr.motif, pr.date, pr.date);

    const pRetId = pRetInfo.lastInsertRowid;

    for (const it of pr.items) {
      db.prepare(`
        INSERT INTO purchase_return_items (purchase_return_id, product_id, reference, nom, quantiteRetournee, prixAchatUnitaire, unite, totalLigne)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(pRetId, it.prod.id, it.prod.reference, it.prod.nom, it.qty, it.pu, it.prod.unite, it.qty * it.pu);

      movStmt.run(
        it.prod.id,
        'RETOUR_ACHAT_FOURNISSEUR',
        -it.qty,
        it.prod.quantite,
        Math.max(0, it.prod.quantite - it.qty),
        it.pu,
        pr.fournisseur,
        pr.num,
        `Retour fournisseur ${pr.num} : ${pr.motif}`,
        pr.date
      );
    }
  }

  // 8. Insertion des Transactions de Trésorerie (Encaissements & Décaissements)
  console.log('[8/9] Enregistrement du journal de trésorerie (Encaissements & Décaissements)...');
  db.prepare('DELETE FROM cash_transactions').run();

  const cashTxStmt = db.prepare(`
    INSERT INTO cash_transactions (
      numeroTransaction, type, categorie, montant, modePaiement,
      client_id, fournisseur, tiers, referenceDocument, motif, dateTransaction, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleCashTransactions = [
    {
      num: 'ENC-202608-0001',
      type: 'ENCAISSEMENT',
      cat: 'REGLEMENT_CLIENT',
      montant: 25000,
      mode: 'ESPECES',
      clientId: createdCustomers[0]?.id || null,
      tiers: createdCustomers[0]?.nom || 'EURL El Baraka Agro',
      ref: 'REC-0012',
      motif: 'Versement acompte sur créance client',
      date: d10DaysAgo
    },
    {
      num: 'ENC-202608-0002',
      type: 'ENCAISSEMENT',
      cat: 'VENTE_DIRECTE',
      montant: 18500,
      mode: 'CARTE',
      clientId: null,
      tiers: 'Client Comptoir',
      ref: 'POS-CIB-882',
      motif: 'Encaissement carte bancaire CIB vente directe',
      date: d5DaysAgo
    },
    {
      num: 'ENC-202608-0003',
      type: 'ENCAISSEMENT',
      cat: 'REGLEMENT_CLIENT',
      montant: 40000,
      mode: 'CHEQUE',
      clientId: createdCustomers[1]?.id || null,
      tiers: createdCustomers[1]?.nom || 'SARL Maghreb Distribution',
      ref: 'CHQ-BNA-9921',
      motif: 'Règlement facture par chèque BNA certifié',
      date: dYesterday
    },
    {
      num: 'DEC-202608-0001',
      type: 'DECAISSEMENT',
      cat: 'DEPENSE_LOYER',
      montant: 60000,
      mode: 'VIREMENT',
      clientId: null,
      tiers: 'Société Immobilière du Centre',
      ref: 'VIR-BEA-7410',
      motif: 'Loyer commercial du magasin pour le mois d’Août 2026',
      date: d25DaysAgo
    },
    {
      num: 'DEC-202608-0002',
      type: 'DECAISSEMENT',
      cat: 'ELECTRICITE_EAU',
      montant: 12400,
      mode: 'ESPECES',
      clientId: null,
      tiers: 'Sonelgaz Algérie',
      ref: 'FAC-ELEC-4412',
      motif: 'Quittance d’électricité et gaz trimestre 2',
      date: d10DaysAgo
    },
    {
      num: 'DEC-202608-0003',
      type: 'DECAISSEMENT',
      cat: 'REGLEMENT_FOURNISSEUR',
      montant: 85000,
      mode: 'CHEQUE',
      clientId: null,
      tiers: 'Grossiste Laiterie Soummam',
      fournisseur: 'Grossiste Laiterie Soummam',
      ref: 'CHQ-CPA-1102',
      motif: 'Règlement facture approvisionnement produits laitiers',
      date: d5DaysAgo
    },
    {
      num: 'DEC-202608-0004',
      type: 'DECAISSEMENT',
      cat: 'TRANSPORT',
      montant: 6500,
      mode: 'ESPECES',
      clientId: null,
      tiers: 'Transporteur Express Centre',
      ref: 'BL-TR-902',
      motif: 'Frais de transport et déchargement de marchandises',
      date: dYesterday
    },
    {
      num: 'DEC-202608-0005',
      type: 'DECAISSEMENT',
      cat: 'SALAIRE',
      montant: 45000,
      mode: 'ESPECES',
      clientId: null,
      tiers: 'Karim Brahimi (Vendeur)',
      ref: 'AVANCE-PAIE-08',
      motif: 'Avance sur salaire quinzaine du mois',
      date: dToday
    }
  ];

  for (const tx of sampleCashTransactions) {
    cashTxStmt.run(
      tx.num,
      tx.type,
      tx.cat,
      tx.montant,
      tx.mode,
      tx.clientId,
      tx.fournisseur || '',
      tx.tiers,
      tx.ref,
      tx.motif,
      tx.date,
      tx.date
    );
  }

  // 8.5. Insertion des Pertes & Casse (Déclarations de Dépréciation de Stock)
  console.log('[8.5/9] Création des déclarations de pertes & casse avec décrément de stock...');
  const lossStmt = db.prepare(`
    INSERT INTO product_losses (
      numeroDeclaration, product_id, reference, nom, categorie, taille, pointure, couleur, genre,
      quantite, prixAchatUnitaire, prixVenteUnitaire, valeurPerte, typePerte, motif, declarePar, dateDeclaration, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sampleLosses = [
    {
      num: 'PRT-202609-0001',
      prodRef: 'ART-ALIM-001', // Huile Elio
      type: 'CASSE',
      qty: 2,
      motif: 'Chute d’un carton lors de la mise en rayon, bouteilles fissurées',
      declarePar: 'Mourad (Magasinier)',
      date: d3DaysAgo
    },
    {
      num: 'PRT-202609-0002',
      prodRef: 'ART-VET-001', // T-Shirt Coton
      type: 'DEFAUT_FABRICATION',
      qty: 2,
      motif: 'Couture déchirée et tâche d’encre d’usine non vendable',
      declarePar: 'Amine (Responsable Vente)',
      date: d5DaysAgo
    },
    {
      num: 'PRT-202609-0003',
      prodRef: 'ART-CHAU-001', // Baskets Running
      type: 'CASSE',
      qty: 1,
      motif: 'Semelle décollée et boîte écrasée lors du transport',
      declarePar: 'Mourad (Magasinier)',
      date: d10DaysAgo
    },
    {
      num: 'PRT-202609-0004',
      prodRef: 'ART-ALIM-008', // Fromage Portion
      type: 'PERIME_AVARIE',
      qty: 3,
      motif: 'Date de péremption dépassée, retiré du rayon frais',
      declarePar: 'Karim (Gérant)',
      date: d15DaysAgo
    },
    {
      num: 'PRT-202609-0005',
      prodRef: 'ART-ELEC-001', // Câble USB
      type: 'PERTE_VOL',
      qty: 2,
      motif: 'Manquant constaté lors de l’inventaire tournant de rayon',
      declarePar: 'Karim (Gérant)',
      date: dYesterday
    }
  ];

  for (const l of sampleLosses) {
    const prod = createdProducts.find((p) => p.reference === l.prodRef);
    if (prod) {
      const prixAchat = prod.prixAchat || 0;
      const prixVente = prod.prixVente || 0;
      const totalLoss = l.qty * prixAchat;

      lossStmt.run(
        l.num,
        prod.id,
        prod.reference,
        prod.nom,
        prod.categorie,
        prod.taille || null,
        prod.pointure || null,
        prod.couleur || null,
        prod.genre || 'UNISEXE',
        l.qty,
        prixAchat,
        prixVente,
        totalLoss,
        l.type,
        l.motif,
        l.declarePar,
        l.date,
        l.date
      );

      // Decrement product stock
      const currentProd = db.prepare('SELECT quantite FROM products WHERE id = ?').get(prod.id);
      const qteAvant = currentProd ? currentProd.quantite : prod.quantite;
      const qteApres = Math.max(0, qteAvant - l.qty);
      db.prepare('UPDATE products SET quantite = ? WHERE id = ?').run(qteApres, prod.id);

      // Log stock movement
      movStmt.run(
        prod.id,
        'PERTE_CASSE',
        -l.qty,
        qteAvant,
        qteApres,
        prixAchat,
        '',
        l.num,
        `Déclaration de perte: ${l.motif}`,
        l.date
      );
    }
  }

  // 9. Insertion des Caisses Magasin & Atelier
  console.log('[9/13] Création des caisses (Magasin, Comptoir, Atelier, Coffre)...');
  const caisseStmt = db.prepare(`
    INSERT INTO cash_registers (nom, code, soldeInitial, actif)
    VALUES (?, ?, ?, 1)
  `);
  caisseStmt.run('Caisse 1 (Magasin)', 'CS-01', 50000);
  caisseStmt.run('Caisse 2 (Comptoir)', 'CS-02', 30000);
  caisseStmt.run('Caisse Atelier', 'CS-ATELIER', 20000);
  caisseStmt.run('Coffre-Fort Principal', 'COFFRE-01', 500000);

  // 10. Insertion des Comptes Utilisateurs (Admin, Réparateur, Vendeur)
  console.log('[10/13] Création des comptes d’accès (Admin, Réparateur SAV, Vendeur)...');
  const userStmt = db.prepare(`
    INSERT INTO users (username, password, nom, role, caisse, actif)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const uAdmin = userStmt.run('admin', 'admin123', 'Administrateur Principal', 'ADMIN', 'Caisse 1 (Magasin)');
  const uRep = userStmt.run('reparateur', '1234', 'Hakim (Chef Atelier)', 'REPARATEUR', 'Caisse Atelier');
  const uVen = userStmt.run('vendeur', '1234', 'Samir (Vendeur Caisse)', 'VENDEUR', 'Caisse 1 (Magasin)');

  const adminId = uAdmin.lastInsertRowid;
  const reparateurId = uRep.lastInsertRowid;
  const vendeurId = uVen.lastInsertRowid;

  // 11. Insertion des Dossiers SAV (3 Sections Réparations)
  console.log('[11/13] Création des dossiers SAV (Réception, Atelier avec déstockage, Livraison & Retours)...');
  const repStmt = db.prepare(`
    INSERT INTO reparations (
      numeroReparation, client_id, clientNom, clientTelephone, appareilType, marque, modele,
      numeroSerie, motDePasseAppareil, accessoires, panneDeclaree, constatTechnique, statut,
      reparateur_id, reparateurNom, estimationDevis, coutMainOeuvre, coutPieces, totalTTC,
      acomptePaye, montantPaye, montantReste, modePaiement, caisse,
      dateReception, dateDiagnostic, dateReparation, dateLivraison, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const repPieceStmt = db.prepare(`
    INSERT INTO reparation_pieces (
      reparation_id, product_id, reference, nom, quantite, prixUnitaire, prixAchatUnitaire, totalLigne, retireDuStock
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const prodBatS22 = createdProducts.find(p => p.reference === 'PCE-BAT-S22');
  const prodChgTypeC = createdProducts.find(p => p.reference === 'PCE-CHG-TYPC');
  const prodPatMx4 = createdProducts.find(p => p.reference === 'PCE-PAT-MX4');
  const prodFanAsus = createdProducts.find(p => p.reference === 'PCE-FAN-ASUS');

  // Dossier 1 (Section 1: Réception récente)
  repStmt.run(
    'REP-202609-0001',
    createdCustomers[4]?.id || null,
    createdCustomers[4]?.nom || 'Hamidi Yacine',
    createdCustomers[4]?.telephone || '0799 11 22 33',
    'Smartphone',
    'Apple',
    'iPhone 13 Pro (128GB)',
    'F2LJ8981PQ',
    '1470',
    'Sans chargeur, coque silicone transparente',
    'Écran cassé et tactile inopérant suite à une chute sur le bitume',
    '',
    'RECEPTIONNE',
    null,
    '',
    12000,
    0,
    0,
    12000,
    3000,
    3000,
    9000,
    'ESPECES',
    'Caisse Atelier',
    dYesterday,
    null,
    null,
    null,
    'Client pressé, souhaite récupérer son appareil avant vendredi.'
  );

  // Dossier 2 (Section 1: Réception & Diagnostic)
  repStmt.run(
    'REP-202609-0002',
    createdCustomers[3]?.id || null,
    createdCustomers[3]?.nom || 'Sarl Atlas Distribution',
    createdCustomers[3]?.telephone || '0560 22 44 66',
    'PC Portable',
    'Dell',
    'Latitude 5420 Core i7',
    'DELL-LAT-8841',
    'atlas2026',
    'Chargeur original 65W Type-C',
    'Ne s’allume plus suite à une coupure électrique, voyant LED clignote blanc/ambre',
    'Problème de régulateur de charge carte mère ou batterie en court-circuit',
    'DIAGNOSTIC',
    reparateurId,
    'Hakim (Chef Atelier)',
    8000,
    0,
    0,
    8000,
    0,
    0,
    8000,
    'ESPECES',
    'Caisse Atelier',
    d3DaysAgo,
    dYesterday,
    null,
    null,
    'Diagnostic en cours sur table de test.'
  );

  // Dossier 3 (Section 2: En Atelier avec pièces déstockées)
  const rep3Info = repStmt.run(
    'REP-202609-0003',
    createdCustomers[1]?.id || null,
    createdCustomers[1]?.nom || 'Supérette El Bahia',
    createdCustomers[1]?.telephone || '0770 98 76 54',
    'Smartphone',
    'Samsung',
    'Galaxy S22 5G (Phantom Black)',
    'SM-S901B-9921',
    '2580',
    'Appareil nu',
    'Batterie gonflée, pousse sur la vitre arrière et surchauffe au repos',
    'Batterie déformée à remplacer immédiatement, connecteurs intacts',
    'EN_REPARATION',
    reparateurId,
    'Hakim (Chef Atelier)',
    5500,
    1500,
    3800,
    5300,
    2000,
    2000,
    3300,
    'ESPECES',
    'Caisse Atelier',
    d5DaysAgo,
    d3DaysAgo,
    dYesterday,
    null,
    'Batterie d’origine installée, collage en cours sous presse.'
  );
  const rep3Id = rep3Info.lastInsertRowid;
  if (prodBatS22) {
    repPieceStmt.run(rep3Id, prodBatS22.id, prodBatS22.reference, prodBatS22.nom, 1, 3800, prodBatS22.prixAchat || 2200, 3800);
    const curProd = db.prepare('SELECT quantite FROM products WHERE id = ?').get(prodBatS22.id);
    const qteAvant = curProd ? curProd.quantite : prodBatS22.quantite;
    const qteApres = Math.max(0, qteAvant - 1);
    db.prepare('UPDATE products SET quantite = ? WHERE id = ?').run(qteApres, prodBatS22.id);
    movStmt.run(
      prodBatS22.id,
      'SORTIE_REPARATION',
      -1,
      qteAvant,
      qteApres,
      prodBatS22.prixAchat,
      '',
      'REP-202609-0003',
      'Consommation pièce pour réparation REP-202609-0003',
      dYesterday
    );
  }

  // Dossier 4 (Section 2: Objets en Atelier - Réparé et prêt pour livraison)
  const rep4Info = repStmt.run(
    'REP-202609-0004',
    createdCustomers[2]?.id || null,
    createdCustomers[2]?.nom || 'Khelil Mohamed (Alimentation)',
    createdCustomers[2]?.telephone || '0661 45 67 89',
    'PC Portable',
    'Asus',
    'TUF Gaming FX505DT',
    'ASUS-TUF-0092',
    'khelil1980',
    'Chargeur Asus 150W d’origine + Sacoche',
    'Surchauffe extrême en jeu (95°C), ventilateur droit bruyant avec claquements',
    'Ventilateur GPU cassé + pâte thermique totalement séchée',
    'REPARE',
    reparateurId,
    'Hakim (Chef Atelier)',
    6500,
    2000,
    4500,
    6500,
    3000,
    3000,
    3500,
    'ESPECES',
    'Caisse Atelier',
    d10DaysAgo,
    d5DaysAgo,
    dYesterday,
    null,
    'Tests de charge FurMark validés : Température stable à 68°C.'
  );
  const rep4Id = rep4Info.lastInsertRowid;
  if (prodFanAsus) {
    repPieceStmt.run(rep4Id, prodFanAsus.id, prodFanAsus.reference, prodFanAsus.nom, 1, 2900, prodFanAsus.prixAchat || 1800, 2900);
    const curProd = db.prepare('SELECT quantite FROM products WHERE id = ?').get(prodFanAsus.id);
    const qteAvant = curProd ? curProd.quantite : prodFanAsus.quantite;
    const qteApres = Math.max(0, qteAvant - 1);
    db.prepare('UPDATE products SET quantite = ? WHERE id = ?').run(qteApres, prodFanAsus.id);
    movStmt.run(prodFanAsus.id, 'SORTIE_REPARATION', -1, qteAvant, qteApres, prodFanAsus.prixAchat, '', 'REP-202609-0004', 'Consommation ventilateur SAV', dYesterday);
  }
  if (prodPatMx4) {
    repPieceStmt.run(rep4Id, prodPatMx4.id, prodPatMx4.reference, prodPatMx4.nom, 1, 1600, prodPatMx4.prixAchat || 850, 1600);
    const curProd = db.prepare('SELECT quantite FROM products WHERE id = ?').get(prodPatMx4.id);
    const qteAvant = curProd ? curProd.quantite : prodPatMx4.quantite;
    const qteApres = Math.max(0, qteAvant - 1);
    db.prepare('UPDATE products SET quantite = ? WHERE id = ?').run(qteApres, prodPatMx4.id);
    movStmt.run(prodPatMx4.id, 'SORTIE_REPARATION', -1, qteAvant, qteApres, prodPatMx4.prixAchat, '', 'REP-202609-0004', 'Consommation pâte thermique SAV', dYesterday);
  }

  // Dossier 5 (Section 3: Sortie & Livraison effectuée avec Bon de Livraison)
  const rep5Info = repStmt.run(
    'REP-202609-0005',
    createdCustomers[5]?.id || null,
    createdCustomers[5]?.nom || 'Restaurant Le Gourmand',
    createdCustomers[5]?.telephone || '0555 33 22 11',
    'Smartphone',
    'Xiaomi',
    'Redmi Note 11 (Star Blue)',
    'XIAOMI-RN11-3412',
    '0000',
    'Appareil avec câble USB',
    'Connecteur de charge dessoudé, ne prend plus la charge rapide',
    'Nappe connecteur Type-C changée et soudée proprement',
    'LIVRE',
    reparateurId,
    'Hakim (Chef Atelier)',
    2400,
    1500,
    900,
    2400,
    1000,
    2400,
    0,
    'ESPECES',
    'Caisse Atelier',
    d15DaysAgo,
    d10DaysAgo,
    d3DaysAgo,
    dYesterday,
    'Bon de livraison émis et signé par le client. Garantie atelier 3 mois.'
  );
  const rep5Id = rep5Info.lastInsertRowid;
  if (prodChgTypeC) {
    repPieceStmt.run(rep5Id, prodChgTypeC.id, prodChgTypeC.reference, prodChgTypeC.nom, 1, 900, prodChgTypeC.prixAchat || 350, 900);
  }

  // Dossier 6 (Section 3: Retour SAV sous Garantie - Quantité -1)
  repStmt.run(
    'REP-202609-0006',
    createdCustomers[0]?.id || null,
    createdCustomers[0]?.nom || 'Établissement Benali & Frères',
    createdCustomers[0]?.telephone || '0550 12 34 56',
    'PC Portable',
    'HP',
    'Pavilion 15-eg0021nf',
    'HP-PAV-77123',
    'benali2026',
    'Sans chargeur',
    'SSD 512GB monté le mois passé présentant des blocages système (Erreurs SMART)',
    'Disque SSD défectueux pris sous garantie constructeur, échange standard',
    'RETOUR_GARANTIE',
    reparateurId,
    'Hakim (Chef Atelier)',
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    'ESPECES',
    'Caisse Atelier',
    d25DaysAgo,
    d15DaysAgo,
    dToday,
    null,
    'BON DE RETOUR SAV (Quantité -1) : Pièce défectueuse réintégrée/retournée et remplacée sous garantie.'
  );

  // 12. Insertion du Journal d'Audit & Historique des modifications
  console.log('[12/13] Génération du journal d’audit (connexions, modifications, SAV et trésorerie)...');
  const auditStmt = db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, module, reference, details, caisse, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  auditStmt.run(adminId, 'admin', 'CONNEXION', 'AUTH', 'SESSION-01', 'Connexion réussie au système', 'Caisse 1 (Magasin)', d25DaysAgo);
  auditStmt.run(adminId, 'admin', 'CREATION_CAISSE', 'CAISSE', 'CS-ATELIER', 'Création de la caisse Caisse Atelier', 'Caisse Atelier', d25DaysAgo);
  auditStmt.run(reparateurId, 'reparateur', 'CONNEXION', 'AUTH', 'SESSION-02', 'Connexion réussie atelier', 'Caisse Atelier', d15DaysAgo);
  auditStmt.run(reparateurId, 'reparateur', 'CREATION_REPARATION', 'REPARATION', 'REP-202609-0001', 'Prise en charge iPhone 13 Pro', 'Caisse Atelier', dYesterday);
  auditStmt.run(reparateurId, 'reparateur', 'DESTOCKAGE_PIECE', 'STOCK', 'PCE-BAT-S22', 'Consommation pièce pour réparation REP-202609-0003 (-1)', 'Caisse Atelier', dYesterday);
  auditStmt.run(reparateurId, 'reparateur', 'LIVRAISON_REPARATION', 'REPARATION', 'REP-202609-0005', 'Livraison smartphone Xiaomi et encaissement solde 1400 DA', 'Caisse Atelier', dYesterday);
  auditStmt.run(reparateurId, 'reparateur', 'RETOUR_GARANTIE', 'REPARATION', 'REP-202609-0006', 'Émission bon de retour SAV sous garantie (Quantité -1)', 'Caisse Atelier', dToday);

  // 13. Sauvegarde sur disque
  console.log('[13/13] Sauvegarde et persistance sur le disque local...');
  persistToDisk();

  console.log('\n===============================================================');
  console.log('   SEEDING GLOBAL TERMINÉ AVEC SUCCÈS !                       ');
  console.log('===============================================================');
  console.log(`- 📦 ${createdProducts.length} Produits avec Code-Barres 1D (dont pièces détachées SAV).`);
  console.log(`- 👥 ${createdCustomers.length} Fiches clients avec soldes de créances.`);
  console.log(`- 🚚 ${createdPurchases.length} Factures d’Achat Fournisseurs.`);
  console.log(`- 🧾 ${createdSales.length} Factures & Tickets de Vente avec QR Codes.`);
  console.log(`- 🔄 ${sampleSaleReturns.length} Avoirs Ventes & Bons de Livraison.`);
  console.log(`- 🔄 ${samplePurchaseReturns.length} Avoirs Achats Fournisseurs.`);
  console.log(`- 💰 ${sampleCashTransactions.length} Transactions de Trésorerie.`);
  console.log(`- 🔐 3 Comptes utilisateurs (admin, reparateur, vendeur).`);
  console.log(`- 💼 4 Caisses (Caisse 1, Caisse 2, Caisse Atelier, Coffre).`);
  console.log(`- 🔧 6 Dossiers SAV complets (Section 1 Réception, Section 2 Atelier, Section 3 Livraison & Retour -1).`);
  console.log(`- 📜 7 Événements dans le journal d’audit.`);
  console.log('--- TOUT EST PRÊT ET SYNCHRONISÉ ---');
}

seedDatabase().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Erreur lors du seeding global:', err);
  process.exit(1);
});
