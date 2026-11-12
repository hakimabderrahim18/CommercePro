import React, { useState } from 'react';
import { X, CreditCard, Banknote, Landmark, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

export default function InvoicePaymentModal({ isOpen, onClose, invoice, onPaymentSuccess }) {
  const { t, isRTL } = useLanguage();
  if (!isOpen || !invoice) return null;

  const montantResteDu = Number(invoice.montantReste || (invoice.totalTTC - invoice.montantPaye) || 0);

  const [montant, setMontant] = useState(montantResteDu > 0 ? montantResteDu : 0);
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [caisses, setCaisses] = useState([]);
  const [caisse, setCaisse] = useState('Caisse 1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (api.caisse) {
      api.caisse.getAll().then(res => {
        if (res.success && res.data && res.data.length > 0) {
          setCaisses(res.data);
          setCaisse(res.data[0].nom);
        }
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const val = parseFloat(montant);
    if (isNaN(val) || val <= 0) {
      setError('Veuillez saisir un montant supérieur à 0.');
      return;
    }

    if (val > montantResteDu) {
      setError(`Le montant ne peut pas dépasser le reste dû (${montantResteDu.toLocaleString('fr-DZ')} ${t('currency')}).`);
      return;
    }

    setLoading(true);
    try {
      const res = await api.invoice.recordPayment({
        invoiceId: invoice._id || invoice.id,
        montant: val,
        modePaiement,
        caisse,
        notes
      });

      if (res.success) {
        if (onPaymentSuccess) onPaymentSuccess(res.data);
        onClose();
      } else {
        setError(res.error || 'Erreur lors de l’enregistrement du paiement.');
      }
    } catch (err) {
      setError(err.message || 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-content modal-container bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">{t('inv_paymentModalTitle')}</h3>
              <p className="text-xs text-blue-100 font-medium font-mono">{invoice.numeroFacture}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Invoice Summary Cards */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">{t('inv_totalAmount')}</span>
              <span className="text-xs font-black text-slate-800">{Number(invoice.totalTTC || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">{t('inv_alreadyPaid')}</span>
              <span className="text-xs font-bold text-emerald-600">{Number(invoice.montantPaye || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">{t('inv_remainingDue')}</span>
              <span className="text-xs font-black text-rose-600">{montantResteDu.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
            </div>
          </div>

          {/* Client info if present */}
          {invoice.client && (
            <div className="text-xs text-slate-600 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 flex items-center justify-between">
              <span className="font-semibold">{t('client')} : <strong className="text-slate-800">{invoice.client.nom}</strong></span>
              <span className="text-[11px] font-bold text-blue-700">{t('cust_debtBalance')}: {Number(invoice.client.soldeDette || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
            </div>
          )}

          {/* Amount to Pay */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">{t('inv_amountToPay')}</label>
              <button
                type="button"
                onClick={() => setMontant(montantResteDu)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer underline"
              >
                {t('inv_fullPayment')} ({montantResteDu.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')})
              </button>
            </div>
            <input
              type="number"
              min="1"
              max={montantResteDu}
              step="any"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:bg-white focus:outline-blue-500"
            />
          </div>

          {/* Payment Method & Caisse */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('inv_paymentMode')}</label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500 cursor-pointer"
              >
                <option value="ESPECES">{t('pos_cash')}</option>
                <option value="CHEQUE">{t('pos_check')}</option>
                <option value="VIREMENT">{t('pos_transfer')}</option>
                <option value="CARTE">{t('pos_card')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('pos_selectCaisse') || 'Caisse'}</label>
              <select
                value={caisse}
                onChange={(e) => setCaisse(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-blue-500 cursor-pointer"
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

          {/* Notes / References */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('inv_notesLabel')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Reçu N° 452, Virement BNA..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              {t('cancel')}
            </button>

            <button
              type="submit"
              disabled={loading || montantResteDu <= 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? t('loading') : t('inv_validatePayment')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
