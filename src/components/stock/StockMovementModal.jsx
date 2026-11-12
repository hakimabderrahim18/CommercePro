import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { PlusCircle, Save, Truck, Plus, X } from 'lucide-react';

export default function StockMovementModal({ isOpen, onClose, product, onSaved }) {
  const [formData, setFormData] = useState({
    type: 'ACHAT_FOURNISSEUR',
    quantite: 1,
    prixAchat: 0,
    fournisseur: '',
    referenceDoc: '',
    motif: 'Réapprovisionnement'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (api.supplier?.getAll) {
        api.supplier.getAll().then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const list = res.data.map((s) => ({
              id: s.id || s._id,
              nom: s.nom || s.name || '',
              telephone: s.telephone || '',
              soldeDette: Number(s.soldeDette || 0)
            })).filter(s => s.nom);
            setSuppliersList((prev) => {
              const combined = [...list];
              prev.forEach(p => {
                if (!combined.some(c => c.nom.toLowerCase() === p.nom.toLowerCase())) {
                  combined.push(p);
                }
              });
              return combined;
            });
            setAvailableSuppliers(list.map(s => s.nom));
          }
        }).catch(() => {});
      }
      if (api.stock?.getAll) {
        api.stock.getAll().then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            const sups = Array.from(new Set(res.data.map((p) => p.fournisseur).filter(Boolean)));
            setSuppliersList((prev) => {
              const combined = [...prev];
              sups.forEach(name => {
                if (!combined.some(c => c.nom.toLowerCase() === name.toLowerCase())) {
                  combined.push({ nom: name, telephone: '', soldeDette: 0 });
                }
              });
              return combined;
            });
            setAvailableSuppliers((prev) => Array.from(new Set([...prev, ...sups])));
          }
        }).catch(() => {});
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (product) {
      setFormData({
        type: 'ACHAT_FOURNISSEUR',
        quantite: 1,
        prixAchat: product.prixAchat || 0,
        fournisseur: product.fournisseur || '',
        referenceDoc: '',
        motif: 'Réapprovisionnement fournisseur'
      });
    }
    setError('');
  }, [product, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseFloat(formData.quantite) || 0;
    if (!qty || qty === 0) {
      setError('La quantité doit être différente de 0.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.stock.addPurchaseOrAdjustment({
        productId: product._id,
        quantite: qty,
        prixAchat: parseFloat(formData.prixAchat) || 0,
        fournisseur: formData.fournisseur,
        referenceDoc: formData.referenceDoc,
        type: formData.type,
        motif: formData.motif
      });

      if (res.success) {
        onSaved();
        onClose();
      } else {
        setError(res.error || 'Erreur lors de la mise à jour du stock.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  const currentQty = product.quantite || 0;
  const newQty = currentQty + Number(formData.quantite || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Mouvement de Stock : ${product.nom}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {/* Stock status indicator */}
        <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-600">Stock Actuel: <strong className="text-slate-900">{currentQty} {product.unite}</strong></span>
          <span className="text-slate-600">Nouveau Stock Estimé: <strong className={`text-base ${newQty >= currentQty ? 'text-emerald-600' : 'text-rose-600'}`}>{newQty} {product.unite}</strong></span>
        </div>

        {/* Type de mouvement */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Type d'opération</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
          >
            <option value="ACHAT_FOURNISSEUR">Achat Fournisseur / Réapprovisionnement (+)</option>
            <option value="AJUSTEMENT_INVENTAIRE">Ajustement d'Inventaire (+ ou -)</option>
          </select>
        </div>

        {/* Quantité à ajouter/retirer */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Quantité ({formData.type === 'ACHAT_FOURNISSEUR' ? 'à ajouter +' : '+ ou -'})
            </label>
            <input
              type="number"
              step="any"
              required
              value={formData.quantite ?? ''}
              onChange={(e) => {
                const clean = String(e.target.value).replace(/^0+(?=\d)/, '');
                setFormData({ ...formData, quantite: clean });
              }}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Prix d'Achat Unitaire (DA)</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={formData.prixAchat ?? ''}
              onChange={(e) => {
                const clean = String(e.target.value).replace(/^0+(?=\d)/, '');
                setFormData({ ...formData, prixAchat: clean });
              }}
              onFocus={(e) => e.target.select()}
              placeholder="0.000"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
            />
          </div>
        </div>

        {/* Fournisseur & N° Bon */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>Fournisseur</span>
              </label>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Saisie libre & Suggestions
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formData.fournisseur}
                onChange={(e) => {
                  setFormData({ ...formData, fournisseur: e.target.value });
                  setShowSupplierSuggestions(true);
                }}
                onFocus={() => setShowSupplierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 250)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
                placeholder="Ex: Fournisseur SARL"
              />
              {formData.fournisseur && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, fournisseur: '' });
                    setShowSupplierSuggestions(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full transition"
                  title="Effacer le fournisseur"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSupplierSuggestions && (
              <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                {(() => {
                  const query = (formData.fournisseur || '').trim().toLowerCase();
                  const filtered = suppliersList.filter(s =>
                    !query ||
                    (s.nom && s.nom.toLowerCase().includes(query)) ||
                    (s.telephone && s.telephone.includes(query))
                  );

                  if (filtered.length === 0 && formData.fournisseur && formData.fournisseur.trim().length > 0) {
                    return (
                      <div
                        onMouseDown={() => {
                          setShowSupplierSuggestions(false);
                        }}
                        className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between text-xs text-slate-600 transition"
                      >
                        <div className="flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Fournisseur libre : <b className="text-emerald-700 font-bold">"{formData.fournisseur}"</b></span>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Nouveau</span>
                      </div>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="p-3 text-xs text-slate-400 text-center italic">
                        Aucun fournisseur enregistré. Saisissez librement un nom ci-dessus.
                      </div>
                    );
                  }

                  return filtered.slice(0, 10).map((s, idx) => (
                    <div
                      key={s.id || idx}
                      onMouseDown={() => {
                        setFormData({ ...formData, fournisseur: s.nom });
                        setShowSupplierSuggestions(false);
                      }}
                      className="p-2 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between text-xs transition group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center text-slate-600 group-hover:text-blue-600 transition">
                          <Truck className="w-3 h-3" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 group-hover:text-blue-700">{s.nom}</span>
                          {s.telephone ? (
                            <span className="text-[10px] text-slate-400 block font-mono">Tél: {s.telephone}</span>
                          ) : null}
                        </div>
                      </div>
                      {s.soldeDette > 0 ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Dette: {Number(s.soldeDette).toLocaleString('fr-DZ')} DA
                        </span>
                      ) : null}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">N° Bon d'achat / Réf doc</label>
            <input
              type="text"
              value={formData.referenceDoc}
              onChange={(e) => setFormData({ ...formData, referenceDoc: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
              placeholder="Ex: BA-2026-09"
            />
          </div>
        </div>

        {/* Motif */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Motif / Commentaire</label>
          <input
            type="text"
            value={formData.motif}
            onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
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
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Validation...' : 'Valider le Mouvement'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
