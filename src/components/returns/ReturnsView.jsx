import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Search, 
  Package, 
  FileSpreadsheet, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Eye, 
  Truck, 
  ReceiptText, 
  Calendar,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../../services/api';
import DateFilter from '../common/DateFilter';
import CreateSaleReturnModal from './CreateSaleReturnModal';
import CreatePurchaseReturnModal from './CreatePurchaseReturnModal';
import ReturnDetailModal from './ReturnDetailModal';
import { useLanguage } from '../../context/LanguageContext';

export default function ReturnsView() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'purchases' | 'all'
  const [saleReturns, setSaleReturns] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [typeDocFilter, setTypeDocFilter] = useState('TOUS');
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isSaleReturnModalOpen, setIsSaleReturnModalOpen] = useState(false);
  const [isPurchaseReturnModalOpen, setIsPurchaseReturnModalOpen] = useState(false);
  const [selectedReturnForDetail, setSelectedReturnForDetail] = useState(null);

  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async (filterParams) => {
    try {
      setLoading(true);
      const params = filterParams || {
        search: searchName,
        productSearch: searchProduct,
        typeDocument: typeDocFilter,
        period,
        startDate,
        endDate
      };

      const [saleRes, purRes] = await Promise.all([
        api.returns.getSaleReturns(params),
        api.returns.getPurchaseReturns(params)
      ]);

      if (saleRes.success) setSaleReturns(saleRes.data || []);
      if (purRes.success) setPurchaseReturns(purRes.data || []);
    } catch (err) {
      console.error('Erreur chargement avoirs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchName, searchProduct, typeDocFilter, period, startDate, endDate]);

  const handleExportExcel = async () => {
    const isSale = activeTab === 'sales' || activeTab === 'all';
    const type = isSale ? 'SALE' : 'PURCHASE';
    const res = await api.returns.exportExcel({ type });
    if (res.success) {
      showToast(`Export Excel réussi ! ${res.count} avoirs exportés.`);
    }
  };

  const handleDeleteSaleReturn = async (ret) => {
    if (
      window.confirm(
        `Annuler l'avoir ${ret.numeroRetour} ?\n\nAttention : cette action va réajuster le stock en déduisant les articles retournés et rétablir le solde client.`
      )
    ) {
      const res = await api.returns.deleteSaleReturn(ret._id);
      if (res.success) {
        showToast(res.message);
        loadData();
      } else {
        showToast(res.error, 'error');
      }
    }
  };

  const handleDeletePurchaseReturn = async (ret) => {
    if (
      window.confirm(
        `Annuler le retour fournisseur ${ret.numeroAvoirAchat} ?\n\nAttention : cette action va ré-incrémenter le stock des articles retournés.`
      )
    ) {
      const res = await api.returns.deletePurchaseReturn(ret._id);
      if (res.success) {
        showToast(res.message);
        loadData();
      } else {
        showToast(res.error, 'error');
      }
    }
  };

  // Calculations
  const totalMontantVentes = saleReturns.reduce((sum, r) => sum + (Number(r.montantTotalRembourse) || 0), 0);
  const totalMontantAchats = purchaseReturns.reduce((sum, r) => sum + (Number(r.montantTotal) || 0), 0);

  // Merged list for 'all' tab
  const allReturns = [
    ...saleReturns.map(r => ({ ...r, originType: 'SALE' })),
    ...purchaseReturns.map(r => ({ ...r, originType: 'PURCHASE' }))
  ].sort((a, b) => new Date(b.dateRetour || b.dateAvoirAchat || b.createdAt) - new Date(a.dateRetour || a.dateAvoirAchat || a.createdAt));

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
          <h2 className="text-lg font-black text-slate-800 tracking-tight">{t('ret_title')}</h2>
          <p className="text-xs text-slate-500 font-semibold">{t('ret_subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsSaleReturnModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-md shadow-rose-500/20 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t('ret_newSaleReturn')}</span>
          </button>

          <button
            onClick={() => setIsPurchaseReturnModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>{t('ret_newPurchaseReturn')}</span>
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
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('sales')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'sales'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>{t('ret_tabSales')} ({saleReturns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'purchases'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4 text-amber-400" />
          <span>{t('ret_tabPurchases')} ({purchaseReturns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ReceiptText className="w-4 h-4" />
          <span>{t('ret_tabAll')} ({allReturns.length})</span>
        </button>
      </div>

      {/* Financial KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">{t('ret_totalSalesReturns')}</span>
            <span className="text-xl font-black text-rose-600">{totalMontantVentes.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">{saleReturns.length} {t('ret_countSalesReturns')}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 block">{t('ret_totalPurchasesReturns')}</span>
            <span className="text-xl font-black text-amber-700">{totalMontantAchats.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">{purchaseReturns.length} {t('ret_countPurchasesReturns')}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-600 block">Total Avoirs Émis</span>
            <span className="text-xl font-black text-slate-800">{(totalMontantVentes + totalMontantAchats).toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{allReturns.length} docs</span>
        </div>
      </div>

      {/* Multi-Criteria Filters Bar (Nom, Produit, Date, Type) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        {/* 1. Filtre par Nom */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Filtrer par nom (Client, Fournisseur, N° Document)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
          />
        </div>

        {/* 2. Filtre par Produit */}
        <div className="relative">
          <Package className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchProduct}
            onChange={(e) => setSearchProduct(e.target.value)}
            placeholder="Filtrer par Produit (Nom ou Référence)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
          />
        </div>

        {/* 3. Sélecteur Type & Refresh */}
        <div className="flex items-center gap-2">
          {activeTab === 'sales' && (
            <select
              value={typeDocFilter}
              onChange={(e) => setTypeDocFilter(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
            >
              <option value="TOUS">Tous les types (Factures & BL)</option>
              <option value="AVOIR_VENTE">Avoirs Facture Vente</option>
              <option value="AVOIR_BL">Avoirs Bon de Livraison (BL)</option>
            </select>
          )}

          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer ml-auto"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* TAB 1: AVOIRS SUR VENTES & BONS DE LIVRAISON (BL) */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">{t('ret_numReturn')}</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">{t('inv_client')}</th>
                  <th className="px-4 py-3">{t('ret_docRef')}</th>
                  <th className="px-4 py-3">{t('ret_itemsReturned')}</th>
                  <th className="px-4 py-3 text-right">{t('ret_amountRefunded')}</th>
                  <th className="px-4 py-3 text-center">{t('ret_refundMode')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {saleReturns.length > 0 ? (
                  saleReturns.map((ret) => (
                    <tr key={ret._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 font-mono font-bold text-rose-600">
                        {ret.numeroRetour}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(ret.dateRetour || ret.createdAt).toLocaleString('fr-DZ', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          ret.typeDocument === 'AVOIR_BL' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {ret.typeDocument === 'AVOIR_BL' ? 'BL' : 'VENTE'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {ret.client?.nom || ret.clientLibre || 'Client Comptoir'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-blue-600">
                        {ret.invoice?.numeroFacture || '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ret.items?.map((it, idx) => (
                            <span key={idx} className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-700 font-medium">
                              <strong>{it.nom}</strong> ({it.quantiteRetournee} {it.unite || 'pcs'})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-rose-600 text-sm">
                        {(ret.montantTotalRembourse || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {ret.modeRemboursement === 'ESPECES' ? 'Espèces' : ret.modeRemboursement === 'DEDUCTION_DETTE' ? 'Déduction Dette' : 'Avoir Client'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedReturnForDetail(ret)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Aperçu & Impression du Bon d'Avoir"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSaleReturn(ret)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Annuler l'avoir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-bold text-slate-600">{t('ret_noSalesReturns')}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Cliquez sur "+ Avoir Vente / BL" pour enregistrer un retour client.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: AVOIRS SUR ACHATS FOURNISSEURS */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">N° Avoir Fournisseur</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">N° Facture Achat</th>
                  <th className="px-4 py-3">Articles Retournés</th>
                  <th className="px-4 py-3 text-right">Montant Avoir</th>
                  <th className="px-4 py-3 text-center">Compensation</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {purchaseReturns.length > 0 ? (
                  purchaseReturns.map((ret) => (
                    <tr key={ret._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 font-mono font-bold text-amber-700">
                        {ret.numeroAvoirAchat}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(ret.dateAvoirAchat || ret.createdAt).toLocaleString('fr-DZ', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {ret.fournisseur}
                        {ret.contactFournisseur && (
                          <span className="block text-[10px] text-slate-400 font-normal">Tél: {ret.contactFournisseur}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-blue-600">
                        {ret.purchase?.numeroFactureAchat || '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ret.items?.map((it, idx) => (
                            <span key={idx} className="inline-block px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-700 font-medium">
                              <strong>{it.nom}</strong> ({it.quantiteRetournee} {it.unite || 'pcs'})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-amber-700 text-sm">
                        {(ret.montantTotal || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {ret.modeRemboursement === 'ESPECES' ? 'Espèces' : 'Avoir Fournisseur'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedReturnForDetail(ret)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Aperçu & Impression du Bon de Retour Fournisseur"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePurchaseReturn(ret)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Annuler le retour"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-bold text-slate-600">{t('ret_noPurchasesReturns')}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Cliquez sur "+ Avoir Achat Fournisseur" pour renvoyer des articles au fournisseur.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VUE CONSOLIDÉE (TOUS LES AVOIRS) */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Nature / N° Document</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Partenaire (Client / Fournisseur)</th>
                  <th className="px-4 py-3">Nb Articles</th>
                  <th className="px-4 py-3 text-right">Montant Total</th>
                  <th className="px-4 py-3 text-center">Règlement</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {allReturns.length > 0 ? (
                  allReturns.map((ret) => {
                    const isSale = ret.originType === 'SALE';
                    const docNum = ret.numeroRetour || ret.numeroAvoirAchat;
                    const partner = isSale ? (ret.client?.nom || ret.clientLibre || 'Client Comptoir') : ret.fournisseur;
                    const total = isSale ? ret.montantTotalRembourse : ret.montantTotal;

                    return (
                      <tr key={`${ret.originType}-${ret._id}`} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black ${
                            isSale ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isSale ? <RotateCcw className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                            <span>{isSale ? 'Avoir Vente/BL' : 'Avoir Achat'}</span>
                          </span>
                          <span className="font-mono font-bold block mt-1 text-slate-900">{docNum}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                          {new Date(ret.dateRetour || ret.dateAvoirAchat || ret.createdAt).toLocaleString('fr-DZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {partner}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[11px] font-bold text-slate-700">
                            {ret.items?.length || 0} art.
                          </span>
                        </td>
                        <td className={`px-4 py-3.5 text-right font-black text-sm ${isSale ? 'text-rose-600' : 'text-amber-700'}`}>
                          {(total || 0).toLocaleString('fr-DZ')} DA
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {ret.modeRemboursement || 'ESPECES'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setSelectedReturnForDetail(ret)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Aperçu & Impression"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400 text-xs">
                      Aucun document d'avoir trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Créer Avoir Vente / BL */}
      <CreateSaleReturnModal
        isOpen={isSaleReturnModalOpen}
        onClose={() => setIsSaleReturnModalOpen(false)}
        onReturnProcessed={() => {
          showToast('Bon d’avoir enregistré et stock ré-incrémenté !');
          loadData();
        }}
      />

      {/* Modal Créer Avoir Achat Fournisseur */}
      <CreatePurchaseReturnModal
        isOpen={isPurchaseReturnModalOpen}
        onClose={() => setIsPurchaseReturnModalOpen(false)}
        onReturnProcessed={() => {
          showToast('Avoir d’achat fournisseur enregistré et stock décrémenté !');
          loadData();
        }}
      />

      {/* Modal Détail & Impression du Bon d'Avoir */}
      <ReturnDetailModal
        isOpen={!!selectedReturnForDetail}
        onClose={() => setSelectedReturnForDetail(null)}
        returnData={selectedReturnForDetail}
      />
    </div>
  );
}
