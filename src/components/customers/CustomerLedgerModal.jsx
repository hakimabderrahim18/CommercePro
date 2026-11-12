import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Calendar, 
  RefreshCw, 
  Printer, 
  Phone, 
  Mail, 
  MapPin, 
  FileSpreadsheet, 
  FileDown, 
  Pencil, 
  Trash2, 
  Check, 
  X,
  Eye,
  Receipt,
  ShoppingBag,
  Clock
} from 'lucide-react';
import { printHtmlContent, exportHtmlToPdf, getPrinterSettings, generateSituationReceiptHtml } from '../../utils/printerHelper';
import { useLanguage } from '../../context/LanguageContext';
import EditInvoiceModal from '../invoices/EditInvoiceModal';
import InvoiceDetailModal from '../invoices/InvoiceDetailModal';

export default function CustomerLedgerModal({ isOpen, onClose, customer, onPaymentRecorded, initialOpenPayment = false }) {
  const { t } = useLanguage();
  const [movements, setMovements] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentCustomer, setCurrentCustomer] = useState(customer);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'movements'

  // Invoice modals state (Bons de commande & Factures)
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // Edit movement state
  const [editingMovement, setEditingMovement] = useState(null);
  const [editMontant, setEditMontant] = useState('');
  const [editMotif, setEditMotif] = useState('');
  const [updating, setUpdating] = useState(false);

  const handlePrintStatement = async (forceFormat = null) => {
    const cfg = getPrinterSettings();
    const format = forceFormat || cfg.situationPrintFormat || '80mm';

    if (format === '80mm') {
      const html = generateSituationReceiptHtml({
        entityType: 'CLIENT',
        entity: currentCustomer,
        movements,
        invoices,
        settings: cfg
      });
      await printHtmlContent(html, {
        printerName: cfg.receiptPrinter,
        pageSize: { width: 80 * 1000, height: 297000 },
        silent: cfg.silentPrint !== false
      });
    } else {
      const printEl = document.getElementById('printable-customer-ledger');
      if (printEl) {
        await printHtmlContent(printEl.innerHTML, {
          printerName: cfg.reportPrinter || cfg.receiptPrinter,
          pageSize: 'A4',
          silent: false
        });
      } else {
        window.print();
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const cId = customer._id || customer.id;
      const res = await api.customer.exportStatementExcel(cId);
      if (res.success) {
        alert('Relevé client exporté en Excel avec succès !');
      } else if (res.message && res.message !== 'Exportation annulée.') {
        alert(res.message || res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPdf = async () => {
    const printEl = document.getElementById('printable-customer-ledger');
    if (printEl) {
      const res = await exportHtmlToPdf(printEl.innerHTML, `Releve_${currentCustomer?.nom || 'Client'}.pdf`, 'A4');
      if (res.success) {
        alert('Relevé client exporté en PDF avec succès !');
      } else if (res.error && res.error !== 'Impression annulée') {
        alert(res.error);
      }
    }
  };

  // Payment form toggle
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('ESPECES');
  const [paymentMotif, setPaymentMotif] = useState('Règlement dette');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchCustomerMovements = async () => {
    const cId = customer?._id || customer?.id;
    if (!cId) return;
    try {
      setLoading(true);
      const [res, invRes] = await Promise.all([
        api.customer.getById(cId),
        api.invoice ? api.invoice.getAll({ clientId: cId, limit: 100 }) : Promise.resolve({ success: false })
      ]);
      if (res.success) {
        setCurrentCustomer(res.data);
        setMovements(res.movements || []);
        setInvoices(res.invoices && res.invoices.length > 0 ? res.invoices : (invRes.success ? (invRes.data || []) : []));
      } else if (invRes.success) {
        setInvoices(invRes.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement relevé:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`Confirmez-vous l'annulation et suppression du bon/facture ${inv.numeroFacture} ?\nLes articles seront remis en stock et la dette du client sera réajustée.`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.invoice.delete(inv._id || inv.id);
      if (res.success) {
        await fetchCustomerMovements();
        if (onPaymentRecorded) onPaymentRecorded();
        window.dispatchEvent(new CustomEvent('customer-updated'));
        window.dispatchEvent(new CustomEvent('stock-updated'));
      } else {
        alert(res.error || 'Erreur lors de la suppression.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer) {
      fetchCustomerMovements();
      setShowPaymentForm(initialOpenPayment);
      setPaymentAmount('');
      setError('');
      setEditingMovement(null);
    }
  }, [isOpen, customer, initialOpenPayment]);

  const handleDeleteMovement = async (m) => {
    if (!window.confirm(`Confirmez-vous la suppression de cette opération de ${Number(m.montant || 0).toLocaleString('fr-DZ')} DA ?\nLe solde de dette sera automatiquement recalculé.`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.customer.deleteMovement(m._id || m.id);
      if (res.success) {
        await fetchCustomerMovements();
        if (onPaymentRecorded) onPaymentRecorded();
      } else {
        alert(res.error || 'Erreur lors de la suppression.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditMovement = (m) => {
    setEditingMovement(m);
    setEditMontant(m.montant || '');
    setEditMotif(m.motif || '');
  };

  const handleSaveEditMovement = async (e) => {
    e.preventDefault();
    const val = parseFloat(editMontant);
    if (isNaN(val) || val <= 0) {
      alert('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }
    try {
      setUpdating(true);
      const res = await api.customer.updateMovement(editingMovement._id || editingMovement.id, {
        montant: val,
        motif: editMotif
      });
      if (res.success) {
        setEditingMovement(null);
        await fetchCustomerMovements();
        if (onPaymentRecorded) onPaymentRecorded();
      } else {
        alert(res.error || 'Erreur lors de la mise à jour.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setError('Veuillez saisir un montant supérieur à 0.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const res = await api.customer.addPayment({
        clientId: customer._id,
        montant: amount,
        modeReglement: paymentMode,
        motif: paymentMotif
      });

      if (res.success) {
        setShowPaymentForm(false);
        setPaymentAmount('');
        await fetchCustomerMovements();
        if (onPaymentRecorded) onPaymentRecorded();
      } else {
        setError(res.error || 'Erreur lors de l’encaissement.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!customer) return null;

  const solde = currentCustomer?.soldeDette || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Fiche & Relevé Client : ${currentCustomer?.nom}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Customer Identity & Contact Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Téléphone</span>
            <div className="flex items-center gap-1 font-semibold text-slate-800 mt-0.5">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{currentCustomer?.telephone || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
            <div className="flex items-center gap-1 font-semibold text-slate-800 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{currentCustomer?.email || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Adresse</span>
            <div className="flex items-center gap-1 font-semibold text-slate-800 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{currentCustomer?.adresse || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Plafond Crédit</span>
            <span className="font-semibold text-slate-800 block mt-0.5">
              {currentCustomer?.plafondCredit ? `${Number(currentCustomer.plafondCredit).toLocaleString('fr-DZ')} DA` : 'Sans plafond'}
            </span>
          </div>
          {currentCustomer?.notes && (
            <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200/60 mt-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold mr-1.5">Note :</span>
              <span className="text-slate-700 italic">{currentCustomer.notes}</span>
            </div>
          )}
        </div>

        {/* CASE DE DETTE CLIENT & ACTIONS SITUATION */}
        <div className={`p-5 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md ${
          solde > 0 ? 'bg-slate-900 border-rose-500/80 text-white' : 'bg-slate-900 border-emerald-500/80 text-white'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                CASE DE DETTE : SOLDE CLIENT
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                solde > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500 text-white'
              }`}>
                {solde > 0 ? 'Dette Active / Impayée' : 'Compte à Jour (0 DA)'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono tracking-tight ${solde > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {solde.toLocaleString('fr-DZ')} DA
              </span>
              <span className="text-xs text-slate-400">
                {solde > 0 ? '(Montant total dû par le client)' : '(Aucun impayé)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-400 hover:text-white bg-slate-800 hover:bg-emerald-600 border border-emerald-600/40 rounded-xl transition cursor-pointer"
              title="Exporter le relevé complet du client en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-400 hover:text-white bg-slate-800 hover:bg-rose-600 border border-rose-600/40 rounded-xl transition cursor-pointer"
              title="Exporter le relevé complet du client en PDF"
            >
              <FileDown className="w-4 h-4 text-rose-400" />
              <span>PDF</span>
            </button>

            {/* Quick 80mm & A4 Print Buttons */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl overflow-hidden p-0.5">
              <button
                type="button"
                onClick={() => handlePrintStatement('80mm')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-blue-600 rounded-lg transition cursor-pointer"
                title="Imprimer le ticket de situation en 80mm (thermique SPRT 80 / POS-80)"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Ticket 80mm</span>
              </button>
              <span className="text-slate-600 text-xs px-0.5">|</span>
              <button
                type="button"
                onClick={() => handlePrintStatement('A4')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-blue-600 rounded-lg transition cursor-pointer"
                title="Imprimer le relevé de compte en pleine page A4"
              >
                <span>Relevé A4</span>
              </button>
            </div>

            <button
              onClick={() => setShowPaymentForm(!showPaymentForm)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition shadow-xs cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              <span>{showPaymentForm ? 'Masquer Versement' : 'Versement & Règlement'}</span>
            </button>
          </div>
        </div>

        {/* Quick Payment Form */}
        {showPaymentForm && (
          <form onSubmit={handleRecordPayment} className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-3 animate-in slide-in-from-top duration-200">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Enregistrer un versement reçu</h4>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Montant Reçu (DA) *</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={paymentAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Max: ${solde} DA`}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-emerald-700 focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mode de Règlement</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-emerald-500"
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="VIREMENT">Virement / Mobile Money</option>
                  <option value="CARTE">Carte Bancaire</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motif / Réf reçu</label>
                <input
                  type="text"
                  value={paymentMotif}
                  onChange={(e) => setPaymentMotif(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Validation...' : 'Valider l’encaissement'}
              </button>
            </div>
          </form>
        )}

        {/* Tabs switcher: Factures & Bons vs Mouvements financiers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'invoices' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Factures & Bons de Vente ({invoices.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('movements')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'movements' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mouvements Financiers & Versements ({movements.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchCustomerMovements}
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg cursor-pointer transition"
              title="Actualiser les données"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {activeTab === 'invoices' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">N° Bon / Facture</th>
                      <th className="px-4 py-2.5">Articles</th>
                      <th className="px-4 py-2.5 text-right">Total TTC</th>
                      <th className="px-4 py-2.5 text-right">Payé</th>
                      <th className="px-4 py-2.5 text-right">Reste</th>
                      <th className="px-4 py-2.5 text-center">État</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.length > 0 ? (
                      invoices.map((inv) => {
                        const isBC = inv.typeDocument === 'BON_COMMANDE';
                        const isTicket = inv.typeDocument === 'TICKET';
                        const itemCount = inv.items?.length || 0;
                        const reste = Number(inv.montantReste !== undefined ? inv.montantReste : (Number(inv.totalTTC || 0) - Number(inv.montantPaye || 0)));
                        return (
                          <tr key={inv._id || inv.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-mono">
                              {new Date(inv.dateFacture || inv.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-blue-600">
                              <div className="flex items-center gap-1.5">
                                <span>{inv.numeroFacture}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                  isBC ? 'bg-amber-100 text-amber-800' : isTicket ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {isBC ? 'BC' : isTicket ? 'Ticket' : 'Facture'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <span className="font-semibold text-slate-800">{itemCount} article{itemCount > 1 ? 's' : ''}</span>
                              {inv.items && inv.items.length > 0 && (
                                <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                                  {inv.items.map(it => `${it.nom} (x${it.quantite})`).join(', ')}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">
                              {Number(inv.totalTTC || 0).toLocaleString('fr-DZ')} DA
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                              {Number(inv.montantPaye || 0).toLocaleString('fr-DZ')} DA
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600">
                              {reste > 0 ? `${reste.toLocaleString('fr-DZ')} DA` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                inv.statutPaiement === 'PAYE' || reste <= 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : Number(inv.montantPaye || 0) > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {inv.statutPaiement === 'PAYE' || reste <= 0 ? 'PAYÉ' : Number(inv.montantPaye || 0) > 0 ? 'PARTIEL' : 'NON PAYÉ'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewingInvoice(inv)}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                  title="Aperçu & Imprimer ce Bon"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingInvoice(inv)}
                                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                                  title="Modifier ce Bon (Produits, Quantités, Prix)"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInvoice(inv)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                                  title="Supprimer ce Bon (+ Re-stocker)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-slate-400 text-xs">
                          Aucun bon de commande ou facture enregistré pour ce client.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Type Mouvement</th>
                      <th className="px-4 py-2.5 text-right">Montant</th>
                      <th className="px-4 py-2.5 text-right">Solde Après</th>
                      <th className="px-4 py-2.5">Mode / Doc</th>
                      <th className="px-4 py-2.5">Motif</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.length > 0 ? (
                      movements.map((m) => {
                        const isDebit = m.type === 'DETTE_VENTE';
                        return (
                          <tr key={m._id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(m.createdAt).toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isDebit
                                    ? 'bg-rose-100 text-rose-800'
                                    : m.type === 'ENCAISSEMENT_REGLEMENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isDebit ? (
                                  <ArrowUpRight className="w-3 h-3 text-rose-600" />
                                ) : (
                                  <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                )}
                                {m.type === 'DETTE_VENTE'
                                  ? 'Crédit Vente'
                                  : m.type === 'ENCAISSEMENT_REGLEMENT'
                                  ? 'Règlement Reçu'
                                  : m.type}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-black ${
                                isDebit ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                            >
                              {isDebit ? `+${m.montant?.toLocaleString('fr-DZ')} DA` : `-${m.montant?.toLocaleString('fr-DZ')} DA`}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              {m.soldeApres?.toLocaleString('fr-DZ')} DA
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium">
                              {m.factureAssociee?.numeroFacture || m.modeReglement || '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {m.motif || '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditMovement(m)}
                                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition cursor-pointer"
                                  title="Modifier cette opération"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMovement(m)}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                  title="Supprimer cette opération"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-400 text-xs">
                          Aucun mouvement financier enregistré pour ce client.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Modification Bon de Commande / Facture */}
        {editingInvoice && (
          <EditInvoiceModal
            isOpen={!!editingInvoice}
            onClose={() => setEditingInvoice(null)}
            invoice={editingInvoice}
            onInvoiceUpdated={async () => {
              setEditingInvoice(null);
              await fetchCustomerMovements();
              if (onPaymentRecorded) onPaymentRecorded();
              window.dispatchEvent(new CustomEvent('customer-updated'));
              window.dispatchEvent(new CustomEvent('stock-updated'));
            }}
          />
        )}

        {/* Modal Aperçu Facture / Bon */}
        {viewingInvoice && (
          <InvoiceDetailModal
            isOpen={!!viewingInvoice}
            onClose={() => setViewingInvoice(null)}
            invoice={viewingInvoice}
            onOpenEdit={(inv) => {
              setViewingInvoice(null);
              setEditingInvoice(inv);
            }}
          />
        )}

        {/* Modal Modification Opération */}
        {editingMovement && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs modal-backdrop"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-content modal-container bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Modifier l'opération
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingMovement(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditMovement} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Montant (DA) *</label>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={editMontant}
                    onChange={(e) => setEditMontant(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Motif / Observation</label>
                  <input
                    type="text"
                    value={editMotif}
                    onChange={(e) => setEditMotif(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingMovement(null)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {updating ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

        {/* Printable Section (A4 Customer Statement) */}
        <div className="print-area hidden">
          <div id="printable-customer-ledger" className="p-6 bg-white space-y-6 text-black">
            <div className="flex justify-between items-start border-b-2 border-black pb-4">
              <div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">
                  COMMERCEPOST - RELEVÉ DE COMPTE CLIENT
                </span>
                <h1 className="text-xl font-black uppercase tracking-tight">{t('appTitle')}</h1>
                <p className="text-xs text-slate-600">{t('appSubtitle')}</p>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-100 border border-black font-black text-xs uppercase mb-1">
                  SITUATION CLIENT
                </span>
                <p className="text-xs">Date : <strong>{new Date().toLocaleDateString('fr-DZ')}</strong></p>
              </div>
            </div>

            {/* Customer & Solde Header */}
            <div className="grid grid-cols-2 gap-4 border border-black p-4 text-xs bg-slate-50">
              <div>
                <span className="block text-slate-500 font-bold uppercase text-[9px]">Client :</span>
                <strong className="text-base block">{currentCustomer?.nom}</strong>
                {currentCustomer?.telephone && <p>Tél : {currentCustomer.telephone}</p>}
                {currentCustomer?.adresse && <p>Adresse : {currentCustomer.adresse}</p>}
              </div>
              <div className="text-right">
                <span className="block text-slate-500 font-bold uppercase text-[9px]">Solde Dette Client :</span>
                <strong className="text-xl font-black block text-black">
                  {solde.toLocaleString('fr-DZ')} DA
                </strong>
                <span className="text-[11px] text-slate-600">
                  {solde > 0 ? '(Montant restant à recouvrer)' : '(Situation à jour)'}
                </span>
              </div>
            </div>

            {/* Movements table */}
            <table className="w-full text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-slate-100 border-b border-black text-left">
                  <th className="border border-black px-2 py-1.5 w-28">Date</th>
                  <th className="border border-black px-2 py-1.5 w-24">Type</th>
                  <th className="border border-black px-2 py-1.5 text-right w-28">Débit (Achat)</th>
                  <th className="border border-black px-2 py-1.5 text-right w-28">Crédit (Règlement)</th>
                  <th className="border border-black px-2 py-1.5 text-right w-28">Solde Après</th>
                  <th className="border border-black px-2 py-1.5">Observations / Réf</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, idx) => {
                  const isPayment = m.type === 'PAIEMENT' || m.type === 'REGLEMENT' || m.type === 'ENCAISSEMENT';
                  return (
                    <tr key={m._id || idx} className="border-b border-slate-300">
                      <td className="border border-black px-2 py-1.5">
                        {new Date(m.createdAt || m.dateMouvement || m.date).toLocaleDateString('fr-DZ')}
                      </td>
                      <td className="border border-black px-2 py-1.5 font-bold">
                        {isPayment ? 'RÈGLEMENT' : 'VENTE / BL'}
                      </td>
                      <td className="border border-black px-2 py-1.5 text-right font-black">
                        {!isPayment ? `${Number(m.montant || 0).toLocaleString('fr-DZ')} DA` : '-'}
                      </td>
                      <td className="border border-black px-2 py-1.5 text-right font-black">
                        {isPayment ? `${Number(m.montant || 0).toLocaleString('fr-DZ')} DA` : '-'}
                      </td>
                      <td className="border border-black px-2 py-1.5 text-right font-mono font-bold">
                        {Number(m.soldeApres || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="border border-black px-2 py-1.5">
                        {m.factureAssociee?.numeroFacture || m.motif || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-black text-xs">
              <div>
                <p className="font-bold">Visa Client :</p>
                <div className="h-16 border-b border-dashed border-black mt-2"></div>
              </div>
              <div>
                <p className="font-bold">Cachet & Signature Magasin :</p>
                <div className="h-16 border-b border-dashed border-black mt-2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
