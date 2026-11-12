import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Calendar, 
  Filter, 
  Trash2, 
  FileSpreadsheet, 
  TrendingDown, 
  RefreshCw,
  Building,
  CreditCard,
  Tag
} from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import DateFilter from '../common/DateFilter';
import CreateTransactionModal from '../treasury/CreateTransactionModal';

export default function ChargesView() {
  const { t, isRTL } = useLanguage();
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TOUS');
  const [search, setSearch] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const categoriesList = [
    { key: 'TOUS', label: 'Toutes les catégories' },
    { key: 'DEPENSE_LOYER', label: 'Loyer Commercial' },
    { key: 'DEPENSE_SALAIRE', label: 'Salaires & Primes' },
    { key: 'DEPENSE_ELECTRICITE', label: 'Électricité & Eau (Sonelgaz)' },
    { key: 'DEPENSE_TRANSPORT', label: 'Transport & Carburant' },
    { key: 'DEPENSE_FOURNITURES', label: 'Fournitures de bureau & Emballage' },
    { key: 'CHARGES_DIVERSES', label: 'Charges & Dépenses diverses' },
    { key: 'RETRAIT_GERANT', label: 'Retraits Caisse Maison (Gérant)' }
  ];

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchCharges = async (filters = {}) => {
    try {
      setLoading(true);
      const params = {
        type: 'DECAISSEMENT',
        period: filters.period || period,
        startDate: filters.startDate !== undefined ? filters.startDate : startDate,
        endDate: filters.endDate !== undefined ? filters.endDate : endDate,
        categorie: filters.categorie || (selectedCategory !== 'TOUS' ? selectedCategory : undefined),
        search: filters.search !== undefined ? filters.search : search
      };

      const res = await api.treasury.getAll(params);
      if (res.success) {
        // Exclure les paiements direct d'achats fournisseurs pour isoler les vraies charges d'exploitation
        const filtered = (res.data || []).filter(tx => 
          tx.categorie !== 'REGLEMENT_FOURNISSEUR' && tx.categorie !== 'ACOMPTE_COMMANDE_FOURNISSEUR'
        );
        setCharges(filtered);
      }
    } catch (err) {
      console.error('Erreur chargement charges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharges();
  }, [selectedCategory]);

  const handleFilterChange = (newFilters) => {
    fetchCharges(newFilters);
  };

  const handleDeleteCharge = async (id, num) => {
    if (window.confirm(`Confirmer la suppression de la charge ${num} ?`)) {
      const res = await api.treasury.delete(id);
      if (res.success) {
        showToast('Charge supprimée avec succès.');
        fetchCharges();
      } else {
        showToast(res.error || 'Erreur suppression', 'error');
      }
    }
  };

  const filteredCharges = charges.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (c.numeroTransaction && c.numeroTransaction.toLowerCase().includes(s)) ||
      (c.motif && c.motif.toLowerCase().includes(s)) ||
      (c.tiers && c.tiers.toLowerCase().includes(s)) ||
      (c.categorie && c.categorie.toLowerCase().includes(s))
    );
  });

  const totalCharges = filteredCharges.reduce((sum, c) => sum + (Number(c.montant) || 0), 0);
  const countCharges = filteredCharges.length;

  const getCategoryLabel = (cat) => {
    const found = categoriesList.find(c => c.key === cat);
    return found ? found.label : (cat || 'Autre charge');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border text-sm font-bold flex items-center justify-between shadow-md ${
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} className="text-xs font-bold underline cursor-pointer">Fermer</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-rose-600" />
            <span>Gestion des Charges & Dépenses</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold">Suivi des coûts d'exploitation (loyer, salaires, électricité, transport, fournitures)</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ajouter une Charge</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">Total Dépenses Période</span>
            <span className="text-2xl font-black text-rose-600 mt-1 block">
              {totalCharges.toLocaleString('fr-DZ')} {t('currency')}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">Nombre d'opérations</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {countCharges}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">Filtre Catégorie actif</span>
            <span className="text-sm font-black text-slate-800 mt-1 block truncate max-w-[200px]">
              {getCategoryLabel(selectedCategory)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Tag className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:border-rose-500 cursor-pointer"
            >
              {categoriesList.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <DateFilter
            period={period}
            setPeriod={setPeriod}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par motif, tiers, N°..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-rose-500 focus:outline-hidden"
            />
          </div>

          <button
            onClick={() => fetchCharges()}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-xs"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Charges Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">N° Transaction</th>
                <th className="px-5 py-3.5">Date & Heure</th>
                <th className="px-5 py-3.5">Catégorie</th>
                <th className="px-5 py-3.5">Motif / Description</th>
                <th className="px-5 py-3.5">Bénéficiaire / Tiers</th>
                <th className="px-5 py-3.5">Caisse</th>
                <th className="px-5 py-3.5">Mode</th>
                <th className="px-5 py-3.5 text-right">Montant</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCharges.length > 0 ? (
                filteredCharges.map((ch) => (
                  <tr key={ch.id || ch._id} className="hover:bg-rose-50/30 transition">
                    <td className="px-5 py-3.5 font-bold font-mono text-rose-600">
                      {ch.numeroTransaction}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(ch.dateTransaction || ch.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px]">
                        {getCategoryLabel(ch.categorie)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700 max-w-xs truncate" title={ch.motif}>
                      {ch.motif || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {ch.tiers || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {ch.caisse || 'Caisse 1'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-bold">
                      {ch.modePaiement}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-rose-600 text-sm">
                      {Number(ch.montant || 0).toLocaleString('fr-DZ')} {t('currency')}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleDeleteCharge(ch.id || ch._id, ch.numeroTransaction)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Supprimer la charge"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-400 font-bold text-xs">
                    Aucune charge ou dépense trouvée pour cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Charge Modal */}
      <CreateTransactionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        initialType="DECAISSEMENT"
        onSuccess={() => {
          showToast('Charge enregistrée avec succès.');
          fetchCharges();
        }}
      />
    </div>
  );
}
