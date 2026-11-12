import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Printer, Download, ArrowLeft, CheckCircle2, Clock, CreditCard, Receipt, RotateCw, FileDown, Pencil } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { getPrinterSettings, generateReceiptHtml, generateA4InvoiceHtml, printHtmlContent, exportInvoiceToPdf } from '../../utils/printerHelper';

export default function InvoiceDetailModal({ isOpen, onClose, invoice, onOpenReturn, onOpenPayment, onOpenEdit }) {
  const { t, isRTL } = useLanguage();
  const [printNotice, setPrintNotice] = useState(null);
  const [receiptRotation, setReceiptRotation] = useState(() => getPrinterSettings().receiptRotation || 0);
  if (!invoice) return null;

  const handlePrint = async (forceA4 = false) => {
    try {
      const isTicketDoc = !forceA4 && (invoice.typeDocument === 'TICKET' || invoice.typeDocument === 'BON_COMMANDE' || !invoice.typeDocument);
      const settings = getPrinterSettings();
      setPrintNotice('Impression directe en cours...');

      const html = isTicketDoc
        ? generateReceiptHtml({ invoice, docType: invoice.typeDocument, settings, rotation: receiptRotation })
        : generateA4InvoiceHtml(invoice, settings);

      const res = await printHtmlContent(html, {
        printerName: isTicketDoc ? settings.receiptPrinter : '',
        pageSize: isTicketDoc ? { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 } : 'A4',
        landscape: false,
        silent: settings.silentPrint !== false, // Impression directe sans pop-up
        margins: isTicketDoc ? { marginType: 'none' } : undefined
      });

      if (res.success) {
        setPrintNotice('✅ Document imprimé avec succès !');
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
      setPrintNotice('Impression directe en cours...');
      const settings = getPrinterSettings();
      const html = generateReceiptHtml({
        invoice,
        docType: invoice.typeDocument,
        settings,
        rotation: receiptRotation,
        contentWidth: settings.receiptContentWidth || 80
      });
      await printHtmlContent(html, {
        printerName: settings.receiptPrinter,
        pageSize: { width: (settings.receiptPaperWidth === '58mm' ? 58 : 80) * 1000, height: 297000 },
        landscape: settings.receiptOrientation === 'landscape',
        silent: true,
        margins: { marginType: 'none' }
      });
      setPrintNotice('✅ Document envoyé à l\'imprimante !');
      setTimeout(() => setPrintNotice(null), 3000);
    } catch (e) {
      setPrintNotice('✅ Document envoyé à l\'imprimante !');
      setTimeout(() => setPrintNotice(null), 3000);
    }
  };

  const handleExportPdf = async () => {
    try {
      setPrintNotice('Génération du fichier PDF...');
      const res = await exportInvoiceToPdf(invoice, { format: 'A4' });
      if (res.canceled) {
        setPrintNotice(null);
        return;
      }
      if (res.success) {
        setPrintNotice('✅ Document exporté en PDF avec succès !');
      } else {
        setPrintNotice(`❌ ${res.error || 'Erreur export PDF'}`);
      }
      setTimeout(() => setPrintNotice(null), 3500);
    } catch (e) {
      setPrintNotice(`❌ ${e.message}`);
      setTimeout(() => setPrintNotice(null), 3500);
    }
  };

  const cycleRotation = () => {
    const next = (receiptRotation + 90) % 360;
    setReceiptRotation(next);
  };

  const isTicket = invoice.typeDocument === 'TICKET';
  const hasRemaining = Number(invoice.montantReste || 0) > 0 || invoice.statutPaiement !== 'PAYE';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('inv_seeDetails')} : ${invoice.numeroFacture}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Document Actions Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
              invoice.statutPaiement === 'PAYE'
                ? 'bg-emerald-100 text-emerald-800'
                : invoice.statutPaiement === 'PARTIEL'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {invoice.statutPaiement === 'PAYE' ? t('inv_paid') : invoice.statutPaiement === 'PARTIEL' ? t('inv_partial') : t('inv_unpaid')}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {t('pos_paymentMethod')}: <strong>{invoice.modePaiement === 'ESPECES' ? t('pos_cash') : invoice.modePaiement === 'A_CREDIT' ? t('pos_credit') : invoice.modePaiement}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasRemaining && onOpenPayment && (
              <button
                type="button"
                onClick={() => onOpenPayment(invoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t('inv_recordPayment')}</span>
              </button>
            )}

            {onOpenEdit && (
              <button
                type="button"
                onClick={() => onOpenEdit(invoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
                title="Modifier ce bon / facture"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            )}

            {onOpenReturn && (
              <button
                type="button"
                onClick={() => onOpenReturn(invoice)}
                className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
              >
                {t('inv_returnItem')}
              </button>
            )}

            <button
              type="button"
              onClick={cycleRotation}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition border border-slate-200 cursor-pointer"
              title="Changer l'angle de rotation (0°, 90°, 180°, 270°)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{receiptRotation}°</span>
            </button>

            <button
              type="button"
              onClick={handlePrintSprt80}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition shadow-2xs cursor-pointer"
              title="Imprimer directement sur SPRT 80 (rouleau 80mm)"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-700" />
              <span>SPRT 80 (Ticket)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg transition shadow-2xs cursor-pointer"
              title="Exporter ce document au format PDF standard A4"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-700" />
              <span>Exporter PDF</span>
            </button>

            {invoice.typeDocument === 'BON_COMMANDE' ? (
              <>
                <button
                  type="button"
                  onClick={() => handlePrint(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs cursor-pointer"
                  title="Imprimer le Bon de Commande au format A4 officiel"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrint(false)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition shadow-xs cursor-pointer"
                  title="Imprimer au format ticket via le dialogue système"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ticket Système</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handlePrint(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs cursor-pointer"
                title="Dialogue d'impression"
              >
                <Printer className="w-4 h-4" />
                <span>{t('print')}</span>
              </button>
            )}
          </div>
        </div>

        {printNotice && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
            {printNotice}
          </div>
        )}

        {/* Printable Area */}
        <div 
          id="printable-invoice" 
          className="print-area bg-white p-6 rounded-2xl border border-slate-200 shadow-xs mx-auto w-full text-xs"
        >
          {/* Header */}
          <div className="text-center border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">{t('appTitle')}</h2>
            <p className="text-slate-500 text-[11px]">{t('appSubtitle')}</p>
            <div className="mt-2 text-[10px] text-slate-400">
              <span>{t('inv_date')}: {new Date(invoice.createdAt || invoice.dateFacture).toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')}</span>
            </div>
            <div className="font-bold text-slate-700 text-xs mt-1 font-mono">
              {invoice.numeroFacture}
            </div>
          </div>

          {/* Customer info */}
          <div className="mb-4 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <span className="text-slate-400 font-semibold block uppercase text-[9px]">{t('client')} :</span>
            <span className="font-bold text-slate-800 text-xs">
              {invoice.client?.nom || invoice.nomClientLibre || t('pos_counterClient')}
            </span>
            {invoice.client?.telephone && (
              <span className="block text-slate-500 text-[10px]">{t('cust_phone')}: {invoice.client.telephone}</span>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-4">
            <table className="w-full text-start">
              <thead className="border-b border-slate-200 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="pb-1.5 text-start">{t('stock_designation')}</th>
                  <th className="pb-1.5 text-center">{t('pos_quantity')}</th>
                  <th className="pb-1.5 text-end">{t('stock_salePrice')}</th>
                  <th className="pb-1.5 text-end">{t('pos_totalLine')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items?.map((item, idx) => (
                  <tr key={idx} className="py-1">
                    <td className="py-1.5 font-semibold text-slate-800 text-start">
                      {item.nom} {item.isSerie ? `(Série de ${item.piecesParSerie || 1} pcs)` : ''}
                    </td>
                    <td className="py-1.5 text-center">{item.quantite} {item.unite || ''}</td>
                    <td className="py-1.5 text-end">{item.prixUnitaire?.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')}</td>
                    <td className="py-1.5 text-end font-bold">{item.totalLigne?.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t-2 border-slate-900 pt-2 space-y-1 text-xs">
            <div className="flex justify-between font-semibold text-slate-600">
              <span>{t('pos_subtotal')}</span>
              <span>{invoice.totalHT?.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
            </div>
            {invoice.montantTva > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>{t('pos_tva')} ({invoice.tauxTva}%) :</span>
                <span>{invoice.montantTva?.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
              <span>{t('pos_totalTtc')}</span>
              <span>{invoice.totalTTC?.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{t('paid')} :</span>
              <span>{invoice.montantPaye?.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
            </div>
            {invoice.montantReste > 0 && (
              <div className="flex justify-between font-bold text-rose-600">
                <span>{t('remaining')} :</span>
                <span>{invoice.montantReste?.toLocaleString(isRTL ? 'ar-DZ' : 'fr-DZ')} {t('currency')}</span>
              </div>
            )}
          </div>

          {/* QR Code */}
          {invoice.qrCodeImage && (
            <div className="mt-4 pt-3 border-t border-dashed border-slate-200 flex flex-col items-center">
              <img
                src={invoice.qrCodeImage}
                alt="QR Code Facture"
                className="w-28 h-28 object-contain"
              />
              <span className="text-[9px] text-slate-400 mt-1 font-mono tracking-tighter">
                {t('pos_qrScannable')}
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
