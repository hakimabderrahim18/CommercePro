import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { 
  Printer, 
  Tag, 
  Smartphone, 
  Barcode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Layers,
  Calendar,
  Lock,
  User,
  AlertTriangle
} from 'lucide-react';
import { 
  LABEL_FORMATS, 
  getPrinterSettings, 
  savePrinterSettings, 
  getStoreName,
  createBarcodeDataUrl,
  printHtmlContent
} from '../../utils/printerHelper';
import { generateRepairLabelHtml, printRepairLabel } from '../../utils/repairPrinterHelper';

export default function RepairLabelModal({ isOpen, onClose, reparation }) {
  if (!reparation) return null;

  const [printerSettings, setPrinterSettings] = useState(getPrinterSettings());
  const initialFmt = printerSettings.labelFormat || '45x35';
  const [selectedFormat, setSelectedFormat] = useState(initialFmt);
  const [customWidth, setCustomWidth] = useState(
    LABEL_FORMATS[initialFmt]?.width || printerSettings.labelWidth || 45
  );
  const [customHeight, setCustomHeight] = useState(
    LABEL_FORMATS[initialFmt]?.height || printerSettings.labelHeight || 35
  );
  const [copies, setCopies] = useState(1);
  const [offsetX, setOffsetX] = useState(printerSettings.labelOffsetX || 0);
  const [printStatus, setPrintStatus] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getPrinterSettings();
      setPrinterSettings(cfg);
      const fmtKey = cfg.labelFormat || '45x35';
      setSelectedFormat(fmtKey);
      setCustomWidth(LABEL_FORMATS[fmtKey]?.width || cfg.labelWidth || 45);
      setCustomHeight(LABEL_FORMATS[fmtKey]?.height || cfg.labelHeight || 35);
      setOffsetX(cfg.labelOffsetX || 0);
      setCopies(1);
      setPrintStatus(null);
      setIsPrinting(false);
    }
  }, [isOpen]);

  const handleFormatChange = (newKey) => {
    setSelectedFormat(newKey);
    const f = LABEL_FORMATS[newKey];
    if (f) {
      setCustomWidth(f.width);
      setCustomHeight(f.height);
      const updated = {
        ...printerSettings,
        labelFormat: newKey,
        labelWidth: f.width,
        labelHeight: f.height
      };
      setPrinterSettings(updated);
      savePrinterSettings(updated);
    }
  };

  const handleSetFormat = (w, h, key = '') => {
    setCustomWidth(w);
    setCustomHeight(h);
    const updated = {
      ...printerSettings,
      labelFormat: key || `${w}x${h}`,
      labelWidth: w,
      labelHeight: h
    };
    if (key) setSelectedFormat(key);
    setPrinterSettings(updated);
    savePrinterSettings(updated);
  };

  // Données de la réparation
  const repNum = (reparation.numeroReparation || 'REP-0001').trim();
  const storeName = getStoreName(printerSettings) || 'SAV ATELIER';
  const clientNom = (reparation.clientNom || 'Client Comptoir').trim();
  const clientTel = (reparation.clientTelephone || '').trim();
  const appareil = [reparation.appareilType, reparation.marque, reparation.modele].filter(Boolean).join(' ').trim() || 'Appareil';
  const pin = (reparation.motDePasseAppareil || '').trim();
  const sn = (reparation.numeroSerie || '').trim();
  const panne = (reparation.panneDeclaree || 'Diagnostic requis').trim();
  const dateStr = new Date(reparation.dateReception || Date.now()).toLocaleDateString('fr-DZ', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Aperçu Barcode calibré compact pour sticker réel
  const barcodeUrl = createBarcodeDataUrl(repNum, { 
    width: 1.5, 
    height: customHeight <= 30 ? 20 : 25, 
    margin: 2 
  });

  // Impression directe Xprinter
  const handlePrintDirect = async () => {
    try {
      setIsPrinting(true);
      setPrintStatus(null);

      const res = await printRepairLabel(reparation, {
        format: selectedFormat,
        customWidth,
        customHeight,
        offsetX,
        copies,
        silent: true
      });

      if (res && res.success) {
        setPrintStatus({
          type: 'success',
          msg: `✅ Étiquette envoyée avec succès sur ${printerSettings.labelPrinter || 'Xprinter XP-350B'} (${copies} copie${copies > 1 ? 's' : ''})`
        });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setPrintStatus({
          type: 'error',
          msg: `Erreur d'impression : ${res?.error || 'Vérifiez la connexion de l\'imprimante d\'étiquettes.'}`
        });
      }
    } catch (err) {
      setPrintStatus({
        type: 'error',
        msg: `Erreur : ${err.message}`
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Impression via dialogue système Windows
  const handlePrintSystemDialog = async () => {
    try {
      setIsPrinting(true);
      setPrintStatus(null);

      const html = generateRepairLabelHtml(reparation, {
        format: selectedFormat,
        customWidth,
        customHeight,
        offsetX,
        settings: printerSettings
      });

      const res = await printHtmlContent(html, {
        printerName: printerSettings.labelPrinter,
        pageSize: { width: Math.round(customWidth * 1000), height: Math.round(customHeight * 1000) },
        landscape: false,
        silent: false,
        copies
      });

      if (res && res.success) {
        setPrintStatus({ type: 'success', msg: '✅ Étiquette envoyée à l\'impression.' });
      } else {
        setPrintStatus({ type: 'error', msg: res?.error || 'Impression annulée ou échouée.' });
      }
    } catch (err) {
      setPrintStatus({ type: 'error', msg: err.message });
    } finally {
      setIsPrinting(false);
    }
  };

  // Facteur d'échelle pour l'aperçu à l'écran
  const previewScale = 6.2;
  const previewWidth = Math.round(customWidth * previewScale);
  const previewHeight = Math.round(customHeight * previewScale);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Étiquette Adhésive Appareil : ${reparation.numeroReparation}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-slate-800">
        {/* Status Toast */}
        {printStatus && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            printStatus.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {printStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{printStatus.msg}</span>
          </div>
        )}

        {/* Format Selector Pills Bar */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Format du Rouleau d'Étiquettes :</span>
            </span>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSetFormat(45, 35, '45x35')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 45 && customHeight === 35 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                45 × 35 mm (Standard)
              </button>
              <button
                type="button"
                onClick={() => handleSetFormat(50, 30, '50x30')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 50 && customHeight === 30 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                50 × 30 mm
              </button>
              <button
                type="button"
                onClick={() => handleSetFormat(40, 30, '40x30')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 40 && customHeight === 30 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                40 × 30 mm
              </button>
              <button
                type="button"
                onClick={() => handleSetFormat(30, 30, '30x30')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 30 && customHeight === 30 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 × 30 mm
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Dimensions :</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Math.max(20, parseInt(e.target.value, 10) || 45))}
                  className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                />
                <span className="text-slate-400 font-bold">×</span>
                <input
                  type="number"
                  min="15"
                  max="100"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Math.max(15, parseInt(e.target.value, 10) || 35))}
                  className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                />
                <span className="text-slate-400 font-bold">mm</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Décalage X :</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="-20"
                  max="20"
                  value={offsetX}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setOffsetX(val);
                    const updated = { ...printerSettings, labelOffsetX: val };
                    setPrinterSettings(updated);
                    savePrinterSettings(updated);
                  }}
                  className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                  title="Ajuste l'alignement horizontal si le rouleau est décalé (en mm)"
                />
                <span className="text-slate-400 font-bold">mm</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Nombre de copies :</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-xs"
                />
                <button
                  type="button"
                  onClick={() => setCopies(2)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                    copies === 2 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title="2 étiquettes (1 pour l'appareil, 1 pour la boîte ou la batterie)"
                >
                  2 (Appareil + Boîte)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Realistic Interactive Sticker Preview Container */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-100/90 rounded-2xl border border-dashed border-slate-300">
          <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">
            <Tag className="w-3.5 h-3.5 text-blue-500" />
            <span>Aperçu Réel • Sticker Thermique {customWidth} × {customHeight} mm</span>
          </div>

          {/* The Physical Sticker Representation */}
          <div
            className="bg-white rounded-xl shadow-lg border border-slate-300 flex flex-col justify-between overflow-hidden select-text text-black transition-all duration-150"
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
              maxHeight: `${previewHeight}px`,
              padding: customHeight <= 30 ? '6px 8px 5px 8px' : '8px 10px 7px 10px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              marginLeft: `${offsetX * 3}px`
            }}
          >
            {/* Header: Store Name & Repair Number Badge */}
            <div className="flex items-center justify-between border-b border-black pb-1 w-full leading-none shrink-0">
              <span className="font-black uppercase text-[10.5px] truncate max-w-[62%] tracking-tight">
                {storeName}
              </span>
              <span className="font-mono font-black text-[11px] bg-black text-white px-1.5 py-0.5 rounded tracking-wider">
                {repNum}
              </span>
            </div>

            {/* Barcode Area */}
            <div className="w-full flex items-center justify-center my-0.5 shrink-0 overflow-hidden">
              {barcodeUrl ? (
                <img 
                  src={barcodeUrl} 
                  alt={repNum}
                  className="max-w-[96%] max-h-7 object-contain block mx-auto [image-rendering:pixelated]"
                />
              ) : (
                <div className="font-mono font-bold text-[10px] text-center">{repNum}</div>
              )}
            </div>

            {/* Info Rows (Client, Phone, Device, PIN, Fault) - 100% complets sans coupure */}
            <div className="border-t border-dashed border-black pt-1 text-[9px] leading-tight font-bold w-full space-y-0.5 shrink-0">
              <div className="break-words">
                <span className="font-extrabold text-black">Clt :</span> {clientNom}
              </div>
              {clientTel && (
                <div className="break-words">
                  <span className="font-extrabold text-black">Tél :</span> <span className="font-mono font-black">{clientTel}</span>
                </div>
              )}
              <div className="break-words">
                <span className="font-extrabold text-black">App :</span> {appareil}
              </div>
              <div className="flex items-center justify-between text-[8.5px]">
                <div className="break-words">
                  <span className="font-extrabold text-black">PIN :</span> <span className="font-mono font-black">{pin || 'Sans'}</span>
                  {sn && <span className="ml-1 text-[8px] text-slate-700 font-bold">| S/N: {sn}</span>}
                </div>
                <div className="text-[8px] text-slate-700 font-bold whitespace-nowrap">
                  {dateStr}
                </div>
              </div>
              <div className="break-words text-black font-semibold text-[8.5px]">
                <span className="font-extrabold">Panne :</span> {panne}
              </div>
            </div>
          </div>

          <span className="text-[10px] text-slate-400 mt-2 font-semibold">
            Calibré pour Xprinter XP-350B • 1 seule étiquette par tirage sans débordement
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            <span>Imprimante : <strong>{printerSettings.labelPrinter || 'Xprinter XP-350B (ou système)'}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSystemDialog}
              disabled={isPrinting}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Dialogue Windows
            </button>

            <button
              type="button"
              onClick={handlePrintDirect}
              disabled={isPrinting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isPrinting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>Imprimer sur Xprinter ({copies})</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
