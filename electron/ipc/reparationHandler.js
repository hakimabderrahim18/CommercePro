const { ipcMain, dialog } = require('electron');
const { getDB } = require('../database/sqlite');
const { logAudit } = require('./authHandler');

function generateReparationNumber() {
  const db = getDB();
  const year = new Date().getFullYear();
  const prefix = `REP-${year}-`;
  
  const last = db.prepare(`
    SELECT numeroReparation FROM reparations 
    WHERE numeroReparation LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let seq = 1;
  if (last && last.numeroReparation) {
    const parts = last.numeroReparation.split('-');
    if (parts.length >= 3) {
      seq = parseInt(parts[2], 10) + 1;
    }
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/**
 * Traite la sortie d'atelier / livraison d'une réparation :
 * 1. La somme va en caisse (cash_transactions avec type ENCAISSEMENT et caisse active)
 * 2. Le gain main d'œuvre va au compte du technicien (technician_movements et users.soldeTechnicien)
 * 3. Le statut passe à LIVRE avec horodatage de livraison (pris en compte dans le chiffre total)
 */
function processReparationExit(db, repId, options = {}, currentUser = null) {
  const rep = db.prepare('SELECT * FROM reparations WHERE id = ?').get(repId);
  if (!rep) return null;

  // 0. Réévaluation éventuelle de la main d'œuvre, des pièces et du réparateur choisi
  const piecesSum = db.prepare('SELECT COALESCE(SUM(totalLigne), 0) as tot FROM reparation_pieces WHERE reparation_id = ?').get(repId);
  const coutPieces = Number(piecesSum?.tot || rep.coutPieces || 0);

  const coutMainOeuvre = options.coutMainOeuvre !== undefined && options.coutMainOeuvre !== null
    ? Math.max(0, Number(options.coutMainOeuvre) || 0)
    : Number(rep.coutMainOeuvre || 0);

  const reparateur_id = options.reparateur_id !== undefined ? options.reparateur_id : rep.reparateur_id;
  const reparateurNom = options.reparateurNom !== undefined ? options.reparateurNom : rep.reparateurNom;

  const totalTTC = Math.round((coutPieces + coutMainOeuvre) * 100) / 100;
  const montantPayeExistant = Math.round(Number(rep.montantPaye || 0) * 100) / 100;
  const activeCaisse = options.caisse || rep.caisse || currentUser?.caisse || 'Caisse 1 (Magasin)';
  const activeMode = options.modePaiement || rep.modePaiement || 'ESPECES';

  // Montant restant dû sur cette réparation
  const soldeRestant = Math.max(0, Math.round((totalTTC - montantPayeExistant) * 100) / 100);

  let payeMaintenant = 0;
  if (options.montantRegle !== undefined && options.montantRegle !== null && options.montantRegle !== '') {
    payeMaintenant = Math.max(0, Number(options.montantRegle) || 0);
  } else {
    // Par défaut, lors de la sortie d'atelier, on encaisse le solde restant
    payeMaintenant = soldeRestant;
  }

  const nouveauMontantPaye = Math.round((montantPayeExistant + payeMaintenant) * 100) / 100;
  const nouveauMontantReste = Math.max(0, Math.round((totalTTC - nouveauMontantPaye) * 100) / 100);

  // 1. FLUX FINANCIER VERS LA CAISSE (cash_transactions)
  if (payeMaintenant > 0) {
    const txNum = `ENC-SAV-${Date.now().toString().slice(-6)}`;
    db.prepare(`
      INSERT INTO cash_transactions (
        numeroTransaction, type, categorie, montant, modePaiement,
        client_id, tiers, referenceDocument, motif, caisse, dateTransaction
      ) VALUES (?, 'ENCAISSEMENT', 'LIVRAISON_SAV', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      txNum, payeMaintenant, activeMode,
      rep.client_id || null, rep.clientNom, rep.numeroReparation,
      `Sortie atelier / Règlement réparation ${rep.numeroReparation} (${rep.appareilType} ${rep.marque} ${rep.modele})`,
      activeCaisse
    );
  }

  // Si dette client restante et client identifié, enregistrer en compte client
  if (nouveauMontantReste > 0 && rep.client_id) {
    const alreadyDebited = db.prepare(`
      SELECT id FROM account_movements 
      WHERE client_id = ? AND referenceFacture = ? AND type = 'VENTE_CREDIT'
    `).get(rep.client_id, rep.numeroReparation);

    if (!alreadyDebited) {
      const client = db.prepare('SELECT * FROM customers WHERE id = ?').get(rep.client_id);
      if (client) {
        const soldeAvant = Number(client.soldeDette || 0);
        const soldeApres = Math.round((soldeAvant + nouveauMontantReste) * 100) / 100;
        db.prepare('UPDATE customers SET soldeDette = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(soldeApres, rep.client_id);

        db.prepare(`
          INSERT INTO account_movements (client_id, type, montant, soldeAvant, soldeApres, referenceFacture, motif)
          VALUES (?, 'VENTE_CREDIT', ?, ?, ?, ?, ?)
        `).run(
          rep.client_id, nouveauMontantReste, soldeAvant, soldeApres,
          rep.numeroReparation, `Reste à payer sortie atelier ${rep.numeroReparation}`
        );
      }
    }
  }

  // 2. VERS LE COMPTE DU TECHNICIEN (technician_movements et users.soldeTechnicien)
  let techCredite = rep.technicienCredite || 0;
  const shouldCreditTech = options.crediterTechnicien !== false;

  if (shouldCreditTech && !techCredite && reparateur_id) {
    const alreadyCredited = db.prepare(`
      SELECT id FROM technician_movements 
      WHERE reparation_id = ? AND type = 'GAIN_REPARATION'
    `).get(rep.id);

    if (!alreadyCredited) {
      const tech = db.prepare('SELECT id, nom, COALESCE(soldeTechnicien, 0) as solde FROM users WHERE id = ?').get(reparateur_id);
      if (tech) {
        // Gain du technicien : commission spécifique OU coût main d'œuvre OU totalTTC s'il n'y a pas de pièces
        const gainTech = Number(options.commissionTechnicien || rep.commissionTechnicien || 0) > 0
          ? Number(options.commissionTechnicien || rep.commissionTechnicien)
          : (coutMainOeuvre > 0 
              ? coutMainOeuvre 
              : (coutPieces === 0 ? totalTTC : 0));

        if (gainTech > 0) {
          const soldeAvant = Number(tech.solde || 0);
          const soldeApres = Math.round((soldeAvant + gainTech) * 100) / 100;

          db.prepare('UPDATE users SET soldeTechnicien = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(soldeApres, tech.id);

          db.prepare(`
            INSERT INTO technician_movements (
              technician_id, reparation_id, type, montant, soldeAvant, soldeApres,
              referenceDocument, motif, caisse, dateMouvement
            ) VALUES (?, ?, 'GAIN_REPARATION', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            tech.id, rep.id, gainTech, soldeAvant, soldeApres,
            rep.numeroReparation,
            `Gain MO sortie atelier : ${rep.numeroReparation} (${rep.appareilType} ${rep.marque} ${rep.modele})`,
            activeCaisse
          );

          techCredite = 1;
        }
      }
    } else {
      techCredite = 1;
    }
  }

  // 3. MISE A JOUR DU STATUT LIVRE & DATE DE LIVRAISON (Prise en compte dans le chiffre d'affaires total)
  db.prepare(`
    UPDATE reparations 
    SET statut = 'LIVRE',
        coutPieces = ?,
        coutMainOeuvre = ?,
        totalTTC = ?,
        montantPaye = ?,
        montantReste = ?,
        modePaiement = ?,
        caisse = ?,
        reparateur_id = ?,
        reparateurNom = ?,
        technicienCredite = ?,
        dateLivraison = COALESCE(dateLivraison, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    coutPieces, coutMainOeuvre, totalTTC,
    nouveauMontantPaye, nouveauMontantReste,
    activeMode, activeCaisse,
    reparateur_id, reparateurNom,
    techCredite, repId
  );

  logAudit(db, {
    userId: currentUser?.id,
    username: currentUser?.username || 'Utilisateur',
    action: 'SORTIE_ATELIER_LIVRAISON',
    module: 'REPARATION',
    reference: rep.numeroReparation,
    caisse: activeCaisse,
    details: `Sortie atelier de ${rep.appareilType} ${rep.marque} ${rep.modele}. Encaissé en caisse (${activeCaisse}): ${payeMaintenant} DA, Technicien crédité: ${rep.reparateurNom || 'Non assigné'}`
  });

  const updated = db.prepare('SELECT * FROM reparations WHERE id = ?').get(repId);
  const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ? ORDER BY id ASC').all(repId);
  return { ...updated, pieces };
}

function registerReparationHandlers(mainWindow) {
  const db = getDB();

  // 1. Obtenir toutes les réparations avec filtres
  ipcMain.handle('reparation:getAll', async (event, filters = {}) => {
    try {
      let query = `
        SELECT r.*, c.telephone as client_tel_db, c.adresse as client_adresse
        FROM reparations r
        LEFT JOIN customers c ON r.client_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.statut && filters.statut !== 'TOUS') {
        query += ` AND r.statut = ?`;
        params.push(filters.statut);
      }

      if (filters.reparateur_id) {
        query += ` AND r.reparateur_id = ?`;
        params.push(filters.reparateur_id);
      }

      if (filters.caisse && filters.caisse !== 'TOUS') {
        query += ` AND r.caisse = ?`;
        params.push(filters.caisse);
      }

      if (filters.search && filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query += ` AND (
          r.numeroReparation LIKE ? OR 
          r.clientNom LIKE ? OR 
          r.clientTelephone LIKE ? OR 
          r.marque LIKE ? OR 
          r.modele LIKE ? OR 
          r.numeroSerie LIKE ? OR 
          r.panneDeclaree LIKE ?
        )`;
        params.push(term, term, term, term, term, term, term);
      }

      query += ` ORDER BY r.id DESC`;

      const list = db.prepare(query).all(...params);

      // Charger les pièces pour chaque réparation si demandé ou nécessaire
      const stmtPieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ? ORDER BY id ASC');
      const enriched = list.map(rep => {
        const pieces = stmtPieces.all(rep.id);
        return { ...rep, pieces };
      });

      return { success: true, data: enriched };
    } catch (error) {
      console.error('Erreur reparation:getAll', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Obtenir une réparation par ID
  ipcMain.handle('reparation:getById', async (event, id) => {
    try {
      if (!id) return { success: false, error: 'ID requis' };
      const rep = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      if (!rep) return { success: false, error: 'Réparation introuvable' };

      const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ? ORDER BY id ASC').all(id);
      return { success: true, data: { ...rep, pieces } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 3. Section Réception : Créer une nouvelle fiche de réparation
  ipcMain.handle('reparation:create', async (event, data, currentUser) => {
    try {
      const {
        client_id,
        clientNom,
        clientTelephone = '',
        appareilType = 'Smartphone',
        marque = '',
        modele = '',
        numeroSerie = '',
        motDePasseAppareil = '',
        accessoires = '',
        panneDeclaree,
        estimationDevis = 0,
        acomptePaye = 0,
        modePaiement = 'ESPECES',
        reparateur_id = null,
        reparateurNom = '',
        caisse = currentUser?.caisse || 'Caisse 1 (Magasin)',
        notes = ''
      } = data || {};

      if (!clientNom || !clientNom.trim()) {
        return { success: false, error: 'Le nom du client est obligatoire.' };
      }
      if (!panneDeclaree || !panneDeclaree.trim()) {
        return { success: false, error: 'La description de la panne est obligatoire.' };
      }

      const numRep = generateReparationNumber();
      const acompte = Math.max(0, Number(acomptePaye) || 0);
      const devis = Math.max(0, Number(estimationDevis) || 0);

      const createTx = db.transaction(() => {
        const res = db.prepare(`
          INSERT INTO reparations (
            numeroReparation, client_id, clientNom, clientTelephone, appareilType,
            marque, modele, numeroSerie, motDePasseAppareil, accessoires,
            panneDeclaree, statut, estimationDevis, coutMainOeuvre, coutPieces,
            totalTTC, acomptePaye, montantPaye, montantReste, modePaiement,
            reparateur_id, reparateurNom, caisse, notes, dateReception
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, 'RECEPTIONNE', ?, 0, 0,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, CURRENT_TIMESTAMP
          )
        `).run(
          numRep, client_id || null, clientNom.trim(), clientTelephone.trim(), appareilType.trim(),
          marque.trim(), modele.trim(), numeroSerie.trim(), motDePasseAppareil.trim(), accessoires.trim(),
          panneDeclaree.trim(), devis,
          devis, acompte, acompte, Math.max(0, devis - acompte), modePaiement,
          reparateur_id || null, reparateurNom || '', caisse, notes.trim()
        );

        const repId = res.lastInsertRowid;

        // Si un acompte est versé, enregistrer immédiatement dans la caisse correspondante
        if (acompte > 0) {
          const txNum = `ENC-ACOMPTE-${Date.now().toString().slice(-6)}`;
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement,
              client_id, tiers, referenceDocument, motif, caisse, dateTransaction
            ) VALUES (?, 'ENCAISSEMENT', 'ACOMPTE_SAV', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            txNum, acompte, modePaiement,
            client_id || null, clientNom.trim(), numRep,
            `Acompte réparation ${numRep} (${appareilType} ${marque} ${modele})`,
            caisse
          );
        }

        // Journal d'audit
        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Utilisateur',
          action: 'RECEPTION_REPARATION',
          module: 'REPARATION',
          reference: numRep,
          caisse,
          details: `Réception ${appareilType} ${marque} ${modele} pour ${clientNom.trim()} (Acompte: ${acompte} DA)`
        });

        return repId;
      });

      const newId = createTx();
      const created = db.prepare('SELECT * FROM reparations WHERE id = ?').get(newId);

      return { success: true, data: { ...created, pieces: [] } };
    } catch (error) {
      console.error('Erreur reparation:create', error);
      return { success: false, error: error.message };
    }
  });

  // 4. Mettre à jour les informations d'une réparation (Diagnostic, assignation, notes, statut)
  ipcMain.handle('reparation:update', async (event, { id, updates }, currentUser) => {
    try {
      if (!id) return { success: false, error: 'ID requis' };
      const current = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      if (!current) return { success: false, error: 'Fiche réparation introuvable' };

      const statut = updates.statut !== undefined ? updates.statut : current.statut;
      const clientNom = updates.clientNom !== undefined ? updates.clientNom : current.clientNom;
      const clientTelephone = updates.clientTelephone !== undefined ? updates.clientTelephone : current.clientTelephone;
      const appareilType = updates.appareilType !== undefined ? updates.appareilType : current.appareilType;
      const marque = updates.marque !== undefined ? updates.marque : current.marque;
      const modele = updates.modele !== undefined ? updates.modele : current.modele;
      const numeroSerie = updates.numeroSerie !== undefined ? updates.numeroSerie : current.numeroSerie;
      const motDePasseAppareil = updates.motDePasseAppareil !== undefined ? updates.motDePasseAppareil : current.motDePasseAppareil;
      const accessoires = updates.accessoires !== undefined ? updates.accessoires : current.accessoires;
      const panneDeclaree = updates.panneDeclaree !== undefined ? updates.panneDeclaree : current.panneDeclaree;
      const estimationDevis = updates.estimationDevis !== undefined ? Number(updates.estimationDevis) : current.estimationDevis;
      const acomptePaye = updates.acomptePaye !== undefined ? Number(updates.acomptePaye) : current.acomptePaye;
      const constatTechnique = updates.constatTechnique !== undefined ? updates.constatTechnique : current.constatTechnique;
      const coutMainOeuvre = updates.coutMainOeuvre !== undefined ? Number(updates.coutMainOeuvre) : current.coutMainOeuvre;
      const reparateur_id = updates.reparateur_id !== undefined ? updates.reparateur_id : current.reparateur_id;
      const reparateurNom = updates.reparateurNom !== undefined ? updates.reparateurNom : current.reparateurNom;
      const notes = updates.notes !== undefined ? updates.notes : current.notes;
      const caisse = updates.caisse !== undefined ? updates.caisse : current.caisse;

      // Recalculer le total
      const totalTTC = Math.round((coutMainOeuvre + Number(current.coutPieces || 0)) * 100) / 100;
      const montantPaye = updates.montantPaye !== undefined ? Number(updates.montantPaye) : Math.max(Number(current.montantPaye || 0), acomptePaye);
      const montantReste = Math.max(0, Math.round((totalTTC - montantPaye) * 100) / 100);

      let dateDiag = current.dateDiagnostic;
      if (statut === 'DIAGNOSTIC' && !dateDiag) {
        dateDiag = new Date().toISOString();
      }

      let dateRep = current.dateReparation;
      if ((statut === 'REPARE' || statut === 'IRREPARABLE') && !dateRep) {
        dateRep = new Date().toISOString();
      }

      db.prepare(`
        UPDATE reparations 
        SET statut = ?, clientNom = ?, clientTelephone = ?, appareilType = ?,
            marque = ?, modele = ?, numeroSerie = ?, motDePasseAppareil = ?,
            accessoires = ?, panneDeclaree = ?, estimationDevis = ?, acomptePaye = ?,
            constatTechnique = ?, coutMainOeuvre = ?, totalTTC = ?,
            montantPaye = ?, montantReste = ?, reparateur_id = ?, reparateurNom = ?,
            notes = ?, caisse = ?, dateDiagnostic = COALESCE(?, dateDiagnostic),
            dateReparation = COALESCE(?, dateReparation), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        statut, clientNom, clientTelephone, appareilType,
        marque, modele, numeroSerie, motDePasseAppareil,
        accessoires, panneDeclaree, estimationDevis, acomptePaye,
        constatTechnique, coutMainOeuvre, totalTTC,
        montantPaye, montantReste, reparateur_id, reparateurNom,
        notes, caisse, dateDiag, dateRep, id
      );

      // Si le statut passe à LIVRE (sortie d'atelier), traiter immédiatement le flux financier et technicien
      if (statut === 'LIVRE' && current.statut !== 'LIVRE') {
        const exitData = processReparationExit(db, id, {
          montantRegle: updates.montantRegle,
          modePaiement: updates.modePaiement || current.modePaiement,
          caisse: caisse || current.caisse
        }, currentUser);
        return { success: true, data: exitData, message: 'Appareil sorti d’atelier et livré avec succès.' };
      }

      logAudit(db, {
        userId: currentUser?.id,
        username: currentUser?.username || 'Utilisateur',
        action: 'MODIFICATION_REPARATION',
        module: 'REPARATION',
        reference: current.numeroReparation,
        caisse,
        details: `Statut: ${statut}, MO: ${coutMainOeuvre} DA, Technicien: ${reparateurNom || 'Non assigné'}`
      });

      const updated = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ?').all(id);

      return { success: true, data: { ...updated, pieces } };
    } catch (error) {
      console.error('Erreur reparation:update', error);
      return { success: false, error: error.message };
    }
  });

  // 4b. Changement rapide de statut (ex: Stepper, Kanban Drag&Drop, Liste)
  ipcMain.handle('reparation:updateStatus', async (event, { id, statut }, currentUser) => {
    try {
      if (!id || !statut) return { success: false, error: 'ID et statut requis.' };
      const current = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      if (!current) return { success: false, error: 'Réparation introuvable.' };

      // Si l'objet sort d'atelier (passe à LIVRE)
      if (statut === 'LIVRE' && current.statut !== 'LIVRE') {
        const exitData = processReparationExit(db, id, {}, currentUser);
        return { success: true, data: exitData, message: 'Appareil sorti d’atelier et livré avec succès.' };
      }

      let dateDiag = current.dateDiagnostic;
      if (statut === 'DIAGNOSTIC' && !dateDiag) dateDiag = new Date().toISOString();

      let dateRep = current.dateReparation;
      if ((statut === 'REPARE' || statut === 'IRREPARABLE') && !dateRep) dateRep = new Date().toISOString();

      db.prepare(`
        UPDATE reparations 
        SET statut = ?, dateDiagnostic = COALESCE(?, dateDiagnostic), dateReparation = COALESCE(?, dateReparation), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(statut, dateDiag, dateRep, id);

      logAudit(db, {
        userId: currentUser?.id,
        username: currentUser?.username || 'Utilisateur',
        action: 'CHANGEMENT_STATUT_REPARATION',
        module: 'REPARATION',
        reference: current.numeroReparation,
        caisse: current.caisse || '',
        details: `Nouveau statut: ${statut}`
      });

      const updated = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ? ORDER BY id ASC').all(id);
      return { success: true, data: { ...updated, pieces } };
    } catch (error) {
      console.error('Erreur reparation:updateStatus', error);
      return { success: false, error: error.message };
    }
  });

  // 5. Section Atelier : Ajouter une pièce détachée -> RETIRE AUTOMATIQUEMENT DU STOCK
  ipcMain.handle('reparation:addPiece', async (event, { reparationId, productId, quantite = 1, prixUnitaire = null }, currentUser) => {
    try {
      if (!reparationId || !productId) {
        return { success: false, error: 'Réparation et article requis.' };
      }

      const rep = db.prepare('SELECT * FROM reparations WHERE id = ?').get(reparationId);
      if (!rep) return { success: false, error: 'Fiche réparation introuvable' };

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!product) return { success: false, error: 'Article/Pièce introuvable en stock' };

      const qte = Math.max(1, Number(quantite) || 1);
      const pu = prixUnitaire !== null && prixUnitaire !== undefined 
        ? Number(prixUnitaire) 
        : Number(product.prixVente || 0);
      const puAchat = Number(product.prixAchat || 0);
      const totalLigne = Math.round((qte * pu) * 100) / 100;

      const addPieceTx = db.transaction(() => {
        // 1. Déduire la pièce du stock automatiquement
        const stockAvant = Number(product.quantite || 0);
        const stockApres = Math.max(0, stockAvant - qte);

        db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(stockApres, product.id);

        // 2. Enregistrer le mouvement de stock (SORTIE: quantité négative -qte)
        const docRef = rep.numeroReparation || `REP-${rep.id}`;
        db.prepare(`
          INSERT INTO stock_movements (
            product_id, type, quantite, quantiteAvant, quantiteApres,
            prixAchatUnitaire, referenceDocument, motif, dateMouvement
          ) VALUES (?, 'PIECE_REPARATION_SAV', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          product.id, -qte, stockAvant, stockApres,
          puAchat, docRef,
          `Pièce atelier SAV pour réparation ${docRef} (${product.nom})`
        );

        // 3. Enregistrer la ligne dans reparation_pieces
        db.prepare(`
          INSERT INTO reparation_pieces (
            reparation_id, product_id, reference, nom, quantite,
            prixUnitaire, prixAchatUnitaire, totalLigne, retireDuStock
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          reparationId, product.id, product.reference || '', product.nom,
          qte, pu, puAchat, totalLigne
        );

        // 4. Recalculer le total des pièces et de la réparation
        const allPieces = db.prepare('SELECT COALESCE(SUM(totalLigne), 0) as totalPieces FROM reparation_pieces WHERE reparation_id = ?').get(reparationId);
        const coutPieces = Number(allPieces.totalPieces || 0);
        const coutMO = Number(rep.coutMainOeuvre || 0);
        const totalTTC = Math.round((coutPieces + coutMO) * 100) / 100;
        const montantPaye = Number(rep.montantPaye || 0);
        const montantReste = Math.max(0, Math.round((totalTTC - montantPaye) * 100) / 100);

        // Si la réparation était en attente ou réceptionnée, passer automatiquement en cours de réparation
        let statut = rep.statut;
        if (statut === 'RECEPTIONNE' || statut === 'DIAGNOSTIC' || statut === 'ATTENTE_PIECE') {
          statut = 'EN_REPARATION';
        }

        db.prepare(`
          UPDATE reparations 
          SET coutPieces = ?, totalTTC = ?, montantReste = ?, statut = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(coutPieces, totalTTC, montantReste, statut, reparationId);

        // 5. Journal d'audit
        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Technicien',
          action: 'AJOUT_PIECE_REPARATION',
          module: 'REPARATION',
          reference: rep.numeroReparation,
          caisse: rep.caisse || '',
          details: `Ajout de ${qte} x ${product.nom} (Retiré du stock: ${stockAvant} -> ${stockApres})`
        });
      });

      addPieceTx();

      const updated = db.prepare('SELECT * FROM reparations WHERE id = ?').get(reparationId);
      const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ? ORDER BY id ASC').all(reparationId);

      return { success: true, data: { ...updated, pieces }, message: 'Pièce ajoutée et déduite du stock.' };
    } catch (error) {
      console.error('Erreur reparation:addPiece', error);
      return { success: false, error: error.message };
    }
  });

  // 6. Section Atelier : Retirer une pièce détachée -> RESTITUE AUTOMATIQUEMENT AU STOCK
  ipcMain.handle('reparation:removePiece', async (event, { pieceId, reparationId }, currentUser) => {
    try {
      if (!pieceId || !reparationId) {
        return { success: false, error: 'Paramètres manquants' };
      }

      const piece = db.prepare('SELECT * FROM reparation_pieces WHERE id = ? AND reparation_id = ?').get(pieceId, reparationId);
      if (!piece) return { success: false, error: 'Ligne pièce introuvable' };

      const rep = db.prepare('SELECT * FROM reparations WHERE id = ?').get(reparationId);

      const removePieceTx = db.transaction(() => {
        // Restituer le stock si elle avait été retirée
        if (piece.product_id && piece.retireDuStock) {
          const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(piece.product_id);
          if (prod) {
            const stockAvant = Number(prod.quantite || 0);
            const stockApres = stockAvant + Number(piece.quantite || 1);

            db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(stockApres, prod.id);

            db.prepare(`
              INSERT INTO stock_movements (
                product_id, type, quantite, quantiteAvant, quantiteApres,
                prixAchatUnitaire, referenceDocument, motif, dateMouvement
              ) VALUES (?, 'ANNULATION_REPARATION', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(
              prod.id, piece.quantite, stockAvant, stockApres,
              piece.prixAchatUnitaire || 0, rep?.numeroReparation || '',
              `Annulation pièce réparation ${rep?.numeroReparation || ''} (${piece.nom})`
            );
          }
        }

        db.prepare('DELETE FROM reparation_pieces WHERE id = ?').run(pieceId);

        // Recalculer totaux
        const allPieces = db.prepare('SELECT COALESCE(SUM(totalLigne), 0) as totalPieces FROM reparation_pieces WHERE reparation_id = ?').get(reparationId);
        const coutPieces = Number(allPieces.totalPieces || 0);
        const coutMO = Number(rep?.coutMainOeuvre || 0);
        const totalTTC = Math.round((coutPieces + coutMO) * 100) / 100;
        const montantPaye = Number(rep?.montantPaye || 0);
        const montantReste = Math.max(0, Math.round((totalTTC - montantPaye) * 100) / 100);

        db.prepare(`
          UPDATE reparations 
          SET coutPieces = ?, totalTTC = ?, montantReste = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(coutPieces, totalTTC, montantReste, reparationId);

        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Technicien',
          action: 'RETRAIT_PIECE_REPARATION',
          module: 'REPARATION',
          reference: rep?.numeroReparation || '',
          details: `Suppression de ${piece.quantite} x ${piece.nom} et réintégration en stock`
        });
      });

      removePieceTx();

      const updated = db.prepare('SELECT * FROM reparations WHERE id = ?').get(reparationId);
      const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ? ORDER BY id ASC').all(reparationId);

      return { success: true, data: { ...updated, pieces } };
    } catch (error) {
      console.error('Erreur reparation:removePiece', error);
      return { success: false, error: error.message };
    }
  });

  // 7. Section Livraison : Sortie du produit réparé avec paiement, caisse, technicien et bon de livraison
  ipcMain.handle('reparation:deliver', async (event, data, currentUser) => {
    try {
      const {
        id,
        montantRegle,
        modePaiement = 'ESPECES',
        caisse = null,
        coutMainOeuvre = null,
        reparateur_id = null,
        reparateurNom = null,
        crediterTechnicien = true
      } = data || {};

      if (!id) return { success: false, error: 'ID requis' };
      const rep = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      if (!rep) return { success: false, error: 'Réparation introuvable' };

      const deliverTx = db.transaction(() => {
        return processReparationExit(db, id, {
          montantRegle,
          modePaiement,
          caisse,
          coutMainOeuvre,
          reparateur_id,
          reparateurNom,
          crediterTechnicien
        }, currentUser);
      });

      const res = deliverTx();
      if (!res) return { success: false, error: 'Erreur lors de la sortie d’atelier.' };

      return { success: true, data: res, message: 'Produit réparé sorti d’atelier et livré avec succès.' };
    } catch (error) {
      console.error('Erreur reparation:deliver', error);
      return { success: false, error: error.message };
    }
  });

  // 8. Bon de livraison en tant que Retour (ex: quantité -1, retour garantie)
  ipcMain.handle('reparation:createReturn', async (event, { id, motif = '', restitutionPieces = true, montantRembourse = 0, modePaiement = 'ESPECES', caisse = null }, currentUser) => {
    try {
      if (!id) return { success: false, error: 'ID requis' };
      const rep = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      if (!rep) return { success: false, error: 'Réparation introuvable' };

      const activeCaisse = caisse || currentUser?.caisse || rep.caisse || 'Caisse 1 (Magasin)';
      const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ?').all(id);
      const remboursement = Math.max(0, Number(montantRembourse) || 0);

      const returnTx = db.transaction(() => {
        // Si restitution des pièces au stock demandée
        if (restitutionPieces) {
          for (const piece of pieces) {
            if (piece.product_id && piece.retireDuStock) {
              const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(piece.product_id);
              if (prod) {
                const stockAvant = Number(prod.quantite || 0);
                const stockApres = stockAvant + Number(piece.quantite || 1);

                db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                  .run(stockApres, prod.id);

                db.prepare(`
                  INSERT INTO stock_movements (
                    product_id, type, quantite, quantiteAvant, quantiteApres,
                    prixAchatUnitaire, referenceDocument, motif, dateMouvement
                  ) VALUES (?, 'RETOUR_SAV', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(
                  prod.id, Math.abs(Number(piece.quantite) || 1), stockAvant, stockApres,
                  piece.prixAchatUnitaire || 0, rep.numeroReparation,
                  `Restitution pièce au stock (SAV ${rep.numeroReparation}): ${piece.nom}`
                );
              }
            }
          }
        }

        // Si remboursement client, décaisser de la caisse
        if (remboursement > 0) {
          const txNum = `DEC-SAV-${Date.now().toString().slice(-6)}`;
          db.prepare(`
            INSERT INTO cash_transactions (
              numeroTransaction, type, categorie, montant, modePaiement,
              client_id, tiers, referenceDocument, motif, caisse, dateTransaction
            ) VALUES (?, 'DECAISSEMENT', 'REMBOURSEMENT_SAV', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            txNum, remboursement, modePaiement,
            rep.client_id || null, rep.clientNom, rep.numeroReparation,
            `Remboursement Retour SAV sur ${rep.numeroReparation} (${motif || 'Retour / Garantie'})`,
            activeCaisse
          );
        }

        // Annulation du gain technicien si le technicien avait été crédité
        if (rep.technicienCredite && rep.reparateur_id) {
          const lastGain = db.prepare(`
            SELECT * FROM technician_movements 
            WHERE reparation_id = ? AND type = 'GAIN_REPARATION'
            ORDER BY id DESC LIMIT 1
          `).get(rep.id);

          if (lastGain) {
            const tech = db.prepare('SELECT id, nom, COALESCE(soldeTechnicien, 0) as solde FROM users WHERE id = ?').get(rep.reparateur_id);
            if (tech) {
              const soldeAvant = Number(tech.solde || 0);
              const soldeApres = Math.max(0, Math.round((soldeAvant - Number(lastGain.montant)) * 100) / 100);
              db.prepare('UPDATE users SET soldeTechnicien = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(soldeApres, tech.id);

              db.prepare(`
                INSERT INTO technician_movements (
                  technician_id, reparation_id, type, montant, soldeAvant, soldeApres,
                  referenceDocument, motif, caisse, dateMouvement
                ) VALUES (?, ?, 'ANNULATION_RETOUR', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).run(
                tech.id, rep.id, -Number(lastGain.montant), soldeAvant, soldeApres,
                rep.numeroReparation,
                `Annulation gain retour SAV / garantie ${rep.numeroReparation}`,
                activeCaisse
              );
            }
          }
          db.prepare('UPDATE reparations SET technicienCredite = 0 WHERE id = ?').run(id);
        }

        // Mettre à jour la fiche
        db.prepare(`
          UPDATE reparations 
          SET statut = 'RETOUR_GARANTIE', notes = notes || ? , updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(`\n[Retour SAV le ${new Date().toLocaleDateString('fr-DZ')}]: ${motif || 'Retour de garantie / non conforme'}`, id);

        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Utilisateur',
          action: 'RETOUR_REPARATION',
          module: 'REPARATION',
          reference: rep.numeroReparation,
          caisse: activeCaisse,
          details: `Bon de retour / Avoir SAV pour ${rep.clientNom}. Remboursé: ${remboursement} DA. Pièces réintégrées: ${restitutionPieces ? 'Oui' : 'Non'}`
        });
      });

      returnTx();

      const updated = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      const updatedPieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ? ORDER BY id ASC').all(id);

      return { success: true, data: { ...updated, pieces: updatedPieces }, message: 'Bon de retour SAV enregistré.' };
    } catch (error) {
      console.error('Erreur reparation:createReturn', error);
      return { success: false, error: error.message };
    }
  });

  // 9. Supprimer une réparation
  ipcMain.handle('reparation:delete', async (event, id, currentUser) => {
    try {
      if (!id) return { success: false, error: 'ID requis' };
      const rep = db.prepare('SELECT * FROM reparations WHERE id = ?').get(id);
      if (!rep) return { success: false, error: 'Réparation introuvable' };

      const deleteTx = db.transaction(() => {
        // Restituer le stock des pièces associées
        const pieces = db.prepare('SELECT * FROM reparation_pieces WHERE reparation_id = ?').all(id);
        for (const p of pieces) {
          if (p.product_id && p.retireDuStock) {
            const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(p.product_id);
            if (prod) {
              const stockAvant = Number(prod.quantite || 0);
              const stockApres = stockAvant + Number(p.quantite || 1);
              db.prepare('UPDATE products SET quantite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(stockApres, prod.id);

              db.prepare(`
                INSERT INTO stock_movements (
                  product_id, type, quantite, quantiteAvant, quantiteApres,
                  prixAchatUnitaire, referenceDocument, motif, dateMouvement
                ) VALUES (?, 'ANNULATION_REPARATION', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).run(
                prod.id, Number(p.quantite || 1), stockAvant, stockApres,
                p.prixAchatUnitaire || 0, rep.numeroReparation || '',
                `Suppression réparation ${rep.numeroReparation || ''} : restitution pièce ${p.nom}`
              );
            }
          }
        }

        // Annuler gain technicien si crédité
        if (rep.technicienCredite && rep.reparateur_id) {
          const lastGain = db.prepare(`
            SELECT * FROM technician_movements 
            WHERE reparation_id = ? AND type = 'GAIN_REPARATION'
            ORDER BY id DESC LIMIT 1
          `).get(id);

          if (lastGain) {
            const tech = db.prepare('SELECT id, nom, COALESCE(soldeTechnicien, 0) as solde FROM users WHERE id = ?').get(rep.reparateur_id);
            if (tech) {
              const soldeAvant = Number(tech.solde || 0);
              const soldeApres = Math.max(0, Math.round((soldeAvant - Number(lastGain.montant)) * 100) / 100);
              db.prepare('UPDATE users SET soldeTechnicien = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(soldeApres, tech.id);

              db.prepare(`
                INSERT INTO technician_movements (
                  technician_id, reparation_id, type, montant, soldeAvant, soldeApres,
                  referenceDocument, motif, caisse, dateMouvement
                ) VALUES (?, ?, 'ANNULATION_SUPPRESSION', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).run(
                tech.id, id, -Number(lastGain.montant), soldeAvant, soldeApres,
                rep.numeroReparation,
                `Annulation gain suppression réparation ${rep.numeroReparation}`,
                rep.caisse || ''
              );
            }
          }
        }

        db.prepare('DELETE FROM technician_movements WHERE reparation_id = ?').run(id);
        db.prepare('DELETE FROM reparation_pieces WHERE reparation_id = ?').run(id);
        db.prepare('DELETE FROM reparations WHERE id = ?').run(id);

        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Admin',
          action: 'SUPPRESSION_REPARATION',
          module: 'REPARATION',
          reference: rep.numeroReparation,
          details: `Suppression de la fiche ${rep.numeroReparation} (${rep.clientNom})`
        });
      });

      deleteTx();
      return { success: true };
    } catch (error) {
      console.error('Erreur reparation:delete', error);
      return { success: false, error: error.message };
    }
  });

  // 10. Obtenir les comptes et soldes des techniciens
  ipcMain.handle('technician:getAccounts', async () => {
    try {
      const techs = db.prepare(`
        SELECT id, nom, username, role, caisse, actif,
               COALESCE(soldeTechnicien, 0) as soldeTechnicien
        FROM users
        WHERE role = 'REPARATEUR' OR soldeTechnicien > 0 OR id IN (SELECT DISTINCT technician_id FROM technician_movements)
        ORDER BY nom ASC
      `).all();

      const enriched = techs.map(t => {
        const stats = db.prepare(`
          SELECT 
            COALESCE(SUM(CASE WHEN type = 'GAIN_REPARATION' THEN montant ELSE 0 END), 0) as totalGains,
            COALESCE(SUM(CASE WHEN type = 'RETRAIT' THEN montant ELSE 0 END), 0) as totalRetraits,
            COUNT(CASE WHEN type = 'GAIN_REPARATION' THEN 1 END) as countReparations
          FROM technician_movements
          WHERE technician_id = ?
        `).get(t.id);

        return {
          ...t,
          totalGains: Number(stats?.totalGains || 0),
          totalRetraits: Number(stats?.totalRetraits || 0),
          countReparations: Number(stats?.countReparations || 0)
        };
      });

      return { success: true, data: enriched };
    } catch (err) {
      console.error('Erreur technician:getAccounts', err);
      return { success: false, error: err.message };
    }
  });

  // 11. Obtenir les mouvements financiers d'un technicien
  ipcMain.handle('technician:getMovements', async (event, { technicianId }) => {
    try {
      if (!technicianId) return { success: false, error: 'ID Technicien requis' };
      const list = db.prepare(`
        SELECT tm.*, r.clientNom, r.appareilType, r.marque, r.modele, r.numeroReparation
        FROM technician_movements tm
        LEFT JOIN reparations r ON tm.reparation_id = r.id
        WHERE tm.technician_id = ?
        ORDER BY tm.id DESC
      `).all(technicianId);

      const tech = db.prepare('SELECT id, nom, username, COALESCE(soldeTechnicien, 0) as soldeTechnicien, caisse FROM users WHERE id = ?').get(technicianId);

      return { success: true, data: list, technician: tech };
    } catch (err) {
      console.error('Erreur technician:getMovements', err);
      return { success: false, error: err.message };
    }
  });

  // 12. Payer un technicien / Retrait de gains (Décaissé de la caisse et débité du compte technicien)
  ipcMain.handle('technician:payWithdrawal', async (event, { technicianId, montant, modePaiement = 'ESPECES', caisse = 'Caisse Atelier', motif = '' }, currentUser) => {
    try {
      const tId = parseInt(technicianId, 10);
      const val = parseFloat(montant);
      if (!tId || isNaN(val) || val <= 0) {
        return { success: false, error: 'Montant valide et technicien requis.' };
      }

      const tech = db.prepare('SELECT * FROM users WHERE id = ?').get(tId);
      if (!tech) return { success: false, error: 'Technicien introuvable.' };

      const activeCaisse = caisse || currentUser?.caisse || tech.caisse || 'Caisse 1 (Magasin)';

      const payTx = db.transaction(() => {
        const soldeAvant = Number(tech.soldeTechnicien || 0);
        const soldeApres = Math.round((soldeAvant - val) * 100) / 100;

        // 1. Mettre à jour le solde du technicien
        db.prepare('UPDATE users SET soldeTechnicien = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(soldeApres, tId);

        // 2. Mouvement compte technicien
        const refNum = `RET-TECH-${Date.now().toString().slice(-6)}`;
        db.prepare(`
          INSERT INTO technician_movements (
            technician_id, type, montant, soldeAvant, soldeApres,
            referenceDocument, motif, caisse, dateMouvement
          ) VALUES (?, 'RETRAIT', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          tId, val, soldeAvant, soldeApres,
          refNum,
          motif || `Règlement / Retrait de gains technicien (${tech.nom})`,
          activeCaisse
        );

        // 3. Décaisser de la caisse (Trésorerie)
        const txNum = `DEC-TECH-${Date.now().toString().slice(-6)}`;
        db.prepare(`
          INSERT INTO cash_transactions (
            numeroTransaction, type, categorie, montant, modePaiement,
            tiers, referenceDocument, motif, caisse, dateTransaction
          ) VALUES (?, 'DECAISSEMENT', 'PAIEMENT_TECHNICIEN', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          txNum, val, modePaiement,
          tech.nom, refNum,
          `Règlement solde gains technicien ${tech.nom} (${motif || 'Versement commission / MO'})`,
          activeCaisse
        );

        logAudit(db, {
          userId: currentUser?.id,
          username: currentUser?.username || 'Admin',
          action: 'PAIEMENT_TECHNICIEN',
          module: 'REPARATION',
          reference: refNum,
          caisse: activeCaisse,
          details: `Règlement de ${val} DA au technicien ${tech.nom}. Nouveau solde technicien: ${soldeApres} DA. Décaissé de: ${activeCaisse}`
        });

        return { soldeAvant, soldeApres };
      });

      const res = payTx();
      return { success: true, message: `Règlement de ${val} DA effectué au technicien ${tech.nom}.`, data: res };
    } catch (err) {
      console.error('Erreur technician:payWithdrawal', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerReparationHandlers };
