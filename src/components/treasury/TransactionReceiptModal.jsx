import React from 'react';
import Modal from '../common/Modal';
import { Printer, Download, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function TransactionReceiptModal({ isOpen, onClose, transaction }) {
  const { t, isRTL } = useLanguage();
  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const isInflow = transaction.type === 'ENCAISSEMENT';
  const tiersName = transaction.client?.nom || transaction.fournisseur || transaction.tiers || '-';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('tre_receiptTitle')} : ${transaction.numeroTransaction}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-between no-print bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
              isInflow ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {isInflow ? t('tre_tabInflows') : t('tre_tabOutflows')}
            </span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              {transaction.numeroTransaction}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('print')}</span>
          </button>
        </div>

        {/* Printable Voucher Area */}
        <div 
          id="printable-transaction"
          className="print-area bg-white p-6 rounded-2xl border-2 border-slate-300 shadow-xs space-y-4 text-xs max-w-md mx-auto"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-slate-800 pb-3">
            <h2 className="text-base font-black tracking-tight text-slate-900 uppercase">{t('appTitle')}</h2>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              {isInflow ? 'BON D’ENCAISSEMENT (REÇU DE CAISSE)' : 'BON DE DÉCAISSEMENT (PIÈCE DE DÉPENSE)'}
            </p>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              <span>{t('inv_date')} : {new Date(transaction.dateTransaction || transaction.created_at).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')}</span>
            </div>
            <div className="font-mono font-black text-sm text-slate-800 mt-1">
              N° {transaction.numeroTransaction}
            </div>
          </div>

          {/* Transaction Info Grid */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">{t('tre_category')} :</span>
              <span className="font-bold text-slate-800">{transaction.categorie}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">{t('tre_tiers')} :</span>
              <span className="font-black text-slate-900">{tiersName}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">{t('tre_method')} :</span>
              <span className="font-bold text-slate-700">{transaction.modePaiement}</span>
            </div>

            {transaction.referenceDocument && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-semibold">{t('tre_refDoc')} :</span>
                <span className="font-mono font-bold text-slate-700">{transaction.referenceDocument}</span>
              </div>
            )}

            {transaction.motif && (
              <div className="pt-1 border-t border-slate-200/60 text-slate-600">
                <span className="text-slate-400 text-[10px] block uppercase font-bold">{t('tre_motif')} :</span>
                <span className="font-medium">{transaction.motif}</span>
              </div>
            )}
          </div>

          {/* Amount Box */}
          <div className={`p-4 rounded-2xl border-2 text-center ${
            isInflow ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900' : 'bg-rose-50/70 border-rose-300 text-rose-900'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
              {isInflow ? 'Montant Encaissé' : 'Montant Décaissé'}
            </span>
            <span className="text-xl font-black font-mono">
              {Number(transaction.montant || 0).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}
            </span>
          </div>

          {/* Signatures zone */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            <div className="border border-slate-200 rounded-xl p-3 h-20 flex flex-col justify-between">
              <span className="font-bold text-slate-600">Le Caissier / Responsable</span>
              <span className="italic text-[9px]">Cachet & Signature</span>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 h-20 flex flex-col justify-between">
              <span className="font-bold text-slate-600">Le Bénéficiaire / Client</span>
              <span className="italic text-[9px]">Signature</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
