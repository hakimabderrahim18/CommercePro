import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { Save, User } from 'lucide-react';

export default function CustomerModal({ isOpen, onClose, customer, onSaved }) {
  const [formData, setFormData] = useState({
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
    plafondCredit: 0,
    soldeDetteInitial: 0,
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) {
      setFormData({
        nom: customer.nom || '',
        telephone: customer.telephone || '',
        email: customer.email || '',
        adresse: customer.adresse || '',
        plafondCredit: customer.plafondCredit || 0,
        soldeDetteInitial: 0,
        notes: customer.notes || ''
      });
    } else {
      setFormData({
        nom: '',
        telephone: '',
        email: '',
        adresse: '',
        plafondCredit: 0,
        soldeDetteInitial: 0,
        notes: ''
      });
    }
    setError('');
  }, [customer, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom.trim()) {
      setError('Le nom du client est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        nom: formData.nom.trim(),
        telephone: formData.telephone?.trim() || '',
        email: formData.email?.trim() || '',
        adresse: formData.adresse?.trim() || '',
        plafondCredit: Number(formData.plafondCredit) || 0,
        soldeDetteInitial: Number(formData.soldeDetteInitial) || 0,
        notes: formData.notes?.trim() || ''
      };

      let res;
      if (customer?._id) {
        res = await api.customer.update(customer._id, payload);
      } else {
        res = await api.customer.create(payload);
      }

      if (res.success) {
        if (onSaved) onSaved(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de l’enregistrement du client.');
      }
    } catch (err) {
      setError(err.message || 'Erreur de connexion à la base de données.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer ? `Modifier le client : ${customer.nom}` : 'Ajouter un nouveau client'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {/* Nom */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Nom complet / Entreprise *</label>
          <input
            type="text"
            required
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
            placeholder="Ex: Société Alpha ou M. Dupont"
          />
        </div>

        {/* Téléphone & Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
            <input
              type="text"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
              placeholder="Ex: +221 77 000 00 00"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
              placeholder="client@exemple.com"
            />
          </div>
        </div>

        {/* Adresse */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
          <input
            type="text"
            value={formData.adresse}
            onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
            placeholder="Ex: Rue 14, Quartier Commercial"
          />
        </div>

        {/* Plafond de crédit & Dette initiale */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Plafond Crédit Autorisé (DA)</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={formData.plafondCredit ?? ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setFormData({ ...formData, plafondCredit: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
              placeholder="0 = Sans limite"
            />
          </div>

          {!customer && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Solde Dette Initial (DA)</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={formData.soldeDetteInitial ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFormData({ ...formData, soldeDetteInitial: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-blue-500"
                placeholder="0"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Informations complémentaires</label>
          <textarea
            rows="2"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            placeholder="Observations particulières..."
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
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Enregistrement...' : 'Enregistrer le Client'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
