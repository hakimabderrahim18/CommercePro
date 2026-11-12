// Client API frontend communiquant avec Electron via window.api

const isElectron = typeof window !== 'undefined' && window.api;

// Fallback pour prévisualisation navigateur en mode dev
const mockFallback = {
  getDBStatus: async () => ({ connected: true, readyState: 1, name: 'commercepost_demo' }),
  reconnectDB: async () => ({ success: true }),
  stock: {
    getAll: async () => ({ success: true, data: [], categories: [] }),
    getByRefOrId: async () => ({ success: false, error: 'Non disponible en mode navigateur' }),
    create: async (data) => ({ success: true, data: { ...data, _id: 'mock_id' } }),
    update: async (id, data) => ({ success: true, data }),
    delete: async () => ({ success: true }),
    addPurchaseOrAdjustment: async () => ({ success: true }),
    reconcileInventory: async () => ({ success: true, count: 0 }),
    importExcel: async () => ({ success: false, error: 'Nécessite Electron' }),
    exportExcel: async () => ({ success: false, error: 'Nécessite Electron' }),
    getMovements: async () => ({ success: true, data: [] }),
    exportMovementsExcel: async () => ({ success: false })
  },
  purchase: {
    create: async (data) => (isElectron ? window.api.purchase.create(data) : { success: true, data: { ...data, _id: 'mock_purchase' } }),
    getAll: async (filters) => (isElectron ? window.api.purchase.getAll(filters) : { success: true, data: [] }),
    update: async (id, data) => (isElectron ? window.api.purchase.update(id, data) : { success: true }),
    delete: async (id) => (isElectron ? window.api.purchase.delete(id) : { success: true }),
    recordPayment: async (data) => (isElectron ? window.api.purchase.recordPayment(data) : { success: true, data }),
    exportExcel: async (filters) => (isElectron ? window.api.purchase.exportExcel(filters) : { success: false })
  },
  supplier: {
    getAll: async (filters) => (isElectron ? window.api.supplier.getAll(filters) : { success: true, data: [], totalDettesFournisseurs: 0 }),
    getById: async (id) => (isElectron ? window.api.supplier.getById(id) : { success: true, data: { _id: id, nom: 'Fournisseur' }, invoices: [], movements: [] }),
    create: async (data) => (isElectron ? window.api.supplier.create(data) : { success: true, data: { ...data, _id: 'mock_supp' } }),
    update: async (id, data) => (isElectron ? window.api.supplier.update(id, data) : { success: true, data }),
    delete: async (id) => (isElectron ? window.api.supplier.delete(id) : { success: true }),
    recordPayment: async (data) => (isElectron ? window.api.supplier.recordPayment(data) : { success: true, data }),
    deleteMovement: async (id) => (isElectron ? window.api.supplier.deleteMovement(id) : { success: true }),
    updateMovement: async (id, data) => (isElectron ? window.api.supplier.updateMovement(id, data) : { success: true }),
    exportStatementExcel: async (supplierId) => (isElectron ? window.api.supplier.exportStatementExcel(supplierId) : { success: false })
  },
  caisse: {
    getAll: async () => (isElectron ? window.api.caisse.getAll() : { success: true, data: [{ nom: 'Caisse 1 (Magasin)', code: 'CAISSE-1', soldeActuel: 0 }] }),
    create: async (data, currentUser) => (isElectron ? window.api.caisse.create(data, currentUser) : { success: true, data }),
    update: async (data, currentUser) => (isElectron ? window.api.caisse.update(data, currentUser) : { success: true, data }),
    transfert: async (data, currentUser) => (isElectron ? window.api.caisse.transfert(data, currentUser) : { success: true }),
    getDailyStats: async () => (isElectron ? window.api.caisse.getDailyStats() : { success: true, data: [], totalRecettesJour: 0 })
  },
  categories: {
    getAll: async () => ({ success: true, data: [{ nom: 'Loyer', type: 'DEPENSE' }, { nom: 'Salaire', type: 'DEPENSE' }] }),
    create: async (data) => ({ success: true, data })
  },
  invoice: {
    create: async (data) => (isElectron ? window.api.invoice.create(data) : mockFallback.invoice.create(data)),
    getAll: async (filters) => (isElectron ? window.api.invoice.getAll(filters) : mockFallback.invoice.getAll(filters)),
    getById: async (id) => (isElectron ? window.api.invoice.getById(id) : mockFallback.invoice.getById(id)),
    update: async (id, data) => (isElectron ? window.api.invoice.update(id, data) : { success: true, data }),
    delete: async (id) => (isElectron ? window.api.invoice.delete(id) : mockFallback.invoice.delete(id)),
    createReturn: async (data) => (isElectron ? window.api.invoice.createReturn(data) : mockFallback.invoice.createReturn(data)),
    recordPayment: async (data) => (isElectron ? window.api.invoice.recordPayment(data) : { success: true, data }),
    exportExcel: async (filters) => (isElectron ? window.api.invoice.exportExcel(filters) : mockFallback.invoice.exportExcel(filters))
  },
  returns: {
    getSaleReturns: async (filters) => (isElectron ? window.api.returns.getSaleReturns(filters) : { success: true, data: [] }),
    getPurchaseReturns: async (filters) => (isElectron ? window.api.returns.getPurchaseReturns(filters) : { success: true, data: [] }),
    createSaleReturn: async (data) => (isElectron ? window.api.returns.createSaleReturn(data) : { success: true, data: { ...data, _id: 'mock_ret_s' } }),
    createPurchaseReturn: async (data) => (isElectron ? window.api.returns.createPurchaseReturn(data) : { success: true, data: { ...data, _id: 'mock_ret_p' } }),
    deleteSaleReturn: async (id) => (isElectron ? window.api.returns.deleteSaleReturn(id) : { success: true }),
    deletePurchaseReturn: async (id) => (isElectron ? window.api.returns.deletePurchaseReturn(id) : { success: true }),
    exportExcel: async (params) => (isElectron ? window.api.returns.exportExcel(params) : { success: false })
  },
  customer: {
    getAll: async (filters) => (isElectron ? window.api.customer.getAll(filters) : mockFallback.customer.getAll(filters)),
    getById: async (id) => (isElectron ? window.api.customer.getById(id) : mockFallback.customer.getById(id)),
    create: async (data) => (isElectron ? window.api.customer.create(data) : mockFallback.customer.create(data)),
    update: async (id, data) => (isElectron ? window.api.customer.update(id, data) : mockFallback.customer.update(id, data)),
    delete: async (id) => (isElectron ? window.api.customer.delete(id) : mockFallback.customer.delete(id)),
    addPayment: async (data) => (isElectron ? window.api.customer.addPayment(data) : mockFallback.customer.addPayment(data)),
    addRefund: async (data) => (isElectron ? window.api.customer.addRefund(data) : mockFallback.customer.addRefund(data)),
    deleteMovement: async (id) => (isElectron ? window.api.customer.deleteMovement(id) : { success: true }),
    updateMovement: async (id, data) => (isElectron ? window.api.customer.updateMovement(id, data) : { success: true }),
    getMovements: async (filters) => (isElectron ? window.api.customer.getMovements(filters) : mockFallback.customer.getMovements(filters)),
    exportExcel: async (filters) => (isElectron ? window.api.customer.exportExcel(filters) : { success: false }),
    importExcel: async () => (isElectron ? window.api.customer.importExcel() : { success: false }),
    exportStatementExcel: async (customerId) => (isElectron ? window.api.customer.exportStatementExcel(customerId) : { success: false })
  },
  treasury: {
    getAll: async (filters) => (isElectron ? window.api.treasury.getAll(filters) : { success: true, data: [], stats: { totalEncaissements: 0, totalDecaissements: 0, soldeNet: 0, count: 0 } }),
    create: async (data) => (isElectron ? window.api.treasury.create(data) : { success: true, data }),
    delete: async (id) => (isElectron ? window.api.treasury.delete(id) : { success: true }),
    exportExcel: async (filters) => (isElectron ? window.api.treasury.exportExcel(filters) : { success: false })
  },
  loss: {
    getAll: async (filters) => (isElectron ? window.api.loss.getAll(filters) : { success: true, data: [], stats: { totalQuantite: 0, totalValeurPerte: 0, countIncidents: 0, countCeMois: 0, valeurCeMois: 0 } }),
    create: async (data) => (isElectron ? window.api.loss.create(data) : { success: true, data }),
    update: async (id, data) => (isElectron ? window.api.loss.update(id, data) : { success: true, data }),
    delete: async (id) => (isElectron ? window.api.loss.delete(id) : { success: true }),
    exportExcel: async (filters) => (isElectron ? window.api.loss.exportExcel(filters) : { success: false })
  },
  dashboard: {
    getStats: async () => ({
      success: true,
      data: {
        kpis: {
          todayCA: 0,
          todaySalesCount: 0,
          periodCA: 0,
          periodSalesCount: 0,
          totalStockValue: 0,
          lowStockCount: 0,
          totalDettesClients: 0
        },
        recentInvoices: [],
        lowStockProducts: [],
        topProducts: [],
        salesByPaymentMode: {}
      }
    })
  },
  print: {
    direct: async () => ({ success: false }),
    html: async () => ({ success: false }),
    toPdf: async () => ({ success: false }),
    getPrinters: async () => ({ success: true, data: [] })
  },
  license: {
    getStatus: async () => ({ success: true, data: { isActivated: true, machineId: 'CP-DEV-TEST-0001', status: 'ACTIVE', clientName: 'Mode Développement', type: 'LIFETIME' } }),
    activate: async () => ({ success: true, message: 'Activé' }),
    deactivate: async () => ({ success: true }),
    reset: async () => ({ success: true }),
    generate: async () => ({ success: false })
  },
  auth: {
    login: async (creds) => (isElectron ? window.api.auth.login(creds) : { success: true, user: { id: 1, username: 'admin', nom: 'Admin Démo', role: 'ADMIN', caisse: 'Caisse 1 (Magasin)' } }),
    getUsers: async () => (isElectron ? window.api.auth.getUsers() : { success: true, data: [{ id: 1, username: 'admin', nom: 'Administrateur', role: 'ADMIN', caisse: 'Caisse 1 (Magasin)', actif: 1 }] }),
    createUser: async (data, currentUser) => (isElectron ? window.api.auth.createUser(data, currentUser) : { success: true, data }),
    updateUser: async (data, currentUser) => (isElectron ? window.api.auth.updateUser(data, currentUser) : { success: true, data }),
    deleteUser: async (id, currentUser) => (isElectron ? window.api.auth.deleteUser(id, currentUser) : { success: true })
  },
  audit: {
    getAll: async (filters) => (isElectron ? window.api.audit.getAll(filters) : { success: true, data: [] }),
    log: async (logData) => (isElectron ? window.api.audit.log(logData) : { success: true })
  },
  reparation: {
    getAll: async (filters) => (isElectron ? window.api.reparation.getAll(filters) : { success: true, data: [] }),
    getById: async (id) => (isElectron ? window.api.reparation.getById(id) : { success: true, data: null }),
    create: async (data, currentUser) => (isElectron ? window.api.reparation.create(data, currentUser) : { success: true, data }),
    update: async (data, currentUser) => (isElectron ? window.api.reparation.update(data, currentUser) : { success: true, data }),
    updateStatus: async (data, currentUser) => (isElectron ? (window.api.reparation.updateStatus ? window.api.reparation.updateStatus(data, currentUser) : window.api.reparation.update({ id: data.id, updates: { statut: data.statut } }, currentUser)) : { success: true, data }),
    addPiece: async (data, currentUser) => (isElectron ? window.api.reparation.addPiece(data, currentUser) : { success: true, data }),
    removePiece: async (data, currentUser) => (isElectron ? window.api.reparation.removePiece(data, currentUser) : { success: true, data }),
    deliver: async (data, currentUser) => (isElectron ? window.api.reparation.deliver(data, currentUser) : { success: true, data }),
    createReturn: async (data, currentUser) => (isElectron ? window.api.reparation.createReturn(data, currentUser) : { success: true, data }),
    delete: async (id, currentUser) => (isElectron ? window.api.reparation.delete(id, currentUser) : { success: true })
  },
  technician: {
    getAccounts: async () => (isElectron && window.api.technician ? window.api.technician.getAccounts() : { success: true, data: [] }),
    getMovements: async (params) => (isElectron && window.api.technician ? window.api.technician.getMovements(params) : { success: true, data: [] }),
    payWithdrawal: async (data, currentUser) => (isElectron && window.api.technician ? window.api.technician.payWithdrawal(data, currentUser) : { success: true })
  },
  updater: {
    check: async () => (isElectron && window.api?.updater ? window.api.updater.check() : { success: true, hasUpdate: false, currentVersion: '1.0.0', latestVersion: '1.0.0', message: 'Logiciel à jour' }),
    download: async () => (isElectron && window.api?.updater ? window.api.updater.download() : { success: true }),
    install: async () => (isElectron && window.api?.updater ? window.api.updater.install() : { success: true }),
    getVersion: async () => (isElectron && window.api?.updater ? window.api.updater.getVersion() : { version: '1.0.0' }),
    openReleaseUrl: async (url) => (isElectron && window.api?.updater ? window.api.updater.openReleaseUrl(url) : { success: true }),
    onProgress: (cb) => (isElectron && window.api?.updater ? window.api.updater.onProgress(cb) : () => {}),
    onStatus: (cb) => (isElectron && window.api?.updater ? window.api.updater.onStatus(cb) : () => {})
  }
};

export const api = isElectron ? window.api : mockFallback;
