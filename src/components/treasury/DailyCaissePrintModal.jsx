import React from 'react';
import Modal from '../common/Modal';
import { Printer, Calendar, Wallet, ArrowDownLeft, ArrowUpRight, Building2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function DailyCaissePrintModal({ 
  isOpen, 
  onClose, 
  transactions = [], 
  stats = {}, 
  caisses = [], 
  dailyStats = [],
  selectedCaisse = 'TOUS',
  period = 'today',
  startDate = '',
  endDate = ''
}) {
  const { t, isRTL } = useLanguage();
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const periodLabel = period === 'today' ? 'Aujourd’hui' :
                      period === 'yesterday' ? 'Hier' :
                      period === 'week' ? 'Cette Semaine' :
                      period === 'month' ? 'Ce Mois' :
                      period === 'custom' ? `Du ${startDate} au ${endDate}` : 'Toutes périodes';

  const caisseLabel = selectedCaisse === 'TOUS' ? 'Toutes les Caisses' : selectedCaisse;

  const totalEnc = Number(stats.totalEncaissements || 0);
  const totalDec = Number(stats.totalDecaissements || 0);
  const soldeNet = Number(stats.soldeNet || (totalEnc - totalDec));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('treasury_print_daily')} (${periodLabel})`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-between no-print bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span>Caisse : <strong>{caisseLabel}</strong></span>
            <span>•</span>
            <span>Période : <strong>{periodLabel}</strong></span>
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

        {/* Printable Area (A4 layout) */}
        <div 
          id="printable-caisse-report"
          className="print-area bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-xs text-slate-800"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-black pb-4">
            <div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">
                COMMERCEPOST - TRÉSORERIE & COMPTABILITÉ
              </span>
              <h1 className="text-xl font-black uppercase tracking-tight">{t('appTitle')}</h1>
              <p className="text-xs text-slate-600">{t('appSubtitle')}</p>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 border border-black font-black text-xs uppercase mb-1">
                POINT DE CAISSE JOURNALIER
              </span>
              <p className="text-xs">Date d'édition : <strong>{new Date().toLocaleString('fr-DZ')}</strong></p>
              <p className="text-xs text-slate-600">Période : <strong>{periodLabel}</strong> | Caisse : <strong>{caisseLabel}</strong></p>
            </div>
          </div>

          {/* Financial KPIs Grid */}
          <div className="grid grid-cols-3 gap-4 border border-black p-4 bg-slate-50 text-xs">
            <div>
              <span className="block text-slate-600 font-bold uppercase text-[9px]">Total Recettes (Encaissements) :</span>
              <strong className="text-base text-emerald-700 block mt-0.5">
                +{totalEnc.toLocaleString('fr-DZ')} DA
              </strong>
            </div>

            <div>
              <span className="block text-slate-600 font-bold uppercase text-[9px]">Total Dépenses (Décaissements) :</span>
              <strong className="text-base text-rose-700 block mt-0.5">
                -{totalDec.toLocaleString('fr-DZ')} DA
              </strong>
            </div>

            <div>
              <span className="block text-slate-600 font-bold uppercase text-[9px]">Solde Net de Caisse :</span>
              <strong className={`text-lg font-black block mt-0.5 ${soldeNet >= 0 ? 'text-black' : 'text-rose-700'}`}>
                {soldeNet.toLocaleString('fr-DZ')} DA
              </strong>
            </div>
          </div>

          {/* Payment Methods breakdown */}
          <div className="border border-black p-3 bg-white space-y-2">
            <span className="font-bold uppercase text-[10px] text-slate-600 block">Ventilation par Mode de Règlement :</span>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] text-slate-500 block">Espèces</span>
                <strong className="text-slate-900 font-mono">{Number(stats.totalEspeces || 0).toLocaleString('fr-DZ')} DA</strong>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] text-slate-500 block">Chèques</span>
                <strong className="text-slate-900 font-mono">{Number(stats.totalCheques || 0).toLocaleString('fr-DZ')} DA</strong>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] text-slate-500 block">Virements</span>
                <strong className="text-slate-900 font-mono">{Number(stats.totalVirements || 0).toLocaleString('fr-DZ')} DA</strong>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] text-slate-500 block">Cartes / CIB</span>
                <strong className="text-slate-900 font-mono">{Number(stats.totalCartes || 0).toLocaleString('fr-DZ')} DA</strong>
              </div>
            </div>
          </div>

          {/* Recettes par Caisse if multiple */}
          {dailyStats.length > 0 && (
            <div className="border border-black p-3 bg-white space-y-2">
              <span className="font-bold uppercase text-[10px] text-slate-600 block">Recettes Enregistrées par Caisse (Aujourd’hui) :</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {dailyStats.map((ds, idx) => (
                  <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center">
                    <span className="font-semibold text-slate-700">{ds.nom} :</span>
                    <strong className="text-blue-700 font-mono">{Number(ds.totalJour || 0).toLocaleString('fr-DZ')} DA</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transactions list */}
          <div className="space-y-2">
            <span className="font-bold uppercase text-[10px] text-slate-600 block">
              Détail des Opérations de la Période ({transactions.length} écritures) :
            </span>
            <table className="w-full text-xs border-collapse border border-black">
              <thead>
                <tr className="bg-slate-100 border-b border-black text-left">
                  <th className="border border-black px-2 py-1.5 w-24">Heure / Date</th>
                  <th className="border border-black px-2 py-1.5 w-24">Type</th>
                  <th className="border border-black px-2 py-1.5 w-28">N° Pièce</th>
                  <th className="border border-black px-2 py-1.5 w-24">Caisse</th>
                  <th className="border border-black px-2 py-1.5 w-24">Mode</th>
                  <th className="border border-black px-2 py-1.5 text-right w-28">Montant</th>
                  <th className="border border-black px-2 py-1.5">Tiers / Motif</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 100).map((t, idx) => {
                  const isIn = t.type === 'ENCAISSEMENT';
                  return (
                    <tr key={t._id || idx} className="border-b border-slate-300">
                      <td className="border border-black px-2 py-1 text-[11px] font-mono">
                        {new Date(t.dateTransaction || t.created_at).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="border border-black px-2 py-1 font-bold">
                        {isIn ? 'RECETTE (+)' : 'DÉPENSE (-)'}
                      </td>
                      <td className="border border-black px-2 py-1 font-mono text-[11px]">
                        {t.numeroTransaction || '-'}
                      </td>
                      <td className="border border-black px-2 py-1 font-semibold">
                        {t.caisse || 'Caisse 1'}
                      </td>
                      <td className="border border-black px-2 py-1">
                        {t.modePaiement || 'ESPECES'}
                      </td>
                      <td className="border border-black px-2 py-1 text-right font-black">
                        {isIn ? '+' : '-'}{Number(t.montant || 0).toLocaleString('fr-DZ')} DA
                      </td>
                      <td className="border border-black px-2 py-1 truncate max-w-xs">
                        {t.tiers || t.fournisseur || t.motif || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-black text-xs">
            <div>
              <p className="font-bold">Visa & Signature du Caissier :</p>
              <div className="h-16 border-b border-dashed border-black mt-2"></div>
            </div>
            <div>
              <p className="font-bold">Visa Responsable / Direction :</p>
              <div className="h-16 border-b border-dashed border-black mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
