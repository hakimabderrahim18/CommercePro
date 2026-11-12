import { api } from '../services/api';
import bwipjs from 'bwip-js';
import JsBarcode from 'jsbarcode';

/**
 * Génère un Data URL base64 PNG de code-barres avec marge de sécurité (Quiet Zone)
 */
export function createBarcodeDataUrl(text, { width = null, height = null, format = 'CODE128', margin = null } = {}) {
  try {
    let cleanText = String(text || '0000').trim().toUpperCase();
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    let fmt = (format || 'CODE128').toUpperCase();

    // Gestion rigoureuse des formats supportés par les douchettes standard
    if (fmt === 'EAN13') {
      if (/^\d{12,13}$/.test(cleanText)) {
        if (cleanText.length === 12) {
          cleanText += calculateEan13CheckDigit(cleanText);
        } else if (!isValidEan13(cleanText)) {
          cleanText = cleanText.slice(0, 12) + calculateEan13CheckDigit(cleanText.slice(0, 12));
        }
      } else {
        fmt = 'CODE128';
      }
    } else if (/^\d{12,13}$/.test(cleanText) && fmt !== 'CODE39') {
      if (cleanText.length === 12) {
        cleanText += calculateEan13CheckDigit(cleanText);
      }
      fmt = 'EAN13';
    } else if (fmt !== 'CODE39') {
      fmt = 'CODE128';
    }

    // Échelle strictement entière (2 ou 3) pour tête d'impression thermique 203 DPI (8 dots/mm)
    // 2 pixels = 0.250 mm (module standard universel)
    // 3 pixels = 0.375 mm pour codes courts (<= 6 car.) pour lisibilité optique maximale
    const modWidth = width || (cleanText.length <= 6 ? 3 : 2);
    const barHeight = height !== null && height !== undefined ? Number(height) : (cleanText.length <= 6 ? 60 : 80);
    const marginPx = margin !== null && margin !== undefined ? Number(margin) : 16;

    JsBarcode(canvas, cleanText, {
      format: fmt,
      displayValue: false,
      width: modWidth,
      height: barHeight,
      margin: marginPx,
      background: '#ffffff',
      lineColor: '#000000'
    });

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Erreur createBarcodeDataUrl:', e);
    return '';
  }
}

export function calculateEan13CheckDigit(str12) {
  const clean = String(str12 || '').replace(/\D/g, '').slice(0, 12);
  if (clean.length < 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(clean[i], 10);
    sum += (i % 2 === 0) ? d : d * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

export function isValidEan13(str) {
  const clean = String(str || '').trim();
  if (!/^\d{13}$/.test(clean)) return false;
  return parseInt(clean[12], 10) === calculateEan13CheckDigit(clean.slice(0, 12));
}

export function generateStandardEan13() {
  const prefix = '697';
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900).toString();
  const raw12 = prefix + timePart + randPart;
  return raw12 + calculateEan13CheckDigit(raw12);
}

export function generateShortNumericBarcode() {
  return generateStandardEan13();
}

/**
 * Décode les caractères envoyés par une douchette USB configurée en QWERTY sur un Windows AZERTY
 */
export function decodeAzertyBarcode(str) {
  if (!str) return '';
  const azertyMap = {
    '&': '1', 'é': '2', '"': '3', '\'': '4', '(': '5',
    '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0',
    '§': '6'
  };
  return String(str).split('').map(ch => azertyMap[ch] || ch).join('');
}

/**
 * Génère le SVG vectoriel certifié GS1/ISO via bwip-js (précision 100% sans aucun flou)
 */
export function createBarcodeSvg(text, { widthMm = 45, heightMm = 35, format = 'CODE128' } = {}) {
  try {
    if (typeof document === 'undefined') return '';
    let cleanText = String(text || '0000').trim().toUpperCase();
    let fmt = (format || 'CODE128').toUpperCase();

    if (fmt === 'EAN13') {
      if (/^\d{12,13}$/.test(cleanText)) {
        if (cleanText.length === 12) {
          cleanText += calculateEan13CheckDigit(cleanText);
        } else if (!isValidEan13(cleanText)) {
          cleanText = cleanText.slice(0, 12) + calculateEan13CheckDigit(cleanText.slice(0, 12));
        }
      } else {
        fmt = 'CODE128';
      }
    } else if (/^\d{12,13}$/.test(cleanText) && fmt !== 'CODE39') {
      if (cleanText.length === 12) {
        cleanText += calculateEan13CheckDigit(cleanText);
      }
      fmt = 'EAN13';
    } else if (fmt !== 'CODE39') {
      fmt = 'CODE128';
    }

    const svgElem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const modWidth = cleanText.length <= 6 ? 3 : 2;
    const barHeight = heightMm <= 25 ? 55 : (heightMm <= 35 ? 75 : 90);

    JsBarcode(svgElem, cleanText, {
      format: fmt,
      displayValue: false,
      width: modWidth,
      height: barHeight,
      margin: 16,
      background: '#ffffff',
      lineColor: '#000000'
    });

    const s = new XMLSerializer().serializeToString(svgElem);
    return s.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" style="max-width:98%;max-height:100%;width:auto;height:auto;display:block;margin:0 auto;" ');
  } catch (e) {
    console.warn('createBarcodeSvg error:', e);
    return '';
  }
}





export const LABEL_FORMATS = {
  '45x35': { width: 45, height: 35, rotation: 0, isVertical: false, label: '45 × 35 mm (⭐ Rouleau Actuel)' },
  '35x45': { width: 35, height: 45, rotation: 0, isVertical: true, label: '35 × 45 mm (Rouleau Vertical 35×45)' },
  '30x30': { width: 30, height: 30, rotation: 0, isVertical: false, label: '30 × 30 mm (Format 30×30)' },
  '50x30': { width: 50, height: 30, rotation: 0, isVertical: false, label: '50 × 30 mm (Rouleau 50×30)' },
  '40x30': { width: 40, height: 30, rotation: 0, isVertical: false, label: '40 × 30 mm (Rouleau Compact 40×30)' },
  '30x20': { width: 30, height: 20, rotation: 0, isVertical: false, label: '30 × 20 mm (Mini 30×20)' },
  '20x30': { width: 20, height: 30, rotation: 0, isVertical: true, label: '20 × 30 mm' },
  '82x20': { width: 82, height: 20, rotation: 0, isVertical: false, label: '82 × 20 mm (Format Large 82×20)' },
  '20x82': { width: 20, height: 82, rotation: 0, isVertical: true, label: '20 × 82 mm (Verticale 20×82)' },
  '40x25': { width: 40, height: 25, rotation: 0, isVertical: false, label: '40 × 25 mm (Compacte)' },
  '50x25': { width: 50, height: 25, rotation: 0, isVertical: false, label: '50 × 25 mm (Moyenne basse)' },
  '58x40': { width: 58, height: 40, rotation: 0, isVertical: false, label: '58 × 40 mm (Moyenne)' },
  '80x50': { width: 80, height: 50, rotation: 0, isVertical: false, label: '80 × 50 mm (Grand Format)' },
  '30x50': { width: 30, height: 50, rotation: 0, isVertical: true, label: '30 × 50 mm (Verticale 30x50)' },
  '40x60': { width: 40, height: 60, rotation: 0, isVertical: true, label: '40 × 60 mm (Verticale Grande)' }
};

export function formatCurrencyDz(val, overrideDecimals = null) {
  const num = Number(val || 0);
  const cfg = getPrinterSettings();
  const settingDec = overrideDecimals !== null && overrideDecimals !== undefined 
    ? overrideDecimals 
    : (cfg?.receiptDecimals !== undefined ? cfg.receiptDecimals : 0);

  let formattedNum = '';
  if (settingDec === 0 || settingDec === '0') {
    formattedNum = Math.round(num).toString();
  } else if (settingDec === 'auto') {
    if (num % 1 === 0) {
      formattedNum = num.toFixed(0);
    } else {
      formattedNum = num.toFixed(2);
    }
  } else {
    const d = parseInt(settingDec, 10) || 2;
    formattedNum = num.toFixed(d);
  }

  const parts = formattedNum.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return parts.join('.');
}

const DEFAULT_SETTINGS = {
  receiptDecimals: 0, // 0 = entiers (ex: 1 250 DA), 2 = 2 décimales (ex: 1 250.00 DA), 'auto' = dynamique
  labelPrinter: '', // Vide = auto-détection Xprinter XP-350B ou première imprimante disponible
  labelFormat: '45x35', // Format étiquette 45x35mm par défaut pour le rouleau du client
  labelWidth: 45,
  labelHeight: 35,
  labelOrientation: 'portrait',
  labelRotation: 0, // 0 = impression normale horizontale sans rotation
  labelOffsetX: 0, // Décalage horizontal en mm
  labelShowStore: true,
  labelShowCategory: false,
  labelShowAttributes: false,
  labelBarcodeType: 'CODE128',
  receiptPrinter: '', // Vide = sélection automatique SPRT 80 / POS-80 ou imprimante par défaut Windows
  receiptPaperWidth: '80mm',
  receiptOrientation: 'portrait',
  receiptRotation: 0, // 0, 90, 180, 270
  receiptMarginLeft: 0, // 0mm
  receiptContentWidth: 70, // 70mm : largeur d'impression utile standard thermique (évite toute coupure à droite)
  storeLogo: '', // Image du Logo (Data URL base64)
  showReceiptLogo: true, // Afficher le logo sur les tickets & bons
  storeName: 'COMMERCE PRO',
  storeSubtitle: 'VENTE PIECE MOBILE',
  storeAddress: "LAGARE A CÔTÉ DE L'ARRÊT DE BUS LA CITÉ (3)",
  storeCity: 'TIARET',
  storePhone: '0550793369/0550082685',
  receiptFooter: 'Merci pour votre confiance ! À bientôt.',
  autoCut: true,
  silentPrint: true, // Impression directe sans pop-up par défaut pour caisse rapide
  activityType: 'pieces_detachees', // 'pieces_detachees' | 'vetements' | 'alimentation' | 'general'
  enableSeriePricing: true,
  repairWorkflowMode: 'dinateck', // 'standard' | 'dinateck'
  
  // Format d'impression de la Situation (Client / Fournisseur) : '80mm' | 'A4'
  situationPrintFormat: '80mm',

  // Attributs et blocs configurables des tickets et bons de commande
  receiptShowStoreHeader: true,
  receiptShowNbrArt: true,
  receiptShowTotalBrut: true,
  receiptShowRemise: true,
  receiptShowTtcAPayer: true,
  receiptShowAncienSolde: true,
  receiptShowTotalAchat: true,
  receiptShowVersement: true,
  receiptShowNouveauSolde: true,
  receiptShowCustomerName: true,
  receiptShowCustomerPhone: true,
  receiptShowCustomerAddress: true,
  receiptShowBarcode: true,
  receiptShowDate: true,
  receiptShowCashier: true
};

const STORAGE_KEY = 'commercepost_printer_settings';

export function getStoreName(cfg = null) {
  const settings = cfg || getPrinterSettings();
  if (settings && typeof settings.storeName === 'string' && settings.storeName.trim()) {
    return settings.storeName.trim();
  }
  return 'COMMERCE PRO';
}

export function getPrinterSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Si l'ancienne valeur erronée 'Xprinter XP-350B' était enregistrée pour le ticket, réinitialiser à vide (auto-détection SPRT 80)
      if (parsed.receiptPrinter === 'Xprinter XP-350B') {
        parsed.receiptPrinter = '';
      }
      const contentW = parsed.receiptContentWidth ? Math.min(Number(parsed.receiptContentWidth), 72) : 70;
      return { 
        ...DEFAULT_SETTINGS, 
        ...parsed,
        receiptMarginLeft: parsed.receiptMarginLeft !== undefined ? parsed.receiptMarginLeft : 0,
        receiptContentWidth: contentW
      };
    }
  } catch (e) {
    console.warn('Erreur lecture printer settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function savePrinterSettings(settings) {
  try {
    const current = getPrinterSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('printer-settings-changed', { detail: updated }));
      } catch (err) {
        // Ignorer si contexte isolé
      }
    }
    return updated;
  } catch (e) {
    console.error('Erreur sauvegarde printer settings:', e);
    return settings;
  }
}

/**
 * Détecte les imprimantes suggérées d'après les noms Windows
 */
export function autoDetectPrinters(printersList = []) {
  let detectedXprinter = '';
  let detectedSprt = '';

  for (const p of printersList) {
    const name = (p.name || '').toLowerCase();
    // Détection Xprinter XP-350B
    if (!detectedXprinter && (name.includes('350') || name.includes('xprinter') || name.includes('xp-') || name.includes('label') || name.includes('barcode'))) {
      detectedXprinter = p.name;
    }
    // Détection SPRT 80 / POS-80 / Thermal
    if (!detectedSprt && (name.includes('sprt') || name.includes('pos80') || name.includes('pos-80') || name.includes('pos 80') || name.includes('80mm') || name.includes('receipt') || name.includes('thermal'))) {
      detectedSprt = p.name;
    }
  }

  return { detectedXprinter, detectedSprt };
}

/**
 * Génère le code HTML complet pour imprimer des étiquettes sur Xprinter XP-350B
 * Conçu strictement pour tenir sur 1 SEULE ÉTIQUETTE 30x30mm (240x240 dots à 203 DPI) sans débordement
 */
export function generateLabelHtml({ 
  product, 
  quantity = 1, 
  format = '45x35', 
  settings = null, 
  priceType = 'prixVente',
  rotation = null,
  customWidth = null,
  customHeight = null,
  barcodeValue = null,
  allCodes = null
}) {
  const cfg = settings || getPrinterSettings();
  const fmt = LABEL_FORMATS[format] || LABEL_FORMATS['45x35'];
  const rot = rotation !== null ? rotation : (fmt.rotation || cfg.labelRotation || 0);

  const widthMm = Number(customWidth || fmt.width || 45);
  const heightMm = Number(customHeight || fmt.height || 35);
  const isRotated = rot === 90 || rot === 270;

  // Dimensions internes
  const contentWidth = isRotated ? heightMm : widthMm;
  const contentHeight = isRotated ? widthMm : heightMm;

  let unitPrice = Number(product[priceType] || product.prixVente || 0);
  const attributes = [product.taille, product.pointure, product.couleur].filter(Boolean).join(' / ');
  const storeHeader = getStoreName(cfg);
  const priceFormatted = Number(unitPrice || 0).toLocaleString('fr-DZ');

  // Tous les codes du produit
  const productAllCodes = Array.from(new Set([
    product.codeBarre,
    product.reference,
    ...(Array.isArray(product.codesBarres) ? product.codesBarres : (product.codesBarres ? String(product.codesBarres).split(/[,;\s\n]+/) : []))
  ].filter(Boolean))).map(c => String(c).trim().toUpperCase());

  // Déterminer la liste des codes à imprimer
  const codesToPrint = (barcodeValue === 'ALL' && Array.isArray(allCodes) && allCodes.length > 0)
    ? allCodes.map(c => String(c).trim().toUpperCase())
    : [(barcodeValue || product.codeBarre || product.reference || '0000').trim().toUpperCase()];

  const pagesHtml = [];

  for (const currentCode of codesToPrint) {
    const targetBarcode = currentCode || '0000';
    const secondaryCodes = productAllCodes.filter(c => c && c !== targetBarcode);

    const prodName = String(product.nom || 'TEST').trim().toUpperCase();
    const nameLen = prodName.length;
    const isLongName = nameLen > 24;

    // Priorité absolue au PNG monochrome haute résolution (zéro tramage / zéro flou)
    // Hauteur du code-barres ajustée si nom long pour que tout tienne sur 1 étiquette sans aucun débordement
    const barcodeHeight = heightMm <= 25 
      ? (isLongName ? 45 : 55) 
      : (heightMm <= 30 ? (isLongName ? 60 : 75) : (isLongName ? 72 : 85));

    const barcodeImg = createBarcodeDataUrl(targetBarcode, { 
      width: (targetBarcode.length <= 6) ? 3 : 2, 
      height: barcodeHeight,
      format: cfg.labelBarcodeType || 'CODE128',
      margin: 2
    });

    const otherCodesText = secondaryCodes.length > 0 
      ? (secondaryCodes.length === 1 ? `Autre: ${secondaryCodes[0]}` : `Codes: ${secondaryCodes.slice(0, 2).join(' • ')}`)
      : '';

    // Calcul de la taille de police pour afficher le nom COMPLET sur 1, 2 ou 3 lignes sans aucune coupure
    const nameFontSize = nameLen > 55 
      ? (widthMm <= 35 ? '7.5px' : '8px') 
      : (nameLen > 35 
        ? (widthMm <= 35 ? '8px' : '8.5px') 
        : (nameLen > 20 ? (widthMm <= 35 ? '9px' : '10px') : (widthMm <= 35 ? '10.5px' : '11.5px')));
    const nameMaxHeight = heightMm <= 25 ? '6mm' : (heightMm <= 30 ? '8mm' : '9.5mm');

    for (let i = 0; i < quantity; i++) {
      pagesHtml.push(`
        <div class="label-page">
          <div class="label-item ${rot !== 0 ? `rotate-${rot}` : ''}">
            <!-- 1. Nom Magasin / Logo en Grand -->
            <div class="store-name">${storeHeader}</div>

            <!-- 2. Désignation Complète du Produit (Retour à la ligne automatique sans coupure) -->
            <div class="product-name" style="font-size: ${nameFontSize}; max-height: ${nameMaxHeight};">${prodName}</div>

            <!-- 3. Zone Code-Barres Haute Visibilité -->
            <div class="barcode-box">
              ${barcodeImg ? `<img src="${barcodeImg}" alt="barcode" class="barcode-img" />` : `<div class="font-mono bold">${targetBarcode}</div>`}
            </div>

            <!-- 4. Numéro / Référence du code-barres -->
            <div class="barcode-number">${targetBarcode}</div>

            <!-- 4b. Codes secondaires si produit multi-codes -->
            ${otherCodesText ? `<div class="secondary-codes">${otherCodesText}</div>` : ''}

            <!-- 5. Grand Prix en DA (Style exact photo) -->
            <div class="price-section">
              Prix: <span class="price-val">${priceFormatted}</span> <span class="price-currency">DA</span>
            </div>
          </div>
        </div>
      `);
    }
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Étiquette ${product.reference || product.codeBarre} - Xprinter 350B</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: #000 !important;
          }
          html, body {
            background: #fff;
            color: #000 !important;
            font-family: Arial, Helvetica, -apple-system, sans-serif;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
          }
          .label-page {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            max-width: ${widthMm}mm;
            max-height: ${heightMm}mm;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 2mm 2mm 1.5mm 2mm;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .label-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .label-item {
            width: 100%;
            height: 100%;
            max-width: ${contentWidth}mm;
            max-height: ${contentHeight}mm;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            text-align: center;
            transform-origin: center center;
            ${cfg.labelOffsetX ? `margin-left: ${Number(cfg.labelOffsetX)}mm;` : ''}
          }
          .rotate-90 { transform: rotate(90deg); }
          .rotate-180 { transform: rotate(180deg); }
          .rotate-270 { transform: rotate(270deg); }
          .store-name {
            font-size: ${widthMm <= 35 ? '13px' : '15px'};
            font-weight: 900 !important;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #000 !important;
            line-height: 1.1;
            width: 100%;
            text-align: center;
          }
          .product-name {
            font-weight: 800 !important;
            text-transform: uppercase;
            line-height: 1.15;
            text-align: center;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            word-break: break-word;
            color: #000 !important;
            margin-top: 0.2mm;
            margin-bottom: 0.2mm;
            width: 100%;
          }
          .barcode-box {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: ${heightMm <= 25 ? '10mm' : (heightMm <= 30 ? '12.5mm' : '15mm')};
            overflow: hidden;
            margin: 0.3mm auto 0 auto;
            background: #ffffff !important;
            padding: 0;
          }
          .barcode-img {
            max-width: 98% !important;
            max-height: 100% !important;
            width: auto !important;
            height: auto !important;
            image-rendering: pixelated !important;
            image-rendering: crisp-edges !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            display: block !important;
            margin: 0 auto !important;
            background: #ffffff !important;
          }
          .barcode-number {
            font-family: Arial, monospace, sans-serif;
            font-size: ${widthMm <= 35 ? '10.5px' : '12.5px'};
            font-weight: 900 !important;
            line-height: 1;
            letter-spacing: 1.5px;
            color: #000 !important;
            margin-top: 0.5mm;
            text-align: center;
            width: 100%;
          }
          .secondary-codes {
            font-family: Arial, monospace, sans-serif;
            font-size: ${widthMm <= 35 ? '7.5px' : '8.5px'};
            font-weight: 800 !important;
            line-height: 1;
            letter-spacing: 0.3px;
            color: #222 !important;
            margin-top: 0.4mm;
            text-align: center;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .price-section {
            width: 100%;
            text-align: center;
            line-height: 1;
            font-size: ${widthMm <= 35 ? '13.5px' : '15.5px'};
            font-weight: 900 !important;
            font-style: italic !important;
            color: #000 !important;
            margin-top: 0.6mm;
            letter-spacing: 0.2px;
          }
          .price-val {
            font-size: ${widthMm <= 35 ? '19px' : '23px'};
            font-weight: 900 !important;
            font-style: italic !important;
          }
          .price-currency {
            font-size: ${widthMm <= 35 ? '11px' : '13px'};
            font-weight: 900 !important;
            font-style: normal !important;
            margin-left: 2px;
          }
        </style>
      </head>
      <body>
        ${pagesHtml.join('')}
      </body>
    </html>
  `;
}

/**
 * Génère le code HTML d'un Bon de Commande / Ticket optimisé pour imprimante thermique 80mm (SPRT 80)
 */
export function generateReceiptHtml({ 
  invoice, 
  docType = 'BON_COMMANDE', 
  settings = null, 
  rotation = null,
  marginLeft = null,
  contentWidth = null
}) {
  const cfg = settings || getPrinterSettings();
  const rot = rotation !== null && rotation !== undefined ? rotation : (cfg.receiptRotation || 0);
  const mLeft = (marginLeft !== null && marginLeft !== undefined) 
    ? marginLeft 
    : (cfg.receiptMarginLeft !== undefined ? cfg.receiptMarginLeft : 0);
  const cWidth = (contentWidth !== null && contentWidth !== undefined) 
    ? contentWidth 
    : (cfg.receiptContentWidth || 80);

  const dateObj = new Date(invoice.createdAt || invoice.dateFacture || Date.now());
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const dateFormatted = `${day}/${month}/${year}-${hours}:${minutes}:${seconds}`;

  const ticketNum = String(invoice.numeroFacture || invoice.numeroTicket || '036009').trim();
  const cleanTicketBarcode = ticketNum.replace(/[^A-Za-z0-9]/g, '') || '036009';
  const barcodeDataUrl = createBarcodeDataUrl(cleanTicketBarcode, { width: 2, height: 42, format: 'CODE128' });

  const clientName = (invoice.client?.nom || invoice.nomClientLibre || invoice.clientLibre || 'Client Comptoir').toUpperCase();
  const clientPhone = invoice.client?.telephone || invoice.telephoneClient || '';
  const clientAddress = invoice.client?.adresse || invoice.adresseClient || '';
  let userStoredName = '';
  try {
    const rawUser = localStorage.getItem('commercepost_auth_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      userStoredName = u?.nom || u?.username || '';
    }
  } catch (e) {}

  const caissierName = (
    invoice.caissier || 
    invoice.vendeur || 
    invoice.creePar || 
    invoice.userName || 
    invoice.user?.nom || 
    invoice.user?.username || 
    userStoredName || 
    'ILYES'
  ).toUpperCase();

  const rawItems = Array.isArray(invoice.items) && invoice.items.length > 0 
    ? invoice.items 
    : (Array.isArray(invoice.lignes) ? invoice.lignes : []);

  let totalQty = 0;
  let totalBrut = 0;

  const itemsRows = rawItems.map((it) => {
    let name = (it.nom || it.designation || it.product_nom || it.product?.nom || it.reference || 'Article').toUpperCase();
    if (it.isSerie || (it.piecesParSerie && Number(it.piecesParSerie) > 1)) {
      name += ` (Série de ${it.piecesParSerie || 1} pcs)`;
    }
    const qty = Number(it.quantite ?? it.qty ?? 1);
    const pu = Number(it.prixUnitaire ?? (it.totalLigne ? it.totalLigne / qty : 0));
    const lineTotal = Number(it.totalLigne ?? (qty * pu));

    totalQty += qty;
    totalBrut += lineTotal;

    return `
      <tr class="item-row">
        <td class="col-lib">${name}</td>
        <td class="col-qte">${qty}</td>
        <td class="col-pu">${formatCurrencyDz(pu)}</td>
        <td class="col-tot">${formatCurrencyDz(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  const nbrArt = rawItems.length;
  const totalTTC = Number(invoice.totalTTC ?? totalBrut);
  const remise = Number(invoice.remise ?? Math.max(0, totalBrut - totalTTC));
  const montantPaye = Number(invoice.montantPaye ?? totalTTC);
  const ancienSolde = Number(invoice.client?.soldeDette ?? invoice.ancienSolde ?? 0);
  const nouveauSolde = Math.max(0, Math.round((ancienSolde + totalTTC - montantPaye) * 100) / 100);

  const effectiveCWidth = Math.min(Number(cWidth) || 70, 72);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket - ${ticketNum}</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000000 !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, "Helvetica Neue", Helvetica, -apple-system, sans-serif;
            font-size: 12.5px;
            font-weight: 900 !important;
            line-height: 1.25;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .receipt-container {
            width: ${effectiveCWidth}mm !important;
            max-width: ${effectiveCWidth}mm !important;
            margin-left: ${mLeft ? `${mLeft}mm` : '0mm'} !important;
            margin-right: auto !important;
            padding-left: 0.5mm !important;
            padding-right: 1.5mm !important;
            padding-top: 2mm !important;
            padding-bottom: 5mm !important;
            box-sizing: border-box;
            text-align: center;
            overflow: hidden !important;
            ${rot !== 0 ? `transform: rotate(${rot}deg); transform-origin: top center;` : ''}
          }
          .logo-wrapper {
            text-align: center;
            margin: 0 auto 5px auto;
            width: 100%;
          }
          .store-logo-img {
            max-width: 130px;
            max-height: 65px;
            object-fit: contain;
            margin: 0 auto;
            display: block;
            filter: grayscale(100%);
          }
          .store-header {
            text-align: center;
            margin-bottom: 4px;
            width: 100%;
          }
          .store-title {
            font-size: 19px;
            font-weight: 900 !important;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 1px;
          }
          .store-subtitle {
            font-size: 14px;
            font-weight: 900 !important;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .store-addr, .store-city, .store-phone {
            font-size: 12px;
            font-weight: 900 !important;
            line-height: 1.2;
          }
          .divider-dashed {
            width: 100%;
            border-top: 1.5px dashed #000;
            margin: 4px 0;
            font-size: 0;
          }
          table.receipt-table {
            width: 100% !important;
            border-collapse: collapse;
            margin: 2px 0;
            font-size: 11.5px;
            table-layout: fixed;
          }
          table.receipt-table th {
            padding: 3px 2px;
            font-size: 11px;
            font-weight: 900 !important;
            text-transform: uppercase;
            border-bottom: 1.5px solid #000;
          }
          table.receipt-table th:not(:last-child),
          table.receipt-table td:not(:last-child) {
            border-right: 1px solid #000;
          }
          .th-lib { width: 35%; text-align: left; padding-left: 1px; padding-right: 3px; }
          .th-qte { width: 14%; text-align: center; padding-left: 2px; padding-right: 2px; }
          .th-pu  { width: 25.5%; text-align: right; padding-left: 2px; padding-right: 3px; }
          .th-tot { width: 25.5%; text-align: right; padding-left: 3px; padding-right: 1px; }

          .item-row td {
            padding: 3px 2px;
            font-size: 11.5px;
            font-weight: 900 !important;
            line-height: 1.25;
            vertical-align: top;
          }
          .item-row:not(:last-child) td {
            border-bottom: 0.5px dashed #555;
          }
          .col-lib {
            width: 35%;
            text-align: left;
            word-break: break-word;
            overflow-wrap: break-word;
            padding-left: 1px;
            padding-right: 3px;
          }
          .col-qte {
            width: 14%;
            text-align: center;
            white-space: nowrap !important;
            padding-left: 2px;
            padding-right: 2px;
          }
          .col-pu {
            width: 25.5%;
            text-align: right;
            white-space: nowrap !important;
            font-size: 11px;
            font-variant-numeric: tabular-nums;
            padding-left: 2px;
            padding-right: 3px;
          }
          .col-tot {
            width: 25.5%;
            text-align: right;
            white-space: nowrap !important;
            font-size: 11px;
            font-variant-numeric: tabular-nums;
            padding-left: 3px;
            padding-right: 1px;
          }

          .summary-line {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 900 !important;
            padding: 2px 0;
            text-align: left;
          }
          .totals-block, .solde-block {
            width: 100%;
            margin: 2px 0;
            font-size: 12.5px;
            font-weight: 900 !important;
          }
          .tot-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5px 1px;
          }
          .tot-pay {
            font-size: 13.5px;
            font-weight: 900 !important;
          }
          .client-box {
            text-align: left;
            font-size: 13px;
            font-weight: 900 !important;
            padding: 2px 0;
          }
          .barcode-wrapper {
            text-align: center;
            margin: 6px auto 3px auto;
            width: 100%;
          }
          .barcode-img {
            max-width: 90%;
            height: 42px;
            object-fit: contain;
            margin: 0 auto;
            display: block;
          }
          .barcode-text {
            font-family: monospace, Arial, sans-serif;
            font-size: 14px;
            font-weight: 900 !important;
            letter-spacing: 2px;
            margin-top: 2px;
          }
          .footer-info {
            font-size: 12px;
            font-weight: 900 !important;
            line-height: 1.3;
            text-align: left;
          }
          .footer-flex {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .cut-space {
            height: 5mm;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          ${(cfg.showReceiptLogo && cfg.storeLogo) ? `
            <div class="logo-wrapper">
              <img src="${cfg.storeLogo}" alt="Logo" class="store-logo-img" />
            </div>
          ` : ''}

          ${cfg.receiptShowStoreHeader !== false ? `
          <div class="store-header">
            <div class="store-title">${getStoreName(cfg)}</div>
            ${cfg.storeSubtitle ? `<div class="store-subtitle">${cfg.storeSubtitle}</div>` : ''}
            ${cfg.storeAddress ? `<div class="store-addr">${cfg.storeAddress}</div>` : ''}
            ${cfg.storeCity ? `<div class="store-city">${cfg.storeCity}</div>` : ''}
            ${cfg.storePhone ? `<div class="store-phone">${cfg.storePhone}</div>` : ''}
          </div>
          <div class="divider-dashed"></div>
          ` : ''}

          <table class="receipt-table">
            <thead>
              <tr>
                <th class="th-lib">LIBELLE</th>
                <th class="th-qte">QTE</th>
                <th class="th-pu">P.U</th>
                <th class="th-tot">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          ${cfg.receiptShowNbrArt !== false ? `
          <div class="divider-dashed"></div>
          <div class="summary-line">
            <span>NBR ART : ${nbrArt}, TQTE : ${totalQty}</span>
          </div>
          ` : ''}

          ${(cfg.receiptShowTotalBrut !== false || cfg.receiptShowRemise !== false || cfg.receiptShowTtcAPayer !== false) ? `
          <div class="divider-dashed"></div>
          <div class="totals-block">
            ${cfg.receiptShowTotalBrut !== false ? `
            <div class="tot-row">
              <span>TOTAL :</span>
              <span>${formatCurrencyDz(totalBrut)}</span>
            </div>` : ''}
            ${cfg.receiptShowRemise !== false ? `
            <div class="tot-row">
              <span>REMISE :</span>
              <span>${formatCurrencyDz(remise)}</span>
            </div>` : ''}
            ${cfg.receiptShowTtcAPayer !== false ? `
            <div class="tot-row tot-pay">
              <span>TTC A PAYER :</span>
              <span>${formatCurrencyDz(totalTTC)}</span>
            </div>` : ''}
          </div>
          ` : ''}

          ${(cfg.receiptShowAncienSolde !== false || cfg.receiptShowTotalAchat !== false || cfg.receiptShowVersement !== false || cfg.receiptShowNouveauSolde !== false) ? `
          <div class="solde-block">
            ${cfg.receiptShowAncienSolde !== false ? `
            <div class="tot-row">
              <span>Anc. solde:</span>
              <span>${formatCurrencyDz(ancienSolde)}</span>
            </div>` : ''}
            ${cfg.receiptShowTotalAchat !== false ? `
            <div class="tot-row">
              <span>Total achat:</span>
              <span>${formatCurrencyDz(totalTTC)}</span>
            </div>` : ''}
            ${cfg.receiptShowVersement !== false ? `
            <div class="tot-row">
              <span>Versement :</span>
              <span>${formatCurrencyDz(montantPaye)}</span>
            </div>` : ''}
            ${cfg.receiptShowNouveauSolde !== false ? `
            <div class="tot-row">
              <span>Nouv. solde:</span>
              <span>${formatCurrencyDz(nouveauSolde)}</span>
            </div>` : ''}
          </div>
          ` : ''}

          ${(cfg.receiptShowCustomerName !== false || (cfg.receiptShowCustomerPhone !== false && clientPhone) || (cfg.receiptShowCustomerAddress !== false && clientAddress)) ? `
          <div class="divider-dashed"></div>
          <div class="client-box">
            ${cfg.receiptShowCustomerName !== false ? `<div>Client : ${clientName}</div>` : ''}
            ${(cfg.receiptShowCustomerPhone !== false && clientPhone) ? `<div>Tél : ${clientPhone}</div>` : ''}
            ${(cfg.receiptShowCustomerAddress !== false && clientAddress) ? `<div>Adresse : ${clientAddress}</div>` : ''}
          </div>
          ` : ''}

          ${cfg.receiptShowBarcode !== false ? `
          <div class="divider-dashed"></div>
          <div class="barcode-wrapper">
            ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" class="barcode-img" alt="${cleanTicketBarcode}" />` : ''}
            <div class="barcode-text">${cleanTicketBarcode}</div>
          </div>
          ` : ''}

          ${(cfg.receiptShowDate !== false || cfg.receiptShowCashier !== false) ? `
          <div class="divider-dashed"></div>
          <div class="footer-info">
            <div class="footer-flex">
              <span>Ticket : ${cleanTicketBarcode}</span>
              ${cfg.receiptShowDate !== false ? `<span>${dateFormatted}</span>` : ''}
            </div>
            ${cfg.receiptShowCashier !== false ? `
            <div>
              <span>Caissier : ${caissierName}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}

          ${cfg.receiptFooter ? `
            <div class="divider-dashed"></div>
            <div style="text-align: center; font-size: 11.5px; font-weight: 900; margin-top: 3px;">
              ${cfg.receiptFooter}
            </div>
          ` : ''}

          <div class="cut-space"></div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Génère un Bon de Commande / Facture Achat Fournisseur au format thermique 80mm pour SPRT 80
 */
export function generatePurchaseReceiptHtml({ 
  purchase, 
  settings = null, 
  rotation = null,
  marginLeft = null,
  contentWidth = null
}) {
  const cfg = settings || getPrinterSettings();
  const rot = rotation !== null ? rotation : (cfg.receiptRotation || 0);
  const mLeft = marginLeft !== null ? marginLeft : (cfg.receiptMarginLeft !== undefined ? cfg.receiptMarginLeft : 0);
  const cWidth = contentWidth !== null ? contentWidth : (cfg.receiptContentWidth || 80);
  const isOrder = purchase.typeDocument === 'BON_COMMANDE_ACHAT';
  const docTitle = isOrder ? '★ BON COMMANDE ACHAT ★' : 'FACTURE ACHAT FOURNISSEUR';

  const dateStr = new Date(purchase.dateFactureAchat || purchase.createdAt || Date.now()).toLocaleDateString('fr-DZ');
  const items = Array.isArray(purchase.items) ? purchase.items : [];

  const itemsRows = items.map((it) => `
    <tr>
      <td class="col-name">
        <div class="item-name">${it.nom}</div>
        <div class="item-ref">${it.reference ? `[${it.reference}] ` : ''}<b>${it.quantite}</b> ${it.unite || 'pcs'} × <b>${Number(it.prixAchatUnitaire || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</b></div>
      </td>
      <td class="col-qty"><strong>${it.quantite}</strong></td>
      <td class="col-total"><strong>${Number(it.totalLigne || (it.quantite * it.prixAchatUnitaire) || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <small>DA</small></strong></td>
    </tr>
  `).join('');

  const effectiveCWidth = Math.min(Number(cWidth) || 70, 72);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${docTitle} - ${purchase.numeroFactureAchat}</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #fff;
            color: #000;
            font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.3;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .receipt-wrapper {
            width: ${effectiveCWidth}mm !important;
            max-width: ${effectiveCWidth}mm !important;
            margin-left: ${mLeft ? `${mLeft}mm` : '0mm'} !important;
            margin-right: auto !important;
            padding-left: 0.5mm !important;
            padding-right: 1.5mm !important;
            padding-top: 2mm !important;
            padding-bottom: 4mm !important;
            box-sizing: border-box;
            color: #000;
            text-align: center;
            overflow: hidden !important;
            ${rot !== 0 ? `transform: rotate(${rot}deg); transform-origin: top center;` : ''}
          }
          .header { text-align: center; margin-bottom: 6px; }
          .store-title { font-size: 17px; font-weight: 900; text-transform: uppercase; color: #000; }
          .badge-doc {
            display: inline-block;
            font-size: 13px;
            font-weight: 900;
            border: 2px solid #000;
            padding: 2px 8px;
            margin: 4px 0;
            color: #000;
          }
          .divider { border-top: 1.5px solid #000; margin: 5px 0; }
          .supplier-box {
            border: 1.5px solid #000;
            padding: 4px 6px;
            margin: 5px 0;
            font-size: 11.5px;
            font-weight: 700;
            color: #000;
          }
          table { width: 100% !important; border-collapse: collapse; font-size: 11.5px; color: #000; margin: 5px 0; }
          th { border-top: 1.5px solid #000; border-bottom: 2px solid #000; padding: 4px 1px; font-size: 11px; font-weight: 900; color: #000; text-transform: uppercase; }
          td { padding: 4px 1px; color: #000; }
          .col-name { width: 52%; text-align: left; }
          .col-qty { width: 18%; text-align: center; font-weight: 900; font-size: 12px; }
          .col-total { width: 30%; text-align: right; font-weight: 900; font-size: 12px; white-space: nowrap; }
          .item-name { font-weight: 900; font-size: 12px; color: #000; }
          .item-ref { font-size: 10px; font-weight: 800; color: #000; margin-top: 1px; }
          .total-big {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 16px;
            font-weight: 900;
            border-top: 2.5px solid #000;
            border-bottom: 2.5px solid #000;
            padding: 5px 0;
            margin: 5px 0;
            color: #000;
            white-space: nowrap;
          }
          .total-big span:last-child {
            font-size: 17px;
            font-weight: 900;
          }
          .reste-row {
            font-size: 13.5px;
            font-weight: 900;
            border: 2px solid #000;
            padding: 4px 6px;
            margin: 4px 0;
            color: #000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            white-space: nowrap;
          }
          .reste-row span:last-child {
            font-size: 14.5px;
            font-weight: 900;
          }
          .row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11.5px; font-weight: 800; color: #000; }
          .signature-box {
            margin-top: 10px;
            border-top: 1.5px solid #000;
            padding-top: 4px;
            font-size: 10.5px;
            font-weight: 800;
            display: flex;
            justify-content: space-between;
            color: #000;
          }
          .cut-space { height: 3mm; }
        </style>
      </head>
      <body>
        <div class="receipt-wrapper ${rot !== 0 ? `rotate-${rot}` : ''}">
          <div class="header">
            <div class="store-title">${getStoreName(cfg)}</div>
            <div style="font-size: 10px;">GESTION DES ACHATS & COMMANDES</div>
            <div class="badge-doc">${docTitle}</div>
          </div>

          <div style="font-size: 10.5px;">
            <div class="row">
              <span>N° Achat :</span>
              <strong>${purchase.numeroFactureAchat}</strong>
            </div>
            <div class="row">
              <span>Date :</span>
              <span>${dateStr}</span>
            </div>
          </div>

          <div class="supplier-box">
            <div>Fournisseur : <strong>${purchase.fournisseur}</strong></div>
            ${purchase.contactFournisseur ? `<div>Contact : ${purchase.contactFournisseur}</div>` : ''}
          </div>

          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th class="col-name">Article</th>
                <th class="col-qty">Qté</th>
                <th class="col-total">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="divider"></div>

          <div class="total-big">
            <span>TOTAL ACHAT :</span>
            <span>${Number(purchase.totalTTC || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</span>
          </div>

          <div class="row">
            <span>Montant Réglé :</span>
            <strong>${Number(purchase.montantPaye || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</strong>
          </div>

          ${Number(purchase.montantReste || 0) > 0 ? `
            <div class="row" style="font-weight: bold; color: #b91c1c;">
              <span>Reste Dû Fournisseur :</span>
              <span>${Number(purchase.montantReste || 0).toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</span>
            </div>
          ` : ''}

          <div class="signature-box">
            <div>Visa Réceptionnaire</div>
            <div>Signature Fournisseur</div>
          </div>

          <div class="cut-space"></div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Déclenche l'impression d'une chaîne HTML via Electron IPC ou fallback iframe
 */
export async function printHtmlContent(html, { 
  printerName = '', 
  pageSize = undefined, 
  landscape = false, 
  silent = true, 
  pageRanges = undefined,
  copies = 1,
  margins = undefined 
} = {}) {
  // Always default pageSize to 80mm thermal roll { width: 80000, height: 297000 } if undefined
  const effectivePageSize = pageSize !== undefined ? pageSize : { width: 80000, height: 297000 };

  // 1. Tenter via Electron direct IPC si disponible
  if (window.api && window.api.print && typeof window.api.print.html === 'function') {
    try {
      const res = await window.api.print.html({
        html,
        printerName,
        pageSize: effectivePageSize,
        landscape: Boolean(landscape),
        silent: Boolean(silent),
        pageRanges,
        copies: Number(copies) || 1,
        margins
      });
      return res;
    } catch (e) {
      console.warn('Erreur print.html IPC:', e);
      if (silent) {
        return { success: false, error: e.message };
      }
    }
  }

  // 2. Si le mode silencieux est demandé mais Electron n'est pas disponible, NE PAS ouvrir de popup
  if (silent) {
    return { success: false, error: 'Impression silencieuse nécessite l’application bureau' };
  }

  // 3. Fallback iframe avec window.print UNIQUEMENT si silent === false
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      try {
        iframe.contentWindow.print();
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (e) {}
          resolve({ success: true });
        }, 3000);
      } catch (err) {
        try { document.body.removeChild(iframe); } catch (e) {}
        resolve({ success: false, error: err.message });
      }
    }, 500);
  });
}

/**
 * Génère une Facture / Bon de Commande au format standard A4 élégant et professionnel
 */
export function generateA4InvoiceHtml(invoice, settings = null) {
  const cfg = settings || getPrinterSettings();
  const isOrder = invoice.typeDocument === 'BON_COMMANDE';
  const isInvoice = invoice.typeDocument === 'FACTURE';
  const docTitle = isOrder ? 'BON DE COMMANDE' : isInvoice ? 'FACTURE DE VENTE' : 'TICKET DE CAISSE';

  const dateObj = new Date(invoice.createdAt || invoice.dateFacture || Date.now());
  const dateStr = dateObj.toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + 
                  dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const clientName = invoice.client?.nom || invoice.nomClientLibre || invoice.clientLibre || 'Client Comptoir';
  const clientPhone = invoice.client?.telephone || '';
  const clientAddress = invoice.client?.adresse || '';

  const rawItems = Array.isArray(invoice.items) && invoice.items.length > 0 
    ? invoice.items 
    : (Array.isArray(invoice.lignes) ? invoice.lignes : []);

  const totalHT = Number(invoice.totalHT ?? rawItems.reduce((s, i) => s + (Number(i.quantite || 1) * Number(i.prixUnitaire || 0)), 0) ?? 0);
  const totalTTC = Number(invoice.totalTTC ?? invoice.montantTotal ?? totalHT);
  const montantPaye = Number(invoice.montantPaye ?? totalTTC);
  const montantReste = Number(invoice.montantReste ?? Math.max(0, totalTTC - montantPaye));
  const tauxTva = Number(invoice.tauxTva || 0);
  const montantTva = Number(invoice.montantTva || (tauxTva > 0 ? Math.round(totalHT * (tauxTva / 100) * 100) / 100 : 0));

  const itemsRows = rawItems.map((it, idx) => {
    let name = it.nom || it.designation || it.product_nom || it.product?.nom || it.reference || 'Article';
    if (it.isSerie || (it.piecesParSerie && Number(it.piecesParSerie) > 1)) {
      name += ` (Série de ${it.piecesParSerie || 1} pcs)`;
    }
    const ref = it.reference || it.product?.reference || '-';
    const qty = Number(it.quantite ?? it.qty ?? 1);
    const pu = Number(it.prixUnitaire ?? 0);
    const lineTotal = Number(it.totalLigne ?? (qty * pu));
    const unite = it.unite || 'pcs';
    return `
      <tr>
        <td style="text-align: center; width: 40px; border: 1px solid #cbd5e1; padding: 8px;">${idx + 1}</td>
        <td style="font-family: monospace; width: 110px; border: 1px solid #cbd5e1; padding: 8px;">${ref}</td>
        <td style="font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">${name}</td>
        <td style="text-align: right; width: 110px; border: 1px solid #cbd5e1; padding: 8px;">${pu.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
        <td style="text-align: center; width: 90px; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">${qty} ${unite}</td>
        <td style="text-align: right; width: 130px; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">${lineTotal.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${docTitle} - ${invoice.numeroFacture || 'BC-0001'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            font-size: 13px;
            color: #1e293b;
            background: #ffffff;
            line-height: 1.4;
          }
          .page-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            padding: 5px;
          }
          .header-table {
            width: 100%;
            margin-bottom: 20px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
          }
          .company-title {
            font-size: 22px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .company-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .doc-badge {
            display: inline-block;
            background: #2563eb;
            color: #ffffff;
            font-weight: 900;
            font-size: 15px;
            padding: 5px 14px;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          .doc-meta {
            text-align: right;
            margin-top: 6px;
            font-size: 12px;
            color: #334155;
          }
          .info-grid {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 20px;
          }
          .info-box {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
          }
          .info-box-title {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
          }
          .info-box-content {
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .items-table th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 800;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 9px 10px;
            border: 1px solid #cbd5e1;
          }
          .items-table td {
            padding: 8px 10px;
            font-size: 12.5px;
          }
          .items-table tr:nth-child(even) td {
            background: #f8fafc;
          }
          .totals-wrapper {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
          }
          .totals-table {
            width: 320px;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 6px 12px;
            font-size: 13px;
          }
          .totals-table tr.total-ttc td {
            background: #0f172a;
            color: #ffffff;
            font-size: 16px;
            font-weight: 900;
            border-radius: 6px;
            padding: 10px 12px;
          }
          .footer-section {
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .signature-box {
            width: 200px;
            text-align: center;
            border-top: 1px solid #64748b;
            padding-top: 5px;
            font-size: 11px;
            font-weight: bold;
            color: #475569;
          }
          .qr-box {
            text-align: center;
          }
          .qr-box img {
            width: 80px;
            height: 80px;
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <table class="header-table">
            <tr>
              <td style="vertical-align: top;">
                <div class="company-title">${getStoreName(cfg)}</div>
                <div class="company-sub">${cfg.storeAddress || 'Commerce & Distribution'} ${cfg.storePhone ? '• Tél: ' + cfg.storePhone : ''}</div>
              </td>
              <td style="vertical-align: top; text-align: right;">
                <div class="doc-badge">${docTitle}</div>
                <div class="doc-meta">
                  <div><strong>N° : </strong><span style="font-family: monospace; font-size: 13px; font-weight: bold;">${invoice.numeroFacture || ''}</span></div>
                  <div><strong>Date : </strong>${dateStr}</div>
                  <div><strong>Caisse : </strong>${invoice.caisse || 'Caisse 1'}</div>
                </div>
              </td>
            </tr>
          </table>

          <div class="info-grid">
            <div class="info-box">
              <div class="info-box-title">Client / Destinataire</div>
              <div class="info-box-content">${clientName}</div>
              ${clientPhone ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Tél: ${clientPhone}</div>` : ''}
              ${clientAddress ? `<div style="font-size: 11px; color: #475569;">Adresse: ${clientAddress}</div>` : ''}
            </div>

            <div class="info-box">
              <div class="info-box-title">Règlement & Modalités</div>
              <div class="info-box-content">
                Mode: ${invoice.modePaiement === 'ESPECES' ? 'Espèces' : invoice.modePaiement === 'A_CREDIT' ? 'À Crédit' : (invoice.modePaiement || 'Espèces')}
              </div>
              <div style="font-size: 11px; color: ${invoice.statutPaiement === 'PAYE' ? '#16a34a' : '#d97706'}; font-weight: bold; margin-top: 2px;">
                Statut: ${invoice.statutPaiement === 'PAYE' ? 'Réglé intégralement' : invoice.statutPaiement === 'PARTIEL' ? 'Partiellement réglé' : 'Non réglé'}
              </div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Réf</th>
                <th>Désignation</th>
                <th style="text-align: right;">Prix Unit.</th>
                <th style="text-align: center;">Quantité</th>
                <th style="text-align: right;">Total Ligne</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals-wrapper">
            <table class="totals-table">
              ${tauxTva > 0 ? `
                <tr>
                  <td style="color: #64748b; font-weight: bold;">Total HT :</td>
                  <td style="text-align: right; font-weight: bold;">${totalHT.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: bold;">TVA (${tauxTva}%) :</td>
                  <td style="text-align: right; font-weight: bold;">${montantTva.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
                </tr>
              ` : ''}
              <tr class="total-ttc">
                <td>TOTAL NET :</td>
                <td style="text-align: right;">${totalTTC.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
              </tr>
              <tr>
                <td style="padding-top: 8px; color: #475569;">Montant Réglé :</td>
                <td style="padding-top: 8px; text-align: right; font-weight: bold;">${montantPaye.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
              </tr>
              ${montantReste > 0 ? `
                <tr>
                  <td style="color: #dc2626; font-weight: 900;">Reste à Payer :</td>
                  <td style="text-align: right; color: #dc2626; font-weight: 900;">${montantReste.toLocaleString('fr-DZ', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DA</td>
                </tr>
              ` : ''}
            </table>
          </div>

          <!-- Message de fin au centre du document -->
          <div style="text-align: center; margin: 25px auto 15px auto; padding: 10px 16px; border-top: 2px dashed #cbd5e1; border-bottom: 2px dashed #cbd5e1; font-size: 14px; font-weight: 900; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px;">
            ★ ${cfg.receiptFooterMessage || 'MERCI DE VOTRE VISITE ET À BIENTÔT !'} ★
          </div>

          <div class="footer-section">
            <div class="signature-box">
              Cachet & Signature
            </div>

            ${invoice.qrCodeImage ? `
              <div class="qr-box">
                <img src="${invoice.qrCodeImage}" alt="QR" />
                <div style="font-size: 9px; color: #94a3b8; font-family: monospace;">Document certifié</div>
              </div>
            ` : '<div style="font-size: 11px; color: #94a3b8; font-style: italic;">Merci de votre confiance !</div>'}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Exporte directement une facture ou bon de commande en fichier PDF
 */
export async function exportInvoiceToPdf(invoice, { format = 'A4', settings = null } = {}) {
  try {
    const rawNumber = invoice.numeroFacture || 'Document';
    const cleanNumber = String(rawNumber).replace(/[\\/:*?"<>|]/g, '-');
    const defaultFilename = `${cleanNumber}.pdf`;

    const html = format === 'ticket' 
      ? generateReceiptHtml({ invoice, settings }) 
      : generateA4InvoiceHtml(invoice, settings);

    if (window.api && window.api.print && typeof window.api.print.toPdf === 'function') {
      const res = await window.api.print.toPdf({
        html,
        defaultFilename,
        pageSize: format === 'ticket' ? { width: 80000, height: 297000 } : 'A4',
        landscape: false
      });
      return res;
    }

    // Fallback navigateur : impression fenêtre
    const printRes = await printHtmlContent(html, { pageSize: 'A4' });
    return printRes;
  } catch (err) {
    console.error('Erreur exportInvoiceToPdf:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Exporte un contenu HTML (Achat, Situation Client / Fournisseur, Pertes) en fichier PDF officiel
 */
export async function exportHtmlToPdf(html, defaultFilename = 'Document.pdf', pageSize = 'A4') {
  try {
    const cleanFilename = String(defaultFilename).replace(/[\\/:*?"<>|]/g, '-');
    const finalFilename = cleanFilename.toLowerCase().endsWith('.pdf') ? cleanFilename : `${cleanFilename}.pdf`;

    if (window.api && window.api.print && typeof window.api.print.toPdf === 'function') {
      const res = await window.api.print.toPdf({
        html,
        defaultFilename: finalFilename,
        pageSize,
        landscape: false
      });
      return res;
    }

    const printRes = await printHtmlContent(html, { pageSize });
    return printRes;
  } catch (err) {
    console.error('Erreur exportHtmlToPdf:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Génère le reçu de Situation / Relevé de compte (Client ou Fournisseur) au format thermique 80mm pour SPRT 80
 */
export function generateSituationReceiptHtml({
  entityType = 'CLIENT', // 'CLIENT' | 'FOURNISSEUR'
  entity = {},
  movements = [],
  invoices = [],
  settings = null
}) {
  const cfg = settings || getPrinterSettings();
  const cWidth = cfg.receiptContentWidth ? Math.min(Number(cfg.receiptContentWidth), 72) : 70;
  const isClient = entityType === 'CLIENT';
  const solde = Number(entity?.soldeDette || 0);

  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}-${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const rowsHtml = (invoices || []).slice(0, 20).map((inv) => {
    const d = new Date(inv.dateFacture || inv.dateFactureAchat || inv.createdAt || Date.now());
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const num = String(inv.numeroFacture || inv.numeroFactureAchat || '').trim();
    const ttc = formatCurrencyDz(Number(inv.totalTTC || 0), cfg.receiptDecimals);
    const reste = Number(inv.montantReste !== undefined ? inv.montantReste : (Number(inv.totalTTC || 0) - Number(inv.montantPaye || 0)));
    const resteStr = reste > 0 ? formatCurrencyDz(reste, cfg.receiptDecimals) : '-';
    return `
      <tr>
        <td style="padding: 2.5px 0;">${dateStr}</td>
        <td style="padding: 2.5px 0; font-weight: 900;">${num}</td>
        <td style="padding: 2.5px 0; text-align: right;">${ttc}</td>
        <td style="padding: 2.5px 0; text-align: right; color: ${reste > 0 ? '#b91c1c' : '#000'}; font-weight: 900;">${resteStr}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Situation ${isClient ? 'Client' : 'Fournisseur'} - ${entity?.nom || ''}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            margin: 0; padding: 0; background: #fff; color: #000;
            font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px; font-weight: 900; line-height: 1.25;
          }
          .container {
            width: ${cWidth}mm; max-width: 100%; margin: 0 auto; padding: 3mm 1mm;
          }
          .divider { border-top: 1.5px dashed #000; margin: 4px 0; }
          .center { text-align: center; }
          .title { font-size: 13px; font-weight: 900; text-transform: uppercase; margin: 3px 0; }
          .solde-box {
            border: 2px solid #000; padding: 6px; text-align: center; margin: 5px 0;
          }
          .solde-val { font-size: 18px; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { border-bottom: 1px solid #000; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="center">
            <div style="font-size: 15px; font-weight: 900;">${getStoreName(cfg)}</div>
            ${cfg.storePhone ? `<div style="font-size: 11px;">Tél: ${cfg.storePhone}</div>` : ''}
            <div class="title">★ SITUATION ${isClient ? 'CLIENT' : 'FOURNISSEUR'} ★</div>
          </div>
          <div class="divider"></div>
          <div style="font-size: 12px;">
            <div>${isClient ? 'Client' : 'Fournisseur'} : <b>${(entity?.nom || '').toUpperCase()}</b></div>
            ${entity?.telephone ? `<div>Tél : ${entity.telephone}</div>` : ''}
            ${entity?.adresse ? `<div>Adresse : ${entity.adresse}</div>` : ''}
          </div>
          <div class="solde-box">
            <div style="font-size: 10.5px; text-transform: uppercase;">SOLDE DETTE ACTUEL</div>
            <div class="solde-val">${formatCurrencyDz(solde, cfg.receiptDecimals)} DA</div>
            <div style="font-size: 10px;">${solde > 0 ? '(MONTANT DÛ / À RÉGLER)' : '(COMPTE À JOUR)'}</div>
          </div>
          ${invoices && invoices.length > 0 ? `
            <div class="divider"></div>
            <div style="font-size: 11px; font-weight: 900; margin-bottom: 3px;">HISTORIQUE DES DERNIERS BONS :</div>
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">Date</th>
                  <th style="text-align: left;">N° Bon</th>
                  <th style="text-align: right;">Total</th>
                  <th style="text-align: right;">Reste</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          ` : ''}
          <div class="divider"></div>
          <div style="font-size: 10.5px; display: flex; justify-content: space-between;">
            <span>Édité le : ${dateFormatted}</span>
          </div>
          <div class="center" style="margin-top: 6px; font-size: 10px;">
            ${cfg.receiptFooter || 'Merci pour votre confiance !'}
          </div>
          <div style="height: 6mm;"></div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Génère le document HTML imprimable pour la Fiche de Mouvements d'un Produit
 */
export function generateProductMovementHtml({
  product,
  movements = [],
  stats = {},
  periodLabel = 'Tout l’historique',
  format = 'a4',
  settings = null
}) {
  const cfg = settings || getPrinterSettings();
  const storeName = getStoreName(cfg);
  const now = new Date().toLocaleString('fr-DZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const is80mm = format === '80mm';

  const rowsHtml = (movements || []).map((m) => {
    const isPos = Number(m.quantite || 0) > 0;
    const dateStr = new Date(m.dateMouvement || m.createdAt).toLocaleString('fr-DZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const typeLabel = (m.type || '').replace(/_/g, ' ');
    const qtyStr = isPos ? `+${m.quantite}` : `${m.quantite}`;

    if (is80mm) {
      return `
        <tr style="border-bottom: 1px dotted #ccc;">
          <td style="padding: 3px 0;">
            <div style="font-weight: bold; font-size: 10px;">${typeLabel} (${qtyStr})</div>
            <div style="font-size: 9px; color: #666;">${dateStr} | ${m.referenceDocument || '-'}</div>
            <div style="font-size: 9px; color: #444;">${m.quantiteAvant} → <strong>${m.quantiteApres}</strong> | ${m.motif || ''}</div>
          </td>
        </tr>
      `;
    }

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; white-space: nowrap; color: #475569;">${dateStr}</td>
        <td style="padding: 6px 8px; font-weight: bold;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; background: ${
            m.type === 'ACHAT_FOURNISSEUR' ? '#dbeafe; color: #1e40af;' :
            m.type === 'VENTE' ? '#f3e8ff; color: #6b21a8;' :
            m.type === 'RETOUR_VENTE' ? '#dcfce7; color: #166534;' :
            (m.type === 'PIECE_REPARATION_SAV' || m.type === 'SORTIE_REPARATION') ? '#fef3c7; color: #92400e;' :
            (m.type === 'ANNULATION_REPARATION' || m.type === 'RETOUR_SAV') ? '#e0f2fe; color: #0369a1;' :
            m.type === 'PERTE' ? '#fee2e2; color: #991b1b;' :
            '#f1f5f9; color: #334155;'
          }">${typeLabel}</span>
        </td>
        <td style="padding: 6px 8px; font-family: monospace; font-size: 10px; color: #2563eb;">${m.referenceDocument || '-'}</td>
        <td style="padding: 6px 8px; color: #475569;">${m.fournisseur || m.tiers || '-'}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: 900; color: ${isPos ? '#16a34a' : '#dc2626'};">
          ${qtyStr} ${product?.unite || 'pcs'}
        </td>
        <td style="padding: 6px 8px; text-align: center; font-family: monospace; color: #64748b;">
          ${m.quantiteAvant} → <strong style="color: #0f172a;">${m.quantiteApres}</strong>
        </td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold;">
          ${Number(m.prixAchatUnitaire || 0) > 0 ? `${Number(m.prixAchatUnitaire).toLocaleString('fr-DZ')} DA` : '-'}
        </td>
        <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">${m.motif || '-'}</td>
      </tr>
    `;
  }).join('');

  if (is80mm) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 6px; width: 72mm; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: 900; }
            .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 14px;">${storeName}</div>
          <div class="center" style="font-size: 11px;">FICHE MOUVEMENTS PRODUIT</div>
          <div class="divider"></div>
          <div style="font-size: 11px; font-weight: bold;">${product?.nom || 'Article'}</div>
          <div style="font-size: 10px; color: #444;">Réf: ${product?.reference || '-'} | Barcode: ${product?.codeBarre || '-'}</div>
          <div style="font-size: 10px; color: #444;">Période: ${periodLabel}</div>
          <div class="divider"></div>
          <div style="font-size: 10px;">
            <div>Stock Initial : <strong>${stats.initialStock ?? '-'}</strong></div>
            <div>Total Entrées (+) : <strong style="color: green;">+${stats.totalEntries || 0}</strong></div>
            <div>Total Sorties (-) : <strong style="color: red;">-${stats.totalExits || 0}</strong></div>
            <div>Stock Actuel : <strong>${product?.quantite || 0} ${product?.unite || 'pcs'}</strong></div>
          </div>
          <div class="divider"></div>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="divider"></div>
          <div class="center" style="font-size: 9px;">Édité le ${now}</div>
        </body>
      </html>
    `;
  }

  // Format A4 Professionnel
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Mouvements - ${product?.nom || 'Produit'}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 12px; }
          .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
          .subtitle { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px; }
          .product-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 15px; margin-bottom: 15px; display: flex; justify-content: space-between; }
          .kpi-container { display: flex; gap: 10px; margin-bottom: 15px; }
          .kpi-box { flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
          .kpi-val { font-size: 16px; font-weight: 900; margin-top: 4px; }
          .kpi-lbl { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          th { background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 8px; text-align: left; }
          .footer { margin-top: 25px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <div class="title">${storeName}</div>
            <div class="subtitle">FICHE HISTORIQUE DES MOUVEMENTS DE STOCK</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 900; font-size: 11px;">Période : ${periodLabel}</div>
            <div style="font-size: 10px; color: #64748b;">Édité le : ${now}</div>
          </div>
        </div>

        <div class="product-card">
          <div>
            <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${product?.nom || 'Article'}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
              Réf : <strong>${product?.reference || '-'}</strong> | Code-barres : <strong>${product?.codeBarre || '-'}</strong> | Catégorie : <strong>${product?.categorie || '-'}</strong>
            </div>
            ${product?.emplacement ? `<div style="font-size: 11px; color: #64748b;">Emplacement : <strong>${product.emplacement}</strong></div>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #64748b;">Stock Actuel :</div>
            <div style="font-size: 18px; font-weight: 900; color: #0284c7;">
              ${product?.quantite || 0} ${product?.unite || 'pcs'}
            </div>
            <div style="font-size: 10px; color: #64748b;">
              P.A : ${(product?.prixAchat || 0).toLocaleString('fr-DZ')} DA | P.V : ${(product?.prixVente || 0).toLocaleString('fr-DZ')} DA
            </div>
          </div>
        </div>

        <div class="kpi-container">
          <div class="kpi-box">
            <div class="kpi-lbl">Stock Initial</div>
            <div class="kpi-val" style="color: #475569;">${stats.initialStock ?? '-'}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-lbl">Total Entrées (+)</div>
            <div class="kpi-val" style="color: #16a34a;">+${stats.totalEntries || 0}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-lbl">Total Sorties (-)</div>
            <div class="kpi-val" style="color: #dc2626;">-${stats.totalExits || 0}</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-lbl">Variation Nette</div>
            <div class="kpi-val" style="color: ${(stats.netVariation || 0) >= 0 ? '#16a34a' : '#dc2626'};">
              ${(stats.netVariation || 0) > 0 ? '+' : ''}${stats.netVariation || 0}
            </div>
          </div>
          <div class="kpi-box">
            <div class="kpi-lbl">Mouvements</div>
            <div class="kpi-val" style="color: #0284c7;">${movements.length}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date & Heure</th>
              <th>Opération</th>
              <th>Réf Document</th>
              <th>Tiers</th>
              <th style="text-align: center;">Variation</th>
              <th style="text-align: center;">Avant → Après</th>
              <th style="text-align: right;">P.U (DA)</th>
              <th>Motif / Justificatif</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #94a3b8;">Aucun mouvement enregistré sur cette période.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          <div>Document généré automatiquement par Commerce Pro • Logiciel de Gestion Commerciale</div>
          <div>Page 1 / 1</div>
        </div>
      </body>
    </html>
  `;
}
