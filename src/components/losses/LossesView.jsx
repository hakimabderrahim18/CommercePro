import React, { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  Plus, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  Eye, 
  Trash2, 
  Calendar, 
  Filter, 
  Package, 
  ShieldAlert, 
  TrendingDown, 
  Clock, 
  Sparkles,
  Layers,
  Pencil
} from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import CreateLossModal from './CreateLossModal';
import EditLossModal from './EditLossModal';
import LossReceiptModal from './LossReceiptModal';

export default function LossesView() {
  const { t, isRTL } = useLanguage();

  const [losses, setLosses] = useState([]);
  const [stats, setStats] = useState({
    totalQuantite: 0,
    totalValeurPerte: 0,
    countIncidents: 0,
    countCeMois: 0,
    valeurCeMois: 0
  });

  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('ALL'); // 'ALL', 'CASSE', 'PERTE_VOL', 'DEFAUT_FABRICATION'

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('TOUS');
  const [selectedCategory, setSelectedCategory] = useState('TOUS');
  const [dateFilter, setDateFilter] = useState('THIS_MONTH'); // 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL', 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLossForReceipt, setSelectedLossForReceipt] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [editLoss, setEditLoss] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchLosses = async () => {
    try {
      setLoading(true);
      const filters = {
        search,
        typePerte: activeSubTab !== 'ALL' ? activeSubTab : selectedType,
        categorie: selectedCategory,
        dateFilter: dateFilter === 'ALL' ? null : dateFilter,
        startDate: dateFilter === 'CUSTOM' ? startDate : null,
        endDate: dateFilter === 'CUSTOM' ? endDate : null
      };

      const res = await api.loss.getAll(filters);
      if (res.success) {
        setLosses(res.data || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('Erreur chargement pertes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLosses();
  }, [search, selectedType, selectedCategory, dateFilter, startDate, endDate, activeSubTab]);

  const handleDeleteLoss = async (loss) => {
    if (!window.confirm(t('loss_deleteConfirm'))) {
      return;
    }

    try {
      const res = await api.loss.delete(loss.id || loss._id);
      if (res.success) {
        fetchLosses();
      } else {
        alert(res.error || 'Erreur lors de l’annulation.');
      }
    } catch (err) {
      alert(err.message || 'Erreur de connexion.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await api.loss.exportExcel({
        search,
        typePerte: activeSubTab !== 'ALL' ? activeSubTab : selectedType
      });
      if (res.success) {
        alert(`Exportation réussie ! ${res.count} déclarations exportées.`);
      }
    } catch (err) {
      console.error('Erreur export Excel pertes', err);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'CASSE':
        return <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[11px]">{t('loss_type_CASSE')}</span>;
      case 'PERTE_VOL':
        return <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-bold text-[11px]">{t('loss_type_PERTE_VOL')}</span>;
      case 'DEFAUT_FABRICATION':
        return <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px]">{t('loss_type_DEFAUT_FABRICATION')}</span>;
      case 'PERIME_AVARIE':
        return <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200 font-bold text-[11px]">{t('loss_type_PERIME_AVARIE')}</span>;
      case 'DEGAT_TRANSPORT':
        return <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-bold text-[11px]">{t('loss_type_DEGAT_TRANSPORT')}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-semibold text-[11px]">{t('loss_type_AUTRE')}</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <AlertOctagon className="w-7 h-7 text-rose-600" />
            <span>{t('loss_title')}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {t('loss_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t('loss_exportExcel')}</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-md shadow-rose-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('loss_newDeclaration')}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Quantité Perdue */}
        <div className="p-4 bg-white rounded-2xl border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">{t('loss_kpiTotalQty')}</span>
            <span className="text-2xl font-black text-rose-600 tracking-tight">
              {stats.totalQuantite.toLocaleString('fr-DZ')} <span className="text-xs font-bold text-slate-400">pcs</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Total Valeur Perte (DA) */}
        <div className="p-4 bg-white rounded-2xl border border-rose-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">{t('loss_kpiTotalValue')}</span>
            <span className="text-2xl font-black text-rose-700 tracking-tight">
              {stats.totalValeurPerte.toLocaleString('fr-DZ')} <span className="text-xs font-bold text-rose-500">{t('currency')}</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Incidents Déclarés */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">{t('loss_kpiCountIncidents')}</span>
            <span className="text-2xl font-black text-slate-800 tracking-tight">
              {stats.countIncidents} <span className="text-xs font-bold text-slate-400">déclarations</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Pertes Ce Mois */}
        <div className="p-4 bg-white rounded-2xl border border-blue-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">{t('loss_kpiMonthLoss')}</span>
            <span className="text-2xl font-black text-blue-700 tracking-tight">
              {stats.valeurCeMois.toLocaleString('fr-DZ')} <span className="text-xs font-bold text-blue-500">{t('currency')}</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'ALL', label: t('loss_tabAll') },
          { id: 'CASSE', label: t('loss_tabCasse') },
          { id: 'PERTE_VOL', label: t('loss_tabVol') },
          { id: 'DEFAUT_FABRICATION', label: t('loss_tabDefaut') }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par n° déclaration, article, taille, motif..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-rose-500"
          />
        </div>

        {/* Date Filter & Refresh */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-rose-500"
          >
            <option value="ALL">{t('all')}</option>
            <option value="TODAY">{t('today')}</option>
            <option value="THIS_WEEK">{t('thisWeek')}</option>
            <option value="THIS_MONTH">{t('thisMonth')}</option>
            <option value="CUSTOM">{t('custom')}</option>
          </select>

          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
              />
              <span className="text-xs text-slate-400">à</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
              />
            </div>
          )}

          <button
            onClick={fetchLosses}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Losses History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">{t('loss_numDeclaration')}</th>
                <th className="px-5 py-3">{t('loss_date')}</th>
                <th className="px-5 py-3">{t('loss_product')}</th>
                <th className="px-5 py-3">{t('type')}</th>
                <th className="px-5 py-3 text-center">{t('loss_qtyDeclared')}</th>
                <th className="px-5 py-3 text-right">{t('loss_unitLoss')}</th>
                <th className="px-5 py-3 text-right">{t('loss_totalLoss')}</th>
                <th className="px-5 py-3">{t('loss_declaredBy')}</th>
                <th className="px-5 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {losses.length > 0 ? (
                losses.map((loss) => {
                  const dateStr = new Date(loss.dateDeclaration || loss.created_at || Date.now()).toLocaleDateString('fr-DZ', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  });

                  return (
                    <tr key={loss.id || loss._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                          {loss.numeroDeclaration}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">
                        {dateStr}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 text-sm block">{loss.nom}</span>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono font-semibold">{loss.reference}</span>
                          {loss.taille && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold">
                              T: {loss.taille}
                            </span>
                          )}
                          {loss.pointure && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-bold">
                              P: {loss.pointure}
                            </span>
                          )}
                          {loss.couleur && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                              {loss.couleur}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {getTypeBadge(loss.typePerte)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 font-black text-xs">
                          - {loss.quantite} pcs
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-slate-500">
                        {Number(loss.prixAchatUnitaire || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-rose-700 text-sm">
                        {Number(loss.valeurPerte || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-medium">
                        {loss.declarePar || 'Responsable Stock'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Modifier la déclaration */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditLoss(loss);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="Modifier cette perte / casse"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Voir / Imprimer le Bon de Perte */}
                          <button
                            onClick={() => {
                              setSelectedLossForReceipt(loss);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Voir / Imprimer le Bon"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Annuler / Supprimer la Déclaration */}
                          <button
                            onClick={() => handleDeleteLoss(loss)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Annuler (Ré-incrémente le stock)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertOctagon className="w-8 h-8 text-slate-300" />
                      <span className="text-xs font-semibold">Aucune perte ou casse enregistrée pour cette sélection</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Loss Modal */}
      <CreateLossModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchLosses();
        }}
      />

      {/* Edit Loss Modal */}
      <EditLossModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditLoss(null);
        }}
        loss={editLoss}
        onLossUpdated={() => {
          fetchLosses();
        }}
      />

      {/* Loss Receipt Modal */}
      <LossReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedLossForReceipt(null);
        }}
        loss={selectedLossForReceipt}
      />
    </div>
  );
}
