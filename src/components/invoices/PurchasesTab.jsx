import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  Plus, 
  Eye, 
  Printer,
  Trash2, 
  RefreshCw, 
  CreditCard,
  Building,
  Calendar,
  Pencil,
  FileSpreadsheet,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import CreatePurchaseModal from '../purchases/CreatePurchaseModal';
import EditPurchaseModal from '../purchases/EditPurchaseModal';
import PurchaseDetailModal from '../purchases/PurchaseDetailModal';
import SupplierLedgerModal from '../suppliers/SupplierLedgerModal';
import { useLanguage } from '../../context/LanguageContext';

export default function PurchasesTab() {
  const { t, isRTL } = useLanguage();
  const [purchases, setPurchases] = useState([]);
  const [caisses, setCaisses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statutPaiement, setStatutPaiement] = useState('TOUS');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [editPurchase, setEditPurchase] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Supplier ledger modal
  const [isSupplierLedgerOpen, setIsSupplierLedgerOpen] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState(null);

  // Settle purchase debt modal
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCaisse, setPaymentCaisse] = useState('Caisse 1');
  const [paymentMode, setPaymentMode] = useState('ESPECES');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeletePurchase = async (purchase) => {
    if (!window.confirm(`Confirmez-vous l'annulation et suppression de la pièce d'achat ${purchase.numeroFactureAchat} ?\nCette action va déduire les quantités du stock et réajuster la dette fournisseur.`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.purchase.delete(purchase._id || purchase.id);
      if (res.success) {
        showToast(`Achat ${purchase.numeroFactureAchat} supprimé avec succès.`);
        fetchPurchases();
      } else {
        alert(res.error || 'Erreur lors de la suppression.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await api.purchase.exportExcel({ search, statutPaiement });
      if (res.success) {
        showToast('Registre des achats exporté avec succès !');
      } else if (res.message && res.message !== 'Exportation annulée.') {
        alert(res.message || res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const [res, caisseRes] = await Promise.all([
        api.purchase.getAll(),
        api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false })
      ]);
      if (res.success) {
        setPurchases(res.data || []);
      }
      if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
        setCaisses(caisseRes.data);
        setPaymentCaisse(caisseRes.data[0].nom);
      }
    } catch (err) {
      console.error('Erreur chargement achats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const handleOpenSupplierLedger = (purchase) => {
    setLedgerSupplier({
      _id: purchase.supplier_id,
      id: purchase.supplier_id,
      nom: purchase.fournisseur,
      telephone: purchase.contactFournisseur
    });
    setIsSupplierLedgerOpen(true);
  };

  const handleSettlePayment = async (e) => {
    e.preventDefault();
    const val = parseFloat(paymentAmount);
    if (!val || val <= 0) {
      setError('Veuillez saisir un montant supérieur à 0.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.purchase.recordPayment({
        purchaseInvoiceId: selectedPurchase._id || selectedPurchase.id,
        montant: val,
        modePaiement: paymentMode,
        caisse: paymentCaisse
      });

      if (res.success) {
        showToast('Règlement achat enregistré avec succès.');
        setIsPaymentModalOpen(false);
        setSelectedPurchase(null);
        setPaymentAmount('');
        fetchPurchases();
      } else {
        setError(res.error || 'Erreur enregistrement règlement.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    const matchesSearch = !search.trim() ||
      (p.numeroFactureAchat && p.numeroFactureAchat.toLowerCase().includes(search.toLowerCase())) ||
      (p.fournisseur && p.fournisseur.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statutPaiement === 'TOUS' || p.statutPaiement === statutPaiement;
    return matchesSearch && matchesStatus;
  });

  const totalAchats = purchases.reduce((sum, p) => sum + (Number(p.totalTTC) || 0), 0);
  const totalRegle = purchases.reduce((sum, p) => sum + (Number(p.montantPaye) || 0), 0);
  const totalReste = purchases.reduce((sum, p) => sum + (Number(p.montantReste) || 0), 0);

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

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Factures & Bons d'Achat</span>
            <span className="text-xl font-black text-slate-800">{totalAchats.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{purchases.length} docs</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-600 block">Total Décaissement Réglé</span>
            <span className="text-xl font-black text-emerald-700">{totalRegle.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Payé</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 block">Reste à Payer (Dette Fournisseur)</span>
            <span className="text-xl font-black text-amber-700">{totalReste.toLocaleString('fr-DZ')} {t('currency')}</span>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Dette</span>
        </div>
      </div>

      {/* Search & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par N° facture achat ou fournisseur..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-blue-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={statutPaiement}
            onChange={(e) => setStatutPaiement(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="PAYE">Payé</option>
            <option value="PARTIEL">Partiel</option>
            <option value="NON_PAYE">Non Payé</option>
          </select>

          <button
            onClick={fetchPurchases}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer shadow-xs"
            title="Exporter la liste des achats au format Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Exporter Excel</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Facture / Bon d'Achat</span>
          </button>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Type & N° Pièce</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Fournisseur</th>
                <th className="px-5 py-3 text-right">Total TTC</th>
                <th className="px-5 py-3 text-right">Payé</th>
                <th className="px-5 py-3 text-right">Reste Dû</th>
                <th className="px-5 py-3 text-center">Caisse</th>
                <th className="px-5 py-3 text-center">État</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length > 0 ? (
                filteredPurchases.map((p) => {
                  const isBC = p.typeDocument === 'BON_COMMANDE_ACHAT';
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-600 font-mono text-sm">{p.numeroFactureAchat}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            isBC ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isBC ? 'Bon Cde' : 'Facture'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {new Date(p.dateFactureAchat || p.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {p.fournisseur}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-900">
                        {Number(p.totalTTC || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                        {Number(p.montantPaye || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-amber-600">
                        {Number(p.montantReste || 0) > 0 ? `${Number(p.montantReste).toLocaleString('fr-DZ')} DA` : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-center text-slate-500 font-semibold">
                        {p.caisse || 'Caisse 1'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          p.statutPaiement === 'PAYE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : p.statutPaiement === 'PARTIEL'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {p.statutPaiement === 'PAYE' ? 'PAYÉ' : p.statutPaiement === 'PARTIEL' ? 'PARTIEL' : 'NON PAYÉ'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Historique fournisseur */}
                          <button
                            type="button"
                            onClick={() => handleOpenSupplierLedger(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                            title="Afficher l'historique complet des opérations du fournisseur"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Historique</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setViewingPurchase(p);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Aperçu & Imprimer la pièce d’achat"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditPurchase(p);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="Modifier cette facture / bon d’achat"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {Number(p.montantReste || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPurchase(p);
                                setPaymentAmount(p.montantReste);
                                setIsPaymentModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                              title="Régler le reste dû au fournisseur"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeletePurchase(p)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Annuler et supprimer cet achat (- Stock)"
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
                  <td colSpan="9" className="py-12 text-center text-slate-400 text-xs">
                    {loading ? 'Chargement des factures d’achat...' : 'Aucune facture d’achat trouvée.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Purchase Debt Modal */}
      {isPaymentModalOpen && selectedPurchase && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs modal-backdrop"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content modal-container bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-800">
              Règlement Dette Fournisseur : {selectedPurchase.numeroFactureAchat}
            </h3>
            <p className="text-xs text-slate-500 font-semibold">
              Fournisseur : {selectedPurchase.fournisseur} | Reste dû : <strong className="text-amber-600">{Number(selectedPurchase.montantReste || 0).toLocaleString('fr-DZ')} DA</strong>
            </p>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSettlePayment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Montant à régler (DA) *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedPurchase.montantReste}
                  step="any"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mode de Paiement</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
                  >
                    <option value="ESPECES">Espèces</option>
                    <option value="VIREMENT">Virement / Chèque</option>
                    <option value="CARTE">Carte</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Caisse Source</label>
                  <select
                    value={paymentCaisse}
                    onChange={(e) => setPaymentCaisse(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
                  >
                    {caisses.map((c) => (
                      <option key={c.id || c.nom} value={c.nom}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Validation...' : 'Valider le Règlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Purchase Modal */}
      <CreatePurchaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPurchaseCreated={() => {
          showToast('Facture / Bon d\'achat enregistré.');
          fetchPurchases();
        }}
      />

      {/* Purchase Detail & Print Modal */}
      <PurchaseDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setViewingPurchase(null);
        }}
        purchase={viewingPurchase}
        onOpenPayment={(pur) => {
          setIsDetailModalOpen(false);
          setSelectedPurchase(pur);
          setPaymentAmount(pur.montantReste);
          setIsPaymentModalOpen(true);
        }}
        onOpenEdit={(pur) => {
          setIsDetailModalOpen(false);
          setEditPurchase(pur);
          setIsEditModalOpen(true);
        }}
      />

      {/* Edit Purchase Modal */}
      <EditPurchaseModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditPurchase(null);
        }}
        purchase={editPurchase}
        onPurchaseUpdated={(updated) => {
          showToast(`Pièce d'achat ${updated.numeroFactureAchat} mise à jour avec succès !`);
          fetchPurchases();
        }}
      />

      {/* Supplier Ledger Modal */}
      <SupplierLedgerModal
        isOpen={isSupplierLedgerOpen}
        onClose={() => {
          setIsSupplierLedgerOpen(false);
          setLedgerSupplier(null);
        }}
        supplier={ledgerSupplier}
        onPaymentRecorded={() => {
          fetchPurchases();
        }}
      />
    </div>
  );
}
