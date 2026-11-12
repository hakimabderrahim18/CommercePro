import React from 'react';
import Modal from '../common/Modal';
import { Printer, Download, RotateCcw, Truck, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getPrinterSettings, printHtmlContent } from '../../utils/printerHelper';

export default function ReturnDetailModal({ isOpen, onClose, returnData }) {
  const { t, isRTL } = useLanguage();
  if (!returnData) return null;

  const handlePrint = async () => {
    try {
      const el = document.getElementById('printable-return-slip');
      if (el) {
        const settings = getPrinterSettings();
        await printHtmlContent(el.outerHTML, {
          pageSize: 'A4',
          landscape: false,
          silent: settings.silentPrint !== false
        });
      }
    } catch (e) {
      console.error('Erreur impression retour:', e);
    }
  };

  const isSale = returnData.kind === 'SALE_RETURN' || returnData.numeroRetour;
  const docNumber = returnData.numeroRetour || returnData.numeroAvoirAchat;
  const docTitle = isSale
    ? returnData.typeDocument === 'AVOIR_BL'
      ? 'BON D’AVOIR SUR LIVRAISON (BL)'
      : 'BON D’AVOIR SUR VENTE'
    : 'BON DE RETOUR ACHAT FOURNISSEUR';

  const partnerName = isSale
    ? returnData.client?.nom || returnData.clientLibre || 'Client Comptoir'
    : returnData.fournisseur;

  const refDoc = isSale
    ? returnData.invoice?.numeroFacture
    : returnData.purchase?.numeroFactureAchat;

  const totalAmount = isSale
    ? Number(returnData.montantTotalRembourse || 0)
    : Number(returnData.montantTotal || 0);

  const formattedDate = new Date(returnData.dateRetour || returnData.dateAvoirAchat || returnData.createdAt).toLocaleString('fr-DZ', {
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
      title={`Détails du document : ${docNumber}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Document Actions Top Bar */}
        <div className="flex items-center justify-between no-print bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
              isSale ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {isSale ? 'AVOIR CLIENT' : 'AVOIR FOURNISSEUR'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Mode: <strong>{returnData.modeRemboursement || 'ESPECES'}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer Bon d'Avoir</span>
          </button>
        </div>

        {/* Printable Area */}
        <div id="printable-return-slip" className="print-area print-a4 bg-white p-6 rounded-2xl border border-slate-200 space-y-6 text-slate-800">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">CommercePost</h2>
              <p className="text-xs text-slate-500 font-semibold">Solution de Gestion Commerciale</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-lg">
                {docTitle}
              </span>
              <p className="text-xs font-mono font-bold text-slate-700 mt-1">{docNumber}</p>
              <p className="text-[11px] text-slate-400 font-medium">{formattedDate}</p>
            </div>
          </div>

          {/* Info Client / Fournisseur & Réf Origine */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                {isSale ? 'Bénéficiaire / Client' : 'Destinataire / Fournisseur'}
              </span>
              <p className="font-black text-slate-900 text-sm">{partnerName}</p>
              {returnData.contactFournisseur && (
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Contact: {returnData.contactFournisseur}</p>
              )}
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                Document d'Origine & Motif
              </span>
              <p className="font-semibold text-slate-800">
                Réf Vente / Achat : <strong className="font-mono text-blue-600">{refDoc || 'Saisie directe'}</strong>
              </p>
              <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                Motif : <em>{returnData.motif || 'Non spécifié'}</em>
              </p>
            </div>
          </div>

          {/* Table of Items */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2">Réf</th>
                  <th className="px-3.5 py-2">Désignation de l'article</th>
                  <th className="px-3.5 py-2 text-center">Quantité</th>
                  <th className="px-3.5 py-2 text-right">P.U {isSale ? 'Vente' : 'Achat'}</th>
                  <th className="px-3.5 py-2 text-right">Total Avoir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {returnData.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-3.5 py-2.5 font-mono text-slate-500 font-bold">{it.reference}</td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900">{it.nom}</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-slate-800">
                      {it.quantiteRetournee || it.quantite} {it.unite || 'pcs'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold">
                      {Number(it.prixUnitaire || it.prixAchatUnitaire || 0).toLocaleString('fr-DZ')} DA
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-black text-slate-900">
                      {Number(it.totalLigne || 0).toLocaleString('fr-DZ')} DA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-semibold">
              <span>Mode de règlement appliqué : </span>
              <strong className="text-slate-800">{returnData.modeRemboursement || 'ESPECES'}</strong>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-500 uppercase block">Total Net de l'Avoir</span>
              <span className="text-2xl font-black text-rose-600">
                {totalAmount.toLocaleString('fr-DZ')} DA
              </span>
            </div>
          </div>

          {/* Footer & Signature */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-100 text-xs text-center">
            <div>
              <p className="font-bold text-slate-600 mb-8">Cachet & Signature Émetteur</p>
              <div className="h-12 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
            </div>
            <div>
              <p className="font-bold text-slate-600 mb-8">
                {isSale ? 'Signature Client' : 'Accusé Réception Fournisseur'}
              </p>
              <div className="h-12 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
            </div>
          </div>
        </div>

        {/* Close button */}
        <div className="flex justify-end no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}
