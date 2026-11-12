import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { RotateCcw, AlertTriangle, Plus, Trash2, Search, ShoppingBag, CheckCircle2, X, FileText, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function CreateSaleReturnModal({ isOpen, onClose, initialInvoice, onReturnProcessed }) {
  const { t, isRTL } = useLanguage();
  const [invoicesList, setInvoicesList] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialInvoice?._id || '');
  const [selectedInvoice, setSelectedInvoice] = useState(initialInvoice || null);
  const [typeDocument, setTypeDocument] = useState('AVOIR_VENTE'); // AVOIR_VENTE or AVOIR_BL
  const [clientLibre, setClientLibre] = useState(initialInvoice?.client?.nom || initialInvoice?.nomClientLibre || 'Client Comptoir');
  const [clientId, setClientId] = useState(initialInvoice?.client_id || null);
  const [motif, setMotif] = useState('Produit défectueux / Non conforme');
  const [modeRemboursement, setModeRemboursement] = useState('ESPECES');
  const [dateRetour, setDateRetour] = useState(new Date().toISOString().slice(0, 10));

  // Champ libre pour la recherche de factures / bons
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [isSearchingInvoices, setIsSearchingInvoices] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const invoiceSearchRef = useRef(null);

  // Available stock items for standalone return
  const [allProducts, setAllProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [returnItems, setReturnItems] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fermer la liste de recherche si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (invoiceSearchRef.current && !invoiceSearchRef.current.contains(e.target)) {
        setShowInvoiceDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load recent invoices, products, and customers when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadInitialData = async () => {
      try {
        const [invRes, prodRes, custRes] = await Promise.all([
          api.invoice.getAll({ limit: 100 }),
          api.stock.getAll(),
          api.customer.getAll()
        ]);
        if (invRes.success) {
          const list = invRes.data || [];
          setInvoicesList(list);
          setSearchResults(list.slice(0, 10));
        }
        if (prodRes.success) setAllProducts(prodRes.data || []);
        if (custRes && custRes.success) setCustomers(custRes.data || []);
      } catch (e) {
        console.error('Erreur chargement données avoir vente:', e);
      }
    };

    loadInitialData();
  }, [isOpen]);

  // Recherche debouncée dans le champ libre des bons et factures
  useEffect(() => {
    if (!isOpen) return;
    const query = invoiceSearch.trim().toLowerCase();

    if (!query) {
      setSearchResults(invoicesList.slice(0, 10));
      setIsSearchingInvoices(false);
      return;
    }

    // Filtrage immédiat dans la liste déjà chargée
    const localMatches = invoicesList.filter(inv => {
      const num = (inv.numeroFacture || '').toLowerCase();
      const clientName = (inv.client?.nom || inv.clientLibre || inv.nomClientLibre || '').toLowerCase();
      const tel = (inv.client?.telephone || '').toLowerCase();
      const type = (inv.typeDocument || '').toLowerCase();
      return num.includes(query) || clientName.includes(query) || tel.includes(query) || type.includes(query);
    });
    setSearchResults(localMatches);

    // Recherche asynchrone sur la base entière (SQLite)
    setIsSearchingInvoices(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.invoice.getAll({ search: query, limit: 15 });
        if (res.success && Array.isArray(res.data)) {
          // Fusionner et dédupliquer par ID
          const map = new Map();
          localMatches.forEach(item => map.set(String(item._id || item.id), item));
          res.data.forEach(item => map.set(String(item._id || item.id), item));
          setSearchResults(Array.from(map.values()));
        }
      } catch (e) {
        console.warn('Erreur recherche libre facture:', e);
      } finally {
        setIsSearchingInvoices(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [invoiceSearch, invoicesList, isOpen]);

  // When initialInvoice changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialInvoice) {
      applySelectedInvoice(initialInvoice);
    }
  }, [initialInvoice, isOpen]);

  // Appliquer la facture sélectionnée et charger ses articles
  const applySelectedInvoice = (inv) => {
    setSelectedInvoice(inv);
    setSelectedInvoiceId(inv._id || inv.id);
    setClientId(inv.client_id || null);
    setClientLibre(inv.client?.nom || inv.clientLibre || inv.nomClientLibre || 'Client Comptoir');
    setTypeDocument(inv.typeDocument === 'TICKET' ? 'AVOIR_VENTE' : (inv.typeDocument === 'BON_LIVRAISON' ? 'AVOIR_BL' : 'AVOIR_VENTE'));
    
    const itemsList = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : (Array.isArray(inv.lignes) ? inv.lignes : []);
    setReturnItems(
      itemsList.map((item) => ({
        productId: item.product_id || item.product?._id || item.productId,
        reference: item.reference || item.product?.reference || '',
        nom: item.nom || item.designation || item.product?.nom || 'Article',
        maxQty: Number(item.quantite) || 1,
        quantite: 1,
        prixUnitaire: Number(item.prixUnitaire) || 0,
        unite: item.unite || 'pcs'
      }))
    );
    setShowInvoiceDropdown(false);
    setInvoiceSearch('');
  };

  // Dissocier le bon et passer en mode retour manuel
  const handleClearInvoiceSelection = () => {
    setSelectedInvoice(null);
    setSelectedInvoiceId('');
    setReturnItems([]);
    setInvoiceSearch('');
  };

  const updateQuantity = (idx, qty) => {
    setReturnItems(
      returnItems.map((item, i) => {
        if (i === idx) {
          const max = item.maxQty !== undefined ? item.maxQty : 99999;
          const validQty = Math.max(0, Math.min(max, Number(qty) || 0));
          return { ...item, quantite: validQty };
        }
        return item;
      })
    );
  };

  const updatePrice = (idx, price) => {
    setReturnItems(
      returnItems.map((item, i) => {
        if (i === idx) {
          return { ...item, prixUnitaire: Number(price) || 0 };
        }
        return item;
      })
    );
  };

  const removeItem = (idx) => {
    setReturnItems(returnItems.filter((_, i) => i !== idx));
  };

  const addManualProduct = (prod) => {
    const existingIdx = returnItems.findIndex((it) => it.productId === prod.id || it.reference === prod.reference);
    if (existingIdx >= 0) {
      updateQuantity(existingIdx, returnItems[existingIdx].quantite + 1);
    } else {
      setReturnItems([
        ...returnItems,
        {
          productId: prod.id,
          reference: prod.reference,
          nom: prod.nom,
          quantite: 1,
          prixUnitaire: Number(prod.prixVente) || 0,
          unite: prod.unite || 'pcs'
        }
      ]);
    }
    setProductSearch('');
  };

  const totalRemboursement = returnItems.reduce(
    (sum, item) => sum + (Number(item.quantite) || 0) * (Number(item.prixUnitaire) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemsToReturn = returnItems.filter((i) => i.quantite > 0);

    if (itemsToReturn.length === 0) {
      setError('Veuillez indiquer au moins un article avec une quantité retournée > 0.');
      return;
    }

    if (!motif.trim()) {
      setError('Le motif du retour est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.returns.createSaleReturn({
        typeDocument,
        invoiceId: selectedInvoiceId || null,
        clientId,
        nomClientLibre: clientLibre || 'Client Comptoir',
        items: itemsToReturn,
        motif,
        modeRemboursement,
        dateRetour: new Date(dateRetour).toISOString()
      });

      if (res.success) {
        if (onReturnProcessed) onReturnProcessed(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors du traitement du retour.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = productSearch.trim()
    ? allProducts.filter((p) =>
        p.nom?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.reference?.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={typeDocument === 'AVOIR_BL' ? 'Nouvel Avoir sur Bon de Livraison (BL)' : 'Nouvel Avoir sur Vente'}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-blue-600" />
          <span>
            Les articles retournés seront automatiquement <strong>ré-incrémentés dans votre stock</strong> (+).
          </span>
        </div>

        {/* LIAISON DE FACTURE OU BON (CHAMP LIBRE DE RECHERCHE DE BONS ET FACTURES) */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-blue-600" />
              <span>Lier à une Facture ou un Bon (Facture, BL, Bon de Commande)</span>
            </label>
            {selectedInvoice ? (
              <button
                type="button"
                onClick={handleClearInvoiceSelection}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 border border-rose-200"
                title="Dissocier ce bon et passer en retour libre"
              >
                <Trash2 className="w-3 h-3" />
                <span>Dissocier le document</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 font-medium">Recherche libre ou retour sans document</span>
            )}
          </div>

          {/* Si un document est sélectionné : afficher la carte récapitulative élégante */}
          {selectedInvoice ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between flex-wrap gap-2 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                  ✓
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-blue-950">
                      {selectedInvoice.numeroFacture}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white text-blue-700 border border-blue-200 shadow-xs">
                      {selectedInvoice.typeDocument || 'FACTURE'}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-800 font-semibold mt-0.5">
                    Client : <strong>{selectedInvoice.client?.nom || selectedInvoice.clientLibre || selectedInvoice.nomClientLibre || 'Client Comptoir'}</strong>
                    {selectedInvoice.client?.telephone ? ` (${selectedInvoice.client.telephone})` : ''}
                    {' • '}
                    Total : <strong>{(selectedInvoice.totalTTC || 0).toLocaleString('fr-DZ')} DA</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceDropdown(true)}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-100 rounded-xl border border-blue-200 transition cursor-pointer shadow-xs"
                >
                  Changer de Bon
                </button>
              </div>
            </div>
          ) : (
            /* Champ libre de recherche avec autocomplétion */
            <div ref={invoiceSearchRef} className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tapez librement le N° du Bon (FAC..., BL..., BC...), nom du client ou téléphone..."
                  value={invoiceSearch}
                  onChange={(e) => {
                    setInvoiceSearch(e.target.value);
                    setShowInvoiceDropdown(true);
                  }}
                  onFocus={() => setShowInvoiceDropdown(true)}
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-xs"
                />
                {invoiceSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceSearch('');
                      setSearchResults(invoicesList.slice(0, 10));
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Menu déroulant des résultats de recherche */}
              {showInvoiceDropdown && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl divide-y divide-slate-100">
                  <div
                    onClick={() => {
                      handleClearInvoiceSelection();
                      setShowInvoiceDropdown(false);
                    }}
                    className="p-2.5 hover:bg-slate-50 text-xs font-bold text-slate-500 cursor-pointer flex items-center justify-between"
                  >
                    <span>-- Aucun document lié (Retour manuel libre) --</span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">Retour Libre</span>
                  </div>

                  {isSearchingInvoices && (
                    <div className="p-3 text-center text-xs text-slate-400 font-semibold">
                      Recherche des factures et bons en cours...
                    </div>
                  )}

                  {!isSearchingInvoices && searchResults.length === 0 && invoiceSearch.trim() && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Aucun bon ni facture correspondant à "{invoiceSearch}".
                    </div>
                  )}

                  {searchResults.map((inv) => {
                    const isBL = inv.typeDocument === 'BON_LIVRAISON';
                    const isBC = inv.typeDocument === 'BON_COMMANDE';
                    const isTicket = inv.typeDocument === 'TICKET';
                    const badgeClass = isBL ? 'bg-purple-100 text-purple-700' :
                                       isBC ? 'bg-amber-100 text-amber-800' :
                                       isTicket ? 'bg-slate-100 text-slate-700' :
                                       'bg-blue-100 text-blue-700';

                    return (
                      <div
                        key={inv._id || inv.id}
                        onClick={() => applySelectedInvoice(inv)}
                        className="p-2.5 hover:bg-blue-50/70 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900">{inv.numeroFacture}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${badgeClass}`}>
                              {inv.typeDocument || 'FACTURE'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                            Client : <strong className="text-slate-800">{inv.client?.nom || inv.clientLibre || inv.nomClientLibre || 'Client Comptoir'}</strong>
                            {inv.client?.telephone ? ` • Tél: ${inv.client.telephone}` : ''}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-black text-slate-900">
                            {(inv.totalTTC || 0).toLocaleString('fr-DZ')} DA
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {inv.dateFacture ? new Date(inv.dateFacture).toLocaleDateString('fr-DZ') : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Configuration du type et date d'Avoir */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Type d'Avoir</label>
              <select
                value={typeDocument}
                onChange={(e) => setTypeDocument(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
              >
                <option value="AVOIR_VENTE">Avoir sur Facture Vente</option>
                <option value="AVOIR_BL">Avoir sur Bon de Livraison (BL)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date de l'Avoir</label>
              <input
                type="date"
                value={dateRetour}
                onChange={(e) => setDateRetour(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Client & Remboursement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Nom du Client</label>
            <input
              type="text"
              value={clientLibre}
              onChange={(e) => {
                setClientLibre(e.target.value);
                setShowClientSuggestions(true);
              }}
              onFocus={() => setShowClientSuggestions(true)}
              onBlur={() => setTimeout(() => setShowClientSuggestions(false), 250)}
              placeholder="Ex: Client Comptoir ou Nom du client..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            />
            {showClientSuggestions && clientLibre && clientLibre.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                {customers
                  .filter(c => (c.nom && c.nom.toLowerCase().includes(clientLibre.toLowerCase())) || (c.telephone && c.telephone.includes(clientLibre)))
                  .slice(0, 8)
                  .map(c => (
                    <div
                      key={c._id || c.id}
                      onMouseDown={() => {
                        setClientLibre(c.nom);
                        setClientId(c._id || c.id);
                        setShowClientSuggestions(false);
                      }}
                      className="p-2 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{c.nom}</span>
                        {c.telephone ? <span className="text-[10px] text-slate-400 block font-mono">Tél: {c.telephone}</span> : null}
                      </div>
                      {c.soldeDette ? (
                        <span className="text-[10px] font-bold text-rose-600">
                          Dette: {Number(c.soldeDette).toLocaleString('fr-DZ')} DA
                        </span>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Mode de Compensation</label>
            <select
              value={modeRemboursement}
              onChange={(e) => setModeRemboursement(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            >
              <option value="ESPECES">Remboursement en Espèces (Cash)</option>
              <option value="DEDUCTION_DETTE">Déduction sur la dette / compte client</option>
              <option value="AVOIR_CLIENT">Générer un bon d'avoir client</option>
            </select>
          </div>
        </div>

        {/* Ajout d'articles libre si pas de document lié ou complément */}
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Ajouter un article au retour</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Rechercher par référence ou désignation de produit à ajouter..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            />
          </div>

          {filteredProducts.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addManualProduct(p)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-center justify-between transition cursor-pointer text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{p.nom}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">Réf: {p.reference} • Stock: {p.quantite} {p.unite}</span>
                  </div>
                  <span className="font-bold text-blue-600">{Number(p.prixVente || 0).toLocaleString('fr-DZ')} DA</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table of items to return */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Article Retourné</th>
                <th className="px-4 py-2.5 text-center">Qté Retournée</th>
                <th className="px-4 py-2.5 text-right">P.U Avoir (DA)</th>
                <th className="px-4 py-2.5 text-right">Total Avoir</th>
                <th className="px-2 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {returnItems.length > 0 ? (
                returnItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-800">
                      <span>{item.nom}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">Réf: {item.reference}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="number"
                        min="0"
                        max={item.maxQty !== undefined ? item.maxQty : 99999}
                        value={item.quantite}
                        onChange={(e) => updateQuantity(idx, e.target.value)}
                        className="w-16 px-2 py-1 text-center font-black text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-blue-500"
                      />
                      {item.maxQty !== undefined && (
                        <span className="block text-[9px] text-slate-400">max: {item.maxQty}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={item.prixUnitaire}
                        onChange={(e) => updatePrice(idx, e.target.value)}
                        className="w-24 px-2 py-1 text-right font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-rose-600">
                      {((Number(item.quantite) || 0) * (Number(item.prixUnitaire) || 0)).toLocaleString('fr-DZ')} DA
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 text-xs">
                    Aucun article dans la liste de retour. Sélectionnez une vente ci-dessus ou ajoutez un produit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total remboursement preview */}
        <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs font-bold">
          <span className="text-slate-300">Montant Total de l'Avoir / Remboursement :</span>
          <span className="text-lg font-black text-emerald-400">
            {totalRemboursement.toLocaleString('fr-DZ')} DA
          </span>
        </div>

        {/* Motif */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Motif du retour / Avoir *</label>
          <input
            type="text"
            required
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            placeholder="Ex: Défaut marchandise, non-conformité au Bon de Livraison, erreur commande..."
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-md shadow-rose-500/20 disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Traitement...' : 'Enregistrer le Bon d’Avoir'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
