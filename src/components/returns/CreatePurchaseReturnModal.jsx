import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { Truck, AlertTriangle, Trash2, Search, ArrowUpRight, CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function CreatePurchaseReturnModal({ isOpen, onClose, onReturnProcessed }) {
  const { t, isRTL } = useLanguage();
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [fournisseur, setFournisseur] = useState('');
  const [contactFournisseur, setContactFournisseur] = useState('');
  const [motif, setMotif] = useState('Retour marchandise défectueuse / surplus');
  const [modeRemboursement, setModeRemboursement] = useState('ESPECES');
  const [dateAvoirAchat, setDateAvoirAchat] = useState(new Date().toISOString().slice(0, 10));

  // Champ libre pour la recherche des bons de commande et factures d'achat
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [isSearchingPurchases, setIsSearchingPurchases] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showPurchaseDropdown, setShowPurchaseDropdown] = useState(false);
  const purchaseSearchRef = useRef(null);

  // Products available in database for manual selection
  const [allProducts, setAllProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [returnItems, setReturnItems] = useState([]);

  const [suppliers, setSuppliers] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fermer la liste de recherche si clic à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (purchaseSearchRef.current && !purchaseSearchRef.current.contains(e.target)) {
        setShowPurchaseDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const [purRes, prodRes, suppRes] = await Promise.all([
          api.purchase.getAll(),
          api.stock.getAll(),
          api.supplier ? api.supplier.getAll() : Promise.resolve({ success: false })
        ]);
        if (purRes.success) {
          const list = purRes.data || [];
          setPurchaseInvoices(list);
          setSearchResults(list.slice(0, 10));
        }
        if (prodRes.success) setAllProducts(prodRes.data || []);
        if (suppRes && suppRes.success) setSuppliers(suppRes.data || []);
      } catch (e) {
        console.error('Erreur chargement factures achats:', e);
      }
    };

    loadData();
  }, [isOpen]);

  // Recherche debouncée dans le champ libre des achats / bons de commande
  useEffect(() => {
    if (!isOpen) return;
    const query = purchaseSearch.trim().toLowerCase();

    if (!query) {
      setSearchResults(purchaseInvoices.slice(0, 10));
      setIsSearchingPurchases(false);
      return;
    }

    // Filtrage immédiat dans la liste chargée
    const localMatches = purchaseInvoices.filter(pur => {
      const num = (pur.numeroFactureAchat || '').toLowerCase();
      const four = (pur.fournisseur || '').toLowerCase();
      const tel = (pur.contactFournisseur || '').toLowerCase();
      const type = (pur.typeDocument || '').toLowerCase();
      return num.includes(query) || four.includes(query) || tel.includes(query) || type.includes(query);
    });
    setSearchResults(localMatches);

    // Recherche asynchrone sur la base entière (SQLite)
    setIsSearchingPurchases(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.purchase.getAll({ search: query });
        if (res.success && Array.isArray(res.data)) {
          const map = new Map();
          localMatches.forEach(item => map.set(String(item._id || item.id), item));
          res.data.forEach(item => map.set(String(item._id || item.id), item));
          setSearchResults(Array.from(map.values()));
        }
      } catch (e) {
        console.warn('Erreur recherche libre achat:', e);
      } finally {
        setIsSearchingPurchases(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [purchaseSearch, purchaseInvoices, isOpen]);

  // Appliquer le bon de commande / facture d'achat sélectionné
  const applySelectedPurchase = (pur) => {
    setSelectedPurchase(pur);
    setSelectedPurchaseId(pur._id || pur.id);
    setFournisseur(pur.fournisseur || '');
    setContactFournisseur(pur.contactFournisseur || '');
    setReturnItems(
      (pur.items || []).map((item) => ({
        productId: item.product_id || item.productId,
        reference: item.reference,
        nom: item.nom,
        maxQty: Number(item.quantite) || 1,
        quantite: 1,
        prixAchatUnitaire: Number(item.prixAchatUnitaire) || 0,
        unite: item.unite || 'pcs'
      }))
    );
    setShowPurchaseDropdown(false);
    setPurchaseSearch('');
  };

  // Dissocier le bon et passer en mode retour achat manuel
  const handleClearPurchaseSelection = () => {
    setSelectedPurchase(null);
    setSelectedPurchaseId('');
    setReturnItems([]);
    setPurchaseSearch('');
  };

  if (!isOpen) return null;

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
          return { ...item, prixAchatUnitaire: Number(price) || 0 };
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
          prixAchatUnitaire: Number(prod.prixAchat) || 0,
          unite: prod.unite || 'pcs'
        }
      ]);
    }
    if (!fournisseur && prod.fournisseur) {
      setFournisseur(prod.fournisseur);
    }
    setProductSearch('');
  };

  const totalAvoir = returnItems.reduce(
    (sum, item) => sum + (Number(item.quantite) || 0) * (Number(item.prixAchatUnitaire) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemsToReturn = returnItems.filter((i) => i.quantite > 0);

    if (!fournisseur.trim()) {
      setError('Veuillez spécifier le nom du fournisseur.');
      return;
    }

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

      const res = await api.returns.createPurchaseReturn({
        purchaseId: selectedPurchaseId || null,
        fournisseur: fournisseur.trim(),
        contactFournisseur: contactFournisseur.trim(),
        items: itemsToReturn,
        motif,
        modeRemboursement,
        dateAvoirAchat: new Date(dateAvoirAchat).toISOString()
      });

      if (res.success) {
        if (onReturnProcessed) onReturnProcessed(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de la création de l’avoir fournisseur.');
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
      title="Créer un Avoir sur Achat / Bon de Retour Fournisseur"
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Attention : les articles retournés au fournisseur seront automatiquement <strong>décrémentés de votre stock</strong> (-).
          </span>
        </div>

        {/* LIAISON DE FACTURE D'ACHAT OU BON DE COMMANDE FOURNISSEUR */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-amber-600" />
              <span>Lier à un Bon de Commande Fournisseur ou Facture d'Achat</span>
            </label>
            {selectedPurchase ? (
              <button
                type="button"
                onClick={handleClearPurchaseSelection}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 border border-rose-200"
                title="Dissocier ce bon d'achat et passer en retour libre"
              >
                <Trash2 className="w-3 h-3" />
                <span>Dissocier le document</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 font-medium">Recherche libre ou retour sans document</span>
            )}
          </div>

          {/* Si un document d'achat est sélectionné */}
          {selectedPurchase ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between flex-wrap gap-2 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                  ✓
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-amber-950">
                      {selectedPurchase.numeroFactureAchat}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white text-amber-800 border border-amber-200 shadow-xs">
                      {selectedPurchase.typeDocument === 'BON_COMMANDE_ACHAT' ? 'BON COMMANDE ACHAT' : 'FACTURE ACHAT'}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-900 font-semibold mt-0.5">
                    Fournisseur : <strong>{selectedPurchase.fournisseur}</strong>
                    {selectedPurchase.contactFournisseur ? ` (${selectedPurchase.contactFournisseur})` : ''}
                    {' • '}
                    Total Achat : <strong>{(selectedPurchase.totalTTC || 0).toLocaleString('fr-DZ')} DA</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseDropdown(true)}
                  className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-white hover:bg-amber-100 rounded-xl border border-amber-200 transition cursor-pointer shadow-xs"
                >
                  Changer de Bon
                </button>
              </div>
            </div>
          ) : (
            /* Champ libre de recherche avec autocomplétion */
            <div ref={purchaseSearchRef} className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tapez librement le N° du Bon (FA..., BCA...), nom du fournisseur ou téléphone..."
                  value={purchaseSearch}
                  onChange={(e) => {
                    setPurchaseSearch(e.target.value);
                    setShowPurchaseDropdown(true);
                  }}
                  onFocus={() => setShowPurchaseDropdown(true)}
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-amber-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition shadow-xs"
                />
                {purchaseSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setPurchaseSearch('');
                      setSearchResults(purchaseInvoices.slice(0, 10));
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Menu déroulant des résultats de recherche d'achats */}
              {showPurchaseDropdown && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl divide-y divide-slate-100">
                  <div
                    onClick={() => {
                      handleClearPurchaseSelection();
                      setShowPurchaseDropdown(false);
                    }}
                    className="p-2.5 hover:bg-slate-50 text-xs font-bold text-slate-500 cursor-pointer flex items-center justify-between"
                  >
                    <span>-- Aucun document lié (Retour manuel libre) --</span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">Retour Libre</span>
                  </div>

                  {isSearchingPurchases && (
                    <div className="p-3 text-center text-xs text-slate-400 font-semibold">
                      Recherche des bons de commande et factures d'achat...
                    </div>
                  )}

                  {!isSearchingPurchases && searchResults.length === 0 && purchaseSearch.trim() && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Aucun achat correspondant à "{purchaseSearch}".
                    </div>
                  )}

                  {searchResults.map((pur) => {
                    const isBCA = pur.typeDocument === 'BON_COMMANDE_ACHAT';
                    return (
                      <div
                        key={pur._id || pur.id}
                        onClick={() => applySelectedPurchase(pur)}
                        className="p-2.5 hover:bg-amber-50/70 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900">{pur.numeroFactureAchat}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isBCA ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isBCA ? 'BON COMMANDE' : 'FACTURE ACHAT'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                            Fournisseur : <strong className="text-slate-800">{pur.fournisseur}</strong>
                            {pur.contactFournisseur ? ` • Tél: ${pur.contactFournisseur}` : ''}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-black text-slate-900">
                            {(pur.totalTTC || 0).toLocaleString('fr-DZ')} DA
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {pur.dateFactureAchat ? new Date(pur.dateFactureAchat).toLocaleDateString('fr-DZ') : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Fournisseur & Date d'Avoir */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom du Fournisseur *</label>
              <input
                type="text"
                required
                value={fournisseur}
                onChange={(e) => {
                  setFournisseur(e.target.value);
                  setShowSupplierSuggestions(true);
                }}
                onFocus={() => setShowSupplierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)}
                placeholder="Ex: Sarl Ets Fournisseur..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-blue-500"
              />
              {showSupplierSuggestions && fournisseur && fournisseur.trim().length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                  {suppliers
                    .filter(s => (s.nom && s.nom.toLowerCase().includes(fournisseur.toLowerCase())) || (s.telephone && s.telephone.includes(fournisseur)))
                    .slice(0, 8)
                    .map(s => (
                      <div
                        key={s._id || s.id}
                        onMouseDown={() => {
                          setFournisseur(s.nom);
                          setSupplierId(s._id || s.id);
                          setContactFournisseur(s.telephone || '');
                          setShowSupplierSuggestions(false);
                        }}
                        className="p-2 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-slate-800">{s.nom}</span>
                          {s.telephone ? <span className="text-[10px] text-slate-400 block font-mono">Tél: {s.telephone}</span> : null}
                        </div>
                        {s.soldeDette ? (
                          <span className="text-[10px] font-bold text-amber-700">
                            Dette: {Number(s.soldeDette).toLocaleString('fr-DZ')} DA
                          </span>
                        ) : null}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date de l'Avoir</label>
              <input
                type="date"
                value={dateAvoirAchat}
                onChange={(e) => setDateAvoirAchat(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Contact & Mode de règlement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact / Téléphone Fournisseur</label>
            <input
              type="text"
              value={contactFournisseur}
              onChange={(e) => setContactFournisseur(e.target.value)}
              placeholder="Ex: 0550 12 34 56"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Mode de Remboursement / Compensation</label>
            <select
              value={modeRemboursement}
              onChange={(e) => setModeRemboursement(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            >
              <option value="ESPECES">Remboursement en Espèces (Cash)</option>
              <option value="AVOIR_FOURNISSEUR">Avoir à déduire des prochains achats</option>
              <option value="DEDUCTION_COMPTE">Déduction sur solde compte fournisseur</option>
            </select>
          </div>
        </div>

        {/* Recherche et Ajout de Produit */}
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Ajouter un article à retourner au fournisseur</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Rechercher par référence ou nom d'article en stock..."
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
                  className="w-full text-left px-4 py-2 hover:bg-amber-50 flex items-center justify-between transition cursor-pointer text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{p.nom}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">Réf: {p.reference} • Stock actuel: {p.quantite} {p.unite}</span>
                  </div>
                  <span className="font-bold text-amber-700">P.Achat: {Number(p.prixAchat || 0).toLocaleString('fr-DZ')} DA</span>
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
                <th className="px-4 py-2.5 text-right">P.U Achat (DA)</th>
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
                        value={item.prixAchatUnitaire}
                        onChange={(e) => updatePrice(idx, e.target.value)}
                        className="w-24 px-2 py-1 text-right font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-blue-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-amber-700">
                      {((Number(item.quantite) || 0) * (Number(item.prixAchatUnitaire) || 0)).toLocaleString('fr-DZ')} DA
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
                    Aucun article dans la liste. Sélectionnez une facture d'achat ou ajoutez un produit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total avoir preview */}
        <div className="p-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs font-bold">
          <span className="text-slate-300">Montant Total de l'Avoir Fournisseur :</span>
          <span className="text-lg font-black text-amber-400">
            {totalAvoir.toLocaleString('fr-DZ')} DA
          </span>
        </div>

        {/* Motif */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Motif du retour fournisseur *</label>
          <input
            type="text"
            required
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            placeholder="Ex: Produits défectueux, erreur de livraison, date de péremption proche..."
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
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Truck className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Traitement...' : 'Enregistrer l’Avoir Fournisseur'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
