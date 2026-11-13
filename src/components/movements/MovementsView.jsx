import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  FileSpreadsheet, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Truck,
  RotateCcw,
  Sliders,
  Plus,
  FileText,
  Eye,
  DollarSign,
  Layers,
  Wrench
} from 'lucide-react';
import { api } from '../../services/api';
import DateFilter from '../common/DateFilter';
import CreatePurchaseModal from '../purchases/CreatePurchaseModal';
import ExportColumnsModal from '../common/ExportColumnsModal';
import ProductMovementsSection from './ProductMovementsSection';
import { useLanguage } from '../../context/LanguageContext';

const MOVEMENTS_EXPORT_COLUMNS = [
  { key: 'date', label: 'Date & Heure', group: '1. Informations Générales' },
  { key: 'type', label: 'Type de Mouvement (Entrée/Sortie/Achat/Vente/Ajustement)', group: '1. Informations Générales' },
  { key: 'motif', label: 'Motif / Justificatif / Note', group: '1. Informations Générales' },
  
  { key: 'refProduit', label: 'Référence Article', group: '2. Article' },
  { key: 'nomProduit', label: 'Désignation Article', group: '2. Article' },
  
  { key: 'quantite', label: 'Quantité Mouvementée (+ / -)', group: '3. Quantités & Niveaux de Stock' },
  { key: 'avant', label: 'Stock Avant Mouvement', group: '3. Quantités & Niveaux de Stock' },
  { key: 'apres', label: 'Stock Après Mouvement', group: '3. Quantités & Niveaux de Stock' },
  
  { key: 'prixAchat', label: 'Prix d’Achat Unitaire (DA)', group: '4. Valorisation & Tiers' },
  { key: 'fournisseurDoc', label: 'Fournisseur / N° Document Référence', group: '4. Valorisation & Tiers' }
];

export default function MovementsView({ isActive = true }) {
  const { t, isRTL } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState('product-movements'); // 'product-movements' | 'movements' | 'purchases'
  const [movements, setMovements] = useState([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('TOUS');
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Create purchase modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async (filterParams) => {
    try {
      setLoading(true);
      const params = filterParams || {
        type: selectedType,
        period,
        startDate,
        endDate,
        search
      };

      const [movRes, purRes] = await Promise.all([
        api.stock.getMovements(params),
        api.purchase.getAll({ search })
      ]);

      if (movRes.success) setMovements(movRes.data || []);
      if (purRes.success) setPurchaseInvoices(purRes.data || []);
    } catch (err) {
      console.error('Erreur chargement mouvements/achats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType, period, startDate, endDate, search]);

  // Synchronisation temps réel : Recharger dès que l'onglet devient actif
  useEffect(() => {
    if (isActive) {
      loadData();
    }
  }, [isActive]);

  // Synchronisation temps réel : Recharger immédiatement sur toute modification
  useEffect(() => {
    const handleDataChange = () => {
      loadData();
    };
    window.addEventListener('app:refresh-data', handleDataChange);
    return () => window.removeEventListener('app:refresh-data', handleDataChange);
  }, []);

  const handleExportExcel = () => {
    setIsExportModalOpen(true);
  };

  const handleExecuteExport = async (columns) => {
    const res = await api.stock.exportMovementsExcel({
      type: selectedType,
      startDate,
      endDate,
      columns
    });
    if (res.success) {
      showToast(`Export réussi ! ${res.count} mouvements exportés avec ${columns.length} colonnes sélectionnées.`);
    }
  };

  // Summaries
  const totalEntries = movements
    .filter((m) => m.quantite > 0)
    .reduce((sum, m) => sum + m.quantite, 0);

  const totalExits = movements
    .filter((m) => m.quantite < 0)
    .reduce((sum, m) => sum + Math.abs(m.quantite), 0);

  const totalAchatsMontant = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <span>{t('mov_title')}</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold">{t('mov_subtitle')}</p>
        </div>

        {activeSubTab !== 'product-movements' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsPurchaseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('mov_newPurchase')}</span>
            </button>

            <DateFilter
              period={period}
              setPeriod={setPeriod}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              onFilterChange={loadData}
            />

            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{t('stock_exportExcel')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation: Fiche Mouvements par Produit vs Journal Global vs Factures d'Achat */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('product-movements')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer ${
            activeSubTab === 'product-movements'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Fiche Mouvements par Produit</span>
        </button>

        <button
          onClick={() => setActiveSubTab('movements')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === 'movements'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Journal Global ({movements.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('purchases')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === 'purchases'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{t('mov_tabPurchases')} ({purchaseInvoices.length})</span>
        </button>
      </div>

      {/* SECTION 1 : FICHE MOUVEMENTS PAR PRODUIT (AVEC INPUT LIBRE, SUGGESTION & FILTRE DE DATE) */}
      {activeSubTab === 'product-movements' && (
        <ProductMovementsSection />
      )}

      {/* SECTIONS 2 & 3 : JOURNAL GLOBAL & FACTURES D'ACHAT */}
      {activeSubTab !== 'product-movements' && (
        <>
          {/* KPIs Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-3.5">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold block">{t('mov_totalPurchases')}</span>
                <span className="text-lg font-black text-slate-800">
                  {totalAchatsMontant.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
                </span>
                <span className="text-[10px] text-slate-400 block">{purchaseInvoices.length} {t('mov_purchasesCount')}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold block">{t('mov_totalEntries')}</span>
                <span className="text-lg font-black text-emerald-600">+{totalEntries}</span>
                <span className="text-[10px] text-slate-400 block">{t('mov_entriesSub')}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs flex items-center gap-3.5">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold block">{t('mov_totalExits')}</span>
                <span className="text-lg font-black text-rose-600">-{totalExits}</span>
                <span className="text-[10px] text-slate-400 block">{t('mov_exitsSub')}</span>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('mov_searchPlaceholder')}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
              />
            </div>

            {activeSubTab === 'movements' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Sliders className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-blue-500 cursor-pointer"
                >
                  <option value="TOUS">{t('all')}</option>
                  <option value="ACHAT_FOURNISSEUR">Achats Fournisseurs (+)</option>
                  <option value="VENTE">Ventes en Caisse (-)</option>
                  <option value="PIECE_REPARATION_SAV">Pièces Atelier SAV (-)</option>
                  <option value="RETOUR_VENTE">Retours de Vente (+)</option>
                  <option value="AJUSTEMENT_INVENTAIRE">Ajustements Inventaire</option>
                </select>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 1: FACTURES D'ACHAT FOURNISSEURS */}
      {activeSubTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-start">{t('mov_numPurchaseInvoice')}</th>
                  <th className="px-4 py-3 text-start">{t('inv_date')}</th>
                  <th className="px-4 py-3 text-start">{t('mov_supplier')}</th>
                  <th className="px-4 py-3 text-center">{t('mov_articlesCount')}</th>
                  <th className="px-4 py-3 text-end">{t('mov_totalHt')}</th>
                  <th className="px-4 py-3 text-end">{t('mov_totalTtc')}</th>
                  <th className="px-4 py-3 text-center">{t('mov_payment')}</th>
                  <th className="px-4 py-3 text-center">{t('mov_action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {purchaseInvoices.length > 0 ? (
                  purchaseInvoices.map((inv) => {
                    const invoiceDate = inv.dateFactureAchat || inv.created_at || inv.createdAt;
                    const dateObj = invoiceDate ? new Date(invoiceDate) : new Date();
                    const formattedDate = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr key={inv._id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-600 block">{inv.numeroFactureAchat}</span>
                          {inv.notes && <span className="text-[10px] text-slate-400 block truncate max-w-xs">{inv.notes}</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {formattedDate}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {inv.fournisseur}
                          {inv.contactFournisseur && (
                            <span className="block text-[10px] text-slate-400 font-normal">Tél: {inv.contactFournisseur}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[11px] font-bold text-slate-700">
                            {inv.items?.length || 0} {t('articles')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end text-slate-600 font-bold">
                          {(inv.totalHT || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
                        </td>
                        <td className="px-4 py-3 text-end font-black text-slate-900 text-sm">
                          {(inv.totalTTC || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            inv.statutPaiement === 'PAYE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.statutPaiement === 'PARTIEL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {inv.statutPaiement === 'PAYE' ? t('inv_paid') : inv.statutPaiement === 'PARTIEL' ? t('inv_partial') : t('inv_unpaid')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedPurchase(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('details')}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-bold text-slate-600">{t('no')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MOUVEMENTS DE STOCK DÉTAILLÉS */}
      {activeSubTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-start">{t('inv_date')}</th>
                  <th className="px-4 py-3 text-start">{t('mov_type')}</th>
                  <th className="px-4 py-3 text-start">{t('stock_designation')}</th>
                  <th className="px-4 py-3 text-center">{t('mov_variation')}</th>
                  <th className="px-4 py-3 text-center">{t('mov_stockBeforeAfter')}</th>
                  <th className="px-4 py-3 text-end">{t('mov_puPurchase')}</th>
                  <th className="px-4 py-3 text-start">{t('mov_reasonDoc')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {movements.length > 0 ? (
                  movements.map((m) => {
                    const isPositive = m.quantite > 0;
                    return (
                      <tr key={m._id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('fr-DZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${
                            m.type === 'ACHAT_FOURNISSEUR'
                              ? 'bg-blue-100 text-blue-800'
                              : m.type === 'VENTE'
                              ? 'bg-purple-100 text-purple-800'
                              : (m.type === 'PIECE_REPARATION_SAV' || m.type === 'SORTIE_REPARATION')
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : (m.type === 'ANNULATION_REPARATION' || m.type === 'RETOUR_SAV')
                              ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                              : m.type === 'RETOUR_VENTE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {m.type === 'ACHAT_FOURNISSEUR' && <Truck className="w-3 h-3" />}
                            {m.type === 'VENTE' && <ArrowUpRight className="w-3 h-3" />}
                            {(m.type === 'PIECE_REPARATION_SAV' || m.type === 'SORTIE_REPARATION') && <Wrench className="w-3 h-3" />}
                            {(m.type === 'ANNULATION_REPARATION' || m.type === 'RETOUR_SAV') && <RotateCcw className="w-3 h-3" />}
                            {m.type === 'RETOUR_VENTE' && <RotateCcw className="w-3 h-3" />}
                            <span>{m.type === 'PIECE_REPARATION_SAV' ? 'Pièce Atelier SAV' : m.type.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-800 block">{m.product?.nom || 'Article inconnu'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Réf: {m.product?.reference || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                            isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {isPositive ? `+${m.quantite}` : m.quantite} {m.product?.unite || 'pcs'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px]">
                          {m.quantiteAvant} → <strong className="text-slate-800">{m.quantiteApres}</strong>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {m.prixAchatUnitaire ? `${m.prixAchatUnitaire.toLocaleString('fr-DZ')} DA` : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <span className="block font-medium">{m.motif || '-'}</span>
                          {m.referenceDocument && (
                            <span className="text-[10px] text-blue-600 font-mono block">Doc: {m.referenceDocument}</span>
                          )}
                          {m.fournisseur && (
                            <span className="text-[10px] text-slate-400 block">Fournisseur: {m.fournisseur}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-bold text-slate-600">Aucun mouvement de stock</p>
                      <p className="text-xs text-slate-400 mt-0.5">Les mouvements apparaîtront lors des ventes, achats ou ajustements.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Création Facture d'Achat */}
      <CreatePurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onPurchaseCreated={() => {
          showToast("Facture d'achat enregistrée avec succès !");
          loadData();
        }}
      />

      {/* Modal Détail Facture d'Achat */}
      {selectedPurchase && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content modal-container bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Détails Facture Achat : {selectedPurchase.numeroFactureAchat}</h3>
                <span className="text-xs text-slate-500">Fournisseur : <strong>{selectedPurchase.fournisseur}</strong> • Date : {new Date(selectedPurchase.createdAt).toLocaleString('fr-DZ')}</span>
              </div>
              <button
                onClick={() => setSelectedPurchase(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="p-2">Article</th>
                    <th className="p-2 text-center">Quantité</th>
                    <th className="p-2 text-right">P.U Achat</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPurchase.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-800">{it.nom} <span className="text-[10px] text-slate-400 font-mono">({it.reference})</span></td>
                      <td className="p-2 text-center font-black text-blue-600">{it.quantite}</td>
                      <td className="p-2 text-right font-semibold">{Number(it.prixAchatUnitaire || 0).toLocaleString('fr-DZ')} DA</td>
                      <td className="p-2 text-right font-black text-slate-900">{Number(it.totalLigne || 0).toLocaleString('fr-DZ')} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Total TTC Facture :</span>
              <span className="text-lg font-black text-slate-900">{Number(selectedPurchase.totalTTC || 0).toLocaleString('fr-DZ')} DA</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Columns Customization Modal */}
      <ExportColumnsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Personnaliser les Colonnes d'Exportation Excel (Mouvements)"
        availableColumns={MOVEMENTS_EXPORT_COLUMNS}
        onConfirm={handleExecuteExport}
      />
    </div>
  );
}
