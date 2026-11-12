import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Search, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  User, 
  CreditCard, 
  DollarSign, 
  Printer, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function CreateInvoiceModal({ isOpen, onClose, onInvoiceCreated }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchProd, setSearchProd] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Form State
  const [typeDocument, setTypeDocument] = useState('FACTURE');
  const [caisses, setCaisses] = useState([]);
  const [selectedCaisse, setSelectedCaisse] = useState('Caisse 1');
  const [selectedTarif, setSelectedTarif] = useState('prixVente'); // 'prixVente' | 'prixDemiGros' | 'prixGros' | 'prixSuperGros'
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
      resetForm();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    const [prodRes, custRes, caisseRes] = await Promise.all([
      api.stock.getAll(),
      api.customer.getAll(),
      api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false })
    ]);
    if (prodRes.success) setProducts(prodRes.data);
    if (custRes.success) setCustomers(custRes.data);
    if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
      setCaisses(caisseRes.data);
      setSelectedCaisse(caisseRes.data[0].nom);
    }
  };

  const resetForm = () => {
    setTypeDocument('FACTURE');
    setSelectedTarif('prixVente');
    setSelectedCustomerId('');
    setNomClientLibre('Client Comptoir');
    setCart([]);
    setTauxTva(0);
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

  // Helper for pricing tier
  const getProductPrice = (product, tarif = selectedTarif) => {
    if (!product) return 0;
    if (tarif === 'prixDemiGros' && product.prixDemiGros) return Number(product.prixDemiGros);
    if (tarif === 'prixGros' && product.prixGros) return Number(product.prixGros);
    if (tarif === 'prixSuperGros' && product.prixSuperGros) return Number(product.prixSuperGros);
    return Number(product.prixVente) || 0;
  };

  // Add to cart
  const addToCart = (product) => {
    if (product.quantite <= 0) {
      setError(`L'article "${product.nom}" est en rupture de stock.`);
      return;
    }

    const unitPrice = getProductPrice(product, selectedTarif);
    const costPrice = Number(product.prixAchat) || 0;

    if (costPrice > 0 && unitPrice < costPrice) {
      setError(`Attention : Prix de vente (${unitPrice} DA) inférieur au prix d'achat (${costPrice} DA) !`);
    }

    const existingIndex = cart.findIndex((item) => item.productId === product._id);
    if (existingIndex > -1) {
      const currentItem = cart[existingIndex];
      if (currentItem.quantite + 1 > product.quantite) {
        setError(`Quantité maximale en stock atteinte (${product.quantite} ${product.unite}).`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantite += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productId: product._id,
          reference: product.reference,
          nom: product.nom,
          prixUnitaire: unitPrice,
          prixAchat: costPrice,
          maxStock: product.quantite,
          unite: product.unite || 'pcs',
          quantite: 1
        }
      ]);
    }
    setSearchProd('');
  };

  const updateCartQuantity = (productId, newQty) => {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    if (newQty === 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > 0 && newQty > item.maxStock) {
      setError(`Stock disponible insuffisant : seulement ${item.maxStock} ${item.unite} en réserve.`);
      return;
    }

    setCart(
      cart.map((i) =>
        i.productId === productId ? { ...i, quantite: Number(newQty) } : i
      )
    );
    setError('');
  };

  const updateCartPrice = (productId, newPrice) => {
    setCart(
      cart.map((i) =>
        i.productId === productId ? { ...i, prixUnitaire: Number(newPrice) } : i
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((i) => i.productId !== productId));
  };

  // Calculations
  const totalHT = cart.reduce((sum, item) => sum + item.prixUnitaire * item.quantite, 0);
  const montantTva = Math.round((totalHT * (tauxTva / 100)) * 100) / 100;
  const totalTTC = Math.round((totalHT + montantTva) * 100) / 100;

  // Auto-set paid amount when mode is cash / carte unless custom entered
  useEffect(() => {
    if (modePaiement === 'A_CREDIT') {
      setMontantPaye(0);
    } else if (montantPaye === 0 || montantPaye < totalTTC) {
      setMontantPaye(totalTTC);
    }
  }, [totalTTC, modePaiement]);

  const montantReste = Math.max(0, Math.round((totalTTC - montantPaye) * 100) / 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Veuillez ajouter au moins un produit au panier.');
      return;
    }

    if (montantReste > 0 && !selectedCustomerId) {
      setError('Une vente à crédit ou avec reste à payer nécessite obligatoirement de sélectionner une fiche client enregistrée.');
      return;
    }

    // Check below cost
    const belowCostItems = cart.filter(item => {
      const pa = Number(item.prixAchat || item.prixAchatUnitaire || 0);
      return Number(item.quantite) > 0 && pa > 0 && Number(item.prixUnitaire) < pa;
    });
    if (belowCostItems.length > 0) {
      const names = belowCostItems.map(i => {
        const pa = Number(i.prixAchat || i.prixAchatUnitaire || 0);
        return `${i.nom} (${i.prixUnitaire} < ${pa})`;
      }).join(', ');
      const confirmSale = window.confirm(
        `ALERTE PRIX D'ACHAT :\nLes articles suivants sont vendus à un prix inférieur à leur prix d'achat :\n${names}\n\nConfirmez-vous cette vente ?`
      );
      if (!confirmSale) return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.invoice.create({
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
        onInvoiceCreated(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de la validation de la facture.');
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
      title="Caisse & Nouvelle Vente"
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top bar: Type document, Caisse, Tarif & Client */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Type de Document</label>
            <div className="flex bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTypeDocument('FACTURE')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  typeDocument === 'FACTURE' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Facture
              </button>
              <button
                type="button"
                onClick={() => setTypeDocument('TICKET')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  typeDocument === 'TICKET' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Ticket
              </button>
              <button
                type="button"
                onClick={() => setTypeDocument('BON_COMMANDE')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  typeDocument === 'BON_COMMANDE' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                B. Commande
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Caisse d'Encaissement</label>
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
            <label className="block text-xs font-bold text-slate-700 mb-1">Tarif Appliqué</label>
            <div className="grid grid-cols-4 gap-1 bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedTarif('prixVente')}
                className={`py-1 text-[10px] font-bold rounded-lg transition cursor-pointer text-center ${
                  selectedTarif === 'prixVente' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Détail
              </button>
              <button
                type="button"
                onClick={() => setSelectedTarif('prixDemiGros')}
                className={`py-1 text-[10px] font-bold rounded-lg transition cursor-pointer text-center ${
                  selectedTarif === 'prixDemiGros' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                ½ Gros
              </button>
              <button
                type="button"
                onClick={() => setSelectedTarif('prixGros')}
                className={`py-1 text-[10px] font-bold rounded-lg transition cursor-pointer text-center ${
                  selectedTarif === 'prixGros' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Gros
              </button>
              <button
                type="button"
                onClick={() => setSelectedTarif('prixSuperGros')}
                className={`py-1 text-[10px] font-bold rounded-lg transition cursor-pointer text-center ${
                  selectedTarif === 'prixSuperGros' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Super
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Client Enregistré</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
            >
              <option value="">-- Client Comptoir --</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nom} {c.telephone ? `(${c.telephone})` : ''} - Dette: {c.soldeDette || 0} DA
                </option>
              ))}
            </select>
          </div>
        </div>

        {!selectedCustomerId && (
          <div className="px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Nom du client libre :</span>
            <input
              type="text"
              list="invoice-clients-suggestions"
              value={nomClientLibre}
              onChange={(e) => setNomClientLibre(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500 w-72"
              placeholder="Ex: Client Comptoir"
            />
            <datalist id="invoice-clients-suggestions">
              {customers.map((c) => (
                <option key={c._id} value={c.nom} />
              ))}
            </datalist>
          </div>
        )}

        {/* Product Search & Autocomplete */}
        <div className="relative">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              list="invoice-products-suggestions"
              value={searchProd}
              onChange={(e) => setSearchProd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredProducts.length > 0) {
                    addToCart(filteredProducts[0]);
                  }
                }
              }}
              placeholder="Rechercher un produit par nom ou scanner le code-barres / QR..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500 shadow-inner"
            />
            <datalist id="invoice-products-suggestions">
              {products.map((p) => (
                <option key={p._id} value={p.nom} />
              ))}
            </datalist>
          </div>

          {/* Search Dropdown */}
          {filteredProducts.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-20">
              <div className="p-2 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <div
                    key={p._id}
                    onClick={() => addToCart(p)}
                    className="p-2.5 flex items-center justify-between hover:bg-blue-50/60 rounded-xl transition cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-xs block">{p.nom}</span>
                      <span className="text-[10px] text-slate-400">Réf: {p.reference} | Dispo: {p.quantite} {p.unite}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-blue-600 text-sm">{p.prixVente?.toLocaleString('fr-DZ')} DA</span>
                      <button
                        type="button"
                        className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cart Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase">
              <tr>
                <th className="px-4 py-2.5">Article</th>
                <th className="px-4 py-2.5 text-center">Quantité</th>
                <th className="px-4 py-2.5 text-right">Prix Unit. (DA)</th>
                <th className="px-4 py-2.5 text-right">Total Ligne</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <tr key={item.productId} className={`hover:bg-slate-50/50 ${item.prixAchat > 0 && item.prixUnitaire < item.prixAchat ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 block">{item.nom}</span>
                        {item.prixAchat > 0 && item.prixUnitaire < item.prixAchat && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white animate-pulse">
                            ⚠️ Vente à perte (PA: {item.prixAchat} DA)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">Réf: {item.reference} (Max: {item.maxStock})</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.productId, item.quantite - 1)}
                          className="w-6 h-6 rounded-lg bg-white font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          placeholder="0"
                          value={item.quantite ?? ''}
                          onChange={(e) => updateCartQuantity(item.productId, e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                          onFocus={(e) => e.target.select()}
                          className="w-12 text-center font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.productId, item.quantite + 1)}
                          className="w-6 h-6 rounded-lg bg-white font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer shadow-2xs"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={item.prixUnitaire ?? ''}
                        onChange={(e) => updateCartPrice(item.productId, e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                        onFocus={(e) => e.target.select()}
                        className={`w-24 px-2 py-1 border rounded-lg text-right font-bold text-xs focus:bg-white focus:outline-blue-500 ${
                          item.prixAchat > 0 && item.prixUnitaire < item.prixAchat 
                            ? 'bg-rose-50 border-rose-400 text-rose-700' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-800">
                      {(item.prixUnitaire * item.quantite).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 text-xs">
                    Votre panier est vide. Recherchez des produits ci-dessus pour les ajouter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payment & Totals Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          {/* Payment method & notes */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mode de Paiement</label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-blue-500"
              >
                <option value="ESPECES">Espèces (Comptant)</option>
                <option value="CARTE">Carte Bancaire</option>
                <option value="VIREMENT">Virement / Mobile Money</option>
                <option value="CHEQUE">Chèque</option>
                <option value="A_CREDIT">À Crédit (Dette client)</option>
                <option value="MIXTE">Mixte / Partiel</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">TVA (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={tauxTva ?? ''}
                onChange={(e) => setTauxTva(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Montant Payé / Encaissé (DA)</label>
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="0.000"
                value={montantPaye ?? ''}
                onChange={(e) => setMontantPaye(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-blue-600 focus:outline-blue-500 text-base"
              />
            </div>
          </div>

          {/* Total Breakdown */}
          <div className="space-y-2 flex flex-col justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Total HT :</span>
                <span>{Number(totalHT).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Montant TVA ({tauxTva || 0}%) :</span>
                <span>{Number(montantTva).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-base font-black text-slate-900">
                <span>Total TTC :</span>
                <span className="text-blue-600">{Number(totalTTC).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Reste Dû (Dette Client) :</span>
                <span className={`text-sm ${montantReste > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {Number(montantReste).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading || cart.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-lg shadow-blue-500/25 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{loading ? 'Validation en cours...' : 'Valider & Enregistrer la Vente'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
