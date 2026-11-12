import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { RotateCcw, AlertTriangle, Plus, Minus, CheckCheck, RefreshCw, Search, X, CheckCircle2, FileText } from 'lucide-react';

export default function SaleReturnModal({ isOpen, onClose, invoice, onReturnProcessed }) {
  const [activeInvoice, setActiveInvoice] = useState(invoice);
  const [returnItems, setReturnItems] = useState([]);
  const [motif, setMotif] = useState('Produit défectueux / Non conforme');
  const [modeRemboursement, setModeRemboursement] = useState('ESPECES');
  const [clientLibre, setClientLibre] = useState('');
  const [customers, setCustomers] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Charger les clients pour suggestions
  useEffect(() => {
    if (isOpen) {
      api.customer.getAll().then(res => {
        if (res && res.success && Array.isArray(res.data)) {
          setCustomers(res.data);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  // Champ libre pour la recherche de bons et factures
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  // Mettre à jour quand le prop invoice change
  useEffect(() => {
    setActiveInvoice(invoice);
    if (invoice) {
      setClientLibre(invoice.client?.nom || invoice.clientLibre || invoice.nomClientLibre || 'Client Comptoir');
    }
  }, [invoice]);

  // Fermer la liste déroulante si clic dehors
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche debouncée libre de bons et factures
  useEffect(() => {
    if (!isOpen) return;
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.invoice.getAll({ search: term, limit: 12 });
        if (res.success && Array.isArray(res.data)) {
          setSearchResults(res.data);
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        console.warn('Erreur recherche bon retour:', e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // Recharger les articles quand activeInvoice change
  useEffect(() => {
    if (activeInvoice && isOpen) {
      const itemsList = Array.isArray(activeInvoice.items) && activeInvoice.items.length > 0
        ? activeInvoice.items
        : (Array.isArray(activeInvoice.lignes) ? activeInvoice.lignes : []);

      const isSingleItem = itemsList.length === 1;

      const mapped = itemsList.map((item, idx) => {
        const maxQ = Math.max(1, Number(item.quantite) || 1);
        return {
          keyId: item.product?._id || item.product_id || item.productId || `it-${idx}`,
          productId: item.product_id || item.product?._id || item.productId || null,
          reference: item.reference || item.product?.reference || '',
          nom: item.nom || item.designation || item.product?.nom || 'Article',
          maxQty: maxQ,
          quantite: isSingleItem ? maxQ : 0,
          prixUnitaire: Number(item.prixUnitaire) || 0,
          unite: item.unite || 'pcs'
        };
      });
      setReturnItems(mapped);
      setError('');
    }
  }, [activeInvoice, isOpen]);

  const handleSelectNewInvoice = async (inv) => {
    try {
      // Charger la facture complète
      const fullRes = await api.invoice.getById(inv.id || inv._id || inv.numeroFacture);
      const targetInv = (fullRes.success && fullRes.data) ? fullRes.data : inv;
      setActiveInvoice(targetInv);
      setClientLibre(targetInv.client?.nom || targetInv.clientLibre || targetInv.nomClientLibre || 'Client Comptoir');
    } catch (e) {
      setActiveInvoice(inv);
      setClientLibre(inv.client?.nom || inv.clientLibre || inv.nomClientLibre || 'Client Comptoir');
    }
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  if (!activeInvoice && !isOpen) return null;

  const updateQuantity = (keyId, qty) => {
    setReturnItems(prev =>
      prev.map((item) => {
        if (item.keyId === keyId) {
          const num = Number(qty);
          const validQty = isNaN(num) ? 0 : Math.max(0, Math.min(item.maxQty, num));
          return { ...item, quantite: validQty };
        }
        return item;
      })
    );
    if (error) setError('');
  };

  const handleSetAllMax = () => {
    setReturnItems(prev => prev.map(item => ({ ...item, quantite: item.maxQty })));
    setError('');
  };

  const handleResetAllZero = () => {
    setReturnItems(prev => prev.map(item => ({ ...item, quantite: 0 })));
  };

  const totalRemboursement = returnItems.reduce(
    (sum, item) => sum + (Number(item.quantite) || 0) * (Number(item.prixUnitaire) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemsToReturn = returnItems
      .filter((i) => Number(i.quantite) > 0)
      .map(i => ({
        productId: i.productId,
        reference: i.reference || 'REF',
        nom: i.nom || 'Article',
        quantite: Number(i.quantite),
        quantiteRetournee: Number(i.quantite),
        prixUnitaire: Number(i.prixUnitaire) || 0,
        unite: i.unite || 'pcs'
      }));

    if (itemsToReturn.length === 0) {
      setError('Veuillez indiquer au moins un article avec une quantité à retourner (> 0). Utilisez le bouton "Tout retourner (Max)" ou les touches [+] à côté des articles.');
      return;
    }

    if (!motif.trim()) {
      setError('Le motif du retour est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const invId = activeInvoice.id || activeInvoice._id;
      const typeDoc = activeInvoice.typeDocument === 'BON_LIVRAISON' ? 'AVOIR_BL' : 'AVOIR_VENTE';

      const res = await api.returns.createSaleReturn({
        typeDocument: typeDoc,
        invoiceId: invId,
        clientId: activeInvoice.client_id || activeInvoice.client?._id || activeInvoice.client?.id || null,
        nomClientLibre: clientLibre.trim() || activeInvoice.nomClientLibre || activeInvoice.clientLibre || activeInvoice.client?.nom || 'Client Comptoir',
        caisse: activeInvoice.caisse || 'Caisse 1',
        items: itemsToReturn,
        motif: motif.trim(),
        modeRemboursement
      });

      if (res.success) {
        if (onReturnProcessed) {
          onReturnProcessed(res.data);
        }
        onClose();
      } else {
        setError(res.error || 'Erreur lors du traitement du retour.');
      }
    } catch (err) {
      setError(err.message || 'Erreur inconnue lors du traitement du retour.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Retour sur vente : Bon ${activeInvoice?.numeroFacture || ''}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* CHAMP LIBRE DE RECHERCHE DE BONS ET FACTURES POUR RETOUR */}
        <div ref={searchContainerRef} className="relative">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
            <span className="flex items-center gap-1 text-slate-700">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Changer ou rechercher un autre Bon / Facture :</span>
            </span>
            <span className="text-[10px] text-slate-400">Recherche libre par N°, Client ou Téléphone</span>
          </div>

          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Tapez librement le N° du Bon (ex: FAC..., BL..., BC...), nom client..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setShowSearchDropdown(true);
              }}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-blue-500 focus:border-blue-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Liste déroulante des résultats de recherche libre */}
          {showSearchDropdown && (
            <div className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
              {isSearching && (
                <div className="p-3 text-center text-xs text-slate-400 font-semibold">
                  Recherche des factures et bons en cours...
                </div>
              )}

              {!isSearching && searchResults.length === 0 && searchQuery.trim() && (
                <div className="p-3 text-center text-xs text-slate-400">
                  Aucun document trouvé pour "{searchQuery}".
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
                    onClick={() => handleSelectNewInvoice(inv)}
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
                        Client : <strong className="text-slate-800">{inv.client?.nom || inv.clientLibre || 'Client'}</strong>
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

        {/* Carte du bon actuellement lié */}
        {activeInvoice && (
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
                  ✓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-blue-950">
                      {activeInvoice.numeroFacture}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white text-blue-700 border border-blue-200 shadow-2xs">
                      {activeInvoice.typeDocument || 'FACTURE'}
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-800 font-semibold mt-0.5">
                    Client initial : <strong>{activeInvoice.client?.nom || activeInvoice.clientLibre || activeInvoice.nomClientLibre || 'Client Comptoir'}</strong>
                    {activeInvoice.client?.telephone ? ` (${activeInvoice.client.telephone})` : ''}
                    {' • '}
                    Total initial : <strong>{(activeInvoice.totalTTC || 0).toLocaleString('fr-DZ')} DA</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Input de texte libre pour le nom du client sur le retour */}
            <div className="pt-2 border-t border-blue-100 flex items-center gap-2 relative">
              <label className="text-[11px] font-bold text-blue-950 shrink-0">
                Nom client (modifiable) :
              </label>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={clientLibre}
                  onChange={(e) => {
                    setClientLibre(e.target.value);
                    setShowClientSuggestions(true);
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 250)}
                  placeholder="Ex: Mohamed, Client Comptoir..."
                  className="w-full px-2.5 py-1 text-xs font-bold text-slate-800 bg-white border border-blue-200 rounded-lg focus:outline-blue-500"
                />
                {showClientSuggestions && clientLibre && clientLibre.trim().length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-blue-200 rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y divide-slate-100">
                    {customers
                      .filter(c => (c.nom && c.nom.toLowerCase().includes(clientLibre.toLowerCase())) || (c.telephone && c.telephone.includes(clientLibre)))
                      .slice(0, 8)
                      .map(c => (
                        <div
                          key={c._id || c.id}
                          onMouseDown={() => {
                            setClientLibre(c.nom);
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
            </div>
          </div>
        )}

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Les articles retournés seront automatiquement ré-incrémentés dans votre stock.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSetAllMax}
              className="px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg transition cursor-pointer flex items-center gap-1"
              title="Retourner tous les articles au maximum de leur quantité achetée"
            >
              <CheckCheck className="w-3.5 h-3.5 text-amber-800" />
              <span>Tout retourner (Max)</span>
            </button>
            <button
              type="button"
              onClick={handleResetAllZero}
              className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
              title="Remettre toutes les quantités de retour à 0"
            >
              <span>Vider</span>
            </button>
          </div>
        </div>

        {/* Table of items to return */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase">
              <tr>
                <th className="px-4 py-2.5">Article</th>
                <th className="px-3 py-2.5 text-center">Acheté</th>
                <th className="px-4 py-2.5 text-center">Qté à Retourner</th>
                <th className="px-4 py-2.5 text-right">Remboursement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnItems.map((item) => (
                <tr key={item.keyId} className={`transition ${item.quantite > 0 ? 'bg-rose-50/40 font-semibold' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-slate-800">
                    <span className="font-bold">{item.nom}</span>
                    {item.reference && (
                      <span className="block text-[10px] text-slate-400">Réf: {item.reference}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-slate-600">
                    {item.maxQty}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.keyId, item.quantite - 1)}
                        disabled={item.quantite <= 0}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Diminuer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={item.maxQty}
                        value={item.quantite}
                        onChange={(e) => updateQuantity(item.keyId, e.target.value)}
                        className={`w-14 px-1.5 py-1 text-center font-black text-xs rounded-lg border focus:outline-none transition ${
                          item.quantite > 0 
                            ? 'bg-rose-50 border-rose-300 text-rose-700 focus:ring-2 focus:ring-rose-400' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 focus:ring-2 focus:ring-blue-400'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.keyId, item.quantite + 1)}
                        disabled={item.quantite >= item.maxQty}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Augmenter"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.keyId, item.maxQty)}
                        className="ml-1 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-md transition cursor-pointer"
                        title="Retourner tout cet article"
                      >
                        Max
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-slate-800">
                    {(item.quantite * item.prixUnitaire).toLocaleString('fr-DZ')} DA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total remboursement preview */}
        <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs font-bold shadow-inner">
          <span className="text-slate-300">Montant total du remboursement :</span>
          <span className="text-base font-black text-rose-400">
            {totalRemboursement.toLocaleString('fr-DZ')} DA
          </span>
        </div>

        {/* Mode de remboursement */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Mode de Remboursement</label>
          <select
            value={modeRemboursement}
            onChange={(e) => setModeRemboursement(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500 cursor-pointer"
          >
            <option value="ESPECES">Remboursement en Espèces (Caisse)</option>
            <option value="DEDUCTION_DETTE">Déduction sur la dette / compte client</option>
            <option value="AVOIR_CLIENT">Générer un avoir client</option>
          </select>
        </div>

        {/* Motif */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Motif du retour *</label>
          <input
            type="text"
            required
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            placeholder="Ex: Produit défectueux, erreur référence, échange..."
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 rounded-xl transition shadow-md shadow-rose-500/25 disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Traitement en cours...' : 'Confirmer le Retour'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
