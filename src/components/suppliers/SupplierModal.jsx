import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { Building, Phone, Mail, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function SupplierModal({ isOpen, onClose, supplier, onSaved }) {
  const { t } = useLanguage();
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [soldeInitial, setSoldeInitial] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!supplier?._id;

  useEffect(() => {
    if (isOpen) {
      if (supplier) {
        setNom(supplier.nom || '');
        setTelephone(supplier.telephone || '');
        setEmail(supplier.email || '');
        setAdresse(supplier.adresse || '');
        setSoldeInitial(supplier.soldeDette || 0);
        setNotes(supplier.notes || '');
      } else {
        setNom('');
        setTelephone('');
        setEmail('');
        setAdresse('');
        setSoldeInitial(0);
        setNotes('');
      }
      setError('');
    }
  }, [isOpen, supplier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      setError('Le nom du fournisseur est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        nom: nom.trim(),
        telephone: telephone.trim(),
        email: email.trim(),
        adresse: adresse.trim(),
        soldeInitial: parseFloat(soldeInitial) || 0,
        notes: notes.trim()
      };

      let res;
      if (isEdit) {
        res = await api.supplier.update(supplier._id, payload);
      } else {
        res = await api.supplier.create(payload);
      }

      if (res.success) {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur enregistrement fournisseur.');
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
      title={isEdit ? 'Modifier la Fiche Fournisseur' : 'Nouveau Fournisseur'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Nom du Fournisseur / Société *</label>
          <input
            type="text"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex: Sarl Import Agro, ETS Benali..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
            <input
              type="text"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="0550 00 00 00"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@fournisseur.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
          <input
            type="text"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Adresse, Ville"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-blue-500"
          />
        </div>

        {!isEdit && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Solde Dette Initial (DA)</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={soldeInitial ?? ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setSoldeInitial(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Si vous avez une dette préexistante envers ce fournisseur.</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Observations</label>
          <textarea
            rows="2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Conditions de livraison, délais de paiement..."
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-500"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
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
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer Fournisseur'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
