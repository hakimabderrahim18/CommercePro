import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Search, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Pencil
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function EditInvoiceModal({ isOpen, onClose, invoice, onInvoiceUpdated }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchProd, setSearchProd] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Form State
  const [typeDocument, setTypeDocument] = useState('BON_COMMANDE');
  const [caisses, setCaisses] = useState([]);
  const [selectedCaisse, setSelectedCaisse] = useState('Caisse 1');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [nomClientLibre, setNomClientLibre] = useState('Client Comptoir');
  const [cart, setCart] = useState([]);
  const [tauxTva, setTauxTva] = useState(0);
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [montantPaye, setMontantPaye] = useState(0);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (invoice) {
        populateForm(invoice);
      }
    }
  }, [isOpen, invoice]);

  const loadInitialData = async () => {
    try {
      const [prodRes, custRes, caisseRes] = await Promise.all([
        api.stock.getAll(),
        api.customer.getAll(),
        api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false })
      ]);
      if (prodRes.success) setProducts(prodRes.data || []);
      if (custRes.success) setCustomers(custRes.data || []);
      if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
        setCaisses(caisseRes.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const populateForm = (inv) => {
    setTypeDocument(inv.typeDocument || 'BON_COMMANDE');
    setSelectedCaisse(inv.caisse || 'Caisse 1');
    setSelectedCustomerId(inv.client_id ? String(inv.client_id) : (inv.client?._id ? String(inv.client._id) : ''));
    setNomClientLibre(inv.clientLibre || inv.nomClientLibre || inv.client?.nom || 'Client Comptoir');
    setTauxTva(Number(inv.tauxTva) || 0);
    setModePaiement(inv.modePaiement || 'ESPECES');
    setMontantPaye(Number(inv.montantPaye) || 0);
    setNotes(inv.notes || '');
    setError('');

    const initialCart = (inv.items || []).map((it) => ({
      productId: it.product_id || it.productId || it.product?._id,
      reference: it.reference,
      nom: it.nom,
      prixUnitaire: Number(it.prixUnitaire) || 0,
      prixAchat: Number(it.prixAchatUnitaire || it.prixAchat || 0),
      prixAchatUnitaire: Number(it.prixAchatUnitaire || it.prixAchat || 0),
      quantite: Number(it.quantite) || 1,
      unite: it.unite || 'pcs',
      isSerie: Boolean(it.isSerie),
      piecesParSerie: Number(it.piecesParSerie || 1),
      totalLigne: Number(it.totalLigne || (it.quantite * it.prixUnitaire)) || 0
    }));
    setCart(initialCart);
  };

  // Search products
  useEffect(() => {
    if (!searchProd.trim()) {
      setFilteredProducts([]);
      return;
    }
    const q = searchProd.toLowerCase();
    const matches = products.filter(
      p =>
        p.nom.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        (p.codeBarre && p.codeBarre.includes(q))
    ).slice(0, 8);
    setFilteredProducts(matches);
  }, [searchProd, products]);

  const handleAddToCart = (product) => {
    const existingIndex = cart.findIndex((item) => item.productId === (product._id || product.id));
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantite += 1;
      updated[existingIndex].totalLigne = Math.round(updated[existingIndex].quantite * updated[existingIndex].prixUnitaire * 100) / 100;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productId: product._id || product.id,
          reference: product.reference,
          nom: product.nom,
          prixUnitaire: Number(product.prixVente) || 0,
          prixAchat: Number(product.prixAchat) || 0,
          prixAchatUnitaire: Number(product.prixAchat) || 0,
          quantite: 1,
          unite: product.unite || 'pcs',
          totalLigne: Number(product.prixVente) || 0
        }
      ]);
    }
    setSearchProd('');
    setFilteredProducts([]);
  };

  const handleUpdateQty = (index, newQty) => {
    const qty = parseFloat(newQty) || 0;
    const updated = [...cart];
    updated[index].quantite = qty;
    updated[index].totalLigne = Math.round(qty * updated[index].prixUnitaire * 100) / 100;
    setCart(updated);
  };

  const handleUpdatePrice = (index, newPrice) => {
    const price = Math.max(0, parseFloat(newPrice) || 0);
    const updated = [...cart];
    updated[index].prixUnitaire = price;
    updated[index].totalLigne = Math.round(updated[index].quantite * price * 100) / 100;
    setCart(updated);
  };

  const handleRemoveFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Calculations
  const totalHT = Math.round(cart.reduce((sum, item) => sum + (Number(item.totalLigne) || 0), 0) * 100) / 100;
  const montantTva = Math.round((totalHT * (Number(tauxTva) / 100)) * 100) / 100;
  const totalTTC = Math.round((totalHT + montantTva) * 100) / 100;
  const montantReste = Math.max(0, Math.round((totalTTC - Number(montantPaye)) * 100) / 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cart.length) {
      setError('Veuillez ajouter au moins un article dans le bon.');
      return;
    }
    if (montantReste > 0 && !selectedCustomerId) {
      setError('Pour un bon avec reste à payer (crédit), vous devez sélectionner un client.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.invoice.update(invoice._id || invoice.id, {
        typeDocument,
        caisse: selectedCaisse,
        clientId: selectedCustomerId || null,
        nomClientLibre: selectedCustomerId ? undefined : nomClientLibre,
        items: cart,
        tauxTva,
        montantPaye: Number(montantPaye),
        modePaiement,
        notes
      });

      if (res.success) {
        if (onInvoiceUpdated) {
          onInvoiceUpdated(res.data);
        }
        onClose();
      } else {
        setError(res.error || 'Erreur lors de la modification.');
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
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Pencil className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">
              Modifier le document {invoice?.numeroFacture}
            </h3>
            <p className="text-[11px] text-slate-500">Mise à jour des articles, prix et stock en temps réel</p>
          </div>
        </div>
      }
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top bar: Type, Caisse, Client */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Type de Pièce</label>
            <select
              value={typeDocument}
              onChange={(e) => setTypeDocument(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
            >
              <option value="BON_COMMANDE">★ Bon de Commande</option>
              <option value="FACTURE">Facture de Vente</option>
              <option value="TICKET">Ticket de Caisse</option>
              <option value="BON_LIVRAISON">Bon de Livraison (BL)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Caisse</label>
            <select
              value={selectedCaisse}
              onChange={(e) => setSelectedCaisse(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
            >
              {caisses.map((c) => (
                <option key={c.id || c.nom} value={c.nom}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Client</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Client Comptoir (Par défaut)</option>
              {customers.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.nom} {c.soldeDette > 0 ? `(Dette: ${c.soldeDette} DA)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Search & Quick Add */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un article à ajouter (Nom, Réf, Code-barre)..."
            value={searchProd}
            onChange={(e) => setSearchProd(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
          />

          {filteredProducts.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <div
                  key={p._id || p.id}
                  onClick={() => handleAddToCart(p)}
                  className="p-2.5 hover:bg-blue-50/60 cursor-pointer flex items-center justify-between transition"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">{p.nom}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Réf: {p.reference} • Stock: {p.quantite} {p.unite}</div>
                  </div>
                  <div className="text-xs font-black text-blue-600">
                    {Number(p.prixVente || 0).toLocaleString('fr-DZ')} DA
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2">Article</th>
                <th className="px-3 py-2 text-center w-24">Quantité</th>
                <th className="px-3 py-2 text-right w-28">Prix U. (DA)</th>
                <th className="px-3 py-2 text-right w-28">Total (DA)</th>
                <th className="px-2 py-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2">
                    <div className="font-bold text-slate-800">
                      {item.nom} {item.isSerie ? `(Série de ${item.piecesParSerie || 1} pcs)` : ''}
                    </div>
                    <div className="text-[10px] text-slate-400">Réf: {item.reference}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      step="any"
                      value={item.quantite}
                      onChange={(e) => handleUpdateQty(idx, e.target.value)}
                      className="w-16 px-1.5 py-1 text-center font-bold bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={item.prixUnitaire}
                      onChange={(e) => handleUpdatePrice(idx, e.target.value)}
                      className="w-24 px-1.5 py-1 text-right font-bold bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-black text-slate-800">
                    {Number(item.totalLigne || 0).toLocaleString('fr-DZ')} DA
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(idx)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Payment Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Mode de Règlement</label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
              >
                <option value="ESPECES">Espèces (Cash)</option>
                <option value="CARTE_BANCAIRE">Carte Bancaire / CIB</option>
                <option value="VIREMENT">Virement bancaire</option>
                <option value="CHEQUE">Chèque</option>
                <option value="A_CREDIT">À Crédit (Totalité)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Montant Payé / Encaissé (DA)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={montantPaye}
                onChange={(e) => setMontantPaye(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-emerald-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-1.5 text-right font-bold text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Total HT :</span>
              <span>{totalHT.toLocaleString('fr-DZ')} DA</span>
            </div>
            <div className="flex justify-between text-slate-800 text-sm font-black pt-1 border-t border-slate-200">
              <span>TOTAL NET À PAYER :</span>
              <span className="text-blue-600">{totalTTC.toLocaleString('fr-DZ')} DA</span>
            </div>
            {montantReste > 0 && (
              <div className="flex justify-between text-rose-600 text-xs font-black pt-1">
                <span>Reste à payer (Dette) :</span>
                <span>{montantReste.toLocaleString('fr-DZ')} DA</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
