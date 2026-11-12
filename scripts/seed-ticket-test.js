const path = require('path');
const fs = require('fs');
const { initDatabase, persistToDisk, getDbPath } = require('../electron/database/sqlite');

async function seedTest() {
  console.log('=== Injection des graines de test CommercePost (Ticket & SAV) ===');
  console.log('Fichier base de données :', getDbPath());

  const db = await initDatabase();

  // 1. Ajouter le caissier ILYES
  const userCheck = db.prepare("SELECT id FROM users WHERE UPPER(username) = 'ILYES'").get();
  if (!userCheck) {
    db.prepare(`
      INSERT INTO users (username, password, nom, role, caisse, actif)
      VALUES ('ilyes', '1234', 'ILYES', 'VENDEUR', 'Caisse 1 (Magasin)', 1)
    `).run();
    console.log('✅ Utilisateur Caissier ILYES créé.');
  }

  // 2. Ajouter le client R MOHAMED YESREF
  let clientId;
  const clientCheck = db.prepare("SELECT id FROM customers WHERE UPPER(nom) LIKE '%YESREF%'").get();
  if (clientCheck) {
    clientId = clientCheck.id;
    console.log('ℹ️ Client R MOHAMED YESREF existe déjà (ID:', clientId, ').');
  } else {
    const ins = db.prepare(`
      INSERT INTO customers (nom, telephone, adresse, email, soldeDette, plafondCredit, notes)
      VALUES ('R MOHAMED YESREF', '0550245000', 'Tiaret', 'mohamed.yesref@gmail.com', 0, 50000, 'Client fidèle comptoir')
    `).run();
    clientId = ins.lastInsertRowid;
    console.log('✅ Client R MOHAMED YESREF inséré (ID:', clientId, ').');
  }

  // 3. Ajouter le produit du ticket : LCD SAM A13/M13/F13 BLINDE
  let prodId;
  const prodCheck = db.prepare("SELECT id FROM products WHERE reference = '036009' OR codeBarre = '036009'").get();
  if (prodCheck) {
    prodId = prodCheck.id;
    console.log('ℹ️ Produit LCD SAM A13 existe déjà (ID:', prodId, ').');
  } else {
    const insProd = db.prepare(`
      INSERT INTO products (reference, codeBarre, nom, categorie, prixAchat, prixVente, quantite, unite, seuilAlerte, fournisseur)
      VALUES ('036009', '036009', 'LCD SAM A13/M13/F13 BLINDE', 'Pièces Téléphonie', 1400, 2000, 30, 'pcs', 5, 'Fournisseur Pièces Alger')
    `).run();
    prodId = insProd.lastInsertRowid;
    console.log('✅ Produit LCD SAM A13/M13/F13 BLINDE inséré (ID:', prodId, ').');
  }

  // 4. Ajouter le ticket exact 036009
  const invCheck = db.prepare("SELECT id FROM invoices WHERE numeroFacture = '036009'").get();
  if (invCheck) {
    console.log('ℹ️ Ticket 036009 déjà présent dans les ventes.');
  } else {
    const insInv = db.prepare(`
      INSERT INTO invoices (
        numeroFacture, typeDocument, client_id, clientLibre, totalHT, remise, tauxTva, montantTva, totalTTC,
        montantPaye, montantReste, statutPaiement, modePaiement, caisse, vendeur, dateFacture, created_at
      ) VALUES (
        '036009', 'BON_COMMANDE', ?, 'R MOHAMED YESREF', 2000, 0, 0, 0, 2000,
        2000, 0, 'PAYE', 'ESPECES', 'Caisse 1 (Magasin)', 'ILYES', '2026-08-31 19:42:07', '2026-08-31 19:42:07'
      )
    `).run(clientId);
    const invId = insInv.lastInsertRowid;

    db.prepare(`
      INSERT INTO invoice_items (invoice_id, product_id, reference, nom, quantite, prixUnitaire, prixAchatUnitaire, unite, totalLigne)
      VALUES (?, ?, '036009', 'LCD SAM A13/M13/F13 BLINDE', 1, 2000, 1400, 'pcs', 2000)
    `).run(invId, prodId);
    console.log('✅ Vente Ticket 036009 insérée avec succès !');
  }

  // 5. Ajouter un Fournisseur & Bon d'achat test avec calcul TVA (19%) et Timbre Fiscal algérien
  let suppId;
  const suppCheck = db.prepare("SELECT id FROM suppliers WHERE nom LIKE '%FOURNISSEUR PIECES TIARET%'").get();
  if (suppCheck) {
    suppId = suppCheck.id;
  } else {
    const insSupp = db.prepare(`
      INSERT INTO suppliers (nom, telephone, adresse, soldeDette)
      VALUES ('FOURNISSEUR PIECES TIARET', '0550112233', 'Zone d Activite Tiaret', 0)
    `).run();
    suppId = insSupp.lastInsertRowid;
    console.log('✅ Fournisseur créé (ID:', suppId, ').');
  }

  const pCheck = db.prepare("SELECT id FROM purchase_invoices WHERE numeroFactureAchat = 'FA-202608-0001'").get();
  if (!pCheck) {
    const insPurch = db.prepare(`
      INSERT INTO purchase_invoices (
        numeroFactureAchat, typeDocument, caisse, supplier_id, fournisseur, contactFournisseur,
        totalHT, remise, tauxTva, montantTva, montantTimbre, totalTTC, montantPaye, montantReste,
        statutPaiement, modePaiement, notes, dateFactureAchat, created_at
      ) VALUES (
        'FA-202608-0001', 'FACTURE_ACHAT', 'Caisse 1 (Magasin)', ?, 'FOURNISSEUR PIECES TIARET', '0550112233',
        14000, 0, 19, 2660, 167, 16827, 16827, 0,
        'PAYE', 'ESPECES', 'Bon d achat test avec TVA 19% et droit de timbre algérien', '2026-08-30 10:00:00', '2026-08-30 10:00:00'
      )
    `).run(suppId);
    const purchId = insPurch.lastInsertRowid;

    db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, reference, nom, quantite, prixAchatUnitaire, unite, totalLigne)
      VALUES (?, ?, '036009', 'LCD SAM A13/M13/F13 BLINDE', 10, 1400, 'pcs', 14000)
    `).run(purchId, prodId);
    console.log('✅ Facture d achat test avec TVA 19% et Timbre fiscal insérée !');
  }

  // 6. Ajouter une Réparation SAV riche avec pièce liée et détails complets
  const repCheck = db.prepare("SELECT id FROM reparations WHERE numeroReparation = 'REP-036009'").get();
  if (!repCheck) {
    const insRep = db.prepare(`
      INSERT INTO reparations (
        numeroReparation, client_id, clientNom, clientTelephone,
        appareilType, marque, modele, numeroSerie, motDePasseAppareil, accessoires,
        panneDeclaree, constatTechnique, statut, estimationDevis, acomptePaye,
        coutMainOeuvre, coutPieces, totalTTC, montantPaye, montantReste, reparateurNom,
        dateReception, dateLivraison
      ) VALUES (
        'REP-036009', ?, 'R MOHAMED YESREF', '0550245000',
        'Smartphone', 'SAMSUNG', 'Galaxy A13', '358941208945123', '1234', 'Sans chargeur, avec coque silicone',
        'Écran tactile fissuré et affichage noir suite à une chute', 'Remplacement complet du bloc écran LCD requis', 'LIVRE', 3500, 1000,
        1500, 2000, 3500, 3500, 0, 'ILYES',
        '2026-08-31 14:00:00', '2026-08-31 19:42:07'
      )
    `).run(clientId);
    const repId = insRep.lastInsertRowid;

    db.prepare(`
      INSERT INTO reparation_pieces (reparation_id, product_id, reference, nom, quantite, prixUnitaire, prixAchatUnitaire, totalLigne)
      VALUES (?, ?, '036009', 'LCD SAM A13/M13/F13 BLINDE', 1, 2000, 1400, 2000)
    `).run(repId, prodId);
    console.log('✅ Réparation SAV riche REP-036009 insérée avec succès !');
  }

  persistToDisk();
  console.log('💾 Données persistées avec succès sur disque.');
  console.log('=== Fin du seed de test ===');
}

seedTest().catch(console.error);
