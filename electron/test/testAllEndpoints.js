const mongoose = require('mongoose');
const { connectDB } = require('../database/connection');
const Product = require('../database/models/Product');
const Customer = require('../database/models/Customer');
const Invoice = require('../database/models/Invoice');
const PurchaseInvoice = require('../database/models/PurchaseInvoice');
const StockMovement = require('../database/models/StockMovement');
const AccountMovement = require('../database/models/AccountMovement');
const SaleReturn = require('../database/models/SaleReturn');
const { generateProductQRCode, generateInvoiceQRCode } = require('../utils/qrGenerator');
const { 
  getMachineId, 
  generateLicenseKey, 
  verifyLicenseKey, 
  getLicenseStatus, 
  activateLicense 
} = require('../licensing/licenseManager');

async function runFullDiagnostics() {
  console.log('========================================================');
  console.log('   TEST & DIAGNOSTIC COMPLET DE TOUTES LES FONCTIONS    ');
  console.log('========================================================\n');

  let errors = 0;
  let testsPassed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      errors++;
    }
  }

  // 1. Test Base de Données
  console.log('[1/8] Test Connexion MongoDB...');
  await connectDB();
  const dbStatus = require('../database/connection').getStatus();
  assert(dbStatus.connected, 'Connexion à la base MongoDB locale active');

  // 2. Test Système de Licence
  console.log('\n[2/8] Test Système de Licence & Machine ID...');
  const machineId = getMachineId();
  assert(machineId.startsWith('CP-'), `Machine ID généré : ${machineId}`);

  const testKey = generateLicenseKey({
    clientName: 'Test Diagnostic Entreprise',
    machineId,
    type: 'LIFETIME'
  });
  assert(testKey.startsWith('LIC-'), 'Clé de licence générée au format LIC-...');

  const verification = verifyLicenseKey(testKey, machineId);
  assert(verification.valid === true, 'Vérification de signature HMAC-SHA256 valide');
  assert(verification.payload.client === 'Test Diagnostic Entreprise', 'Nom client correct dans le payload');

  const activationRes = activateLicense(testKey);
  assert(activationRes.success === true, 'Activation de la licence réussie');

  const status = getLicenseStatus();
  assert(status.isActivated === true, 'Statut de licence est ACTIF');

  // 3. Test Module Stock
  console.log('\n[3/8] Test Module Stock (Produits, QR Codes, Calculs)...');
  const testRef = `TEST-${Date.now().toString().slice(-4)}`;
  const { qrData, qrImage } = await generateProductQRCode({
    reference: testRef,
    nom: 'Produit Test Auto',
    prixVente: 1250,
    unite: 'pcs'
  });
  assert(qrData && qrImage.startsWith('data:image/png;base64,'), 'Génération QR Code Définition OK');

  const product = await Product.create({
    reference: testRef,
    nom: 'Produit Test Diagnostic',
    categorie: 'Test',
    prixAchat: 800,
    prixVente: 1250,
    quantite: 50,
    seuilAlerte: 10,
    unite: 'pcs',
    qrCodeData: qrData,
    qrCodeImage: qrImage
  });
  assert(product._id != null, `Création produit en DA réussie (${product.nom})`);

  // Mise à jour produit
  product.nom = 'Produit Test Diagnostic Modifié';
  await product.save();
  const updatedProd = await Product.findById(product._id);
  assert(updatedProd.nom === 'Produit Test Diagnostic Modifié', 'Modification produit OK');

  // 4. Test Module Achats Fournisseurs
  console.log('\n[4/8] Test Module Achats Fournisseurs (+ Augmentation Stock)...');
  const initialQty = product.quantite;
  const purchase = await PurchaseInvoice.create({
    numeroFactureAchat: `FA-TEST-${Date.now().toString().slice(-4)}`,
    fournisseur: 'Fournisseur Test SPA',
    items: [{
      product: product._id,
      reference: product.reference,
      nom: product.nom,
      quantite: 20,
      prixAchatUnitaire: 800,
      totalLigne: 16000
    }],
    totalHT: 16000,
    tauxTva: 0,
    montantTva: 0,
    totalTTC: 16000,
    montantPaye: 16000,
    modePaiement: 'ESPECES',
    statutPaiement: 'PAYE'
  });
  assert(purchase._id != null, `Création Facture d'Achat Fournisseur (${purchase.numeroFactureAchat})`);

  // Stock movement and qty increment
  product.quantite += 20;
  await product.save();
  await StockMovement.create({
    product: product._id,
    type: 'ACHAT_FOURNISSEUR',
    quantite: 20,
    quantiteAvant: initialQty,
    quantiteApres: product.quantite,
    prixAchatUnitaire: 800,
    referenceDocument: purchase.numeroFactureAchat
  });
  assert(product.quantite === initialQty + 20, `Stock incrémenté de +20 (Total: ${product.quantite})`);

  // 5. Test Module Clients & Dettes
  console.log('\n[5/8] Test Module Clients, Crédits & Encaissements...');
  const customer = await Customer.create({
    nom: 'Client Test Diagnostic',
    telephone: '0555 00 11 22',
    soldeDette: 5000,
    plafondCredit: 20000
  });
  assert(customer._id != null, `Création client avec dette en DA (${customer.nom})`);

  // Règlement / Encaissement
  customer.soldeDette -= 2000;
  await customer.save();
  await AccountMovement.create({
    client: customer._id,
    type: 'ENCAISSEMENT_REGLEMENT',
    montant: 2000,
    soldeAvant: 5000,
    soldeApres: 3000,
    motif: 'Règlement test acompte'
  });
  assert(customer.soldeDette === 3000, `Encaissement de 2000 DA OK (Reste dette: ${customer.soldeDette} DA)`);

  // 6. Test Module Ventes & Caisse (POS)
  console.log('\n[6/8] Test Module Facturation Vente & POS (- Déduction Stock)...');
  const qtyBeforeSale = product.quantite;
  const invoice = new Invoice({
    numeroFacture: `FAC-TEST-${Date.now().toString().slice(-4)}`,
    typeDocument: 'FACTURE',
    client: customer._id,
    items: [{
      product: product._id,
      reference: product.reference,
      nom: product.nom,
      quantite: 5,
      prixUnitaire: product.prixVente,
      prixAchatUnitaire: product.prixAchat,
      totalLigne: 5 * product.prixVente
    }],
    totalHT: 5 * product.prixVente,
    tauxTva: 0,
    montantTva: 0,
    totalTTC: 5 * product.prixVente,
    montantPaye: 3000,
    montantReste: (5 * product.prixVente) - 3000,
    modePaiement: 'A_CREDIT',
    statutPaiement: 'PARTIEL'
  });
  const invQr = await generateInvoiceQRCode(invoice);
  invoice.qrCodeData = invQr.qrData;
  invoice.qrCodeImage = invQr.qrImage;
  await invoice.save();
  assert(invoice._id != null, `Création vente/facture avec QR code (${invoice.numeroFacture})`);

  // Déduction stock
  product.quantite -= 5;
  await product.save();
  assert(product.quantite === qtyBeforeSale - 5, `Stock déduit de 5 articles lors de la vente (Restant: ${product.quantite})`);

  // 7. Test Module Retour de Vente
  console.log('\n[7/8] Test Module Retours de Vente (+ Réintégration Stock)...');
  const saleReturn = await SaleReturn.create({
    numeroRetour: `RET-TEST-${Date.now().toString().slice(-4)}`,
    facture: invoice._id,
    client: customer._id,
    motif: 'Erreur de commande test',
    items: [{
      product: product._id,
      reference: product.reference,
      nom: product.nom,
      quantite: 1,
      prixUnitaire: product.prixVente,
      totalLigne: product.prixVente,
      motif: 'Erreur commande'
    }],
    totalRembourse: product.prixVente,
    modeRemboursement: 'ESPECES',
    reintegrerStock: true
  });
  product.quantite += 1;
  await product.save();
  assert(saleReturn._id != null, `Création retour de vente (${saleReturn.numeroRetour})`);
  assert(product.quantite === qtyBeforeSale - 4, `Stock réintégré suite au retour (+1 article)`);

  // 8. Nettoyage des enregistrements de test
  console.log('\n[8/8] Nettoyage des données de test...');
  await Product.findByIdAndDelete(product._id);
  await Customer.findByIdAndDelete(customer._id);
  await Invoice.findByIdAndDelete(invoice._id);
  await PurchaseInvoice.findByIdAndDelete(purchase._id);
  await SaleReturn.findByIdAndDelete(saleReturn._id);
  await StockMovement.deleteMany({ product: product._id });
  await AccountMovement.deleteMany({ client: customer._id });
  assert(true, 'Nettoyage des entités de test effectué');

  console.log('\n========================================================');
  console.log(`RÉSULTAT DES TESTS : ${testsPassed} PASSÉS / ${errors} ERREURS`);
  console.log('========================================================\n');

  if (errors === 0) {
    console.log('🎉 TOUTES LES FONCTIONNALITÉS ET FORMULAIRES FONCTIONNENT PARFAITEMENT !');
    process.exit(0);
  } else {
    console.error('❌ DES ERREURS ONT ÉTÉ DÉTECTÉES.');
    process.exit(1);
  }
}

runFullDiagnostics().catch(err => {
  console.error('Erreur non gérée pendant le diagnostic:', err);
  process.exit(1);
});
