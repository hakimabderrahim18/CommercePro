import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { 
  Printer, 
  Barcode, 
  Tag, 
  Copy, 
  Check, 
  Sliders, 
  Layers, 
  Sparkles,
  QrCode,
  DollarSign,
  RotateCw,
  Smartphone,
  Monitor
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  LABEL_FORMATS, 
  getPrinterSettings, 
  savePrinterSettings,
  getStoreName,
  generateLabelHtml, 
  printHtmlContent,
  createBarcodeDataUrl,
  createBarcodeSvg 
} from '../../utils/printerHelper';

export default function ProductQrModal({ isOpen, onClose, product }) {
  const { t, isRTL } = useLanguage();
  if (!product) return null;

  const [printerSettings, setPrinterSettings] = useState(getPrinterSettings());

  useEffect(() => {
    if (isOpen) {
      setPrinterSettings(getPrinterSettings());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleSettingsChanged = (e) => {
      setPrinterSettings(e?.detail || getPrinterSettings());
    };
    window.addEventListener('printer-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('printer-settings-changed', handleSettingsChanged);
  }, []);

  const initialFmt = printerSettings.labelFormat || '45x35';
  const [selectedFormat, setSelectedFormat] = useState(initialFmt);
  const [barcodeType, setBarcodeType] = useState(printerSettings.labelBarcodeType || 'CODE128');
  const [rotation, setRotation] = useState(
    LABEL_FORMATS[initialFmt]?.rotation || printerSettings.labelRotation || 0
  );
  const [copies, setCopies] = useState(1);
  const [priceType, setPriceType] = useState('prixVente');
  const [showStore, setShowStore] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const [showAttributes, setShowAttributes] = useState(false);
  const [customWidth, setCustomWidth] = useState(
    LABEL_FORMATS[initialFmt]?.width || printerSettings.labelWidth || 45
  );
  const [customHeight, setCustomHeight] = useState(
    LABEL_FORMATS[initialFmt]?.height || printerSettings.labelHeight || 35
  );
  const [offsetX, setOffsetX] = useState(printerSettings.labelOffsetX || 0);
  const [printStatus, setPrintStatus] = useState(null);

  const allCodes = Array.from(new Set([
    product.codeBarre,
    product.reference,
    ...(Array.isArray(product.codesBarres) ? product.codesBarres : (product.codesBarres ? String(product.codesBarres).split(/[,;\s\n]+/) : []))
  ].filter(Boolean))).map(c => String(c).trim().toUpperCase());

  const [selectedBarcode, setSelectedBarcode] = useState(() => (product.codeBarre || product.reference || '0000').trim().toUpperCase());

  useEffect(() => {
    if (product) {
      setSelectedBarcode((product.codeBarre || product.reference || '0000').trim().toUpperCase());
    }
  }, [product]);

  const fmt = LABEL_FORMATS[selectedFormat] || LABEL_FORMATS['45x35'];
  const prix = Number(product[priceType] || product.prixVente || 0);
  const effectiveBarcode = selectedBarcode === 'ALL'
    ? (allCodes[0] || (product.codeBarre || product.reference || '0000').trim().toUpperCase())
    : (selectedBarcode || product.codeBarre || product.reference || '0000').trim().toUpperCase();
  const secondaryCodes = allCodes.filter(c => c && c !== effectiveBarcode);

  const barcodeDataUrlPreview = createBarcodeDataUrl(effectiveBarcode, {
    width: effectiveBarcode.length <= 6 ? 3 : 2,
    height: 80,
    format: barcodeType
  });
  const barcodeSrc = barcodeDataUrlPreview;
  const attributes = [product.taille, product.pointure, product.couleur].filter(Boolean).join(' • ');

  const handleFormatChange = (newKey) => {
    setSelectedFormat(newKey);
    const targetFmt = LABEL_FORMATS[newKey];
    if (targetFmt) {
      if (targetFmt.rotation !== undefined) setRotation(targetFmt.rotation);
      if (targetFmt.width) setCustomWidth(targetFmt.width);
      if (targetFmt.height) setCustomHeight(targetFmt.height);
    }
  };

  const handleSet45x35Mode = () => {
    setSelectedFormat('45x35');
    setCustomWidth(45);
    setCustomHeight(35);
    setRotation(0);
  };

  const handleSet35x45Mode = () => {
    setSelectedFormat('35x45');
    setCustomWidth(35);
    setCustomHeight(45);
    setRotation(0);
  };

  const handleSet50x30Mode = () => {
    setSelectedFormat('50x30');
    setCustomWidth(50);
    setCustomHeight(30);
    setRotation(0);
  };

  const handleSet40x30Mode = () => {
    setSelectedFormat('40x30');
    setCustomWidth(40);
    setCustomHeight(30);
    setRotation(0);
  };

  const handleSet30x20Mode = () => {
    setSelectedFormat('30x20');
    setCustomWidth(30);
    setCustomHeight(20);
    setRotation(0);
  };

  const handleSet20x30Mode = () => {
    setSelectedFormat('20x30');
    setCustomWidth(20);
    setCustomHeight(30);
    setRotation(0);
  };

  const handleSet30x30Mode = () => {
    setSelectedFormat('30x30');
    setCustomWidth(30);
    setCustomHeight(30);
    setRotation(0);
  };

  const handleSet82x20Mode = () => {
    setSelectedFormat('82x20');
    setCustomWidth(82);
    setCustomHeight(20);
    setRotation(0);
  };

  const handleSetVerticalMode = () => {
    setSelectedFormat('30x50');
    setCustomWidth(30);
    setCustomHeight(50);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handlePrintDirectXprinter = async () => {
    try {
      setPrintStatus('Impression sur Xprinter 350B...');
      const numCopies = Math.max(1, parseInt(copies, 10) || 1);
      const totalLabels = (selectedBarcode === 'ALL' ? allCodes.length : 1) * numCopies;

      const html = generateLabelHtml({
        product,
        quantity: numCopies,
        format: selectedFormat,
        settings: {
          ...printerSettings,
          labelBarcodeType: barcodeType,
          labelShowStore: showStore,
          labelShowCategory: showCategory,
          labelShowAttributes: showAttributes,
          labelRotation: rotation,
          labelOffsetX: offsetX
        },
        priceType,
        rotation,
        customWidth,
        customHeight,
        barcodeValue: selectedBarcode,
        allCodes: allCodes
      });

      const res = await printHtmlContent(html, {
        printerName: printerSettings.labelPrinter,
        pageSize: { width: customWidth * 1000, height: customHeight * 1000 },
        landscape: false, // Toujours portrait pour alimentation normale du rouleau d'étiquettes
        silent: printerSettings.silentPrint,
        pageRanges: [{ from: 0, to: totalLabels - 1 }]
      });

      if (res.success) {
        setPrintStatus(`✅ ${totalLabels} étiquette(s) imprimée(s) avec succès sur Xprinter 350B !`);
      } else {
        setPrintStatus(`❌ ${res.error || 'Erreur impression Xprinter'}`);
      }
      setTimeout(() => setPrintStatus(null), 3500);
    } catch (err) {
      setPrintStatus(`❌ ${err.message}`);
      setTimeout(() => setPrintStatus(null), 3500);
    }
  };

  const handlePrintSystemDialog = () => {
    // Inject dynamic @page style for current format
    const existingStyle = document.getElementById('dynamic-label-print-style');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.id = 'dynamic-label-print-style';
    style.innerHTML = `
      @media print {
        @page {
          size: ${customWidth}mm ${customHeight}mm portrait !important;
          margin: 0mm !important;
        }
        #product-label-barcode {
          width: ${customWidth}mm !important;
          height: ${customHeight}mm !important;
          max-width: ${customWidth}mm !important;
          max-height: ${customHeight}mm !important;
          padding: ${customHeight <= 30 ? '1mm 1.5mm 0.8mm 1.5mm' : '1.8mm 2.2mm'} !important;
        }
      }
    `;
    document.head.appendChild(style);

    window.print();

    setTimeout(() => {
      if (style.parentNode) style.parentNode.removeChild(style);
    }, 2000);
  };

  const isRotated = rotation === 90 || rotation === 270;
  const previewWidth = isRotated ? customHeight * 5.2 : customWidth * 5.2;
  const previewHeight = isRotated ? customWidth * 5.2 : customHeight * 5.2;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Étiquette Code-Barres Xprinter 350B : ${product.nom}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-slate-800">
        {/* Print status toast */}
        {printStatus && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            printStatus.startsWith('✅') ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            <Printer className="w-4 h-4" />
            <span>{printStatus}</span>
          </div>
        )}

        {/* Choix du code-barres si plusieurs codes */}
        {allCodes.length > 1 && (
          <div className="flex flex-col gap-2 bg-indigo-50/80 p-3 rounded-2xl border border-indigo-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-indigo-700" />
                <span className="text-xs font-black text-indigo-900 uppercase tracking-wide">
                  Codes-Barres associés ({allCodes.length}) :
                </span>
              </div>
              <span className="text-[11px] text-indigo-600 font-semibold">
                Ce produit possède {allCodes.length} codes-barres
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {allCodes.map((code, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedBarcode(code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition cursor-pointer flex items-center gap-1 ${
                    selectedBarcode === code
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <span>{code}</span>
                  {code === (product.codeBarre || product.reference)?.trim().toUpperCase() && (
                    <span className="text-[9px] bg-amber-400 text-amber-950 px-1 rounded font-bold">Principal</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedBarcode('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  selectedBarcode === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-indigo-800 border border-indigo-300 hover:bg-indigo-100'
                }`}
              >
                <span>⭐ Imprimer TOUS les codes ({allCodes.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Orientation & Format Quick Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/70 p-3 rounded-2xl border border-blue-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-blue-900 uppercase tracking-wide">Format Rapide :</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-blue-200 shadow-2xs">
              <button
                type="button"
                onClick={handleSet45x35Mode}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 45 && customHeight === 35 && rotation === 0
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>45 × 35 mm (⭐ Rouleau Actuel)</span>
              </button>
              <button
                type="button"
                onClick={handleSet35x45Mode}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 35 && customHeight === 45 && rotation === 0
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>35 × 45 mm (Rouleau Vertical)</span>
              </button>
              <button
                type="button"
                onClick={handleSet30x30Mode}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 30 && customHeight === 30 && rotation === 0
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>30 × 30 mm</span>
              </button>
              <button
                type="button"
                onClick={handleSet50x30Mode}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 50 && customHeight === 30 && rotation === 0
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>50 × 30 mm</span>
              </button>
              <button
                type="button"
                onClick={handleSet40x30Mode}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 40 && customHeight === 30 && rotation === 0
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>40 × 30 mm</span>
              </button>
              <button
                type="button"
                onClick={handleSet30x20Mode}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 30 && customHeight === 20 && rotation === 0
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>30 × 20 mm</span>
              </button>
              <button
                type="button"
                onClick={handleSet20x30Mode}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  customWidth === 20 && customHeight === 30 && rotation === 0
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>20 × 30 mm</span>
              </button>
            </div>
          </div>

          {/* Quick Rotation Button */}
          <button
            type="button"
            onClick={handleRotate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-800 transition shadow-2xs cursor-pointer"
            title="Pivoter l'étiquette de 90 degrés"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Pivoter ({rotation}°)</span>
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          {/* Format selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Dimensions du Rouleau :</label>
            <select
              value={selectedFormat}
              onChange={(e) => handleFormatChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold focus:outline-blue-500 mb-1.5"
            >
              {Object.entries(LABEL_FORMATS).map(([k, f]) => (
                <option key={k} value={k}>{f.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-slate-500 font-bold">L:</span>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Math.max(10, parseInt(e.target.value, 10) || 50))}
                  className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-[11px]"
                  title="Largeur en millimètres"
                />
                <span className="text-[10px] text-slate-400">mm</span>
              </div>
              <span className="text-slate-400 font-bold">×</span>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-slate-500 font-bold">H:</span>
                <input
                  type="number"
                  min="15"
                  max="150"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Math.max(10, parseInt(e.target.value, 10) || 30))}
                  className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-[11px]"
                  title="Hauteur en millimètres"
                />
                <span className="text-[10px] text-slate-400">mm</span>
              </div>
            </div>
          </div>

          {/* Centering / Décalage X */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Centrage Décalage X :</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOffsetX((prev) => prev - 1)}
                className="w-8 h-8 bg-white border border-slate-200 hover:bg-slate-100 font-black rounded-xl text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                title="Décaler vers la gauche"
              >
                -
              </button>
              <div className="flex items-center gap-1 flex-1 justify-center bg-white border border-slate-200 rounded-xl px-2 py-1">
                <input
                  type="number"
                  min="-25"
                  max="25"
                  value={offsetX}
                  onChange={(e) => setOffsetX(parseInt(e.target.value, 10) || 0)}
                  className="w-10 text-center font-black text-xs outline-none"
                  title="Décalage horizontal en millimètres"
                />
                <span className="text-[10px] text-slate-400 font-bold">mm</span>
              </div>
              <button
                type="button"
                onClick={() => setOffsetX((prev) => prev + 1)}
                className="w-8 h-8 bg-white border border-slate-200 hover:bg-slate-100 font-black rounded-xl text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                title="Décaler vers la droite"
              >
                +
              </button>
            </div>
            {offsetX !== 0 && (
              <button
                type="button"
                onClick={() => setOffsetX(0)}
                className="text-[10px] text-blue-600 hover:underline font-bold mt-1 block text-center w-full cursor-pointer"
              >
                Recentrer à 0 mm
              </button>
            )}
          </div>

          {/* Price Tier */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tarif affiché :</label>
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold focus:outline-blue-500"
            >
              <option value="prixVente">Prix Vente Détail ({Number(product.prixVente || 0).toLocaleString('fr-DZ')} DA)</option>
              {Number(product.prixDemiGros || 0) > 0 && (
                <option value="prixDemiGros">Prix Demi-Gros ({Number(product.prixDemiGros).toLocaleString('fr-DZ')} DA)</option>
              )}
              {Number(product.prixGros || 0) > 0 && (
                <option value="prixGros">Prix Gros ({Number(product.prixGros).toLocaleString('fr-DZ')} DA)</option>
              )}
              {Number(product.prixSuperGros || 0) > 0 && (
                <option value="prixSuperGros">Prix Super Gros ({Number(product.prixSuperGros).toLocaleString('fr-DZ')} DA)</option>
              )}
            </select>
          </div>

          {/* Symbologie / Type de Code-Barres */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Type Code-Barres :</label>
            <select
              value={barcodeType}
              onChange={(e) => setBarcodeType(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-bold focus:outline-blue-500"
            >
              <option value="CODE128">CODE 128 (Standard)</option>
              <option value="CODE39">CODE 39 (Alphanumérique)</option>
              <option value="EAN13">EAN-13 (13 chiffres)</option>
            </select>
          </div>

          {/* Number of Copies */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nombre de copies :</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="500"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-center focus:outline-blue-500"
              />
              <button
                type="button"
                onClick={() => setCopies(Math.max(1, Math.floor(product.quantite || 1)))}
                className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[11px] font-bold transition cursor-pointer"
                title="Mettre la quantité égale au stock actuel"
              >
                Stock ({product.quantite || 0})
              </button>
            </div>
          </div>
        </div>

        {/* Display Toggles */}
        <div className="flex flex-wrap items-center gap-4 text-xs px-1">
          <div className="inline-flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={showStore}
                onChange={(e) => setShowStore(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Nom Magasin :</span>
            </label>
            <input
              type="text"
              value={printerSettings.storeName || ''}
              onChange={(e) => {
                const updated = { ...printerSettings, storeName: e.target.value };
                setPrinterSettings(updated);
                savePrinterSettings(updated);
              }}
              placeholder="Ex: NOUNOU TELECOM"
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-[11px] focus:outline-blue-500 w-44 shadow-2xs"
              title="Modifie le nom de l'établissement synchronisé avec les paramètres, étiquettes et bons de commande"
            />
          </div>

          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={showCategory}
              onChange={(e) => setShowCategory(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Catégorie</span>
          </label>

          {attributes && (
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={showAttributes}
                onChange={(e) => setShowAttributes(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Attributs ({attributes})</span>
            </label>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="font-bold text-slate-700 text-xs">Format Code :</span>
            <select
              value={barcodeType}
              onChange={(e) => setBarcodeType(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded-xl font-black text-[11px] text-blue-900 focus:outline-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="CODE128">⭐ CODE 128 (Lecture instantanée)</option>
              <option value="CODE39">CODE 39</option>
              <option value="EAN13">EAN-13</option>
            </select>
          </div>
        </div>

        {/* Real-size Interactive Label Preview (Reflects Rotation & Orientation) */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-2xl border border-dashed border-slate-300">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Aperçu Réel • {fmt.label}
            </span>
            {rotation !== 0 && (
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                Pivoter {rotation}°
              </span>
            )}
          </div>

          {/* Scaled preview container */}
          <div
            id="product-label-barcode"
            className="print-area bg-white rounded-lg shadow-md border border-slate-300 flex flex-col justify-between items-center text-center select-text"
            style={{
              width: `${previewWidth}px`,
              minHeight: `${previewHeight}px`,
              padding: '8px 10px 6px 10px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              color: '#000',
              transform: rotation !== 0 ? `rotate(${rotation}deg)` : 'none',
              marginLeft: `${offsetX * 3}px`,
              transition: 'transform 0.2s ease-in-out, margin-left 0.2s ease-in-out'
            }}
          >
            {/* 1. Header Magasin : Nom configurable depuis les Paramètres */}
            {showStore && (
              <div className="font-black uppercase tracking-wider text-black text-[15px] leading-tight w-full">
                {getStoreName(printerSettings)}
              </div>
            )}

            {/* 2. Nom du Produit (Affichage complet sur 1, 2 ou 3 lignes sans coupure) */}
            <div 
              className="text-center font-extrabold text-black leading-tight uppercase my-0.5 w-full break-words line-clamp-3"
              style={{
                fontSize: (product.nom || '').length > 55 ? '8px' : ((product.nom || '').length > 35 ? '8.5px' : ((product.nom || '').length > 20 ? '10px' : '11.5px')),
                lineHeight: '1.15'
              }}
            >
              {(product.nom || 'TEST').toUpperCase()}
            </div>

            {/* 3. Zone Code-barres net avec barres épaisses */}
            <div className="w-[96%] h-14 flex items-center justify-center my-0.5 overflow-hidden">
              {barcodeDataUrlPreview ? (
                <img 
                  src={barcodeDataUrlPreview} 
                  alt={effectiveBarcode}
                  className="max-w-full max-h-full object-contain block mx-auto [image-rendering:pixelated]"
                />
              ) : (
                <div className="text-center font-mono font-bold text-[11px] py-1 text-black">
                  {effectiveBarcode}
                </div>
              )}
            </div>

            {/* 4. Numéro / Référence sous le code-barres */}
            <div className="text-center font-black text-black tracking-widest font-mono text-[12px] leading-none mb-0.5">
              {effectiveBarcode}
            </div>

            {/* 4b. Codes secondaires si le produit a plusieurs codes */}
            {secondaryCodes.length > 0 && (
              <div className="text-center font-bold text-slate-700 text-[8.5px] leading-tight mb-1 truncate max-w-full px-1">
                {secondaryCodes.length === 1 ? `Autre code: ${secondaryCodes[0]}` : `Autres: ${secondaryCodes.join(' • ')}`}
              </div>
            )}

            {/* 5. Prix en grande taille italique */}
            <div className="text-center font-black text-black italic text-[16px] leading-none w-full">
              Prix: <span className="text-[23px] font-black">{prix.toLocaleString('fr-DZ')}</span> <span className="text-[13px] not-italic">DA</span>
            </div>
          </div>

          <span className="text-[10px] text-slate-400 mt-4 font-semibold">
            {selectedBarcode === 'ALL' ? `${allCodes.length * copies} étiquettes (${allCodes.length} codes × ${copies})` : `${copies} étiquette${copies > 1 ? 's' : ''}`} • Format {customWidth}×{customHeight} mm calibré pour Xprinter 350B
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 no-print">
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-600" />
            <span>Imprimante cible : <strong>{printerSettings.labelPrinter || 'Xprinter XP-350B (ou système)'}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSystemDialog}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Dialogue Système
            </button>

            <button
              type="button"
              onClick={handlePrintDirectXprinter}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/25 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>
                Imprimer sur Xprinter 350B ({selectedBarcode === 'ALL' ? allCodes.length * copies : copies})
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
