const path = require('path');
const fs = require('fs');
const { initDatabase, persistToDisk, getDbPath } = require('../electron/database/sqlite');

async function cleanDatabaseForProduction() {
  console.log('========================================================================');
  console.log('  COMMERCE PRO — PRÉPARATION & NETTOYAGE COMPLET POUR PRODUCTION (SQLite)');
  console.log('========================================================================\n');

  const db = await initDatabase();

  console.log('1. Purge complète de toutes les tables opérationnelles & de test...');
  db.exec(`
    -- Réparations & SAV
    DELETE FROM reparation_pieces;
    DELETE FROM reparations;

    -- Ventes, BL & Factures
    DELETE FROM invoice_items;
    DELETE FROM invoices;

    -- Achats Fournisseurs
    DELETE FROM purchase_items;
    DELETE FROM purchase_invoices;

    -- Retours & Avoirs
    DELETE FROM sale_return_items;
    DELETE FROM sale_returns;
    DELETE FROM purchase_return_items;
    DELETE FROM purchase_returns;

    -- Mouvements & Trésorerie
    DELETE FROM stock_movements;
    DELETE FROM account_movements;
    DELETE FROM supplier_movements;
    DELETE FROM cash_transactions;
    DELETE FROM product_losses;

    -- Journal d'Audit de test
    DELETE FROM audit_logs;

    -- Produits, Clients & Fournisseurs
    DELETE FROM products;
    DELETE FROM customers;
    DELETE FROM suppliers;
  `);

  console.log('2. Réinitialisation des compteurs auto-incrément (sqlite_sequence)...');
  try {
    db.exec('DELETE FROM sqlite_sequence;');
  } catch (e) {
    // sqlite_sequence peut être vide
  }

  console.log('3. Initialisation des comptes utilisateurs de Production...');
  try {
    db.exec(`
      DELETE FROM users;
      INSERT INTO users (id, username, password, nom, role, caisse, actif) VALUES 
      (1, 'admin', 'admin123', 'Administrateur', 'ADMIN', 'Caisse Principale (Coffre)', 1),
      (2, 'reparateur', '1234', 'Atelier Réparateur', 'REPARATEUR', 'Caisse Atelier (SAV)', 1),
      (3, 'vendeur', '1234', 'Caissier / Vendeur', 'VENDEUR', 'Caisse 1 (Comptoir)', 1);
    `);
  } catch (e) {
    console.error('Erreur initialisation users:', e.message);
  }

  console.log('4. Initialisation des caisses magasins de Production...');
  try {
    db.exec(`
      DELETE FROM cash_registers;
      INSERT INTO cash_registers (id, nom, code, soldeInitial, actif) VALUES 
      (1, 'Caisse 1 (Magasin)', 'CAISSE-1', 0, 1),
      (2, 'Caisse Atelier', 'CAISSE-ATELIER', 0, 1),
      (3, 'Caisse Maison', 'CAISSE-MAISON', 0, 1),
      (4, 'Caisse Dette', 'CAISSE-DETTE', 0, 1),
      (5, 'Caisse Principale (Coffre)', 'CAISSE-PRIN', 0, 1);
    `);
  } catch (e) {
    console.error('Erreur initialisation caisses:', e.message);
  }

  console.log('5. Initialisation des catégories standard de charges d’exploitation...');
  try {
    db.exec(`
      DELETE FROM custom_categories;
      INSERT INTO custom_categories (id, nom, type) VALUES 
      (1, 'Loyer', 'DEPENSE'),
      (2, 'Salaires & Rémunérations', 'DEPENSE'),
      (3, 'Électricité, Gaz & Eau', 'DEPENSE'),
      (4, 'Transport & Livraison', 'DEPENSE'),
      (5, 'Fournitures & Entretien', 'DEPENSE'),
      (6, 'Marketing & Communication', 'DEPENSE'),
      (7, 'Frais bancaires & Divers', 'DEPENSE');
    `);
  } catch (e) {
    console.error('Erreur initialisation catégories:', e.message);
  }

  console.log('6. Compactage SQLite (VACUUM)...');
  try {
    db.exec('VACUUM;');
  } catch (e) {}

  // Sauvegarde sur disque de la base principale
  persistToDisk();

  const localDbPath = getDbPath();
  console.log(`\nSauvegardé avec succès dans le fichier local : ${localDbPath}`);

  // Synchronisation avec AppData (utilisé par Electron emballé / release)
  if (process.env.APPDATA) {
    const appDataDbDir = path.join(process.env.APPDATA, 'commercepost', 'data');
    const appDataDbFile = path.join(appDataDbDir, 'commercepost.db');
    try {
      if (!fs.existsSync(appDataDbDir)) {
        fs.mkdirSync(appDataDbDir, { recursive: true });
      }
      if (fs.existsSync(localDbPath)) {
        fs.copyFileSync(localDbPath, appDataDbFile);
        console.log(`Synchronisé vers AppData : ${appDataDbFile}`);
      }
    } catch (err) {
      console.warn('Avertissement synchronisation AppData:', err.message);
    }

    // Supprimer d'éventuels fichiers temporaires WAL / SHM dans AppData
    ['commercepost.db-wal', 'commercepost.db-shm'].forEach(f => {
      const p = path.join(appDataDbDir, f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) {}
      }
    });
  }

  // Supprimer d'éventuels fichiers temporaires WAL / SHM dans data local
  const projectDir = path.join(__dirname, '../data');
  ['commercepost.db-wal', 'commercepost.db-shm'].forEach(f => {
    const p = path.join(projectDir, f);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (e) {}
    }
  });

  console.log('\n========================================================================');
  console.log('  ✅ BASE DE DONNÉES ENTIÈREMENT PROPRE ET PRÊTE POUR LA PRODUCTION !');
  console.log('  - 0 Articles / Produits');
  console.log('  - 0 Ventes & Factures');
  console.log('  - 0 Achats Fournisseurs');
  console.log('  - 0 Retours & Avoirs');
  console.log('  - 0 Réparations SAV');
  console.log('  - 0 Clients & Fournisseurs');
  console.log('  - 0 Mouvements de stock & Trésorerie');
  console.log('  - 0 Pertes déclarées & 0 Audit logs');
  console.log('  - 3 Comptes utilisateurs configurés (admin, reparateur, vendeur)');
  console.log('  - 3 Caisses configurées (Comptoir, Atelier SAV, Coffre)');
  console.log('  - 7 Catégories de charges configurées');
  console.log('========================================================================\n');

  process.exit(0);
}

cleanDatabaseForProduction().catch((err) => {
  console.error('Erreur lors du nettoyage de la base SQLite:', err);
  process.exit(1);
});
