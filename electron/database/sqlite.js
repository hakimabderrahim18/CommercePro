const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let SQL = null;
let db = null;
let dbPath = null;
let inTransaction = false;

function getDbPath() {
  if (dbPath) return dbPath;

  const projectDataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(projectDataDir)) {
    try { fs.mkdirSync(projectDataDir, { recursive: true }); } catch (e) {}
  }
  const projectDbFile = path.join(projectDataDir, 'commercepost.db');

  let isPackaged = false;
  let userDataDbFile = null;

  try {
    const { app } = require('electron');
    if (app && app.getPath) {
      isPackaged = app.isPackaged;
      const userDataDir = path.join(app.getPath('userData'), 'data');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      userDataDbFile = path.join(userDataDir, 'commercepost.db');
    }
  } catch (e) {
    // Non-electron context (CLI, tests, seeds)
  }

  // Si on est dans Electron, toujours utiliser la base de données principale persistante
  if (userDataDbFile) {
    if (!fs.existsSync(userDataDbFile) && fs.existsSync(projectDbFile)) {
      try {
        fs.copyFileSync(projectDbFile, userDataDbFile);
      } catch (err) {}
    } else if (fs.existsSync(userDataDbFile) && !fs.existsSync(projectDbFile)) {
      try {
        fs.copyFileSync(userDataDbFile, projectDbFile);
      } catch (err) {}
    }
    dbPath = userDataDbFile;
    return dbPath;
  }

  dbPath = projectDbFile;
  return dbPath;
}

function persistToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const primaryPath = getDbPath();
    fs.writeFileSync(primaryPath, buffer);

    // Also sync to project data and userData to keep all tools in sync
    try {
      const projPath = path.resolve(__dirname, '../../data/commercepost.db');
      if (projPath !== primaryPath && fs.existsSync(path.dirname(projPath))) {
        fs.writeFileSync(projPath, buffer);
      }
    } catch (e) {}

    try {
      if (process.env.APPDATA) {
        const uPathPro = path.join(process.env.APPDATA, 'commercepro', 'data', 'commercepost.db');
        if (uPathPro !== primaryPath && fs.existsSync(path.dirname(uPathPro))) {
          fs.writeFileSync(uPathPro, buffer);
        }
        const uPathOld = path.join(process.env.APPDATA, 'commercepost', 'data', 'commercepost.db');
        if (uPathOld !== primaryPath && fs.existsSync(path.dirname(uPathOld))) {
          fs.writeFileSync(uPathOld, buffer);
        }
      }
    } catch (e) {}
  } catch (err) {
    console.error('[SQLite] Erreur de sauvegarde sur disque:', err);
  }
}

function scheduleSave() {
  if (!inTransaction) {
    persistToDisk();
  }
}

class SQLiteAdapter {
  constructor(rawDb) {
    this.rawDb = rawDb;
    this.open = true;
  }

  exec(sql) {
    this.rawDb.exec(sql);
    scheduleSave();
  }

  prepare(sql) {
    const self = this;
    return {
      all(...params) {
        const results = [];
        try {
          const stmt = self.rawDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
        } catch (err) {
          console.error('[SQLite prepare.all error]', sql, params, err);
          throw err;
        }
        return results;
      },

      get(...params) {
        let result = null;
        try {
          const stmt = self.rawDb.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) {
            result = stmt.getAsObject();
          }
          stmt.free();
        } catch (err) {
          console.error('[SQLite prepare.get error]', sql, params, err);
          throw err;
        }
        return result;
      },

      run(...params) {
        try {
          self.rawDb.run(sql, params);
          const lastIdRes = self.rawDb.exec('SELECT last_insert_rowid() as id');
          const lastInsertRowid = (lastIdRes[0] && lastIdRes[0].values[0]) ? lastIdRes[0].values[0][0] : 0;
          scheduleSave();
          return { lastInsertRowid };
        } catch (err) {
          console.error('[SQLite prepare.run error]', sql, params, err);
          throw err;
        }
      }
    };
  }

  transaction(fn) {
    const self = this;
    return (...args) => {
      inTransaction = true;
      try {
        self.rawDb.exec('BEGIN TRANSACTION');
      } catch (e) {
        // Already in transaction
      }

      try {
        const res = fn(...args);
        try {
          self.rawDb.exec('COMMIT');
        } catch (commitErr) {
          console.warn('[SQLite Commit Warning]', commitErr.message);
        }
        inTransaction = false;
        persistToDisk();
        return res;
      } catch (err) {
        inTransaction = false;
        try {
          self.rawDb.exec('ROLLBACK');
        } catch (rollbackErr) {
          // Ignore rollback error if transaction already closed
        }
        console.error('[SQLite Transaction Error]', err);
        throw err;
      }
    };
  }
}

let wrappedDb = null;

async function initDatabase() {
  if (wrappedDb) return wrappedDb;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  const filePath = getDbPath();
  console.log('[SQLite] Chargement de la base de données locale :', filePath);

  let rawDb;
  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }

  wrappedDb = new SQLiteAdapter(rawDb);
  db = rawDb;

  initTables(wrappedDb);
  persistToDisk();
  return wrappedDb;
}

function getDB() {
  if (!wrappedDb) {
    throw new Error('Database not yet initialized. Call initDatabase() on app ready.');
  }
  return wrappedDb;
}

function initTables(database) {
  database.exec(`
    -- 1. Table Produits
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      codeBarre TEXT,
      nom TEXT NOT NULL,
      categorie TEXT DEFAULT 'Général',
      taille TEXT DEFAULT '',
      pointure TEXT DEFAULT '',
      couleur TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      prixAchat REAL DEFAULT 0,
      prixVente REAL NOT NULL DEFAULT 0,
      prixDemiGros REAL DEFAULT 0,
      prixGros REAL DEFAULT 0,
      prixSuperGros REAL DEFAULT 0,
      prixSerie REAL DEFAULT 0,
      piecesParSerie REAL DEFAULT 1,
      quantite REAL DEFAULT 0,
      unite TEXT DEFAULT 'pcs',
      seuilAlerte REAL DEFAULT 5,
      fournisseur TEXT DEFAULT '',
      codesBarres TEXT DEFAULT '',
      barcodeData TEXT DEFAULT '',
      barcodeImage TEXT DEFAULT '',
      qrCodeData TEXT DEFAULT '',
      qrCodeImage TEXT DEFAULT '',
      image TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Table Clients
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      telephone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      adresse TEXT DEFAULT '',
      plafondCredit REAL DEFAULT 0,
      soldeDette REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Table Factures de Vente
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numeroFacture TEXT UNIQUE NOT NULL,
      typeDocument TEXT DEFAULT 'FACTURE',
      caisse TEXT DEFAULT 'Caisse 1',
      vendeur TEXT DEFAULT 'ILYES',
      client_id INTEGER,
      clientLibre TEXT DEFAULT 'Client Comptoir',
      totalHT REAL DEFAULT 0,
      tauxTva REAL DEFAULT 0,
      montantTva REAL DEFAULT 0,
      remise REAL DEFAULT 0,
      totalTTC REAL NOT NULL DEFAULT 0,
      montantPaye REAL DEFAULT 0,
      montantReste REAL DEFAULT 0,
      modePaiement TEXT DEFAULT 'ESPECES',
      statutPaiement TEXT DEFAULT 'PAYE',
      notes TEXT DEFAULT '',
      qrCodeData TEXT DEFAULT '',
      qrCodeImage TEXT DEFAULT '',
      dateFacture DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Table Lignes de Vente (Items)
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER,
      reference TEXT NOT NULL,
      nom TEXT NOT NULL,
      quantite REAL NOT NULL DEFAULT 1,
      prixUnitaire REAL NOT NULL DEFAULT 0,
      prixAchatUnitaire REAL NOT NULL DEFAULT 0,
      unite TEXT DEFAULT 'pcs',
      isSerie INTEGER DEFAULT 0,
      piecesParSerie REAL DEFAULT 1,
      totalLigne REAL NOT NULL DEFAULT 0
    );

    -- 5. Table Factures d'Achat Fournisseurs
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numeroFactureAchat TEXT UNIQUE NOT NULL,
      fournisseur TEXT NOT NULL,
      contactFournisseur TEXT DEFAULT '',
      totalHT REAL DEFAULT 0,
      tauxTva REAL DEFAULT 0,
      montantTva REAL DEFAULT 0,
      totalTTC REAL NOT NULL DEFAULT 0,
      montantPaye REAL DEFAULT 0,
      modePaiement TEXT DEFAULT 'ESPECES',
      dateFactureAchat DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Table Lignes d'Achat (Purchase Items)
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER,
      reference TEXT NOT NULL,
      nom TEXT NOT NULL,
      quantite REAL NOT NULL DEFAULT 1,
      prixAchatUnitaire REAL NOT NULL DEFAULT 0,
      prixVente REAL DEFAULT 0,
      prixDemiGros REAL DEFAULT 0,
      prixGros REAL DEFAULT 0,
      prixSuperGros REAL DEFAULT 0,
      unite TEXT DEFAULT 'pcs',
      totalLigne REAL NOT NULL DEFAULT 0
    );

    -- 7. Table Mouvements de Stock
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      type TEXT NOT NULL,
      quantite REAL NOT NULL,
      quantiteAvant REAL DEFAULT 0,
      quantiteApres REAL DEFAULT 0,
      prixAchatUnitaire REAL DEFAULT 0,
      fournisseur TEXT DEFAULT '',
      referenceDocument TEXT DEFAULT '',
      motif TEXT DEFAULT '',
      dateMouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Table Mouvements de Compte Client (Dettes & Règlements)
    CREATE TABLE IF NOT EXISTS account_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      montant REAL NOT NULL,
      soldeAvant REAL DEFAULT 0,
      soldeApres REAL DEFAULT 0,
      referenceFacture TEXT DEFAULT '',
      motif TEXT DEFAULT '',
      dateMouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Table Retours de Vente / Avoirs Ventes & Bons de Livraison
    CREATE TABLE IF NOT EXISTS sale_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numeroRetour TEXT UNIQUE NOT NULL,
      typeDocument TEXT DEFAULT 'AVOIR_VENTE',
      invoice_id INTEGER,
      client_id INTEGER,
      clientLibre TEXT DEFAULT 'Client Comptoir',
      montantTotalRembourse REAL DEFAULT 0,
      modeRemboursement TEXT DEFAULT 'ESPECES',
      motif TEXT DEFAULT '',
      dateRetour DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      product_id INTEGER,
      reference TEXT NOT NULL,
      nom TEXT NOT NULL,
      quantiteRetournee REAL NOT NULL,
      prixUnitaire REAL NOT NULL,
      unite TEXT DEFAULT 'pcs',
      totalLigne REAL NOT NULL
    );

    -- 10. Table Avoirs / Retours Achats Fournisseurs
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numeroAvoirAchat TEXT UNIQUE NOT NULL,
      purchase_id INTEGER,
      fournisseur TEXT NOT NULL,
      contactFournisseur TEXT DEFAULT '',
      montantTotal REAL DEFAULT 0,
      modeRemboursement TEXT DEFAULT 'ESPECES',
      motif TEXT DEFAULT '',
      dateAvoirAchat DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_return_id INTEGER NOT NULL,
      product_id INTEGER,
      reference TEXT NOT NULL,
      nom TEXT NOT NULL,
      quantiteRetournee REAL NOT NULL,
      prixAchatUnitaire REAL NOT NULL,
      unite TEXT DEFAULT 'pcs',
      totalLigne REAL NOT NULL
    );

    -- 11. Table Encaissements & Décaissements (Trésorerie & Caisse)
    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numeroTransaction TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      categorie TEXT NOT NULL,
      montant REAL NOT NULL DEFAULT 0,
      modePaiement TEXT DEFAULT 'ESPECES',
      client_id INTEGER,
      fournisseur TEXT DEFAULT '',
      tiers TEXT DEFAULT '',
      referenceDocument TEXT DEFAULT '',
      motif TEXT DEFAULT '',
      dateTransaction DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 12. Table Pertes & Casse des Produits (Damages & Losses)
    CREATE TABLE IF NOT EXISTS product_losses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numeroDeclaration TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL,
      reference TEXT NOT NULL,
      nom TEXT NOT NULL,
      categorie TEXT DEFAULT '',
      taille TEXT DEFAULT '',
      pointure TEXT DEFAULT '',
      couleur TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      quantite REAL NOT NULL,
      prixAchatUnitaire REAL DEFAULT 0,
      prixVenteUnitaire REAL DEFAULT 0,
      valeurPerte REAL NOT NULL DEFAULT 0,
      typePerte TEXT NOT NULL DEFAULT 'CASSE',
      motif TEXT DEFAULT '',
      declarePar TEXT DEFAULT 'Responsable Stock',
      dateDeclaration DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Table des Caisses (Multi-caisses magasin)
    CREATE TABLE IF NOT EXISTS cash_registers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      soldeInitial REAL DEFAULT 0,
      actif INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. Table des Fournisseurs
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      telephone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      adresse TEXT DEFAULT '',
      soldeDette REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. Table des Mouvements de Compte Fournisseur (Dettes & Versements)
    CREATE TABLE IF NOT EXISTS supplier_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      montant REAL NOT NULL,
      soldeAvant REAL DEFAULT 0,
      soldeApres REAL DEFAULT 0,
      referenceFacture TEXT DEFAULT '',
      motif TEXT DEFAULT '',
      dateMouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. Table des Catégories Libres (Charges / Dépenses)
    CREATE TABLE IF NOT EXISTS custom_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'DEPENSE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Table Utilisateurs & Rôles
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nom TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'VENDEUR', -- ADMIN, REPARATEUR, VENDEUR
      caisse TEXT DEFAULT 'Caisse 1 (Magasin)',
      actif INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Table Journal d'Audit & Historique des Modifications
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      reference TEXT DEFAULT '',
      details TEXT DEFAULT '',
      caisse TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. Table des Réparations (SAV / Atelier)
    CREATE TABLE IF NOT EXISTS reparations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numeroReparation TEXT UNIQUE NOT NULL,
      client_id INTEGER,
      clientNom TEXT NOT NULL,
      clientTelephone TEXT DEFAULT '',
      appareilType TEXT NOT NULL DEFAULT 'Smartphone',
      marque TEXT NOT NULL,
      modele TEXT NOT NULL,
      numeroSerie TEXT DEFAULT '',
      motDePasseAppareil TEXT DEFAULT '',
      accessoires TEXT DEFAULT '',
      panneDeclaree TEXT NOT NULL,
      constatTechnique TEXT DEFAULT '',
      statut TEXT NOT NULL DEFAULT 'RECEPTIONNE', -- RECEPTIONNE, DIAGNOSTIC, ATTENTE_PIECE, EN_REPARATION, REPARE, IRREPARABLE, LIVRE, RETOUR_GARANTIE
      reparateur_id INTEGER,
      reparateurNom TEXT DEFAULT '',
      estimationDevis REAL DEFAULT 0,
      coutMainOeuvre REAL DEFAULT 0,
      coutPieces REAL DEFAULT 0,
      totalTTC REAL DEFAULT 0,
      acomptePaye REAL DEFAULT 0,
      montantPaye REAL DEFAULT 0,
      montantReste REAL DEFAULT 0,
      modePaiement TEXT DEFAULT 'ESPECES',
      caisse TEXT DEFAULT 'Caisse 1 (Magasin)',
      dateReception DATETIME DEFAULT CURRENT_TIMESTAMP,
      dateDiagnostic DATETIME,
      dateReparation DATETIME,
      dateLivraison DATETIME,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 20. Table des Pièces Utilisées en Réparation
    CREATE TABLE IF NOT EXISTS reparation_pieces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reparation_id INTEGER NOT NULL,
      product_id INTEGER,
      reference TEXT DEFAULT '',
      nom TEXT NOT NULL,
      quantite REAL NOT NULL DEFAULT 1,
      prixUnitaire REAL NOT NULL DEFAULT 0,
      prixAchatUnitaire REAL DEFAULT 0,
      totalLigne REAL NOT NULL DEFAULT 0,
      retireDuStock INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 21. Table des Mouvements et Comptes des Techniciens
    CREATE TABLE IF NOT EXISTS technician_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      reparation_id INTEGER,
      type TEXT NOT NULL, -- 'GAIN_REPARATION', 'RETRAIT', 'AJUSTEMENT', 'ANNULATION'
      montant REAL NOT NULL,
      soldeAvant REAL DEFAULT 0,
      soldeApres REAL DEFAULT 0,
      referenceDocument TEXT DEFAULT '',
      motif TEXT DEFAULT '',
      caisse TEXT DEFAULT '',
      dateMouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations légères pour colonnes optionnelles & nouvelles fonctionnalités
  try {
    database.exec("ALTER TABLE products ADD COLUMN taille TEXT DEFAULT '';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN pointure TEXT DEFAULT '';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN couleur TEXT DEFAULT '';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN genre TEXT DEFAULT '';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN image TEXT DEFAULT '';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE sale_returns ADD COLUMN typeDocument TEXT DEFAULT 'AVOIR_VENTE';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE sale_returns ADD COLUMN clientLibre TEXT DEFAULT 'Client Comptoir';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE sale_returns ADD COLUMN modeRemboursement TEXT DEFAULT 'ESPECES';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE sale_returns ADD COLUMN dateRetour DATETIME DEFAULT CURRENT_TIMESTAMP;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE sale_return_items ADD COLUMN unite TEXT DEFAULT 'pcs';");
  } catch (e) {}

  // 1. Multi-prix produits (Gros, Demi-gros, Super gros)
  try {
    database.exec("ALTER TABLE users ADD COLUMN soldeTechnicien REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE reparations ADD COLUMN commissionTechnicien REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE reparations ADD COLUMN technicienCredite INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS technician_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        technician_id INTEGER NOT NULL,
        reparation_id INTEGER,
        type TEXT NOT NULL,
        montant REAL NOT NULL,
        soldeAvant REAL DEFAULT 0,
        soldeApres REAL DEFAULT 0,
        referenceDocument TEXT DEFAULT '',
        motif TEXT DEFAULT '',
        caisse TEXT DEFAULT '',
        dateMouvement DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN prixDemiGros REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN prixGros REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN prixSuperGros REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN codesBarres TEXT DEFAULT '';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN prixSerie REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE products ADD COLUMN piecesParSerie REAL DEFAULT 1;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE invoice_items ADD COLUMN isSerie INTEGER DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE invoice_items ADD COLUMN piecesParSerie REAL DEFAULT 1;");
  } catch (e) {}

  // 2. Multi-caisses
  try {
    database.exec("ALTER TABLE cash_transactions ADD COLUMN caisse TEXT DEFAULT 'Caisse 1';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE invoices ADD COLUMN caisse TEXT DEFAULT 'Caisse 1';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE invoices ADD COLUMN vendeur TEXT DEFAULT 'ILYES';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN caisse TEXT DEFAULT 'Caisse 1';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN typeDocument TEXT DEFAULT 'FACTURE_ACHAT';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN supplier_id INTEGER;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN montantReste REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN statutPaiement TEXT DEFAULT 'PAYE';");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN montantTimbre REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN remise REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE purchase_invoices ADD COLUMN notes TEXT DEFAULT '';");
  } catch (e) {}

  // Migration prixAchatUnitaire & quantiteRetournee sur invoice_items
  try {
    database.exec("ALTER TABLE invoice_items ADD COLUMN prixAchatUnitaire REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE invoice_items ADD COLUMN quantiteRetournee REAL DEFAULT 0;");
  } catch (e) {}
  try {
    database.exec(`
      UPDATE invoice_items 
      SET prixAchatUnitaire = (SELECT p.prixAchat FROM products p WHERE p.id = invoice_items.product_id)
      WHERE (prixAchatUnitaire IS NULL OR prixAchatUnitaire = 0) AND product_id IS NOT NULL;
    `);
  } catch (e) {}

  // Migration universelle updated_at sur toutes les tables
  const tablesWithUpdatedAt = [
    'invoices',
    'purchase_invoices',
    'sale_returns',
    'purchase_returns',
    'cash_transactions',
    'product_losses',
    'customers',
    'suppliers',
    'products'
  ];
  for (const t of tablesWithUpdatedAt) {
    try {
      database.exec(`ALTER TABLE ${t} ADD COLUMN updated_at DATETIME;`);
    } catch (e) {}
    try {
      database.exec(`UPDATE ${t} SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`);
    } catch (e) {}
  }

  // Migration colonnes multi-prix pour purchase_items
  const purchaseItemCols = ['prixVente', 'prixDemiGros', 'prixGros', 'prixSuperGros'];
  for (const col of purchaseItemCols) {
    try {
      database.exec(`ALTER TABLE purchase_items ADD COLUMN ${col} REAL DEFAULT 0;`);
    } catch (e) {}
  }

  // Initialisation des Caisses par défaut si table vide ou caisses manquantes
  try {
    const regCount = database.prepare("SELECT COUNT(*) as count FROM cash_registers").get();
    if (!regCount || regCount.count === 0) {
      database.exec(`
        INSERT INTO cash_registers (nom, code, soldeInitial, actif) VALUES 
        ('Caisse 1 (Magasin)', 'CAISSE-1', 0, 1),
        ('Caisse Maison', 'CAISSE-MAISON', 0, 1),
        ('Caisse Dette', 'CAISSE-DETTE', 0, 1),
        ('Caisse Atelier', 'CAISSE-ATELIER', 0, 1);
      `);
    } else {
      // S'assurer que Caisse Maison, Caisse Dette et Caisse Atelier existent
      const hasMaison = database.prepare("SELECT id FROM cash_registers WHERE code = 'CAISSE-MAISON' OR nom LIKE '%Maison%'").get();
      if (!hasMaison) {
        database.prepare("INSERT INTO cash_registers (nom, code, soldeInitial, actif) VALUES ('Caisse Maison', 'CAISSE-MAISON', 0, 1)").run();
      }
      const hasDette = database.prepare("SELECT id FROM cash_registers WHERE code = 'CAISSE-DETTE' OR nom LIKE '%Dette%'").get();
      if (!hasDette) {
        database.prepare("INSERT INTO cash_registers (nom, code, soldeInitial, actif) VALUES ('Caisse Dette', 'CAISSE-DETTE', 0, 1)").run();
      }
      const hasAtelier = database.prepare("SELECT id FROM cash_registers WHERE code = 'CAISSE-ATELIER' OR nom LIKE '%Atelier%'").get();
      if (!hasAtelier) {
        database.prepare("INSERT INTO cash_registers (nom, code, soldeInitial, actif) VALUES ('Caisse Atelier', 'CAISSE-ATELIER', 0, 1)").run();
      }
    }
  } catch (e) {}

  // Initialisation des Comptes Utilisateurs par défaut si table vide
  try {
    const userCount = database.prepare("SELECT COUNT(*) as count FROM users").get();
    if (!userCount || userCount.count === 0) {
      database.exec(`
        INSERT INTO users (username, password, nom, role, caisse, actif) VALUES 
        ('admin', 'admin123', 'Administrateur Général', 'ADMIN', 'Caisse 1 (Magasin)', 1),
        ('reparateur', '1234', 'Technicien SAV Atelier', 'REPARATEUR', 'Caisse Atelier', 1),
        ('vendeur', '1234', 'Caissier Vendeur', 'VENDEUR', 'Caisse 1 (Magasin)', 1);
      `);
    }
  } catch (e) {}

  // Initialisation des catégories libres par défaut si table vide
  try {
    const catCount = database.prepare("SELECT COUNT(*) as count FROM custom_categories").get();
    if (!catCount || catCount.count === 0) {
      database.exec(`
        INSERT INTO custom_categories (nom, type) VALUES 
        ('Loyer', 'DEPENSE'),
        ('Salaires & Rémunérations', 'DEPENSE'),
        ('Électricité & Eau', 'DEPENSE'),
        ('Transport & Livraison', 'DEPENSE'),
        ('Fournitures & Entretien', 'DEPENSE'),
        ('Marketing & Publicité', 'DEPENSE'),
        ('Frais bancaires & Divers', 'DEPENSE');
      `);
    }
  } catch (e) {}

  // Synchronisation des fournisseurs depuis purchase_invoices existants
  try {
    const existingSuppliers = database.prepare("SELECT DISTINCT fournisseur, contactFournisseur FROM purchase_invoices WHERE fournisseur IS NOT NULL AND fournisseur != ''").all();
    for (const s of existingSuppliers) {
      const exists = database.prepare("SELECT id FROM suppliers WHERE UPPER(nom) = ?").get(s.fournisseur.trim().toUpperCase());
      if (!exists) {
        database.prepare("INSERT INTO suppliers (nom, telephone) VALUES (?, ?)").run(s.fournisseur.trim(), s.contactFournisseur || '');
      }
    }
  } catch (e) {}

  // Synchronisation des mouvements de stock pour les pièces de réparation consommées
  try {
    // 1. Normaliser les anciennes sorties réparation enregistrées en quantité positive
    database.prepare(`
      UPDATE stock_movements 
      SET quantite = -ABS(quantite), type = 'PIECE_REPARATION_SAV' 
      WHERE (type = 'SORTIE_REPARATION' OR type = 'PIECE_REPARATION_SAV') AND quantite > 0
    `).run();

    // 2. Insérer les mouvements de stock manquants pour les pièces de réparation
    const unrecordedPieces = database.prepare(`
      SELECT rp.*, r.numeroReparation, r.clientNom, p.quantite as currentStock
      FROM reparation_pieces rp
      LEFT JOIN reparations r ON rp.reparation_id = r.id
      LEFT JOIN products p ON rp.product_id = p.id
      WHERE rp.retireDuStock = 1
        AND NOT EXISTS (
          SELECT 1 FROM stock_movements sm 
          WHERE sm.product_id = rp.product_id 
            AND (sm.type = 'PIECE_REPARATION_SAV' OR sm.type = 'SORTIE_REPARATION')
            AND sm.referenceDocument = r.numeroReparation
        )
    `).all();

    for (const piece of unrecordedPieces) {
      const qte = Math.abs(Number(piece.quantite) || 1);
      const docRef = piece.numeroReparation || `REP-${piece.reparation_id}`;
      const motif = `Pièce atelier utilisée pour réparation ${docRef} (${piece.nom})`;
      database.prepare(`
        INSERT INTO stock_movements (
          product_id, type, quantite, quantiteAvant, quantiteApres,
          prixAchatUnitaire, referenceDocument, motif, dateMouvement
        ) VALUES (?, 'PIECE_REPARATION_SAV', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        piece.product_id,
        -qte, // Sortie: variation négative
        (piece.currentStock || 0) + qte,
        piece.currentStock || 0,
        piece.prixAchatUnitaire || 0,
        docRef,
        motif,
        piece.created_at || new Date().toISOString()
      );
    }
  } catch (e) {
    console.error('Erreur synchronisation stock_movements pièces réparation:', e);
  }

  // Indexation haute performance pour la lecture ultra-rapide des codes-barres
  try {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_codebarre ON products(codeBarre);
      CREATE INDEX IF NOT EXISTS idx_products_reference ON products(reference);
      CREATE INDEX IF NOT EXISTS idx_products_nom ON products(nom);
      CREATE INDEX IF NOT EXISTS idx_reparations_numero ON reparations(numeroReparation);
      CREATE INDEX IF NOT EXISTS idx_reparations_statut ON reparations(statut);
      CREATE INDEX IF NOT EXISTS idx_reparations_client ON reparations(clientNom);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    `);
  } catch (e) {}
}

module.exports = {
  initDatabase,
  getDB,
  getDbPath,
  persistToDisk
};
