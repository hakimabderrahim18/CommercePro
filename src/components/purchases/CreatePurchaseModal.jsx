import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Search, 
  Plus, 
  Trash2, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  Sparkles,
  FileText
} from 'lucide-react';

export default function CreatePurchaseModal({ isOpen, onClose, onPurchaseCreated }) {
  const [products, setProducts] = useState([]);
  const [searchProd, setSearchProd] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Form State
  const [typeDocument, setTypeDocument] = useState('FACTURE_ACHAT');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [contactFournisseur, setContactFournisseur] = useState('');
  const [caisses, setCaisses] = useState([]);
  const [selectedCaisse, setSelectedCaisse] = useState('Caisse 1');
  const [numeroFactureAchat, setNumeroFactureAchat] = useState('');
  const [items, setItems] = useState([]);
  const [remise, setRemise] = useState(0);
  const [tauxTva, setTauxTva] = useState(0);
  const [appliquerTimbre, setAppliquerTimbre] = useState(false);
  const [montantTimbre, setMontantTimbre] = useState(0);
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [montantPaye, setMontantPaye] = useState(0);
  const [notes, setNotes] = useState('');

  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetForm();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    const [prodRes, suppRes, caisseRes] = await Promise.all([
      api.stock.getAll(),
      api.supplier ? api.supplier.getAll() : Promise.resolve({ success: false }),
      api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false })
    ]);
    if (prodRes.success) setProducts(prodRes.data);
    if (suppRes.success) setSuppliers(suppRes.data);
    if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
      setCaisses(caisseRes.data);
      setSelectedCaisse(caisseRes.data[0].nom);
    }
  };

  const resetForm = () => {
    setTypeDocument('FACTURE_ACHAT');
    setSelectedSupplierId('');
    setFournisseur('');
    setContactFournisseur('');
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    setNumeroFactureAchat(`FA-${dateStr}-${Date.now().toString().slice(-4)}`);
    setItems([]);
    setRemise(0);
    setTauxTva(0);
    setAppliquerTimbre(false);
    setMontantTimbre(0);
    setModePaiement('ESPECES');
    setMontantPaye(0);
    setNotes('');
    setError('');
  };

  // Search product filter
  useEffect(() => {
    if (!searchProd.trim()) {
      setFilteredProducts([]);
      return;
    }
    const q = searchProd.toLowerCase();
    const matches = products.filter(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        (p.categorie && p.categorie.toLowerCase().includes(q))
    );
    setFilteredProducts(matches.slice(0, 8));
  }, [searchProd, products]);

  // Add to purchase list
  const addItem = (product) => {
    const existingIndex = items.findIndex((i) => i.productId === product._id);
    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].quantite += 1;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: product._id,
          reference: product.reference,
          nom: product.nom,
          prixAchatUnitaire: product.prixAchat || 0,
          unite: product.unite || 'pcs',
          quantite: 1
        }
      ]);
    }
    setSearchProd('');
    setError('');
  };

  const updateItemQuantity = (productId, newQty) => {
    if (newQty === '' || newQty === '-') {
      setItems(items.map((i) => (i.productId === productId ? { ...i, quantite: newQty } : i)));
      return;
    }
    const num = Number(newQty);
    if (isNaN(num)) return;
    if (num === 0) {
      removeItem(productId);
      return;
    }
    setItems(
      items.map((i) => (i.productId === productId ? { ...i, quantite: num } : i))
    );
  };

  const updateItemPrice = (productId, newPrice) => {
    setItems(
      items.map((i) => (i.productId === productId ? { ...i, prixAchatUnitaire: Number(newPrice) } : i))
    );
  };

  const removeItem = (productId) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  // Calculations under the Algerian Tax System
  const totalBrutHT = items.reduce((sum, item) => sum + (Number(item.prixAchatUnitaire) || 0) * (Number(item.quantite) || 0), 0);
  const remiseVal = Number(remise) || 0;
  const totalNetHT = Math.max(0, totalBrutHT - remiseVal);
  const montantTva = Math.round((totalNetHT * (Number(tauxTva) / 100)) * 100) / 100;

  // Droit de Timbre fiscal algérien (Code du Timbre - Art. 138) : 1% sur règlement espèces, max 2 500 DA, min 5 DA
  useEffect(() => {
    if (appliquerTimbre && modePaiement === 'ESPECES') {
      const calcTimbre = Math.min(2500, Math.max(5, Math.round((totalNetHT + montantTva) * 0.01)));
      setMontantTimbre(calcTimbre);
    } else if (!appliquerTimbre || modePaiement !== 'ESPECES') {
      setMontantTimbre(0);
    }
  }, [appliquerTimbre, modePaiement, totalNetHT, montantTva]);

  const totalTTC = Math.round((totalNetHT + montantTva + (Number(montantTimbre) || 0)) * 100) / 100;
  const soldeRestant = Math.max(0, Math.round((totalTTC - (Number(montantPaye) || 0)) * 100) / 100);

  useEffect(() => {
    if (modePaiement === 'A_CREDIT') {
      setMontantPaye(0);
    } else if (montantPaye === 0 || montantPaye < totalTTC) {
      setMontantPaye(totalTTC);
    }
  }, [totalTTC, modePaiement]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalSupplierName = selectedSupplierId 
      ? suppliers.find(s => s._id === selectedSupplierId)?.nom || fournisseur
      : fournisseur;

    if (!finalSupplierName.trim()) {
      setError('Veuillez renseigner ou sélectionner le nom du fournisseur.');
      return;
    }
    if (items.length === 0) {
      setError('Veuillez ajouter au moins un article à la facture d’achat.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.purchase.create({
        typeDocument,
        numeroFactureAchat,
        supplier_id: selectedSupplierId || null,
        fournisseur: finalSupplierName,
        contactFournisseur,
        caisse: selectedCaisse,
        items,
        remise: remiseVal,
        tauxTva: Number(tauxTva) || 0,
        montantTimbre: Number(montantTimbre) || 0,
        montantPaye: Number(montantPaye),
        modePaiement,
        notes
      });

      if (res.success) {
        window.dispatchEvent(new CustomEvent('app:refresh-data', { detail: { type: 'purchase', data: res.data } }));
        if (onPurchaseCreated) onPurchaseCreated(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur enregistrement facture d’achat.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nouvelle Facture d'Achat Fournisseur"
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Type Document, Fournisseur, Caisse & N° Facture */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Type de Document</label>
            <div className="flex bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTypeDocument('FACTURE_ACHAT')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  typeDocument === 'FACTURE_ACHAT' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Facture
              </button>
              <button
                type="button"
                onClick={() => setTypeDocument('BON_COMMANDE_ACHAT')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  typeDocument === 'BON_COMMANDE_ACHAT' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                B. Commande
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Fournisseur Enregistré</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                const s = suppliers.find(sup => sup._id === e.target.value);
                if (s) {
                  setFournisseur(s.nom);
                  setContactFournisseur(s.telephone || s.email || '');
                }
              }}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
            >
              <option value="">-- Saisie libre ou nouveau --</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.nom} - Dette: {s.soldeDette || 0} DA
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Caisse de Décaissement</label>
            <select
              value={selectedCaisse}
              onChange={(e) => setSelectedCaisse(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
            >
              {caisses.length > 0 ? (
                caisses.map((c) => (
                  <option key={c.id || c.nom} value={c.nom}>
                    {c.nom}
                  </option>
                ))
              ) : (
                <option value="Caisse 1">Caisse 1</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">N° Facture / Bon Fournisseur</label>
            <input
              type="text"
              value={numeroFactureAchat}
              onChange={(e) => setNumeroFactureAchat(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-blue-500"
              placeholder="Ex: FA-2026-001"
            />
          </div>
        </div>

        {!selectedSupplierId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom Fournisseur *</label>
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
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-blue-500"
                placeholder="Nom du fournisseur / Société"
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
                          setSelectedSupplierId(s._id || s.id);
                          setContactFournisseur(s.telephone || s.email || '');
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Contact Fournisseur</label>
              <input
                type="text"
                value={contactFournisseur}
                onChange={(e) => setContactFournisseur(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                placeholder="Tél / Email"
              />
            </div>
          </div>
        )}

        {/* Product Search */}
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              list="purchase-products-suggestions"
              value={searchProd}
              onChange={(e) => setSearchProd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredProducts.length > 0) {
                    addItem(filteredProducts[0]);
                  }
                }
              }}
              placeholder="Rechercher un article du stock à approvisionner..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            />
            <datalist id="purchase-products-suggestions">
              {products.map((p) => (
                <option key={p._id} value={p.nom} />
              ))}
            </datalist>
          </div>

          {filteredProducts.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-20">
              <div className="p-2 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => addItem(p)}
                    className="p-2 flex items-center justify-between hover:bg-blue-50/60 rounded-xl transition cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">{p.nom}</span>
                      <span className="text-[10px] text-slate-400">Réf: {p.reference} • Stock actuel: {p.quantite} {p.unite}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-600">P. Achat: {p.prixAchat} DA</span>
                      <button type="button" className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 rounded-lg">
                        Ajouter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase">
              <tr>
                <th className="px-4 py-2.5">Article</th>
                <th className="px-4 py-2.5 text-center">Quantité Achetée (+)</th>
                <th className="px-4 py-2.5 text-right">Prix Achat Unit. (DA)</th>
                <th className="px-4 py-2.5 text-right">Total Ligne</th>
                <th className="px-4 py-2.5 text-center">Suppr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {item.nom}
                      <span className="block text-[10px] text-slate-400 font-mono">Réf: {item.reference}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 justify-center">
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={item.quantite ?? ''}
                          onChange={(e) => updateItemQuantity(item.productId, e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                          onFocus={(e) => e.target.select()}
                          className="w-16 px-2 py-1 text-center font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-blue-500"
                        />
                        <span className="text-[10px] font-bold text-slate-500">{item.unite || 'pcs'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="0.000"
                        value={item.prixAchatUnitaire ?? ''}
                        onChange={(e) => updateItemPrice(item.productId, e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                        onFocus={(e) => e.target.select()}
                        className="w-24 px-2 py-1 text-right font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-800">
                      {(item.prixAchatUnitaire * item.quantite).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 text-xs">
                    Aucun article ajouté à cette facture d’achat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Configuration Fiscale (Système Algérien) : Remise, TVA & Droit de Timbre */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Fiscalité & Calculs (Système Fiscal Algérien)</span>
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
              TVA 0%, 9%, 19% • Timbre Art. 138 CTA
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Taux TVA */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Taux de TVA (%) :</label>
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[0, 9, 19].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setTauxTva(rate)}
                      className={`flex-1 py-1 rounded-lg font-bold text-xs transition cursor-pointer border ${
                        tauxTva === rate
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Taux personnalisé..."
                    value={tauxTva ?? 0}
                    onChange={(e) => setTauxTva(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                  />
                  <span className="text-slate-500 font-bold text-xs">%</span>
                </div>
              </div>
            </div>

            {/* Remise Globale */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Remise Globale Fournisseur (DA) :</label>
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="0.00"
                value={remise ?? ''}
                onChange={(e) => setRemise(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Déduite du brut avant calcul de la TVA</span>
            </div>

            {/* Droit de Timbre Fiscal */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Droit de Timbre Fiscal :</label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appliquerTimbre}
                    onChange={(e) => setAppliquerTimbre(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[10px] font-bold text-blue-600">1% Espèces</span>
                </label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="0.00"
                  disabled={!appliquerTimbre && modePaiement !== 'ESPECES'}
                  value={montantTimbre ?? ''}
                  onChange={(e) => setMontantTimbre(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
                <span className="text-slate-500 font-bold text-xs">DA</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Art. 138 CTA (Paiements en espèces)</span>
            </div>
          </div>
        </div>

        {/* Totals & Payment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mode de Paiement Fournisseur</label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-blue-500"
              >
                <option value="ESPECES">Espèces (Comptant)</option>
                <option value="VIREMENT">Virement Bancaire / Chèque</option>
                <option value="A_CREDIT">À Crédit (Fournisseur)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Montant Réglé / Décaissement (DA)</label>
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="0.000"
                value={montantPaye ?? ''}
                onChange={(e) => setMontantPaye(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-blue-600 focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Observations / Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Facture conforme, livraison réceptionnée..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1 text-xs bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Brut HT :</span>
                <span>{Number(totalBrutHT).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</span>
              </div>
              {remiseVal > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Remise Fournisseur :</span>
                  <span>-{Number(remiseVal).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700 font-bold">
                <span>Total Net HT :</span>
                <span>{Number(totalNetHT).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>TVA ({tauxTva}%) :</span>
                <span>+{Number(montantTva).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</span>
              </div>
              {montantTimbre > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Droit de Timbre (1%) :</span>
                  <span>+{Number(montantTimbre).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1">
              <div className="flex justify-between font-black text-base text-slate-900">
                <span>TOTAL ACHAT (TTC) :</span>
                <span className="text-blue-600">{Number(totalTTC).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</span>
              </div>
              {soldeRestant > 0 && (
                <div className="flex justify-between text-xs font-black text-rose-600 pt-1 border-t border-dashed border-slate-200">
                  <span>Dette Fournisseur Restante :</span>
                  <span>+{Number(soldeRestant).toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA</span>
                </div>
              )}
            </div>
          </div>
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
            disabled={loading || items.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer la Facture d’Achat (+ Stock)'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
