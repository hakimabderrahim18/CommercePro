import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Minus, 
  Search, 
  FileSpreadsheet, 
  Eye, 
  Printer,
  Trash2, 
  CreditCard, 
  Banknote, 
  Landmark, 
  SlidersHorizontal,
  Calendar,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import DateFilter from '../common/DateFilter';
import CreateTransactionModal from './CreateTransactionModal';
import TransactionReceiptModal from './TransactionReceiptModal';
import DailyCaissePrintModal from './DailyCaissePrintModal';
import { useLanguage } from '../../context/LanguageContext';

export default function TreasuryView() {
  const { t, isRTL } = useLanguage();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalEncaissements: 0,
    totalDecaissements: 0,
    soldeNet: 0,
    totalEspeces: 0,
    totalCheques: 0,
    totalVirements: 0,
    totalCartes: 0,
    count: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [typeFilter, setTypeFilter] = useState('TOUS');
  const [search, setSearch] = useState('');
  const [modePaiement, setModePaiement] = useState('TOUS');
  const [categorie, setCategorie] = useState('TOUS');
  const [caisseFilter, setCaisseFilter] = useState('TOUS');
  const [caisses, setCaisses] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState('ENCAISSEMENT');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDailyPrintModalOpen, setIsDailyPrintModalOpen] = useState(false);

  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchTransactions = async (filterParams) => {
    try {
      setLoading(true);
      const params = filterParams || {
        type: typeFilter,
        search,
        modePaiement,
        categorie,
        caisse: caisseFilter,
        period,
        startDate,
        endDate
      };

      const [res, caisseRes, dailyRes] = await Promise.all([
        api.treasury.getAll(params),
        api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false }),
        api.caisse ? api.caisse.getDailyStats() : Promise.resolve({ success: false })
      ]);

      if (res.success) {
        setTransactions(res.data || []);
        if (res.stats) setStats(res.stats);
      }
      if (caisseRes.success && caisseRes.data) {
        setCaisses(caisseRes.data);
      }
      if (dailyRes.success && dailyRes.data) {
        setDailyStats(dailyRes.data);
      }
    } catch (err) {
      console.error('Erreur chargement trésorerie:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter, search, modePaiement, categorie, caisseFilter, period, startDate, endDate]);

  const handleOpenCreate = (type) => {
    setCreateType(type);
    setIsCreateModalOpen(true);
  };

  const handleDeleteTransaction = async (tx) => {
    if (window.confirm(`${t('tre_confirmDelete')} (${tx.numeroTransaction} - ${tx.montant} ${t('currency')}) ?`)) {
      const res = await api.treasury.delete(tx._id || tx.id);
      if (res.success) {
        showToast('Transaction supprimée avec succès.');
        fetchTransactions();
      } else {
        showToast(res.error, 'error');
      }
    }
  };

  const handleExportExcel = async () => {
    const res = await api.treasury.exportExcel({
      type: typeFilter,
      search,
      modePaiement,
      categorie,
      period,
      startDate,
      endDate
    });
    if (res.success) {
      showToast('Journal de trésorerie exporté avec succès !');
    }
  };

  const handleDateFilterChange = (filter) => {
    setPeriod(filter.period);
    setStartDate(filter.startDate || '');
    setEndDate(filter.endDate || '');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between animate-in slide-in-from-top duration-200 ${
          notification.type === 'error' 
            ? 'bg-rose-50 border-rose-200 text-rose-700' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} className="text-xs font-bold underline cursor-pointer">{t('close')}</button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">{t('tre_title')}</h2>
          <p className="text-xs text-slate-500 font-medium">{t('tre_subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t('tre_exportExcel')}</span>
          </button>

          <button
            onClick={() => setIsDailyPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition shadow-xs cursor-pointer"
            title="Imprimer le point de caisse journalier et l'état de trésorerie"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>{t('treasury_print_daily')}</span>
          </button>

          <button
            onClick={() => handleOpenCreate('DECAISSEMENT')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-md shadow-rose-500/20 cursor-pointer"
          >
            <Minus className="w-4 h-4" />
            <span>{t('tre_newOutflow')}</span>
          </button>

          <button
            onClick={() => handleOpenCreate('ENCAISSEMENT')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('tre_newInflow')}</span>
          </button>
        </div>
      </div>

      {/* Daily Caisse breakdown widget */}
      {dailyStats.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-blue-600" />
              <span>{t('pos_dailyCaisseStats') || 'Point des Caisses du Jour (Recettes & Dépenses)'}</span>
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">{new Date().toLocaleDateString(isRTL ? 'ar-DZ' : 'fr-FR')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {dailyStats.map((c) => (
              <div key={c.id || c.nom} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-800 block">{c.nom}</span>
                  <span className="text-[10px] text-slate-500">{c.todayTxCount || 0} opérations</span>
                </div>
                <div className="text-end">
                  <span className={`text-xs font-black block ${Number(c.todayBalance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {Number(c.todayBalance || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    +{Number(c.todayEncaissements || 0)} / -{Number(c.todayDecaissements || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Encaissements */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">{t('tre_totalInflows')}</span>
            <span className="text-lg font-black text-emerald-600">
              +{stats.totalEncaissements.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        {/* Total Décaissements */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">{t('tre_totalOutflows')}</span>
            <span className="text-lg font-black text-rose-600">
              -{stats.totalDecaissements.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Solde Net */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">{t('tre_netBalance')}</span>
            <span className={`text-lg font-black ${stats.soldeNet >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              {stats.soldeNet.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Espèces en Caisse */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">{t('tre_cashBalance')}</span>
            <span className="text-lg font-black text-slate-800">
              {stats.totalEspeces.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Banknote className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Sub-tabs & Triple Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Top bar with Subtabs and Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Subtabs Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => setTypeFilter('TOUS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'TOUS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t('tre_tabAll')}
            </button>
            <button
              onClick={() => setTypeFilter('ENCAISSEMENT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                typeFilter === 'ENCAISSEMENT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>{t('tre_tabInflows')}</span>
            </button>
            <button
              onClick={() => setTypeFilter('DECAISSEMENT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                typeFilter === 'DECAISSEMENT' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{t('tre_tabOutflows')}</span>
            </button>
          </div>

          {/* Search input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tre_searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            />
          </div>
        </div>

        {/* Bottom bar with Payment Method and Date Range Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Mode de Paiement */}
            <select
              value={modePaiement}
              onChange={(e) => setModePaiement(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-blue-500 cursor-pointer"
            >
              <option value="TOUS">{t('tre_allMethods')}</option>
              <option value="ESPECES">{t('pos_cash')}</option>
              <option value="CHEQUE">{t('pos_check')}</option>
              <option value="VIREMENT">{t('pos_transfer')}</option>
              <option value="CARTE">{t('pos_card')}</option>
            </select>

            {/* Caisse Filter */}
            <select
              value={caisseFilter}
              onChange={(e) => setCaisseFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-blue-500 cursor-pointer"
            >
              <option value="TOUS">Toutes les caisses</option>
              {caisses.map((c) => (
                <option key={c.id || c.nom} value={c.nom}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <DateFilter onChange={handleDateFilterChange} />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3.5 text-start">{t('tre_numTx')}</th>
                <th className="px-4 py-3.5 text-start">{t('inv_date')}</th>
                <th className="px-4 py-3.5 text-start">{t('tre_category')}</th>
                <th className="px-4 py-3.5 text-start">{t('tre_tiers')}</th>
                <th className="px-4 py-3.5 text-end">{t('tre_amount')}</th>
                <th className="px-4 py-3.5 text-center">{t('tre_method')}</th>
                <th className="px-4 py-3.5 text-start">{t('tre_refDoc')}</th>
                <th className="px-4 py-3.5 text-start">{t('tre_motif')}</th>
                <th className="px-4 py-3.5 text-center">{t('tre_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const isInflow = tx.type === 'ENCAISSEMENT';
                  const tiersName = tx.client?.nom || tx.fournisseur || tx.tiers || '-';
                  const dateObj = new Date(tx.dateTransaction || tx.created_at || Date.now());
                  const formattedDate = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={tx._id || tx.id} className="hover:bg-slate-50/80 transition">
                      {/* N° Transaction */}
                      <td className="px-4 py-3.5 font-mono font-bold text-blue-600">
                        {tx.numeroTransaction}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-slate-500">
                        {formattedDate}
                      </td>

                      {/* Catégorie */}
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          isInflow 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {tx.categorie}
                        </span>
                      </td>

                      {/* Tiers */}
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {tiersName}
                      </td>

                      {/* Montant */}
                      <td className={`px-4 py-3.5 text-end font-black text-sm ${
                        isInflow ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isInflow ? '+' : '-'}{Number(tx.montant || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
                      </td>

                      {/* Mode de Paiement */}
                      <td className="px-4 py-3.5 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold">
                          {tx.modePaiement}
                        </span>
                      </td>

                      {/* Réf Document */}
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {tx.referenceDocument || '-'}
                      </td>

                      {/* Motif */}
                      <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate text-[11px]">
                        {tx.motif || '-'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedTransaction(tx);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Aperçu & Reçu de Caisse"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteTransaction(tx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title={t('delete')}
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
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-bold text-slate-600">Aucune opération financière trouvée</p>
                    <p className="text-xs text-slate-400 mt-0.5">Enregistrez un encaissement ou un décaissement pour alimenter le journal de trésorerie.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Transaction Modal */}
      <CreateTransactionModal
        isOpen={isCreateModalOpen}
        initialType={createType}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          showToast(t('tre_successCreate'));
          fetchTransactions();
        }}
      />

      {/* Printable Receipt Modal */}
      <TransactionReceiptModal
        isOpen={isReceiptModalOpen}
        transaction={selectedTransaction}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedTransaction(null);
        }}
      />

      {/* Printable Daily Caisse & Treasury Report Modal */}
      <DailyCaissePrintModal
        isOpen={isDailyPrintModalOpen}
        onClose={() => setIsDailyPrintModalOpen(false)}
        transactions={transactions}
        stats={stats}
        caisses={caisses}
        dailyStats={dailyStats}
        selectedCaisse={caisseFilter}
        period={period}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
