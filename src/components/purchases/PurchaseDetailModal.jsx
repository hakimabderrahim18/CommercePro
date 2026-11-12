import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Printer, Download, Truck, CreditCard, Building2, Calendar, Receipt, RotateCw, Pencil, FileDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { getPrinterSettings, generatePurchaseReceiptHtml, printHtmlContent, exportHtmlToPdf } from '../../utils/printerHelper';

export default function PurchaseDetailModal({ isOpen, onClose, purchase, onOpenPayment, onOpenEdit }) {
  const { t, isRTL } = useLanguage();
  const [printNotice, setPrintNotice] = useState(null);
  const [purchaseRotation, setPurchaseRotation] = useState(() => getPrinterSettings().receiptRotation || 0);
  if (!isOpen || !purchase) return null;

  const handlePrint = async () => {
    try {
      setPrintNotice('Ouverture du dialogue d’impression A4...');
      const el = document.getElementById('printable-purchase');
      const innerContent = el ? el.innerHTML : '';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${docTitle} - ${purchase.numeroFactureAchat}</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { background: #ffffff; color: #0f172a; font-size: 12px; line-height: 1.4; padding: 15px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
              th, td { padding: 8px 10px; text-align: left; }
              th { background: #f8fafc; border-bottom: 2px solid #0f172a; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #334155; }
              td { border-bottom: 1px solid #e2e8f0; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .font-black, .font-bold { font-weight: bold; }
              .font-mono { font-family: monospace; }
            </style>
          </head>
          <body>
            ${innerContent}
          </body>
        </html>
      `;

      const res = await printHtmlContent(html, {
        pageSize: 'A4',
        landscape: false,
        silent: true
      });

      if (res.success) {
        setPrintNotice('✅ Impression A4 lancée avec succès !');
      } else if (res.error && res.error !== 'Impression annulée') {
        setPrintNotice(`❌ ${res.error}`);
      }
      setTimeout(() => setPrintNotice(null), 3000);
    } catch (e) {
      setPrintNotice(`❌ ${e.message}`);
      setTimeout(() => setPrintNotice(null), 3000);
    }
  };

  const handlePrintSprt80 = async () => {
    try {
      setPrintNotice('Impression du Bon de Commande sur SPRT 80...');
      const settings = getPrinterSettings();
      const html = generatePurchaseReceiptHtml({
        purchase,
        settings,
        rotation: purchaseRotation
      });
      const res = await printHtmlContent(html, {
        printerName: settings.receiptPrinter,
        pageSize: { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 },
        landscape: settings.receiptOrientation === 'landscape',
        silent: settings.silentPrint !== undefined ? settings.silentPrint : true
      });
      if (res.success) {
        setPrintNotice('✅ Bon de Commande Achat imprimé sur SPRT 80 !');
      } else {
        setPrintNotice(`❌ ${res.error || 'Erreur impression SPRT 80'}`);
      }
      setTimeout(() => setPrintNotice(null), 3000);
    } catch (e) {
      setPrintNotice(`❌ ${e.message}`);
      setTimeout(() => setPrintNotice(null), 3000);
    }
  };

  const handleExportPdf = async () => {
    try {
      setPrintNotice('Génération du fichier PDF...');
      const el = document.getElementById('printable-purchase');
      const innerContent = el ? el.innerHTML : '';
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${docTitle} - ${purchase.numeroFactureAchat}</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { background: #ffffff; color: #0f172a; font-size: 12px; line-height: 1.4; padding: 15px; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
              th, td { padding: 8px 10px; text-align: left; }
              th { background: #f8fafc; border-bottom: 2px solid #0f172a; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #334155; }
              td { border-bottom: 1px solid #e2e8f0; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .font-black, .font-bold { font-weight: bold; }
              .font-mono { font-family: monospace; }
            </style>
          </head>
          <body>
            ${innerContent}
          </body>
        </html>
      `;

      const res = await exportHtmlToPdf(html, `${purchase.numeroFactureAchat}.pdf`, 'A4');
      if (res.canceled) {
        setPrintNotice(null);
        return;
      }
      if (res.success) {
        setPrintNotice('✅ Document d’achat exporté en PDF avec succès !');
      } else {
        setPrintNotice(`❌ ${res.error || 'Erreur export PDF'}`);
      }
      setTimeout(() => setPrintNotice(null), 3500);
    } catch (e) {
      setPrintNotice(`❌ ${e.message}`);
      setTimeout(() => setPrintNotice(null), 3500);
    }
  };

  const isOrder = purchase.typeDocument === 'BON_COMMANDE_ACHAT';
  const docTitle = isOrder ? 'BON DE COMMANDE FOURNISSEUR' : 'FACTURE D’ACHAT FOURNISSEUR';
  const hasRemaining = Number(purchase.montantReste || 0) > 0;

  const items = Array.isArray(purchase.items) ? purchase.items : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${docTitle} : ${purchase.numeroFactureAchat}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Document Actions Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
              purchase.statutPaiement === 'PAYE'
                ? 'bg-emerald-100 text-emerald-800'
                : purchase.statutPaiement === 'PARTIEL'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {purchase.statutPaiement === 'PAYE' ? 'RÉGLÉ' : purchase.statutPaiement === 'PARTIEL' ? 'PARTIEL' : 'NON RÉGLÉ'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Caisse: <strong>{purchase.caisse || 'Caisse 1'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasRemaining && onOpenPayment && (
              <button
                type="button"
                onClick={() => onOpenPayment(purchase)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Régler le Reste</span>
              </button>
            )}

            {onOpenEdit && (
              <button
                type="button"
                onClick={() => onOpenEdit(purchase)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
                title="Modifier ce bon / facture d’achat"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg transition shadow-2xs cursor-pointer"
              title="Exporter ce document d’achat en PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-700" />
              <span>Exporter PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setPurchaseRotation((r) => (r + 90) % 360)}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer"
              title="Changer l'angle de rotation (0°, 90°, 180°, 270°)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{purchaseRotation}°</span>
            </button>

            <button
              type="button"
              onClick={handlePrintSprt80}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition shadow-2xs cursor-pointer"
              title="Imprimer Bon de Commande sur SPRT 80 (Thermique 80mm)"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-700" />
              <span>SPRT 80 (Ticket)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs cursor-pointer"
              title="Imprimer au format A4 officiel"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print')} (A4)</span>
            </button>
          </div>
        </div>

        {printNotice && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
            {printNotice}
          </div>
        )}

        {/* Printable Area (A4 layout) */}
        <div 
          id="printable-purchase"
          className="print-area print-a4 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-xs text-slate-800"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 gap-4">
            <div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">
                COMMERCEPOST - GESTION DES ACHATS
              </span>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {t('appTitle')}
              </h2>
              <p className="text-slate-500 text-xs">{t('appSubtitle')}</p>
            </div>

            <div className="text-right sm:text-right">
              <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase mb-1 ${
                isOrder ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
              }`}>
                {docTitle}
              </span>
              <div className="font-mono font-black text-sm text-slate-900">
                N° {purchase.numeroFactureAchat}
              </div>
              <div className="text-slate-500 text-[11px] mt-1">
                Date : {new Date(purchase.dateFactureAchat || purchase.createdAt).toLocaleDateString('fr-DZ')}
              </div>
            </div>
          </div>

          {/* Supplier & Delivery Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fournisseur :</span>
              <h3 className="text-sm font-black text-slate-900">{purchase.fournisseur}</h3>
              {purchase.contactFournisseur && (
                <p className="text-slate-600 text-[11px] mt-0.5">Contact: {purchase.contactFournisseur}</p>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Détails Règlement :</span>
              <p className="text-slate-700 font-semibold">Mode : <strong>{purchase.modePaiement || 'ESPECES'}</strong></p>
              <p className="text-slate-600 text-[11px]">Caisse de décaissement : {purchase.caisse || 'Caisse 1'}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Réf / Code</th>
                <th className="py-2.5 px-3">Désignation</th>
                <th className="py-2.5 px-3 text-center">Quantité</th>
                <th className="py-2.5 px-3 text-right">P.U Achat HT</th>
                <th className="py-2.5 px-3 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length > 0 ? (
                items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-600 text-[11px]">
                      {it.reference || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {it.nom}
                    </td>
                    <td className="py-2.5 px-3 text-center font-black">
                      {it.quantite} {it.unite || 'pcs'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                      {Number(it.prixAchatUnitaire || 0).toLocaleString('fr-DZ')} DA
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      {Number(it.totalLigne || (it.quantite * it.prixAchatUnitaire) || 0).toLocaleString('fr-DZ')} DA
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-slate-400">
                    Aucun article spécifié.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Financial Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-72 space-y-1.5 border-t border-slate-200 pt-3 text-xs">
              <div className="flex justify-between text-slate-600 font-semibold">
                <span>Total HT :</span>
                <span>{Number(purchase.totalHT || purchase.totalTTC || 0).toLocaleString('fr-DZ')} DA</span>
              </div>

              {Number(purchase.tauxTva || 0) > 0 && (
                <div className="flex justify-between text-slate-600 font-semibold">
                  <span>TVA ({purchase.tauxTva}%) :</span>
                  <span>{Number(purchase.montantTva || 0).toLocaleString('fr-DZ')} DA</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-300 pt-1.5">
                <span>TOTAL TTC :</span>
                <span>{Number(purchase.totalTTC || 0).toLocaleString('fr-DZ')} DA</span>
              </div>

              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Montant Payé / Acompte :</span>
                <span>{Number(purchase.montantPaye || 0).toLocaleString('fr-DZ')} DA</span>
              </div>

              <div className="flex justify-between text-rose-700 font-black border-t border-dashed border-slate-300 pt-1">
                <span>Reste Dû au Fournisseur :</span>
                <span>{Number(purchase.montantReste || 0).toLocaleString('fr-DZ')} DA</span>
              </div>
            </div>
          </div>

          {/* Notes if any */}
          {purchase.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-500 uppercase text-[10px] block">Notes / Remarques :</span>
              <p className="text-slate-700 mt-0.5">{purchase.notes}</p>
            </div>
          )}

          {/* Signatures & Stamps */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-700">Visa / Signature du Fournisseur :</p>
              <div className="h-16 border-b border-dashed border-slate-300 mt-2"></div>
            </div>
            <div>
              <p className="font-bold text-slate-700">Cachet & Signature de Réception :</p>
              <div className="h-16 border-b border-dashed border-slate-300 mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
