import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Edit3, 
  Trash2, 
  FileText, 
  DollarSign, 
  RefreshCw,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  Building,
  CreditCard,
  Eye,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import CustomerModal from './CustomerModal';
import CustomerLedgerModal from './CustomerLedgerModal';
import CreateTransactionModal from '../treasury/CreateTransactionModal';
import SuppliersTab from '../suppliers/SuppliersTab';
import { useLanguage } from '../../context/LanguageContext';

export default function CustomersView({ isActive = true }) {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('clients'); // 'clients' | 'fournisseurs'
  const [customers, setCustomers] = useState([]);
  const [totalDettes, setTotalDettes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyWithDebt, setOnlyWithDebt] = useState(false);

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [initialOpenPayment, setInitialOpenPayment] = useState(false);
  const [isEncaissementModalOpen, setIsEncaissementModalOpen] = useState(false);

  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.customer.getAll({
        search,
        onlyWithDebt
      });
      if (res.success) {
        setCustomers(res.data);
        setTotalDettes(res.totalDettes || 0);
      }
    } catch (err) {
      console.error('Erreur chargement clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, onlyWithDebt]);

  // Synchronisation temps réel : Recharger dès que l'onglet devient actif
  useEffect(() => {
    if (isActive) {
      fetchCustomers();
    }
  }, [isActive]);

  // Synchronisation temps réel : Recharger immédiatement sur toute modification
  useEffect(() => {
    const handleDataChange = () => {
      fetchCustomers();
    };
    window.addEventListener('app:refresh-data', handleDataChange);
    return () => window.removeEventListener('app:refresh-data', handleDataChange);
  }, []);

  useEffect(() => {
    const handleCustomerUpdate = () => {
      fetchCustomers();
    };
    window.addEventListener('customer-updated', handleCustomerUpdate);
    return () => {
      window.removeEventListener('customer-updated', handleCustomerUpdate);
    };
  }, []);

  const handleExportExcel = async () => {
    const res = await api.customer.exportExcel({ search, onlyWithDebt });
    if (res.success) {
      showToast(t('cust_exportSuccess'));
    }
  };

  const handleImportExcel = async () => {
    const res = await api.customer.importExcel();
    if (res.success) {
      showToast(res.message || t('cust_importSuccess'));
      fetchCustomers();
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleDeleteCustomer = async (cust) => {
    if (window.confirm(`Supprimer le client "${cust.nom}" ?`)) {
      const res = await api.customer.delete(cust._id);
      if (res.success) {
        showToast('Client supprimé avec succès.');
        fetchCustomers();
      } else {
        showToast(res.error, 'error');
      }
    }
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const debtCustomersCount = safeCustomers.filter((c) => (Number(c.soldeDette) || 0) > 0).length;

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

      {/* Tab Switcher: Clients & Dettes vs Fournisseurs & Situation */}
      <div className="flex bg-slate-200/70 p-1.5 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('clients')}
          className={`px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'clients' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('nav_customers') || 'Clients & Dettes'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fournisseurs')}
          className={`px-5 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'fournisseurs' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Fournisseurs & Situation Fournisseur</span>
        </button>
      </div>

      {activeTab === 'fournisseurs' ? (
        <SuppliersTab />
      ) : (
        <>
          {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">{t('cust_title')}</h2>
              <p className="text-xs text-slate-500 font-semibold">{t('cust_subtitle')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleImportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-xs cursor-pointer"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>{t('cust_importExcel')}</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl transition shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{t('cust_exportExcel')}</span>
              </button>

              <button
                onClick={() => setIsEncaissementModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition cursor-pointer"
                title="Enregistrer un versement client pour régler une dette"
              >
                <CreditCard className="w-4 h-4" />
                <span>+ Encaissement Dette Client</span>
              </button>

              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('cust_addCustomer')}</span>
              </button>
            </div>
          </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">{t('nav_customers')}</span>
            <span className="text-xl font-black text-slate-800">{customers.length}</span>
          </div>
          <Users className="w-8 h-8 text-blue-500/30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-600 block">{t('cust_totalDebt')}</span>
            <span className="text-xl font-black text-rose-700">{totalDettes.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <DollarSign className="w-8 h-8 text-rose-500/30" />
        </div>

        <div 
          onClick={() => setOnlyWithDebt(!onlyWithDebt)}
          className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between cursor-pointer transition ${
            onlyWithDebt ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400' : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div>
            <span className="text-xs font-semibold text-amber-700 block">{t('cust_customersWithDebt')}</span>
            <span className="text-xl font-black text-amber-800">{debtCustomersCount}</span>
          </div>
          <AlertCircle className="w-8 h-8 text-amber-500/30" />
        </div>
      </div>

      {/* Search and Filters Bar */}
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setOnlyWithDebt(!onlyWithDebt)}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              onlyWithDebt ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('cust_customersWithDebt')} ({debtCustomersCount})
          </button>

          <button
            onClick={fetchCustomers}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Customer List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">{t('cust_name')}</th>
                <th className="px-5 py-3">{t('cust_phone')}</th>
                <th className="px-5 py-3">{t('cust_address')}</th>
                <th className="px-5 py-3 text-right">{t('cust_creditLimit')}</th>
                <th className="px-5 py-3 text-right">{t('cust_debtBalance')}</th>
                <th className="px-5 py-3 text-center">{t('status')}</th>
                <th className="px-5 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length > 0 ? (
                customers.map((c) => {
                  const hasDebt = (c.soldeDette || 0) > 0;
                  return (
                    <tr 
                      key={c._id} 
                      onClick={(e) => {
                        if (e.target.closest('button') || e.target.closest('a')) return;
                        setLedgerCustomer(c);
                        setInitialOpenPayment(false);
                        setIsLedgerModalOpen(true);
                      }}
                      className="hover:bg-blue-50/50 transition cursor-pointer"
                      title="Cliquer pour afficher la fiche, l'historique des bons et les règlements de ce client"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-800 text-sm block">{c.nom}</span>
                        {c.notes && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[200px] block">
                            {c.notes}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 space-y-0.5">
                        {c.telephone && (
                          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.telephone}</span>
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{c.email}</span>
                          </div>
                        )}
                        {!c.telephone && !c.email && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">
                        {c.adresse ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{c.adresse}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-slate-500">
                        {c.plafondCredit > 0 ? `${c.plafondCredit?.toLocaleString('fr-DZ')} DA` : 'Illimité'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`text-sm font-black ${
                            hasDebt ? 'text-rose-600 font-mono' : 'text-emerald-600'
                          }`}
                        >
                          {(c.soldeDette || 0).toLocaleString('fr-DZ')} DA
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            hasDebt
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {hasDebt ? 'DÉBITEUR' : 'À JOUR'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Historique des opérations */}
                          <button
                            onClick={() => {
                              setLedgerCustomer(c);
                              setInitialOpenPayment(false);
                              setIsLedgerModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                            title="Afficher l'historique complet des opérations et relevé du client"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Historique</span>
                          </button>

                          {/* Ajouter un règlement / opération */}
                          <button
                            onClick={() => {
                              setLedgerCustomer(c);
                              setInitialOpenPayment(true);
                              setIsLedgerModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer"
                            title="Ajouter un règlement ou opération pour ce client"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>+ Règlement</span>
                          </button>

                          {/* Modifier */}
                          <button
                            onClick={() => {
                              setSelectedCustomer(c);
                              setIsCustomerModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                            title="Modifier les coordonnées du client"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{t('edit') || 'Modifier'}</span>
                          </button>

                          {/* Supprimer */}
                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                            title="Supprimer le client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{t('delete') || 'Supprimer'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 text-xs">
                    {loading ? 'Chargement des clients...' : 'Aucun client trouvé.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Modal */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customer={selectedCustomer}
        onSaved={() => {
          showToast(selectedCustomer ? 'Fiche client mise à jour avec succès !' : 'Nouveau client enregistré avec succès !');
          fetchCustomers();
        }}
      />

      {/* Customer Ledger Modal */}
      <CustomerLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => {
          setIsLedgerModalOpen(false);
          setLedgerCustomer(null);
          setInitialOpenPayment(false);
        }}
        customer={ledgerCustomer}
        initialOpenPayment={initialOpenPayment}
        onPaymentRecorded={() => {
          showToast('Opération enregistrée avec succès.');
          fetchCustomers();
        }}
      />

      {/* Direct Customer Encaissement Modal */}
      <CreateTransactionModal
        isOpen={isEncaissementModalOpen}
        onClose={() => setIsEncaissementModalOpen(false)}
        initialType="ENCAISSEMENT"
        onSuccess={() => {
          showToast('Encaissement enregistré avec succès.');
          fetchCustomers();
        }}
      />
        </>
      )}
    </div>
  );
}
