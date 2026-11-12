import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Search, 
  Trash2, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  Pencil
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function EditPurchaseModal({ isOpen, onClose, purchase, onPurchaseUpdated }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [caisses, setCaisses] = useState([]);
  const [searchProd, setSearchProd] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Form State
  const [typeDocument, setTypeDocument] = useState('FACTURE_ACHAT');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [contactFournisseur, setContactFournisseur] = useState('');
  const [selectedCaisse, setSelectedCaisse] = useState('Caisse 1');
  const [items, setItems] = useState([]);
  const [tauxTva, setTauxTva] = useState(0);
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [montantPaye, setMontantPaye] = useState(0);
  const [notes, setNotes] = useState('');

  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (purchase) {
        populateForm(purchase);
      }
    }
  }, [isOpen, purchase]);

  const loadInitialData = async () => {
    try {
      const [prodRes, suppRes, caisseRes] = await Promise.all([
        api.stock.getAll(),
        api.supplier ? api.supplier.getAll() : Promise.resolve({ success: false }),
        api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false })
      ]);
      if (prodRes.success) setProducts(prodRes.data || []);
      if (suppRes.success) setSuppliers(suppRes.data || []);
      if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
        setCaisses(caisseRes.data);
      }
    } catch (e) {
      console.error('Erreur chargement données achat:', e);
    }
  };

  const populateForm = (p) => {
    setTypeDocument(p.typeDocument || 'FACTURE_ACHAT');
    setSelectedSupplierId(p.supplier_id ? String(p.supplier_id) : (p.fournisseurId ? String(p.fournisseurId) : ''));
    setFournisseur(p.fournisseur || '');
    setContactFournisseur(p.contactFournisseur || '');
    setSelectedCaisse(p.caisse || 'Caisse 1');
    setTauxTva(Number(p.tauxTva) || 0);
    setModePaiement(p.modePaiement || 'ESPECES');
    setMontantPaye(Number(p.montantPaye) || 0);
    setNotes(p.notes || '');
    setError('');

    const initialItems = (p.items || []).map((it) => ({
      productId: it.product_id || it.productId || it.product?._id,
      reference: it.reference,
      nom: it.nom,
      prixAchatUnitaire: Number(it.prixAchatUnitaire || it.prixAchat || 0),
      prixVenteUnitaire: Number(it.prixVenteUnitaire || it.prixVente || 0),
      quantite: Number(it.quantite) || 1,
      unite: it.unite || 'pcs'
    }));
    setItems(initialItems);
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
        (p.categorie && p.categorie.toLowerCase().includes(q)) ||
        (p.codeBarre && p.codeBarre.includes(q))
    );
    setFilteredProducts(matches.slice(0, 8));
  }, [searchProd, products]);

  const addItem = (product) => {
    const pId = product._id || product.id;
    const existingIndex = items.findIndex((i) => i.productId === pId);
    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].quantite += 1;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: pId,
          reference: product.reference,
          nom: product.nom,
          prixAchatUnitaire: Number(product.prixAchat || 0),
          prixVenteUnitaire: Number(product.prixVente || 0),
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

  const totalHT = items.reduce((sum, i) => sum + Number(i.prixAchatUnitaire || 0) * Number(i.quantite || 0), 0);
  const montantTva = Math.round(totalHT * (tauxTva / 100) * 100) / 100;
  const totalTTC = Math.round((totalHT + montantTva) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Veuillez ajouter au moins un produit.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const purchaseId = purchase._id || purchase.id;
      const res = await api.purchase.update(purchaseId, {
        typeDocument,
        fournisseurId: selectedSupplierId || null,
        fournisseur: fournisseur || 'Fournisseur Libre',
        contactFournisseur,
        caisse: selectedCaisse,
        items,
        tauxTva,
        modePaiement,
        montantPaye: Number(montantPaye || 0),
        notes
      });

      if (res.success) {
        if (onPurchaseUpdated) onPurchaseUpdated(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de la mise à jour de la facture d’achat.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Modifier Achat : ${purchase?.numeroFactureAchat || ''}`}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
          <strong>Avertissement :</strong> La modification de cet achat recalculera automatiquement les quantités en stock et ajustera le solde de dette du fournisseur.
        </div>

        {/* Form Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Type de Document</label>
            <select
              value={typeDocument}
              onChange={(e) => setTypeDocument(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-blue-500"
            >
              <option value="FACTURE_ACHAT">Facture d’Achat Fournisseur</option>
              <option value="BON_COMMANDE_ACHAT">Bon de Commande Fournisseur</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Fournisseur</label>
            <select
              value={selectedSupplierId}
              onChange={(e) => {
                const sId = e.target.value;
                setSelectedSupplierId(sId);
                const supp = suppliers.find((s) => String(s._id || s.id) === String(sId));
                if (supp) {
                  setFournisseur(supp.nom);
                  setContactFournisseur(supp.telephone || '');
                }
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-blue-500"
            >
              <option value="">-- Fournisseur Libre --</option>
              {suppliers.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.nom} ({s.telephone || 'Sans tél'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Caisse Utilisée</label>
            <select
              value={selectedCaisse}
              onChange={(e) => setSelectedCaisse(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-blue-500"
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

        {/* Product Search & Add */}
        <div className="relative">
          <label className="block text-xs font-bold text-slate-700 mb-1">Rechercher et Ajouter des Articles</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tapez le nom, la référence ou scannez le code-barres..."
              value={searchProd}
              onChange={(e) => setSearchProd(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-500"
            />
          </div>

          {filteredProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {filteredProducts.map((p) => (
                <div
                  key={p._id || p.id}
                  onClick={() => addItem(p)}
                  className="px-3.5 py-2 hover:bg-blue-50/70 cursor-pointer flex items-center justify-between text-xs transition"
                >
                  <div>
                    <span className="font-bold text-slate-800">{p.nom}</span>
                    <span className="text-[10px] text-slate-400 block">Réf: {p.reference} | Stock actuel: {p.quantite}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-blue-600 block">{Number(p.prixAchat || 0).toLocaleString('fr-DZ')} DA</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5">Article</th>
                <th className="px-4 py-2.5 text-center">Quantité</th>
                <th className="px-4 py-2.5 text-right">Prix Achat (DA)</th>
                <th className="px-4 py-2.5 text-right">Total HT</th>
                <th className="px-4 py-2.5 text-center">Suppr.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-800 block">{item.nom}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Réf: {item.reference}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        step="0.001"
                        value={item.quantite ?? ''}
                        onChange={(e) => updateItemQuantity(item.productId, e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                        onFocus={(e) => e.target.select()}
                        className="w-20 px-2 py-1 text-center font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-blue-500"
                      />
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
                    Aucun article dans cette facture d’achat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Montant Réglé (DA)</label>
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
          </div>

          <div className="space-y-1.5 text-xs bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex justify-between text-slate-600">
              <span>Total Achat HT :</span>
              <span>{Number(totalHT).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</span>
            </div>
            <div className="flex justify-between font-black text-base text-slate-900 pt-2 border-t border-slate-100">
              <span>TOTAL ACHAT (TTC) :</span>
              <span className="text-blue-600">{Number(totalTTC).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</span>
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
            <span>{loading ? 'Mise à jour...' : 'Enregistrer les Modifications (+ Stock)'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
