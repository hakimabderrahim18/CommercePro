const { ipcMain } = require('electron');
const { getDB } = require('../database/sqlite');

function registerDashboardHandlers(mainWindow) {
  const db = getDB();

  ipcMain.handle('dashboard:getStats', async (event, params = {}) => {
    try {
      const { period = 'today', startDate = null, endDate = null } = params;

      let dateFilter = '';
      let txDateFilter = '';
      let lossDateFilter = '';
      const queryParams = [];
      const txQueryParams = [];
      const lossQueryParams = [];

      if (period === 'all') {
        dateFilter = "1=1";
        txDateFilter = "1=1";
        lossDateFilter = "1=1";
      } else if (period === 'today') {
        dateFilter = "(date(dateFacture, 'localtime') = date('now', 'localtime') OR substr(dateFacture, 1, 10) = date('now', 'localtime') OR date(dateFacture) = date('now'))";
        txDateFilter = "(date(dateTransaction, 'localtime') = date('now', 'localtime') OR substr(dateTransaction, 1, 10) = date('now', 'localtime') OR date(dateTransaction) = date('now'))";
        lossDateFilter = "(date(dateDeclaration, 'localtime') = date('now', 'localtime') OR substr(dateDeclaration, 1, 10) = date('now', 'localtime') OR date(dateDeclaration) = date('now'))";
      } else if (period === 'yesterday') {
        dateFilter = "(date(dateFacture, 'localtime') = date('now', '-1 day', 'localtime') OR date(dateFacture) = date('now', '-1 day'))";
        txDateFilter = "(date(dateTransaction, 'localtime') = date('now', '-1 day', 'localtime') OR date(dateTransaction) = date('now', '-1 day'))";
        lossDateFilter = "(date(dateDeclaration, 'localtime') = date('now', '-1 day', 'localtime') OR date(dateDeclaration) = date('now', '-1 day'))";
      } else if (period === 'week') {
        dateFilter = "(date(dateFacture, 'localtime') >= date('now', '-7 days', 'localtime') OR date(dateFacture) >= date('now', '-7 days'))";
        txDateFilter = "(date(dateTransaction, 'localtime') >= date('now', '-7 days', 'localtime') OR date(dateTransaction) >= date('now', '-7 days'))";
        lossDateFilter = "(date(dateDeclaration, 'localtime') >= date('now', '-7 days', 'localtime') OR date(dateDeclaration) >= date('now', '-7 days'))";
      } else if (period === 'month') {
        dateFilter = "(date(dateFacture, 'localtime') >= date('now', 'start of month', 'localtime') OR date(dateFacture) >= date('now', 'start of month'))";
        txDateFilter = "(date(dateTransaction, 'localtime') >= date('now', 'start of month', 'localtime') OR date(dateTransaction) >= date('now', 'start of month'))";
        lossDateFilter = "(date(dateDeclaration, 'localtime') >= date('now', 'start of month', 'localtime') OR date(dateDeclaration) >= date('now', 'start of month'))";
      } else if (period === 'year') {
        dateFilter = "(date(dateFacture, 'localtime') >= date('now', 'start of year', 'localtime') OR date(dateFacture) >= date('now', 'start of year'))";
        txDateFilter = "(date(dateTransaction, 'localtime') >= date('now', 'start of year', 'localtime') OR date(dateTransaction) >= date('now', 'start of year'))";
        lossDateFilter = "(date(dateDeclaration, 'localtime') >= date('now', 'start of year', 'localtime') OR date(dateDeclaration) >= date('now', 'start of year'))";
      } else if (period === 'custom' && startDate && endDate) {
        dateFilter = "date(dateFacture, 'localtime') BETWEEN ? AND ?";
        txDateFilter = "date(dateTransaction, 'localtime') BETWEEN ? AND ?";
        lossDateFilter = "date(dateDeclaration, 'localtime') BETWEEN ? AND ?";
        queryParams.push(startDate, endDate);
        txQueryParams.push(startDate, endDate);
        lossQueryParams.push(startDate, endDate);
      } else {
        dateFilter = "(date(dateFacture, 'localtime') = date('now', 'localtime') OR substr(dateFacture, 1, 10) = date('now', 'localtime') OR date(dateFacture) = date('now'))";
        txDateFilter = "(date(dateTransaction, 'localtime') = date('now', 'localtime') OR substr(dateTransaction, 1, 10) = date('now', 'localtime') OR date(dateTransaction) = date('now'))";
        lossDateFilter = "(date(dateDeclaration, 'localtime') = date('now', 'localtime') OR substr(dateDeclaration, 1, 10) = date('now', 'localtime') OR date(dateDeclaration) = date('now'))";
      }

      // 1. Factures sur la période
      const invoices = db.prepare(`
        SELECT i.*, c.nom as client_nom, c.telephone as client_telephone
        FROM invoices i
        LEFT JOIN customers c ON i.client_id = c.id
        WHERE ${dateFilter}
        ORDER BY i.id DESC
      `).all(...queryParams).map(inv => {
        const costRowInv = db.prepare(`
          SELECT COALESCE(SUM(it.quantite * COALESCE(NULLIF(it.prixAchatUnitaire, 0), p.prixAchat, 0)), 0) as cost
          FROM invoice_items it
          LEFT JOIN products p ON it.product_id = p.id
          WHERE it.invoice_id = ?
        `).get(inv.id);
        const cost = Number(costRowInv?.cost || 0);
        const total = Number(inv.totalTTC || 0);
        const benefice = Math.round((total - cost) * 100) / 100;

        return {
          ...inv,
          _id: inv.id,
          totalTTC: total,
          montantPaye: Number(inv.montantPaye || 0),
          montantReste: Number(inv.montantReste || 0),
          coutAchat: cost,
          benefice,
          client: inv.client_id ? { _id: inv.client_id, nom: inv.client_nom, telephone: inv.client_telephone } : null
        };
      });

      // Totaux période
      let periodCA = 0;
      let periodEncaisse = 0;
      let periodResteDu = 0;
      const salesByPaymentMode = {};

      for (const inv of invoices) {
        periodCA += Number(inv.totalTTC || 0);
        periodEncaisse += Number(inv.montantPaye || 0);
        periodResteDu += Number(inv.montantReste || 0);

        const mode = inv.modePaiement || 'ESPECES';
        salesByPaymentMode[mode] = (salesByPaymentMode[mode] || 0) + Number(inv.totalTTC || 0);
      }

      // 1b. Réparations livrées (Sorties d'atelier) sur la période
      const repDateFilter = dateFilter.replace(/dateFacture/g, "COALESCE(dateLivraison, updated_at)");
      const deliveredReparations = db.prepare(`
        SELECT r.*, c.nom as client_nom_db, c.telephone as client_tel_db
        FROM reparations r
        LEFT JOIN customers c ON r.client_id = c.id
        WHERE r.statut = 'LIVRE' AND ${repDateFilter}
        ORDER BY r.id DESC
      `).all(...queryParams).map(rep => {
        const costRowRep = db.prepare(`
          SELECT COALESCE(SUM(quantite * COALESCE(prixAchatUnitaire, 0)), 0) as cost
          FROM reparation_pieces
          WHERE reparation_id = ?
        `).get(rep.id);
        const cost = Number(costRowRep?.cost || 0);
        const total = Number(rep.totalTTC || rep.montantPaye || 0);
        const benefice = Math.round((total - cost) * 100) / 100;

        return {
          ...rep,
          _id: rep.id,
          totalTTC: total,
          montantPaye: Number(rep.montantPaye || 0),
          montantReste: Number(rep.montantReste || 0),
          coutAchat: cost,
          benefice,
          isReparation: true,
          client: rep.client_id ? { _id: rep.client_id, nom: rep.client_nom_db || rep.clientNom, telephone: rep.client_tel_db || rep.clientTelephone } : { nom: rep.clientNom, telephone: rep.clientTelephone }
        };
      });

      for (const rep of deliveredReparations) {
        periodCA += Number(rep.totalTTC || 0);
        periodEncaisse += Number(rep.montantPaye || 0);
        periodResteDu += Number(rep.montantReste || 0);

        const mode = rep.modePaiement || 'ESPECES';
        salesByPaymentMode[mode] = (salesByPaymentMode[mode] || 0) + Number(rep.totalTTC || 0);
      }

      periodCA = Math.round(periodCA * 100) / 100;
      periodEncaisse = Math.round(periodEncaisse * 100) / 100;
      periodResteDu = Math.round(periodResteDu * 100) / 100;

      // 2. CA et ventes d'aujourd'hui (Factures + Réparations sorties d'atelier)
      const todayStats = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(totalTTC), 0) as ca 
        FROM invoices 
        WHERE (date(dateFacture, 'localtime') = date('now', 'localtime') OR substr(dateFacture, 1, 10) = date('now', 'localtime') OR date(dateFacture) = date('now'))
      `).get();

      const todayRepStats = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(totalTTC), 0) as ca 
        FROM reparations 
        WHERE statut = 'LIVRE' AND (date(COALESCE(dateLivraison, updated_at), 'localtime') = date('now', 'localtime') OR substr(COALESCE(dateLivraison, updated_at), 1, 10) = date('now', 'localtime') OR date(COALESCE(dateLivraison, updated_at)) = date('now'))
      `).get();

      const todayCA = Math.round((Number(todayStats?.ca || 0) + Number(todayRepStats?.ca || 0)) * 100) / 100;
      const todaySalesCount = Number(todayStats?.count || 0) + Number(todayRepStats?.count || 0);

      // 3. Marge brute sur la période (Bénéfice commercial sur les ventes & réparations)
      const costRow = db.prepare(`
        SELECT COALESCE(SUM(it.quantite * COALESCE(NULLIF(it.prixAchatUnitaire, 0), p.prixAchat, 0)), 0) as totalCost
        FROM invoice_items it
        JOIN invoices i ON it.invoice_id = i.id
        LEFT JOIN products p ON it.product_id = p.id
        WHERE ${dateFilter}
      `).get(...queryParams);

      const repPiecesCostRow = db.prepare(`
        SELECT COALESCE(SUM(rp.quantite * COALESCE(rp.prixAchatUnitaire, 0)), 0) as totalCost
        FROM reparation_pieces rp
        JOIN reparations r ON rp.reparation_id = r.id
        WHERE r.statut = 'LIVRE' AND ${repDateFilter}
      `).get(...queryParams);

      const totalCost = Math.round((Number(costRow.totalCost || 0) + Number(repPiecesCostRow?.totalCost || 0)) * 100) / 100;
      const margeBrute = Math.round((periodCA - totalCost) * 100) / 100;

      // 4. Charges d'exploitation de la période (Loyer, salaires, etc. - hors règlement fournisseurs pour achats)
      const chargesRows = db.prepare(`
        SELECT categorie, COALESCE(SUM(montant), 0) as total
        FROM cash_transactions
        WHERE type = 'DECAISSEMENT' 
          AND categorie NOT IN ('REGLEMENT_FOURNISSEUR', 'ACOMPTE_COMMANDE_FOURNISSEUR')
          AND ${txDateFilter}
        GROUP BY categorie
      `).all(...txQueryParams);

      let totalCharges = 0;
      const chargesParCategorie = {};
      chargesRows.forEach(c => {
        const val = Number(c.total || 0);
        totalCharges += val;
        chargesParCategorie[c.categorie] = val;
      });

      // 5. Pertes de stock sur la période
      const lossRow = db.prepare(`
        SELECT COALESCE(SUM(valeurPerte), 0) as totalPertes
        FROM product_losses
        WHERE ${lossDateFilter}
      `).get(...lossQueryParams);
      const totalPertes = Number(lossRow?.totalPertes || 0);

      // 6. Bénéfice Net Réel de la période (Marge brute - Charges)
      const beneficeNet = Math.round((margeBrute - totalCharges - totalPertes) * 100) / 100;
      const tauxMarge = periodCA > 0 ? Math.round((margeBrute / periodCA) * 1000) / 10 : 0;
      const tauxRentabilite = periodCA > 0 ? Math.round((beneficeNet / periodCA) * 1000) / 10 : 0;

      // 7. Alertes Stock & Valeur totale du stock
      const allProducts = db.prepare('SELECT * FROM products').all();
      const lowStockProducts = allProducts.filter(p => p.quantite <= (p.seuilAlerte || 5));
      const totalStockValue = allProducts.reduce((sum, p) => sum + (Number(p.quantite) * Number(p.prixVente)), 0);

      // 8. Total des dettes clients & dettes fournisseurs
      const debtRow = db.prepare('SELECT COALESCE(SUM(soldeDette), 0) as totalDebt FROM customers').get();
      const totalDettesClients = Number(debtRow.totalDebt || 0);

      const suppDebtRow = db.prepare('SELECT COALESCE(SUM(soldeDette), 0) as totalSuppDebt FROM suppliers').get();
      const totalDettesFournisseurs = Number(suppDebtRow?.totalSuppDebt || 0);

      // 9. Top 5 produits les plus vendus
      const topProducts = db.prepare(`
        SELECT it.nom, it.reference, it.unite,
               SUM(it.quantite) as totalQty,
               SUM(it.totalLigne) as totalCA
        FROM invoice_items it
        JOIN invoices i ON it.invoice_id = i.id
        WHERE ${dateFilter}
        GROUP BY it.reference, it.nom
        ORDER BY totalQty DESC
        LIMIT 5
      `).all(...queryParams);

      // 10. Bons d'achat récents (Purchase orders)
      const recentPurchases = db.prepare(`
        SELECT p.*, s.nom as supplier_nom, s.telephone as supplier_telephone
        FROM purchase_invoices p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ORDER BY p.id DESC
        LIMIT 15
      `).all().map(p => ({
        ...p,
        _id: p.id,
        totalTTC: Number(p.totalTTC || 0),
        montantPaye: Number(p.montantPaye || 0),
        montantReste: Number(p.montantReste || 0),
        fournisseur: p.fournisseur || p.supplier_nom || 'Fournisseur'
      }));

      const responseData = {
        period,
        kpis: {
          todayCA: todayCA,
          todaySalesCount: todaySalesCount,
          periodCA,
          periodSalesCount: invoices.length + deliveredReparations.length,
          periodInvoicesCount: invoices.length,
          periodReparationsCount: deliveredReparations.length,
          periodEncaisse,
          periodResteDu,
          totalCost,
          margeBrute,
          totalCharges,
          totalPertes,
          beneficeNet,
          tauxMarge,
          tauxRentabilite,
          totalStockValue,
          totalActiveProducts: allProducts.length,
          lowStockCount: lowStockProducts.length,
          totalDettesClients,
          totalDettesFournisseurs
        },
        chargesParCategorie,
        recentInvoices: invoices.slice(0, 15),
        recentReparations: deliveredReparations.slice(0, 15),
        recentPurchases,
        lowStockProducts: lowStockProducts.slice(0, 10),
        topProducts,
        salesByPaymentMode
      };

      return {
        success: true,
        data: responseData
      };
    } catch (error) {
      console.error('Erreur dashboard:getStats', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerDashboardHandlers };
