import React, { useRef } from 'react';
import Modal from '../common/Modal';
import { Printer, AlertOctagon, Package, Calendar, User, FileText } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function LossReceiptModal({ isOpen, onClose, loss }) {
  const { t, isRTL } = useLanguage();
  const printRef = useRef(null);

  if (!loss) return null;

  const handlePrint = () => {
    window.print();
  };

  const typeLabel = loss.typePerte === 'CASSE' ? t('loss_type_CASSE') :
                    loss.typePerte === 'PERTE_VOL' ? t('loss_type_PERTE_VOL') :
                    loss.typePerte === 'DEFAUT_FABRICATION' ? t('loss_type_DEFAUT_FABRICATION') :
                    loss.typePerte === 'PERIME_AVARIE' ? t('loss_type_PERIME_AVARIE') :
                    loss.typePerte === 'DEGAT_TRANSPORT' ? t('loss_type_DEGAT_TRANSPORT') : (loss.typePerte || t('loss_type_AUTRE'));

  const dateFormatted = new Date(loss.dateDeclaration || loss.created_at || Date.now()).toLocaleString('fr-DZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('loss_receiptTitle')}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Printable Area */}
        <div ref={printRef} className="p-6 bg-white border border-slate-200 rounded-2xl space-y-5 text-slate-800 printable-card">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block mb-1">
                COMMERCEPOST - GESTION DU STOCK
              </span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {t('loss_receiptTitle')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {t('loss_receiptSubtitle')}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 font-mono font-black text-sm rounded-lg">
                {loss.numeroDeclaration}
              </span>
              <span className="block text-[11px] text-slate-400 font-semibold mt-1">
                {dateFormatted}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold block">{t('loss_product')} :</span>
              <span className="font-black text-slate-900 text-sm block">{loss.nom}</span>
              <div className="flex items-center gap-2 text-[11px] text-slate-600 font-mono">
                <span>Réf: {loss.reference}</span>
                {loss.categorie && <span>| {loss.categorie}</span>}
              </div>
              {(loss.taille || loss.pointure || loss.couleur || (loss.genre && loss.genre !== 'UNISEXE')) && (
                <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-slate-200">
                  {loss.taille && <span className="font-bold text-indigo-700">Taille: {loss.taille}</span>}
                  {loss.pointure && <span className="font-bold text-amber-800">Pointure: {loss.pointure}</span>}
                  {loss.couleur && <span className="font-semibold text-slate-700">Couleur: {loss.couleur}</span>}
                  {loss.genre && loss.genre !== 'UNISEXE' && <span>Genre: {loss.genre}</span>}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold block">{t('type')} & Responsable :</span>
              <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[11px]">
                {typeLabel}
              </span>
              <span className="block text-[11px] font-semibold text-slate-700 pt-1">
                Déclaré par : <span className="font-bold text-slate-900">{loss.declarePar || 'Responsable Stock'}</span>
              </span>
            </div>
          </div>

          {/* Quantities & Financial Impact */}
          <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Quantité Dépréciée</th>
                <th className="px-4 py-2.5 text-right">{t('loss_unitLoss')}</th>
                <th className="px-4 py-2.5 text-right">{t('loss_totalLoss')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-4 py-3 font-black text-rose-600 text-sm">
                  - {loss.quantite} pcs
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-700">
                  {Number(loss.prixAchatUnitaire || 0).toLocaleString('fr-DZ')} {t('currency')}
                </td>
                <td className="px-4 py-3 text-right font-black text-rose-700 text-sm">
                  {Number(loss.valeurPerte || 0).toLocaleString('fr-DZ')} {t('currency')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Motif / Observations */}
          {loss.motif && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-0.5">
              <span className="font-bold text-slate-500 block">{t('loss_motif')} :</span>
              <p className="text-slate-800 font-medium italic">{loss.motif}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
            <div className="space-y-12">
              <span className="font-bold text-slate-500 block">Visa du Déclarant / Magasinier :</span>
              <div className="border-b border-dashed border-slate-300 w-36"></div>
            </div>
            <div className="space-y-12 text-right">
              <span className="font-bold text-slate-500 block">Approbation de la Direction :</span>
              <div className="border-b border-dashed border-slate-300 w-36 ml-auto"></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            {t('close')}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('loss_printVoucher')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
