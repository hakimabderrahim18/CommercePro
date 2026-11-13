import React, { useState, useEffect } from 'react';
import { 
  ReceiptText, 
  Search, 
  FileSpreadsheet, 
  Eye, 
  Trash2, 
  Plus, 
  RotateCcw, 
  RefreshCw, 
  Printer, 
  Calendar, 
  CreditCard,
  Pencil,
  FileDown
} from 'lucide-react';
import { api } from '../../services/api';
import DateFilter from '../common/DateFilter';
import InvoiceDetailModal from './InvoiceDetailModal';
import EditInvoiceModal from './EditInvoiceModal';
import SaleReturnModal from './SaleReturnModal';
import InvoicePaymentModal from './InvoicePaymentModal';
import PurchasesTab from './PurchasesTab';
import ExportColumnsModal from '../common/ExportColumnsModal';
import { useLanguage } from '../../context/LanguageContext';
import { exportInvoiceToPdf } from '../../utils/printerHelper';

const INVOICE_EXPORT_COLUMNS = [
  { key: 'numeroFacture', label: 'N° Facture / Pièce', group: '1. Document' },
  { key: 'date', label: 'Date & Heure', group: '1. Document' },
  { key: 'typeDocument', label: 'Type de Pièce (Facture/Ticket/Bon)', group: '1. Document' },
  { key: 'client', label: 'Nom du Client', group: '2. Client & Caisse' },
  { key: 'caisse', label: 'Caisse Utilisée', group: '2. Client & Caisse' },
  { key: 'totalHT', label: 'Total Hors Taxes (HT)', group: '3. Montants' },
  { key: 'tauxTva', label: 'Taux TVA (%)', group: '3. Montants' },
  { key: 'montantTva', label: 'Montant TVA (DA)', group: '3. Montants' },
  { key: 'totalTTC', label: 'Total Net à Payer (TTC)', group: '3. Montants' },
  { key: 'montantPaye', label: 'Montant Encaissé (Payé)', group: '4. Règlement' },
  { key: 'montantReste', label: 'Reste Dû (Dette Client)', group: '4. Règlement' },
  { key: 'modePaiement', label: 'Mode de Paiement', group: '4. Règlement' },
  { key: 'statutPaiement', label: 'Statut Règlement (Payé/Partiel)', group: '4. Règlement' },
  { key: 'notes', label: 'Notes & Remarques', group: '5. Autres' }
];

export default function InvoicesView({ isActive = true, onNewSale, initialInvoiceToView }) {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'purchases'
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeDocument, setTypeDocument] = useState('TOUS');
  const [statutPaiement, setStatutPaiement] = useState('TOUS');

  // Date filters
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected for preview / return / payment
  const [selectedInvoice, setSelectedInvoice] = useState(initialInvoiceToView || null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(!!initialInvoiceToView);
  const [editInvoice, setEditInvoice] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchInvoices = async (filterParams) => {
    try {
      setLoading(true);
      const params = filterParams || {
        search,
        typeDocument,
        statutPaiement,
        period,
        startDate,
        endDate
      };
      const res = await api.invoice.getAll(params);
      if (res.success) {
        setInvoices(res.data);
      }
    } catch (err) {
      console.error('Erreur chargement factures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [search, typeDocument, statutPaiement, period, startDate, endDate]);

  // Synchronisation temps réel : Recharger dès que l'onglet devient actif
  useEffect(() => {
    if (isActive) {
      fetchInvoices();
    }
  }, [isActive]);

  // Synchronisation temps réel : Recharger immédiatement sur toute modification
  useEffect(() => {
    const handleDataChange = () => {
      fetchInvoices();
    };
    window.addEventListener('app:refresh-data', handleDataChange);
    return () => window.removeEventListener('app:refresh-data', handleDataChange);
  }, []);

  const handleFilterChange = (newFilters) => {
    fetchInvoices(newFilters);
  };

  const handleExportExcel = () => {
    setIsExportModalOpen(true);
  };

  const handleExecuteExport = async (columns) => {
    const res = await api.invoice.exportExcel({
      typeDocument,
      statutPaiement,
      startDate,
      endDate,
      columns
    });
    if (res.success) {
      showToast(`Export réussi ! ${res.count} factures exportées avec ${columns.length} colonnes sélectionnées.`);
    }
  };

  const handleExportPdf = async (invoice) => {
    try {
      showToast('Génération du fichier PDF...');
      const res = await exportInvoiceToPdf(invoice, { format: 'A4' });
      if (res.canceled) return;
      if (res.success) {
        showToast(`Document ${invoice.numeroFacture || ''} exporté en PDF avec succès !`);
      } else {
        showToast(`Erreur export PDF: ${res.error || 'Échec'}`, 'error');
      }
    } catch (e) {
      showToast(`Erreur export PDF: ${e.message}`, 'error');
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    if (
      window.confirm(
        `Annuler la facture ${invoice.numeroFacture} ?\n\nAttention : cette action va ré-incrémenter le stock des articles et annuler la dette client associée.`
      )
    ) {
      const res = await api.invoice.delete(invoice._id);
      if (res.success) {
        showToast(res.message);
        fetchInvoices();
      } else {
        showToast(res.error, 'error');
      }
    }
  };

  // Summary calculations
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const totalCA = safeInvoices.reduce((sum, inv) => sum + (Number(inv.totalTTC) || 0), 0);
  const totalEncaisse = safeInvoices.reduce((sum, inv) => sum + (Number(inv.montantPaye) || 0), 0);
  const totalReste = safeInvoices.reduce((sum, inv) => sum + (Number(inv.montantReste) || 0), 0);

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

      {/* Main Tab Switcher: Ventes vs Achats */}
      <div className="flex bg-slate-200/70 p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'sales' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ReceiptText className="w-4 h-4" />
          <span>Factures & Bons de Vente</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('purchases')}
          className={`px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'purchases' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Achats & Bons de Commande Fournisseur</span>
        </button>
      </div>

      {activeTab === 'purchases' ? (
        <PurchasesTab />
      ) : (
        <>
          {/* Top Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">{t('inv_title')}</h2>
              <p className="text-xs text-slate-500 font-semibold">{t('inv_subtitle')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
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
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{t('stock_exportExcel')}</span>
              </button>

              <button
                onClick={onNewSale}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('top_newSale')}</span>
              </button>
            </div>
          </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">{t('inv_amountTtc')}</span>
            <span className="text-xl font-black text-slate-800">{totalCA.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{invoices.length} docs</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 block">{t('inv_paid')}</span>
            <span className="text-xl font-black text-emerald-700">{totalEncaisse.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{t('inv_paid')}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-600 block">{t('cust_debtBalance')}</span>
            <span className="text-xl font-black text-rose-700">{totalReste.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">{t('pos_credit')}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Type Doc */}
          <select
            value={typeDocument}
            onChange={(e) => setTypeDocument(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
          >
            <option value="TOUS">{t('all')}</option>
            <option value="FACTURE">{t('pos_printInvoice')}</option>
            <option value="TICKET">{t('pos_printTicket')}</option>
          </select>

          {/* Statut Paiement */}
          <select
            value={statutPaiement}
            onChange={(e) => setStatutPaiement(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
          >
            <option value="TOUS">{t('all')}</option>
            <option value="PAYE">{t('inv_paid')}</option>
            <option value="PARTIEL">{t('inv_partial')}</option>
            <option value="NON_PAYE">{t('inv_unpaid')}</option>
          </select>

          <button
            onClick={fetchInvoices}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">{t('inv_numInvoice')}</th>
                <th className="px-5 py-3">{t('inv_date')}</th>
                <th className="px-5 py-3">{t('inv_client')}</th>
                <th className="px-5 py-3 text-right">{t('inv_amountTtc')}</th>
                <th className="px-5 py-3 text-right">Bénéfice</th>
                <th className="px-5 py-3 text-right">{t('inv_paid')}</th>
                <th className="px-5 py-3 text-right">{t('cust_debtBalance')}</th>
                <th className="px-5 py-3 text-center">{t('inv_paymentStatus')}</th>
                <th className="px-5 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 font-bold text-blue-600 font-mono">
                      {inv.numeroFacture}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(inv.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {inv.client?.nom || inv.nomClientLibre || 'Client Comptoir'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900">
                      {inv.totalTTC?.toLocaleString('fr-DZ')} DA
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                      {inv.benefice !== undefined && inv.benefice !== null ? `${inv.benefice.toLocaleString('fr-DZ')} DA` : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-600">
                      {inv.montantPaye?.toLocaleString('fr-DZ')} DA
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-rose-600">
                      {inv.montantReste > 0 ? `${inv.montantReste?.toLocaleString('fr-DZ')} DA` : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {inv.modePaiement}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          inv.statutPaiement === 'PAYE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : inv.statutPaiement === 'PARTIEL'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {inv.statutPaiement === 'PAYE' ? t('inv_paid') : inv.statutPaiement === 'PARTIEL' ? t('inv_partial') : t('inv_unpaid')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Modifier un bon déjà passé */}
                        <button
                          onClick={() => {
                            setEditInvoice(inv);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                          title="Modifier ce bon / facture"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Record payment button if unpaid or partial */}
                        {(inv.montantReste > 0 || inv.statutPaiement !== 'PAYE') && (
                          <button
                            onClick={() => {
                              setPaymentInvoice(inv);
                              setIsPaymentModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                            title={t('inv_recordPayment')}
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}

                        {/* Exporter PDF */}
                        <button
                          onClick={() => handleExportPdf(inv)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Exporter ce bon / facture en PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title={t('inv_seeDetails')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setReturnInvoice(inv);
                            setIsReturnModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                          title={t('inv_returnItem')}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteInvoice(inv)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-slate-400 text-xs">
                    {loading ? t('loading') : t('no')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditInvoice(null);
        }}
        invoice={editInvoice}
        onInvoiceUpdated={(updated) => {
          showToast(`Document ${updated.numeroFacture} mis à jour avec succès !`);
          fetchInvoices();
        }}
      />

      {/* Detail & Print Modal */}
      <InvoiceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        onOpenReturn={(inv) => {
          setIsDetailModalOpen(false);
          setReturnInvoice(inv);
          setIsReturnModalOpen(true);
        }}
        onOpenPayment={(inv) => {
          setIsDetailModalOpen(false);
          setPaymentInvoice(inv);
          setIsPaymentModalOpen(true);
        }}
        onOpenEdit={(inv) => {
          setIsDetailModalOpen(false);
          setEditInvoice(inv);
          setIsEditModalOpen(true);
        }}
      />

      {/* Invoice Payment / Settlement Modal */}
      <InvoicePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentInvoice(null);
        }}
        invoice={paymentInvoice}
        onPaymentSuccess={(updatedInv) => {
          showToast(t('inv_paymentSuccess'));
          fetchInvoices();
        }}
      />

      {/* Sale Return Modal */}
      <SaleReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setReturnInvoice(null);
        }}
        invoice={returnInvoice}
        onReturnProcessed={() => {
          showToast('Retour enregistré avec succès et stock réajusté.');
          fetchInvoices();
        }}
      />

      {/* Export Columns Customization Modal */}
      <ExportColumnsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Personnaliser les Colonnes d'Exportation Excel (Ventes)"
        availableColumns={INVOICE_EXPORT_COLUMNS}
        onConfirm={handleExecuteExport}
      />
        </>
      )}
    </div>
  );
}
