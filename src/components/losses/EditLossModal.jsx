import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { AlertCircle, CheckCircle, Pencil } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function EditLossModal({ isOpen, onClose, loss, onLossUpdated }) {
  const { t } = useLanguage();
  const [quantite, setQuantite] = useState(1);
  const [typePerte, setTypePerte] = useState('CASSE');
  const [motif, setMotif] = useState('');
  const [declarePar, setDeclarePar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && loss) {
      setQuantite(Number(loss.quantite) || 1);
      setTypePerte(loss.typePerte || 'CASSE');
      setMotif(loss.motif || '');
      setDeclarePar(loss.declarePar || 'Responsable Stock');
      setError('');
    }
  }, [isOpen, loss]);

  if (!isOpen || !loss) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(quantite);
    if (!qty || qty <= 0) {
      setError('La quantité perdue doit être supérieure à 0.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const lossId = loss.id || loss._id;
      const res = await api.loss.update(lossId, {
        quantite: qty,
        typePerte,
        motif,
        declarePar
      });

      if (res.success) {
        if (onLossUpdated) onLossUpdated(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de la modification de la perte.');
      }
    } catch (err) {
      setError(err.message || 'Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Modifier Déclaration : ${loss.numeroDeclaration || ''}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
          <div className="font-black text-slate-800 text-sm">{loss.nom}</div>
          <div className="text-slate-500 font-mono">Réf: {loss.reference} | Prix Achat: {loss.prixAchatUnitaire} DA</div>
          <div className="text-[11px] text-amber-700 pt-1">
            <strong>Note :</strong> Modifier la quantité ajustera automatiquement le stock disponible et tracera la modification dans l'historique des mouvements.
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Type de Dépréciation / Perte</label>
          <select
            value={typePerte}
            onChange={(e) => setTypePerte(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
          >
            <option value="CASSE">Casse matériel</option>
            <option value="PERTE_VOL">Perte / Vol</option>
            <option value="DEFAUT_FABRICATION">Défaut de fabrication</option>
            <option value="PERIME_AVARIE">Produit avarié / périmé</option>
            <option value="DEGAT_TRANSPORT">Dégât transport</option>
            <option value="AUTRE">Autre motif</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Quantité Perdue / Cassée</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={quantite ?? ''}
            onChange={(e) => setQuantite(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
            onFocus={(e) => e.target.select()}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-rose-600 focus:outline-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Motif / Justification</label>
          <textarea
            rows="3"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-blue-500"
            placeholder="Précisez la cause ou les circonstances..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Déclaré par</label>
          <input
            type="text"
            value={declarePar}
            onChange={(e) => setDeclarePar(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-blue-500"
          />
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
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
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{loading ? 'Enregistrement...' : 'Valider la Modification'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
