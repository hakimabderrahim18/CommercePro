import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShoppingCart, 
  AlertTriangle, 
  Users, 
  TrendingUp, 
  FileSpreadsheet, 
  ArrowUpRight, 
  RefreshCw,
  Package,
  Clock,
  Building,
  Filter,
  CheckCircle,
  FileText
} from 'lucide-react';
import StatCard from '../common/StatCard';
import DateFilter from '../common/DateFilter';
import PurchaseDetailModal from '../purchases/PurchaseDetailModal';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export default function DashboardView({ onNavigateToStock, onNavigateToInvoices, onNavigateToCustomers, onViewInvoice }) {
  const { t, isRTL } = useLanguage();
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Orders Table Switcher & Filter State
  const [orderTab, setOrderTab] = useState('ventes'); // 'ventes' | 'achats'
  const [partyFilter, setPartyFilter] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isPurchaseDetailOpen, setIsPurchaseDetailOpen] = useState(false);

  const fetchDashboardData = async (filterParams) => {
    try {
      setLoading(true);
      const params = filterParams || { period, startDate, endDate };
      const res = await api.dashboard.getStats(params);
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleFilterChange = (newFilters) => {
    fetchDashboardData(newFilters);
  };

  const handleExportSales = async () => {
    await api.invoice.exportExcel({ period, startDate, endDate });
  };

  const kpis = {
    todayCA: Number(stats?.kpis?.todayCA || 0),
    todaySalesCount: Number(stats?.kpis?.todaySalesCount || 0),
    periodCA: Number(stats?.kpis?.periodCA || 0),
    periodSalesCount: Number(stats?.kpis?.periodSalesCount || 0),
    periodInvoicesCount: Number(stats?.kpis?.periodInvoicesCount || 0),
    periodReparationsCount: Number(stats?.kpis?.periodReparationsCount || 0),
    totalCost: Number(stats?.kpis?.totalCost || 0),
    margeBrute: Number(stats?.kpis?.margeBrute || 0),
    totalCharges: Number(stats?.kpis?.totalCharges || 0),
    totalPertes: Number(stats?.kpis?.totalPertes || 0),
    beneficeNet: Number(stats?.kpis?.beneficeNet || 0),
    tauxRentabilite: Number(stats?.kpis?.tauxRentabilite || 0),
    totalStockValue: Number(stats?.kpis?.totalStockValue || 0),
    lowStockCount: Number(stats?.kpis?.lowStockCount || 0),
    totalDettesClients: Number(stats?.kpis?.totalDettesClients || 0),
    totalDettesFournisseurs: Number(stats?.kpis?.totalDettesFournisseurs || 0)
  };

  // Filter Invoices by Client Name
  const filteredInvoices = (stats?.recentInvoices || []).filter(inv => {
    if (!partyFilter.trim()) return true;
    const clientName = (inv.client?.nom || inv.clientLibre || '').toLowerCase();
    const invNum = (inv.numeroFacture || '').toLowerCase();
    const query = partyFilter.toLowerCase().trim();
    return clientName.includes(query) || invNum.includes(query);
  });

  // Filter Purchases by Supplier Name
  const filteredPurchases = (stats?.recentPurchases || []).filter(p => {
    if (!partyFilter.trim()) return true;
    const suppName = (p.fournisseur || p.supplier_nom || '').toLowerCase();
    const pNum = (p.numeroFactureAchat || '').toLowerCase();
    const query = partyFilter.toLowerCase().trim();
    return suppName.includes(query) || pNum.includes(query);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header with Date Filter and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">{t('dash_title')}</h2>
          <p className="text-xs text-slate-500 font-semibold">{t('dash_subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <DateFilter
            period={period}
            setPeriod={setPeriod}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            onFilterChange={handleFilterChange}
          />

          <button
            onClick={() => fetchDashboardData()}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-xs"
            title="Rafraîchir les données"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid - Row 1: Ventes, Commandes, Dettes Clients & Fournisseurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dash_totalSales') || 'Chiffre d\'Affaires'}
          value={`${kpis.periodCA.toLocaleString('fr-DZ')} ${t('currency')}`}
          subtitle={`${t('today')}: ${kpis.todayCA.toLocaleString('fr-DZ')} ${t('currency')}`}
          icon={DollarSign}
          color="blue"
        />

        <StatCard
          title="Opérations (Ventes & SAV)"
          value={kpis.periodSalesCount}
          subtitle={kpis.periodReparationsCount > 0 
            ? `${kpis.periodInvoicesCount} vente${kpis.periodInvoicesCount > 1 ? 's' : ''} + ${kpis.periodReparationsCount} réparation${kpis.periodReparationsCount > 1 ? 's' : ''}`
            : `${t('today')}: ${kpis.todaySalesCount}`}
          icon={ShoppingCart}
          color="emerald"
        />

        <StatCard
          title="Dettes Clients (Créances)"
          value={`${kpis.totalDettesClients.toLocaleString('fr-DZ')} ${t('currency')}`}
          subtitle="Reste à encaisser des clients"
          icon={Users}
          color={kpis.totalDettesClients > 0 ? 'amber' : 'emerald'}
        />

        <StatCard
          title="Dettes Fournisseurs (Dettes)"
          value={`${kpis.totalDettesFournisseurs.toLocaleString('fr-DZ')} ${t('currency')}`}
          subtitle="Reste à payer aux fournisseurs"
          icon={Building}
          color={kpis.totalDettesFournisseurs > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* KPI Cards Grid - Row 2: Marge Commerciale (Bénéfice Ventes), Charges, Bénéfice Net */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Bénéfice Ventes (Marge Brute)"
          value={`${kpis.margeBrute.toLocaleString('fr-DZ')} ${t('currency')}`}
          subtitle={`Coût d'achat: ${kpis.totalCost.toLocaleString('fr-DZ')} ${t('currency')}`}
          icon={TrendingUp}
          color={kpis.margeBrute >= 0 ? 'emerald' : 'rose'}
        />

        <StatCard
          title="Charges d'Exploitation"
          value={`${kpis.totalCharges.toLocaleString('fr-DZ')} ${t('currency')}`}
          subtitle="Loyer, salaires, Sonelgaz, transport"
          icon={DollarSign}
          color="rose"
        />

        <StatCard
          title="Bénéfice Net Réel"
          value={`${kpis.beneficeNet.toLocaleString('fr-DZ')} ${t('currency')}`}
          subtitle={kpis.beneficeNet >= 0 ? "Marge nette après déduction des charges" : "Charges supérieures aux marges"}
          icon={TrendingUp}
          color={kpis.beneficeNet >= 0 ? 'emerald' : 'rose'}
        />

        <StatCard
          title={t('dash_lowStockAlerts') || 'Alertes Stock'}
          value={kpis.lowStockCount}
          subtitle={`Valeur stock: ${kpis.totalStockValue.toLocaleString('fr-DZ')} DA`}
          icon={AlertTriangle}
          color={kpis.lowStockCount > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Main Section: History Tables (Bons de Commande & Bons d'Achat) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Orders History with tabs for Ventes vs Achats and Client/Fournisseur filter */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          {/* Table Header & Controls */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tabs: Bons de Commande (Ventes) vs Bons d'Achat */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setOrderTab('ventes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  orderTab === 'ventes' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bons de Commande (Ventes)</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderTab('achats')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  orderTab === 'achats' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Bons d'Achat (Fournisseurs)</span>
              </button>
            </div>

            {/* Filter by Client or Fournisseur */}
            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-56">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={partyFilter}
                  onChange={(e) => setPartyFilter(e.target.value)}
                  placeholder={orderTab === 'ventes' ? "Filtrer par client..." : "Filtrer par fournisseur..."}
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {orderTab === 'ventes' && (
                <button
                  onClick={handleExportSales}
                  className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                  title="Exporter Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={orderTab === 'ventes' ? onNavigateToInvoices : () => {}}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                title="Voir tout"
              >
                <span>{t('all')}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto flex-1">
            {orderTab === 'ventes' ? (
              /* TAB 1: BONS DE COMMANDE (VENTES) */
              filteredInvoices.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">{t('inv_numInvoice') || 'N° Bon'}</th>
                      <th className="px-4 py-3">{t('inv_date') || 'Date'}</th>
                      <th className="px-4 py-3">{t('inv_client') || 'Client'}</th>
                      <th className="px-4 py-3 text-right">Montant</th>
                      <th className="px-4 py-3 text-right">Bénéfice</th>
                      <th className="px-4 py-3 text-right">Dette / Reste</th>
                      <th className="px-4 py-3 text-center">{t('inv_paymentStatus') || 'Statut'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredInvoices.map((inv) => (
                      <tr 
                        key={inv._id} 
                        onClick={() => onViewInvoice && onViewInvoice(inv)}
                        className="hover:bg-blue-50/50 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 font-bold text-blue-600 font-mono">
                          {inv.numeroFacture}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(inv.dateFacture).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {inv.client?.nom || inv.clientLibre || t('pos_counterClient')}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">
                          {Number(inv.totalTTC || 0).toLocaleString('fr-DZ')} {t('currency')}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-600">
                          +{Number(inv.benefice || 0).toLocaleString('fr-DZ')} DA
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {Number(inv.montantReste || 0) > 0 ? (
                            <span className="text-rose-600 font-black">
                              {Number(inv.montantReste).toLocaleString('fr-DZ')} DA
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">0 DA</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            inv.statutPaiement === 'PAYE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.statutPaiement === 'PARTIEL'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {inv.statutPaiement === 'PAYE' ? t('inv_paid') : inv.statutPaiement === 'PARTIEL' ? t('inv_partial') : t('inv_unpaid')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-xs">Aucun bon de commande trouvé pour cette période ou ce filtre.</p>
                </div>
              )
            ) : (
              /* TAB 2: BONS D'ACHAT (FOURNISSEURS) */
              filteredPurchases.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">N° Bon Achat</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Fournisseur</th>
                      <th className="px-4 py-3 text-right">Montant Achat</th>
                      <th className="px-4 py-3 text-right">Payé</th>
                      <th className="px-4 py-3 text-right">Dette / Reste</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredPurchases.map((p) => (
                      <tr 
                        key={p._id} 
                        onClick={() => {
                          setSelectedPurchase(p);
                          setIsPurchaseDetailOpen(true);
                        }}
                        className="hover:bg-indigo-50/50 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 font-bold text-indigo-600 font-mono">
                          {p.numeroFactureAchat}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(p.dateFacture).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {p.fournisseur || p.supplier_nom || 'Fournisseur'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900">
                          {Number(p.totalTTC || 0).toLocaleString('fr-DZ')} {t('currency')}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {Number(p.montantPaye || 0).toLocaleString('fr-DZ')} DA
                        </td>
                        <td className="px-4 py-3 text-right font-bold">
                          {Number(p.montantReste || 0) > 0 ? (
                            <span className="text-rose-600 font-black">
                              {Number(p.montantReste).toLocaleString('fr-DZ')} DA
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">0 DA</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            p.statutPaiement === 'PAYE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : p.statutPaiement === 'PARTIEL'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {p.statutPaiement === 'PAYE' ? 'Réglé' : p.statutPaiement === 'PARTIEL' ? 'Partiel' : 'Non payé'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <Building className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-xs">Aucun bon d'achat trouvé pour ce filtre.</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right 1 Col: Top Products */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>{t('dash_topProducts')}</span>
            </h3>
            <button
              onClick={onNavigateToStock}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>{t('all')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {stats?.topProducts?.length > 0 ? (
              stats.topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{p.nom}</span>
                    <span className="text-[10px] text-slate-500">{p.totalQty} {p.unite || 'pcs'} vendus</span>
                  </div>
                  <span className="text-xs font-black text-emerald-700">
                    {Number(p.totalCA || 0).toLocaleString('fr-DZ')} {t('currency')}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">Aucune vente enregistrée sur cette période.</p>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Detail Modal */}
      {selectedPurchase && (
        <PurchaseDetailModal
          isOpen={isPurchaseDetailOpen}
          onClose={() => {
            setIsPurchaseDetailOpen(false);
            setSelectedPurchase(null);
          }}
          purchase={selectedPurchase}
        />
      )}
    </div>
  );
}
