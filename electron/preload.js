const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Base de données & statut
  getDBStatus: () => ipcRenderer.invoke('db:getStatus'),
  reconnectDB: () => ipcRenderer.invoke('db:reconnect'),

  // Module Stock
  stock: {
    getAll: (filters) => ipcRenderer.invoke('stock:getAll', filters),
    getByRefOrId: (identifier) => ipcRenderer.invoke('stock:getByRefOrId', identifier),
    create: (data) => ipcRenderer.invoke('stock:create', data),
    update: (id, updates) => ipcRenderer.invoke('stock:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('stock:delete', id),
    addPurchaseOrAdjustment: (data) => ipcRenderer.invoke('stock:addPurchaseOrAdjustment', data),
    reconcileInventory: (data) => ipcRenderer.invoke('stock:reconcileInventory', data),
    importExcel: () => ipcRenderer.invoke('stock:importExcel'),
    exportExcel: (options) => ipcRenderer.invoke('stock:exportExcel', options),
    getMovements: (filters) => ipcRenderer.invoke('stock:getMovements', filters),
    exportMovementsExcel: (filters) => ipcRenderer.invoke('stock:exportMovementsExcel', filters)
  },

  // Module Achats Fournisseurs
  purchase: {
    create: (data) => ipcRenderer.invoke('purchase:create', data),
    getAll: (filters) => ipcRenderer.invoke('purchase:getAll', filters),
    update: (id, data) => ipcRenderer.invoke('purchase:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('purchase:delete', id),
    recordPayment: (data) => ipcRenderer.invoke('purchase:recordPayment', data),
    exportExcel: (filters) => ipcRenderer.invoke('purchase:exportExcel', filters)
  },

  // Module Fournisseurs & Situation
  supplier: {
    getAll: (filters) => ipcRenderer.invoke('supplier:getAll', filters),
    getById: (id) => ipcRenderer.invoke('supplier:getById', id),
    create: (data) => ipcRenderer.invoke('supplier:create', data),
    update: (id, updates) => ipcRenderer.invoke('supplier:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('supplier:delete', id),
    recordPayment: (data) => ipcRenderer.invoke('supplier:recordPayment', data),
    deleteMovement: (movementId) => ipcRenderer.invoke('supplier:deleteMovement', movementId),
    updateMovement: (id, updates) => ipcRenderer.invoke('supplier:updateMovement', { id, updates }),
    exportStatementExcel: (supplierId) => ipcRenderer.invoke('supplier:exportStatementExcel', supplierId)
  },

  // Module Caisses Multiples
  caisse: {
    getAll: () => ipcRenderer.invoke('caisse:getAll'),
    create: (data, currentUser) => ipcRenderer.invoke('caisse:create', data, currentUser),
    update: (data, currentUser) => ipcRenderer.invoke('caisse:update', data, currentUser),
    transfert: (data, currentUser) => ipcRenderer.invoke('caisse:transfert', data, currentUser),
    getDailyStats: () => ipcRenderer.invoke('caisse:getDailyStats')
  },

  // Module Catégories Libres
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    create: (data) => ipcRenderer.invoke('categories:create', data)
  },

  // Module Factures & Ventes
  invoice: {
    create: (data) => ipcRenderer.invoke('invoice:create', data),
    getAll: (filters) => ipcRenderer.invoke('invoice:getAll', filters),
    getById: (id) => ipcRenderer.invoke('invoice:getById', id),
    update: (id, data) => ipcRenderer.invoke('invoice:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('invoice:delete', id),
    createReturn: (data) => ipcRenderer.invoke('invoice:createReturn', data),
    recordPayment: (data) => ipcRenderer.invoke('invoice:recordPayment', data),
    exportExcel: (filters) => ipcRenderer.invoke('invoice:exportExcel', filters)
  },

  // Module Avoirs & Retours (Ventes / BL & Achats Fournisseurs)
  returns: {
    getSaleReturns: (filters) => ipcRenderer.invoke('returns:getSaleReturns', filters),
    getPurchaseReturns: (filters) => ipcRenderer.invoke('returns:getPurchaseReturns', filters),
    createSaleReturn: (data) => ipcRenderer.invoke('returns:createSaleReturn', data),
    createPurchaseReturn: (data) => ipcRenderer.invoke('returns:createPurchaseReturn', data),
    deleteSaleReturn: (id) => ipcRenderer.invoke('returns:deleteSaleReturn', id),
    deletePurchaseReturn: (id) => ipcRenderer.invoke('returns:deletePurchaseReturn', id),
    exportExcel: (params) => ipcRenderer.invoke('returns:exportExcel', params)
  },

  // Module Clients & Dettes
  customer: {
    getAll: (filters) => ipcRenderer.invoke('customer:getAll', filters),
    getById: (id) => ipcRenderer.invoke('customer:getById', id),
    create: (data) => ipcRenderer.invoke('customer:create', data),
    update: (id, updates) => ipcRenderer.invoke('customer:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('customer:delete', id),
    addPayment: (data) => ipcRenderer.invoke('customer:addPayment', data),
    addRefund: (data) => ipcRenderer.invoke('customer:addRefund', data),
    deleteMovement: (movementId) => ipcRenderer.invoke('customer:deleteMovement', movementId),
    updateMovement: (id, updates) => ipcRenderer.invoke('customer:updateMovement', { id, updates }),
    getMovements: (filters) => ipcRenderer.invoke('customer:getMovements', filters),
    exportExcel: (filters) => ipcRenderer.invoke('customer:exportExcel', filters),
    importExcel: () => ipcRenderer.invoke('customer:importExcel'),
    exportStatementExcel: (customerId) => ipcRenderer.invoke('customer:exportStatementExcel', customerId)
  },

  // Module Trésorerie (Encaissements & Décaissements)
  treasury: {
    getAll: (filters) => ipcRenderer.invoke('treasury:getAll', filters),
    create: (data) => ipcRenderer.invoke('treasury:create', data),
    delete: (id) => ipcRenderer.invoke('treasury:delete', id),
    exportExcel: (filters) => ipcRenderer.invoke('treasury:exportExcel', filters)
  },

  // Module Pertes & Casse des Produits
  loss: {
    getAll: (filters) => ipcRenderer.invoke('loss:getAll', filters),
    create: (data) => ipcRenderer.invoke('loss:create', data),
    update: (id, data) => ipcRenderer.invoke('loss:update', { id, data }),
    delete: (id) => ipcRenderer.invoke('loss:delete', id),
    exportExcel: (filters) => ipcRenderer.invoke('loss:exportExcel', filters)
  },

  // Module Dashboard
  dashboard: {
    getStats: (params) => ipcRenderer.invoke('dashboard:getStats', params)
  },

  // Impression
  print: {
    direct: (options) => ipcRenderer.invoke('print:direct', options),
    html: (options) => ipcRenderer.invoke('print:html', options),
    toPdf: (options) => ipcRenderer.invoke('print:toPdf', options),
    getPrinters: () => ipcRenderer.invoke('print:getPrinters')
  },

  // Module Licence & Activation
  license: {
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
    activate: (key) => ipcRenderer.invoke('license:activate', key),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
    reset: () => ipcRenderer.invoke('license:reset'),
    generate: (params) => ipcRenderer.invoke('license:generate', params)
  },

  // Module Authentification & Utilisateurs
  auth: {
    login: (creds) => ipcRenderer.invoke('auth:login', creds),
    getUsers: () => ipcRenderer.invoke('users:getAll'),
    createUser: (data, currentUser) => ipcRenderer.invoke('users:create', data, currentUser),
    updateUser: (data, currentUser) => ipcRenderer.invoke('users:update', data, currentUser),
    deleteUser: (id, currentUser) => ipcRenderer.invoke('users:delete', id, currentUser)
  },

  // Module Journal d'Audit & Historique des Modifications
  audit: {
    getAll: (filters) => ipcRenderer.invoke('audit:getAll', filters),
    log: (logData) => ipcRenderer.invoke('audit:log', logData)
  },

  // Module Réparations (SAV / Atelier)
  reparation: {
    getAll: (filters) => ipcRenderer.invoke('reparation:getAll', filters),
    getById: (id) => ipcRenderer.invoke('reparation:getById', id),
    create: (data, currentUser) => ipcRenderer.invoke('reparation:create', data, currentUser),
    update: (data, currentUser) => ipcRenderer.invoke('reparation:update', data, currentUser),
    updateStatus: (data, currentUser) => ipcRenderer.invoke('reparation:updateStatus', data, currentUser),
    addPiece: (data, currentUser) => ipcRenderer.invoke('reparation:addPiece', data, currentUser),
    removePiece: (data, currentUser) => ipcRenderer.invoke('reparation:removePiece', data, currentUser),
    deliver: (data, currentUser) => ipcRenderer.invoke('reparation:deliver', data, currentUser),
    createReturn: (data, currentUser) => ipcRenderer.invoke('reparation:createReturn', data, currentUser),
    delete: (id, currentUser) => ipcRenderer.invoke('reparation:delete', id, currentUser)
  },

  // Comptes & Règlements des Techniciens
  technician: {
    getAccounts: () => ipcRenderer.invoke('technician:getAccounts'),
    getMovements: (params) => ipcRenderer.invoke('technician:getMovements', params),
    payWithdrawal: (data, currentUser) => ipcRenderer.invoke('technician:payWithdrawal', data, currentUser)
  },

  // Mises à jour en ligne (GitHub Releases)
  updater: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    getVersion: () => ipcRenderer.invoke('update:getVersion'),
    openReleaseUrl: (url) => ipcRenderer.invoke('update:openReleaseUrl', url),
    onProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update:progress', handler);
      return () => ipcRenderer.removeListener('update:progress', handler);
    },
    onStatus: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update:status', handler);
      return () => ipcRenderer.removeListener('update:status', handler);
    }
  },

  // Raccourci F5 global
  onF5Key: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut:f5', handler);
    return () => ipcRenderer.removeListener('shortcut:f5', handler);
  }
});
