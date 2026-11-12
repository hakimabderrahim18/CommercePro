import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { AlertOctagon, Save, Search, Package, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function CreateLossModal({ isOpen, onClose, onSuccess }) {
  const { t, isRTL } = useLanguage();

  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [formData, setFormData] = useState({
    product_id: '',
    quantite: 1,
    typePerte: 'CASSE',
    motif: '',
    declarePar: isRTL ? 'مسؤول المخزن' : 'Responsable Stock',
    dateDeclaration: new Date().toISOString().substring(0, 16)
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load products list on open
  useEffect(() => {
    if (isOpen) {
      loadProducts();
      setSelectedProduct(null);
      setProductSearch('');
      setFormData({
        product_id: '',
        quantite: 1,
        typePerte: 'CASSE',
        motif: '',
        declarePar: isRTL ? 'مسؤول المخزن' : 'Responsable Stock',
        dateDeclaration: new Date().toISOString().substring(0, 16)
      });
      setError('');
    }
  }, [isOpen]);

  const loadProducts = async () => {
    try {
      const res = await api.stock.getAll();
      if (res.success) {
        setProducts(res.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement produits', err);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return false;
    const term = productSearch.toLowerCase();
    return (
      (p.nom && p.nom.toLowerCase().includes(term)) ||
      (p.reference && p.reference.toLowerCase().includes(term)) ||
      (p.codeBarre && p.codeBarre.toLowerCase().includes(term)) ||
      (p.categorie && p.categorie.toLowerCase().includes(term)) ||
      (p.taille && p.taille.toLowerCase().includes(term)) ||
      (p.pointure && p.pointure.toLowerCase().includes(term)) ||
      (p.couleur && p.couleur.toLowerCase().includes(term))
    );
  }).slice(0, 8);

  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setFormData((prev) => ({
      ...prev,
      product_id: prod.id || prod._id,
      quantite: 1
    }));
    setProductSearch('');
  };

  const calculatedLossValue = selectedProduct
    ? (Number(formData.quantite) || 0) * (Number(selectedProduct.prixAchat) || 0)
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Veuillez rechercher et sélectionner un article.');
      return;
    }

    const qte = Number(formData.quantite);
    if (!qte || qte <= 0) {
      setError('La quantité déclarée doit être supérieure à zéro.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.loss.create({
        ...formData,
        product_id: selectedProduct.id || selectedProduct._id,
        reference: selectedProduct.reference,
        nom: selectedProduct.nom,
        categorie: selectedProduct.categorie,
        taille: selectedProduct.taille,
        pointure: selectedProduct.pointure,
        couleur: selectedProduct.couleur,
        genre: selectedProduct.genre,
        prixAchatUnitaire: selectedProduct.prixAchat || 0,
        prixVenteUnitaire: selectedProduct.prixVente || 0,
        valeurPerte: calculatedLossValue
      });

      if (res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de la déclaration de perte.');
      }
    } catch (err) {
      setError(err.message || 'Erreur de communication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('loss_newDeclaration')}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Sélection du Produit */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {t('loss_product')} <span className="text-rose-500">*</span>
          </label>

          {!selectedProduct ? (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t('loss_selectProductPlaceholder')}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-rose-500"
                autoFocus
              />

              {/* Suggestions dropdown */}
              {productSearch.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <div
                        key={p.id || p._id}
                        onClick={() => handleSelectProduct(p)}
                        className="p-2.5 hover:bg-rose-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{p.nom}</span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-mono font-bold text-blue-600">{p.reference}</span>
                            {p.taille && <span className="font-bold text-indigo-600">T: {p.taille}</span>}
                            {p.pointure && <span className="font-bold text-amber-600">P: {p.pointure}</span>}
                            {p.couleur && <span>{p.couleur}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            (p.quantite || 0) <= (p.seuilAlerte || 5) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {p.quantite} {p.unite}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Aucun article correspondant
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{selectedProduct.nom}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    <span className="font-mono font-bold text-slate-700">{selectedProduct.reference}</span>
                    {selectedProduct.taille && <span className="font-bold text-indigo-700">Taille: {selectedProduct.taille}</span>}
                    {selectedProduct.pointure && <span className="font-bold text-amber-700">Pointure: {selectedProduct.pointure}</span>}
                    {selectedProduct.couleur && <span>{selectedProduct.couleur}</span>}
                    <span className="text-slate-400">|</span>
                    <span className="font-bold text-emerald-700">{t('loss_stockAvailable')} {selectedProduct.quantite} {selectedProduct.unite}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 bg-white border border-rose-200 rounded-lg cursor-pointer"
              >
                Changer
              </button>
            </div>
          )}
        </div>

        {/* 2. Type de Perte & Quantité */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('type')} <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.typePerte}
              onChange={(e) => setFormData({ ...formData, typePerte: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-rose-500"
            >
              <option value="CASSE">{t('loss_type_CASSE')}</option>
              <option value="PERTE_VOL">{t('loss_type_PERTE_VOL')}</option>
              <option value="DEFAUT_FABRICATION">{t('loss_type_DEFAUT_FABRICATION')}</option>
              <option value="PERIME_AVARIE">{t('loss_type_PERIME_AVARIE')}</option>
              <option value="DEGAT_TRANSPORT">{t('loss_type_DEGAT_TRANSPORT')}</option>
              <option value="AUTRE">{t('loss_type_AUTRE')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t('loss_qtyDeclared')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={formData.quantite}
              onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-rose-600 focus:bg-white focus:outline-rose-500"
            />
          </div>
        </div>

        {/* 3. Date & Déclaré Par */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('loss_date')}</label>
            <input
              type="datetime-local"
              value={formData.dateDeclaration}
              onChange={(e) => setFormData({ ...formData, dateDeclaration: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('loss_declaredBy')}</label>
            <input
              type="text"
              value={formData.declarePar}
              onChange={(e) => setFormData({ ...formData, declarePar: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-rose-500"
              placeholder="Nom du déclarant / magasinier"
            />
          </div>
        </div>

        {/* 4. Motif & Circonstances */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">{t('loss_motif')}</label>
          <textarea
            rows="2"
            value={formData.motif}
            onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
            placeholder="Détails sur l'incident (ex: Chute lors de la mise en rayon, couture déchirée, boîte écrasée...)"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-rose-500"
          />
        </div>

        {/* Financial Summary & Stock Decrement Notice */}
        <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">{t('loss_totalLoss')} (Coût d'achat) :</span>
            <span className="text-base font-black text-rose-700">
              {calculatedLossValue.toLocaleString('fr-DZ')} {t('currency')}
            </span>
          </div>

          <div className="pt-2 border-t border-rose-200/60 flex items-center gap-1.5 text-[11px] text-rose-800 font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{t('loss_stockNotice')} ({Number(formData.quantite) || 0} {selectedProduct?.unite || 'pcs'})</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={loading || !selectedProduct}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-md shadow-rose-500/20 disabled:opacity-50 cursor-pointer"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>{loading ? t('loading') : t('confirm')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
