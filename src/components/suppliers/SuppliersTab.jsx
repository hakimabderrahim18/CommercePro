import React, { useState, useEffect } from 'react';
import { 
  Building, 
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
  CreditCard,
  Truck,
  Eye,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import SupplierModal from './SupplierModal';
import SupplierLedgerModal from './SupplierLedgerModal';
import { useLanguage } from '../../context/LanguageContext';

export default function SuppliersTab({ onNewPurchase }) {
  const { t, isRTL } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyWithDebt, setOnlyWithDebt] = useState(false);

  // Modals
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState(null);
  const [initialOpenPayment, setInitialOpenPayment] = useState(false);

  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.supplier.getAll();
      if (res.success) {
        setSuppliers(res.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement fournisseurs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const handleSupplierUpdate = () => {
      fetchSuppliers();
    };
    window.addEventListener('supplier-updated', handleSupplierUpdate);
    return () => {
      window.removeEventListener('supplier-updated', handleSupplierUpdate);
    };
  }, []);

  const handleDelete = async (s) => {
    if (window.confirm(`Supprimer la fiche fournisseur "${s.nom}" ?`)) {
      const res = await api.supplier.delete(s._id);
      if (res.success) {
        showToast('Fournisseur supprimé avec succès.');
        fetchSuppliers();
      } else {
        showToast(res.error, 'error');
      }
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch = !search.trim() || 
      s.nom.toLowerCase().includes(search.toLowerCase()) ||
      (s.telephone && s.telephone.includes(search)) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase()));
    const matchesDebt = !onlyWithDebt || (Number(s.soldeDette) || 0) > 0;
    return matchesSearch && matchesDebt;
  });

  const totalDettesFournisseurs = suppliers.reduce((sum, s) => sum + (Number(s.soldeDette) || 0), 0);
  const totalAchats = suppliers.reduce((sum, s) => sum + (Number(s.totalAchats) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Toast */}
      {notification && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between ${
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <span>{notification.msg}</span>
          <button onClick={() => setNotification(null)} className="text-xs font-bold underline cursor-pointer">Fermer</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Fournisseurs</span>
            <span className="text-xl font-black text-slate-800">{suppliers.length}</span>
          </div>
          <Building className="w-8 h-8 text-blue-500/30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 block">Dettes Fournisseurs (À régler)</span>
            <span className="text-xl font-black text-amber-700">{totalDettesFournisseurs.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <DollarSign className="w-8 h-8 text-amber-500/30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Volume Total Achats</span>
            <span className="text-xl font-black text-blue-600">{totalAchats.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <Truck className="w-8 h-8 text-blue-500/30" />
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher fournisseur par nom, téléphone..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setOnlyWithDebt(!onlyWithDebt)}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              onlyWithDebt ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Avec Dette Uniquement
          </button>

          <button
            onClick={fetchSuppliers}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setSelectedSupplier(null);
              setIsSupplierModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Fournisseur</span>
          </button>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Fournisseur</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Adresse</th>
                <th className="px-5 py-3 text-right">Total Achats</th>
                <th className="px-5 py-3 text-right">Solde Dette Fournisseur</th>
                <th className="px-5 py-3 text-center">État</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((s) => {
                  const hasDebt = (s.soldeDette || 0) > 0;
                  return (
                    <tr 
                      key={s._id} 
                      onClick={(e) => {
                        if (e.target.closest('button') || e.target.closest('a')) return;
                        setLedgerSupplier(s);
                        setInitialOpenPayment(false);
                        setIsLedgerModalOpen(true);
                      }}
                      className="hover:bg-blue-50/50 transition cursor-pointer"
                      title="Cliquer pour afficher la situation, les bons d'achat et les versements de ce fournisseur"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-800 text-sm block">{s.nom}</span>
                        {s.notes && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[200px] block">
                            {s.notes}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 space-y-0.5">
                        {s.telephone && (
                          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{s.telephone}</span>
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{s.email}</span>
                          </div>
                        )}
                        {!s.telephone && !s.email && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">
                        {s.adresse || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-700">
                        {Number(s.totalAchats || 0).toLocaleString('fr-DZ')} {t('currency')}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-sm font-black ${hasDebt ? 'text-amber-600 font-mono' : 'text-emerald-600'}`}>
                          {Number(s.soldeDette || 0).toLocaleString('fr-DZ')} {t('currency')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          hasDebt ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {hasDebt ? 'À PAYER' : 'RÉGULARISÉ'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Historique des opérations */}
                          <button
                            onClick={() => {
                              setLedgerSupplier(s);
                              setInitialOpenPayment(false);
                              setIsLedgerModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                            title="Afficher l'historique complet des opérations et situation du fournisseur"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Historique</span>
                          </button>

                          {/* Ajouter un versement / opération */}
                          <button
                            onClick={() => {
                              setLedgerSupplier(s);
                              setInitialOpenPayment(true);
                              setIsLedgerModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer"
                            title="Effectuer un versement ou ajouter une opération pour ce fournisseur"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>+ Versement</span>
                          </button>

                          {/* Modifier */}
                          <button
                            onClick={() => {
                              setSelectedSupplier(s);
                              setIsSupplierModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                            title="Modifier les coordonnées du fournisseur"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{t('edit') || 'Modifier'}</span>
                          </button>

                          {/* Supprimer */}
                          <button
                            onClick={() => handleDelete(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                            title="Supprimer le fournisseur"
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
                    {loading ? 'Chargement des fournisseurs...' : 'Aucun fournisseur trouvé.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Modal */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        supplier={selectedSupplier}
        onSaved={() => {
          showToast(selectedSupplier ? 'Fiche fournisseur mise à jour avec succès !' : 'Nouveau fournisseur enregistré avec succès !');
          fetchSuppliers();
        }}
      />

      {/* Supplier Ledger & Versement Modal */}
      <SupplierLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => {
          setIsLedgerModalOpen(false);
          setLedgerSupplier(null);
          setInitialOpenPayment(false);
        }}
        supplier={ledgerSupplier}
        initialOpenPayment={initialOpenPayment}
        onPaymentRecorded={() => {
          showToast('Opération fournisseur enregistrée.');
          fetchSuppliers();
        }}
      />
    </div>
  );
}
