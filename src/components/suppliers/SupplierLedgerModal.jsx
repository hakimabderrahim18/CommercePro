import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/api';
import { 
  Building, 
  ArrowUpRight, 
  DollarSign, 
  Calendar, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  CreditCard, 
  Printer, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  FileSpreadsheet, 
  FileDown, 
  Pencil, 
  Trash2, 
  Eye, 
  X, 
  Check, 
  ShoppingBag,
  Plus
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { printHtmlContent, exportHtmlToPdf, getPrinterSettings, generateSituationReceiptHtml } from '../../utils/printerHelper';
import EditPurchaseModal from '../purchases/EditPurchaseModal';
import PurchaseDetailModal from '../purchases/PurchaseDetailModal';

export default function SupplierLedgerModal({ isOpen, onClose, supplier, onPaymentRecorded, initialOpenPayment = false }) {
  const { t, isRTL } = useLanguage();
  const [currentSupplier, setCurrentSupplier] = useState(supplier);
  const [movements, setMovements] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [caisses, setCaisses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' | 'movements'

  // Edit movement state
  const [editingMovement, setEditingMovement] = useState(null);
  const [editMontant, setEditMontant] = useState('');
  const [editMotif, setEditMotif] = useState('');
  const [updating, setUpdating] = useState(false);

  // Purchase modals state
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [viewingPurchase, setViewingPurchase] = useState(null);

  const handlePrintStatement = async (forceFormat = null) => {
    const cfg = getPrinterSettings();
    const format = forceFormat || cfg.situationPrintFormat || '80mm';

    if (format === '80mm') {
      const html = generateSituationReceiptHtml({
        entityType: 'FOURNISSEUR',
        entity: currentSupplier,
        movements,
        invoices: purchases,
        settings: cfg
      });
      await printHtmlContent(html, {
        printerName: cfg.receiptPrinter,
        pageSize: { width: 80 * 1000, height: 297000 },
        silent: cfg.silentPrint !== false
      });
    } else {
      const printEl = document.getElementById('printable-supplier-ledger');
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
      const sId = supplier._id || supplier.id;
      const res = await api.supplier.exportStatementExcel(sId);
      if (res.success) {
        alert('Situation fournisseur exportée en Excel avec succès !');
      } else if (res.message && res.message !== 'Exportation annulée.') {
        alert(res.message || res.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPdf = async () => {
    const printEl = document.getElementById('printable-supplier-ledger');
    if (printEl) {
      const res = await exportHtmlToPdf(printEl.innerHTML, `Situation_${currentSupplier?.nom || 'Fournisseur'}.pdf`, 'A4');
      if (res.success) {
        alert('Situation fournisseur exportée en PDF avec succès !');
      } else if (res.error && res.error !== 'Impression annulée') {
        alert(res.error);
      }
    }
  };

  // Versement form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [caisse, setCaisse] = useState('Caisse 1');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchSupplierDetails = async () => {
    if (!supplier?._id) return;
    try {
      setLoading(true);
      const [res, caisseRes] = await Promise.all([
        api.supplier.getById(supplier._id),
        api.caisse ? api.caisse.getAll() : Promise.resolve({ success: false })
      ]);
      if (res.success) {
        setCurrentSupplier(res.data);
        setMovements(res.movements || []);
        setPurchases(res.invoices || res.purchases || []);
      }
      if (caisseRes.success && caisseRes.data && caisseRes.data.length > 0) {
        setCaisses(caisseRes.data);
        setCaisse(caisseRes.data[0].nom);
      }
    } catch (err) {
      console.error('Erreur chargement relevé fournisseur:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && supplier) {
      fetchSupplierDetails();
      setShowPaymentForm(initialOpenPayment);
      setMontant('');
      setError('');
      setEditingMovement(null);
    }
  }, [isOpen, supplier, initialOpenPayment]);

  const handleDeleteMovement = async (m) => {
    if (!window.confirm(`Confirmez-vous la suppression de cette opération de ${Number(m.montant || 0).toLocaleString('fr-DZ')} DA ?\nLe solde de dette sera automatiquement recalculé.`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.supplier.deleteMovement(m._id || m.id);
      if (res.success) {
        await fetchSupplierDetails();
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
    setEditMotif(m.notes || m.motif || '');
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
      const res = await api.supplier.updateMovement(editingMovement._id || editingMovement.id, {
        montant: val,
        motif: editMotif
      });
      if (res.success) {
        setEditingMovement(null);
        await fetchSupplierDetails();
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

  const handleDeletePurchase = async (p) => {
    if (!window.confirm(`Confirmez-vous l'annulation et suppression de la pièce d'achat ${p.numeroFactureAchat} ?\nLes quantités seront déduites du stock et la dette réajustée.`)) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.purchase.delete(p._id || p.id);
      if (res.success) {
        await fetchSupplierDetails();
        if (onPaymentRecorded) onPaymentRecorded();
        window.dispatchEvent(new CustomEvent('supplier-updated'));
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

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const val = parseFloat(montant);
    if (!val || val <= 0) {
      setError('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const res = await api.supplier.recordPayment({
        supplierId: supplier._id,
        montant: val,
        modePaiement,
        caisse,
        reference,
        notes
      });

      if (res.success) {
        setShowPaymentForm(false);
        setMontant('');
        setReference('');
        setNotes('');
        await fetchSupplierDetails();
        if (onPaymentRecorded) onPaymentRecorded();
      } else {
        setError(res.error || 'Erreur enregistrement versement fournisseur.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!supplier) return null;

  const solde = Number(currentSupplier?.soldeDette || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Fiche & Situation Fournisseur : ${currentSupplier?.nom}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Supplier Identity & Coordinates Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Téléphone</span>
            <div className="flex items-center gap-1 font-semibold text-slate-800 mt-0.5">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{currentSupplier?.telephone || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
            <div className="flex items-center gap-1 font-semibold text-slate-800 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{currentSupplier?.email || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Adresse</span>
            <div className="flex items-center gap-1 font-semibold text-slate-800 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{currentSupplier?.adresse || '-'}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Observations</span>
            <span className="font-semibold text-slate-800 truncate block mt-0.5">{currentSupplier?.notes || '-'}</span>
          </div>
        </div>

        {/* CASE DE DETTE FOURNISSEUR & ACTIONS SITUATION */}
        <div className={`p-5 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md ${
          solde > 0 ? 'bg-slate-900 border-amber-500/80 text-white' : 'bg-slate-900 border-emerald-500/80 text-white'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                CASE DE DETTE : RESTE À PAYER AU FOURNISSEUR
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                solde > 0 ? 'bg-amber-500 text-slate-950 font-black' : 'bg-emerald-500 text-white'
              }`}>
                {solde > 0 ? 'Dette Fournisseur Active' : 'Compte Fournisseur Régularisé'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono tracking-tight ${solde > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {solde.toLocaleString('fr-DZ')} {t('currency')}
              </span>
              <span className="text-xs text-slate-400">
                {solde > 0 ? '(Montant total à régler au fournisseur)' : '(Solde régularisé)'}
              </span>
            </div>
            {currentSupplier?.telephone && (
              <div className="flex items-center gap-2 text-xs text-slate-300 pt-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{currentSupplier.telephone}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold text-xs rounded-xl border border-emerald-600/40 transition cursor-pointer"
              title="Exporter la situation fournisseur en Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white font-bold text-xs rounded-xl border border-rose-600/40 transition cursor-pointer"
              title="Exporter la situation fournisseur en PDF"
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
                title="Imprimer la situation fournisseur en pleine page A4"
              >
                <span>Relevé A4</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPaymentForm(!showPaymentForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-600/30 transition cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>{showPaymentForm ? 'Fermer Versement' : 'Effectuer un Versement'}</span>
            </button>
          </div>
        </div>

        {/* Versement Form */}
        {showPaymentForm && (
          <form onSubmit={handleRecordPayment} className="p-4 bg-slate-50 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span>Nouveau Versement Fournisseur</span>
            </h4>

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Montant Versement *</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={montant}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mode de Paiement</label>
                <select
                  value={modePaiement}
                  onChange={(e) => setModePaiement(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
                >
                  <option value="ESPECES">Espèces (Caisse)</option>
                  <option value="VIREMENT">Virement / Chèque</option>
                  <option value="CARTE">Carte</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Caisse Source</label>
                <select
                  value={caisse}
                  onChange={(e) => setCaisse(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-blue-500"
                >
                  {caisses.length > 0 ? (
                    caisses.map((c) => (
                      <option key={c.id || c.nom} value={c.nom}>
                        {c.nom}
                      </option>
                    ))
                  ) : (
                    <option value="Caisse 1">Caisse 1</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Réf / N° Reçu</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex: Reçu N° 849, Chèque BNA 123"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observation éventuelle"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{submitting ? 'Validation...' : 'Valider le Versement'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Historic Purchases & Movements */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('movements')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'movements' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mouvements & Versements ({movements.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('purchases')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'purchases' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Factures & Bons d'Achat ({purchases.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchSupplierDetails}
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg cursor-pointer"
              title="Rafraîchir"
            >
              <Clock className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {activeTab === 'movements' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">N° Pièce</th>
                      <th className="px-4 py-2.5 text-right">Montant (DA)</th>
                      <th className="px-4 py-2.5 text-right">Solde Après (DA)</th>
                      <th className="px-4 py-2.5">Notes</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.length > 0 ? (
                      movements.map((m) => {
                        const isPayment = m.type === 'REGLEMENT' || m.type === 'VERSEMENT' || m.type === 'PAIEMENT_DETTE';
                        return (
                          <tr key={m._id || m.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-mono">
                              {new Date(m.createdAt || m.dateMouvement).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                isPayment ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isPayment ? 'VERSEMENT (-)' : 'ACHAT (+)'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-700">
                              {m.numeroFacture || m.reference || m.referenceFacture || '-'}
                            </td>
                            <td className={`px-4 py-3 text-right font-black ${isPayment ? 'text-emerald-600' : 'text-slate-900'}`}>
                              {isPayment ? '-' : '+'}{Number(m.montant || 0).toLocaleString('fr-DZ')} DA
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700 font-mono">
                              {Number(m.soldeApres || 0).toLocaleString('fr-DZ')} DA
                            </td>
                            <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                              {m.notes || m.motif || '-'}
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
                          Aucun mouvement enregistré pour ce fournisseur.
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
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">N° Pièce</th>
                      <th className="px-4 py-2.5 text-right">Total TTC</th>
                      <th className="px-4 py-2.5 text-right">Payé</th>
                      <th className="px-4 py-2.5 text-right">Reste</th>
                      <th className="px-4 py-2.5 text-center">État</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.length > 0 ? (
                      purchases.map((p) => {
                        const isBC = p.typeDocument === 'BON_COMMANDE_ACHAT';
                        return (
                          <tr key={p._id || p.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-500 font-mono">
                              {new Date(p.dateFactureAchat || p.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-blue-600">
                              <div className="flex items-center gap-1.5">
                                <span>{p.numeroFactureAchat}</span>
                                <span className={`px-1 py-0.2 rounded text-[9px] font-black uppercase ${
                                  isBC ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {isBC ? 'BC' : 'Facture'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">
                              {Number(p.totalTTC || 0).toLocaleString('fr-DZ')} DA
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                              {Number(p.montantPaye || 0).toLocaleString('fr-DZ')} DA
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-amber-600">
                              {Number(p.montantReste || 0) > 0 ? `${Number(p.montantReste).toLocaleString('fr-DZ')} DA` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                p.statutPaiement === 'PAYE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.statutPaiement === 'PARTIEL'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {p.statutPaiement === 'PAYE' ? 'PAYÉ' : p.statutPaiement === 'PARTIEL' ? 'PARTIEL' : 'NON PAYÉ'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewingPurchase(p)}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                  title="Aperçu & Imprimer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPurchase(p)}
                                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                                  title="Modifier cet achat"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePurchase(p)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                                  title="Supprimer cet achat (- Stock)"
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
                          Aucun achat ou bon de commande enregistré pour ce fournisseur.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Modification Opération Mouvement */}
        {editingMovement && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs modal-backdrop"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-content modal-container bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Modifier l'opération fournisseur
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Motif / Notes</label>
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

        {/* Modal Modification Facture Achat */}
        {editingPurchase && (
          <EditPurchaseModal
            isOpen={!!editingPurchase}
            onClose={() => setEditingPurchase(null)}
            purchase={editingPurchase}
            onPurchaseUpdated={() => {
              setEditingPurchase(null);
              fetchSupplierDetails();
              if (onPaymentRecorded) onPaymentRecorded();
              window.dispatchEvent(new CustomEvent('supplier-updated'));
              window.dispatchEvent(new CustomEvent('stock-updated'));
            }}
          />
        )}

        {/* Modal Aperçu Achat */}
        {viewingPurchase && (
          <PurchaseDetailModal
            isOpen={!!viewingPurchase}
            onClose={() => setViewingPurchase(null)}
            purchase={viewingPurchase}
            onOpenEdit={(p) => {
              setViewingPurchase(null);
              setEditingPurchase(p);
            }}
          />
        )}

        {/* Printable Section (A4 Supplier Statement) */}
        <div className="print-area hidden">
          <div id="printable-supplier-ledger" className="p-6 bg-white space-y-6 text-black">
            <div className="flex justify-between items-start border-b-2 border-black pb-4">
              <div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">
                  COMMERCEPOST - RELEVÉ DE COMPTE FOURNISSEUR
                </span>
                <h1 className="text-xl font-black uppercase tracking-tight">{t('appTitle')}</h1>
                <p className="text-xs text-slate-600">{t('appSubtitle')}</p>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-100 border border-black font-black text-xs uppercase mb-1">
                  SITUATION FOURNISSEUR
                </span>
                <p className="text-xs">Date d'édition : <strong>{new Date().toLocaleDateString('fr-DZ')}</strong></p>
              </div>
            </div>

            {/* Supplier and balance header */}
            <div className="grid grid-cols-2 gap-4 border border-black p-4 text-xs bg-slate-50">
              <div>
                <span className="block text-slate-500 font-bold uppercase text-[9px]">Fournisseur :</span>
                <strong className="text-base block">{currentSupplier?.nom}</strong>
                {currentSupplier?.telephone && <p>Tél : {currentSupplier.telephone}</p>}
                {currentSupplier?.adresse && <p>Adresse : {currentSupplier.adresse}</p>}
              </div>
              <div className="text-right">
                <span className="block text-slate-500 font-bold uppercase text-[9px]">Solde Actuel Dû au Fournisseur :</span>
                <strong className="text-xl font-black block text-black">
                  {solde.toLocaleString('fr-DZ')} DA
                </strong>
                <span className="text-[11px] text-slate-600">
                  {solde > 0 ? '(Dette à payer)' : '(Compte régularisé)'}
                </span>
              </div>
            </div>

            {/* Movements table */}
            <table className="w-full text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-slate-100 border-b border-black text-left">
                  <th className="border border-black px-2 py-1.5 w-28">Date</th>
                  <th className="border border-black px-2 py-1.5 w-24">Opération</th>
                  <th className="border border-black px-2 py-1.5 w-32">Référence</th>
                  <th className="border border-black px-2 py-1.5 text-right w-28">Montant</th>
                  <th className="border border-black px-2 py-1.5 text-right w-28">Solde Après</th>
                  <th className="border border-black px-2 py-1.5">Observations</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, idx) => {
                  const isPay = m.type === 'VERSEMENT_FOURNISSEUR' || m.type === 'REGLEMENT';
                  return (
                    <tr key={m._id || idx} className="border-b border-slate-300">
                      <td className="border border-black px-2 py-1.5">
                        {new Date(m.createdAt || m.dateMouvement).toLocaleDateString('fr-DZ')}
                      </td>
                      <td className="border border-black px-2 py-1.5 font-bold">
                        {isPay ? 'VERSEMENT' : 'ACHAT'}
                      </td>
                      <td className="border border-black px-2 py-1.5 font-mono">
                        {m.numeroFacture || m.reference || '-'}
                      </td>
                      <td className="border border-black px-2 py-1.5 text-right font-black">
                        {isPay ? '-' : '+'}{Number(m.montant || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="border border-black px-2 py-1.5 text-right font-mono font-bold">
                        {Number(m.soldeApres || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="border border-black px-2 py-1.5">
                        {m.notes || m.motif || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-black text-xs">
              <div>
                <p className="font-bold">Visa & Signature Fournisseur :</p>
                <div className="h-16 border-b border-dashed border-black mt-2"></div>
              </div>
              <div>
                <p className="font-bold">Cachet & Signature Établissement :</p>
                <div className="h-16 border-b border-dashed border-black mt-2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
