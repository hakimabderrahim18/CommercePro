import { 
  createBarcodeDataUrl, 
  getPrinterSettings, 
  formatCurrencyDz, 
  getStoreName, 
  LABEL_FORMATS, 
  printHtmlContent 
} from './printerHelper';

/**
 * Génère le code HTML pour l'étiquette produit thermique (à coller sur l'appareil à réparer)
 * Conçu strictement pour tenir sur 1 SEULE ÉTIQUETTE (45x35, 50x30, 40x30, 30x30 mm) sans saut de page.
 */
export function generateRepairLabelHtml(rep, options = {}) {
  const opts = typeof options === 'string' ? { format: options } : (options || {});
  const {
    format = '45x35',
    customWidth = null,
    customHeight = null,
    offsetX = null,
    settings = null,
    copies = 1
  } = opts;

  const cfg = settings || getPrinterSettings();
  const fmt = (LABEL_FORMATS && LABEL_FORMATS[format]) || { width: 45, height: 35 };
  const widthMm = Number(customWidth || fmt.width || 45);
  const heightMm = Number(customHeight || fmt.height || 35);
  const effectiveOffsetX = offsetX !== null && offsetX !== undefined ? Number(offsetX) : (cfg.labelOffsetX ? Number(cfg.labelOffsetX) : 0);

  const storeHeader = (getStoreName(cfg) || 'SAV ATELIER').toUpperCase();
  const repNum = (rep?.numeroReparation || 'REP-0001').trim();
  const clientNom = (rep?.clientNom || 'Client Comptoir').trim();
  const clientTel = (rep?.clientTelephone || '').trim();
  const appareil = [rep?.appareilType, rep?.marque, rep?.modele].filter(Boolean).join(' ').trim() || 'Appareil';
  const pin = (rep?.motDePasseAppareil || '').trim();
  const sn = (rep?.numeroSerie || '').trim();
  const panne = (rep?.panneDeclaree || 'Diagnostic requis').trim();
  const dateStr = new Date(rep?.dateReception || Date.now()).toLocaleDateString('fr-DZ', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Hauteur du code-barres compacte pour laisser un maximum d'espace aux coordonnées complètes
  const barHeight = heightMm <= 30 ? 18 : (heightMm <= 35 ? 20 : 25);
  const barcodeUrl = createBarcodeDataUrl(repNum, { 
    width: 1.5, 
    height: barHeight, 
    margin: 2 
  });

  const totalCopies = Math.max(1, Number(copies) || 1);
  const pagesHtml = [];

  for (let i = 0; i < totalCopies; i++) {
    pagesHtml.push(`
      <div class="label-page">
        <!-- En-tête : Nom du Magasin / Atelier -->
        <div class="label-header">
          <span class="store-title">${storeHeader}</span>
          <span class="date-badge">${dateStr}</span>
        </div>

        <!-- Numéro de réparation -->
        <div class="rep-num">${repNum}</div>

        <!-- Code-barres scannable compact -->
        ${barcodeUrl ? `
          <div class="barcode-container">
            <img src="${barcodeUrl}" class="barcode-img" alt="${repNum}" />
          </div>
        ` : ''}

        <!-- Détails appareil et client (100% complets sans coupure ni "...") -->
        <div class="details-box">
          <div class="detail-row">
            <span class="label-key">Client :</span>
            <span class="label-val font-bold">${clientNom}</span>
          </div>
          ${clientTel ? `
            <div class="detail-row">
              <span class="label-key">Tél :</span>
              <span class="label-val font-bold font-mono">${clientTel}</span>
            </div>
          ` : ''}
          <div class="detail-row">
            <span class="label-key">Appareil :</span>
            <span class="label-val font-bold">${appareil}</span>
          </div>
          ${(pin || sn) ? `
            <div class="detail-row">
              ${pin ? `<span class="label-key">PIN: <strong style="color:#000;">${pin}</strong></span>` : ''}
              ${(pin && sn) ? `<span style="margin: 0 4px; color:#555;">|</span>` : ''}
              ${sn ? `<span class="label-key">S/N: <strong>${sn}</strong></span>` : ''}
            </div>
          ` : ''}
          <div class="detail-row panne-row">
            <span class="label-key">Panne :</span>
            <span class="label-val font-medium">${panne}</span>
          </div>
        </div>
      </div>
    `);
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiquette - ${repNum}</title>
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          }
          html, body {
            background: #fff;
            margin: 0 !important;
            padding: 0 !important;
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            overflow: hidden !important;
          }
          .label-page {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            max-width: ${widthMm}mm;
            max-height: ${heightMm}mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 1mm 1.5mm 0.8mm 1.5mm;
            ${effectiveOffsetX ? `margin-left: ${effectiveOffsetX}mm;` : ''}
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .label-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .label-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #000;
            padding-bottom: 0.4mm;
            margin-bottom: 0.4mm;
            font-size: 8.5px;
            line-height: 1;
          }
          .store-title {
            font-weight: 900;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            max-width: 65%;
          }
          .date-badge {
            font-size: 7.5px;
            font-weight: 700;
          }
          .rep-num {
            font-size: 10.5px;
            font-weight: 900;
            text-align: center;
            letter-spacing: 0.8px;
            margin: 0.3mm 0;
            line-height: 1;
          }
          .barcode-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 auto 0.4mm auto;
            max-width: 95%;
          }
          .barcode-img {
            max-width: 100%;
            height: ${barHeight}px;
            object-fit: contain;
            display: block;
          }
          .details-box {
            border-top: 1px dashed #000;
            padding-top: 0.6mm;
            margin-top: 0.3mm;
            display: flex;
            flex-direction: column;
            gap: 0.4mm;
            width: 100%;
          }
          .detail-row {
            display: flex;
            align-items: baseline;
            font-size: ${heightMm <= 30 ? '8px' : '8.5px'};
            line-height: 1.15;
            word-break: break-word;
            white-space: normal;
            width: 100%;
          }
          .label-key {
            font-weight: 800;
            margin-right: 3px;
            flex-shrink: 0;
            white-space: nowrap;
          }
          .label-val {
            font-weight: 700;
            word-break: break-word;
            white-space: normal;
            flex: 1;
          }
          .font-bold {
            font-weight: 800 !important;
          }
          .font-mono {
            font-family: monospace, Arial, sans-serif !important;
            letter-spacing: 0.3px;
          }
          .font-medium {
            font-weight: 600 !important;
          }
          .panne-row {
            font-size: ${heightMm <= 30 ? '7.5px' : '8px'};
            line-height: 1.1;
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
 * Imprime l'étiquette directement sur l'imprimante d'étiquettes (Xprinter XP-350B)
 * avec dimensions précises au micromètre pour caler le rouleau sans saut intempestif.
 */
export async function printRepairLabel(rep, options = {}) {
  const {
    format = '45x35',
    customWidth = null,
    customHeight = null,
    offsetX = null,
    copies = 1,
    silent = true,
    settings = null
  } = options;

  const cfg = settings || getPrinterSettings();
  const fmt = (LABEL_FORMATS && LABEL_FORMATS[format]) || { width: 45, height: 35 };
  const widthMm = Number(customWidth || fmt.width || 45);
  const heightMm = Number(customHeight || fmt.height || 35);

  const html = generateRepairLabelHtml(rep, {
    format,
    customWidth: widthMm,
    customHeight: heightMm,
    offsetX,
    settings: cfg,
    copies
  });

  return await printHtmlContent(html, {
    printerName: cfg.labelPrinter || '',
    pageSize: {
      width: Math.round(widthMm * 1000),
      height: Math.round(heightMm * 1000)
    },
    landscape: false,
    silent: silent !== undefined ? silent : true,
    copies: 1 // Les copies sont déjà incluses dans les pages HTML
  });
}

/**
 * Génère le Bon de Prise en Charge / Réception (Reçu client à la dépose)
 */
export function generateRepairReceiptHtml(rep, settings = null) {
  const cfg = settings || getPrinterSettings();
  const barcodeUrl = createBarcodeDataUrl(rep.numeroReparation || 'REP-0001', { width: 2, height: 40 });
  const dateObj = new Date(rep.dateReception || Date.now());
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const dateStr = `${day}/${month}/${year} à ${hours}:${minutes}`;

  const devis = Number(rep.estimationDevis || 0);
  const acompte = Number(rep.acomptePaye || 0);
  const reste = Math.max(0, devis - acompte);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Bon de Prise en Charge - ${rep.numeroReparation}</title>
        <style>
          @page { margin: 0; size: auto; }
          * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; font-family: Arial, "Helvetica Neue", sans-serif; -webkit-print-color-adjust: exact !important; }
          body { width: 70mm !important; max-width: 70mm !important; margin: 0 auto !important; padding: 2mm 1mm; background: #fff; font-size: 12px; font-weight: 900 !important; line-height: 1.25; overflow: hidden !important; }
          .text-center { text-align: center; }
          .logo-wrapper { text-align: center; margin: 0 auto 4px auto; }
          .store-logo-img { max-width: 130px; max-height: 65px; object-fit: contain; margin: 0 auto; display: block; filter: grayscale(100%); }
          .store-title { font-size: 18px; font-weight: 900 !important; text-transform: uppercase; margin-bottom: 1px; }
          .store-sub { font-size: 13px; font-weight: 900 !important; text-transform: uppercase; margin-bottom: 2px; }
          .store-contact { font-size: 11.5px; font-weight: 900 !important; }
          .doc-title { font-size: 14.5px; font-weight: 900 !important; text-transform: uppercase; margin: 4px 0 2px 0; letter-spacing: 0.5px; }
          .rep-num { font-size: 16px; font-weight: 900 !important; letter-spacing: 1px; margin-bottom: 2px; }
          .divider-dashed { width: 100%; border-top: 1.5px dashed #000; margin: 4px 0; font-size: 0; }
          .section-title { font-size: 12px; font-weight: 900 !important; text-transform: uppercase; margin-bottom: 2px; text-decoration: underline; }
          .info-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5px 0; font-size: 12px; }
          .info-label { font-weight: 900 !important; text-transform: uppercase; }
          .info-val { font-weight: 900 !important; text-align: right; }
          .box-text { background: #f8fafc; border: 1px solid #000; padding: 4px; font-size: 12px; font-weight: 900 !important; margin: 2px 0 4px 0; text-align: left; }
          .totals-table { width: 100%; border-collapse: collapse; margin: 3px 0; }
          .totals-table td { padding: 2px 0; font-size: 13px; font-weight: 900 !important; }
          .barcode-wrapper { text-align: center; margin: 6px auto 3px auto; }
          .barcode-img { max-width: 85%; height: 40px; object-fit: contain; margin: 0 auto; display: block; }
          .barcode-num { font-family: monospace; font-size: 13px; letter-spacing: 1.5px; margin-top: 2px; }
          .clauses { font-size: 10px; font-weight: 800 !important; text-align: justify; line-height: 1.25; margin-top: 4px; }
          .signature-box { display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; font-weight: 900 !important; }
          .sign-line { width: 45%; height: 35px; border-bottom: 1px solid #000; margin-top: 2px; }
          .cut-space { height: 5mm; }
        </style>
      </head>
      <body>
        ${(cfg.showReceiptLogo && cfg.storeLogo) ? `
          <div class="logo-wrapper">
            <img src="${cfg.storeLogo}" alt="Logo" class="store-logo-img" />
          </div>
        ` : ''}

        <div class="text-center">
          <div class="store-title">${cfg.storeName || 'COMMERCE PRO'}</div>
          ${cfg.storeSubtitle ? `<div class="store-sub">${cfg.storeSubtitle}</div>` : ''}
          ${cfg.storeAddress ? `<div class="store-contact">${cfg.storeAddress}</div>` : ''}
          ${cfg.storeCity ? `<div class="store-contact">${cfg.storeCity}</div>` : ''}
          ${cfg.storePhone ? `<div class="store-contact">Tél: ${cfg.storePhone}</div>` : ''}
        </div>

        <div class="divider-dashed"></div>

        <div class="text-center">
          <div class="doc-title">★ BON DE PRISE EN CHARGE SAV ★</div>
          <div class="rep-num">N° : ${rep.numeroReparation}</div>
          <div style="font-size: 11.5px; font-weight: 900;">Date de dépôt : ${dateStr}</div>
        </div>

        <div class="divider-dashed"></div>

        <!-- Informations Client -->
        <div>
          <div class="section-title">1. INFORMATIONS DU CLIENT</div>
          <div class="info-row">
            <span class="info-label">Nom :</span>
            <span class="info-val">${(rep.clientNom || 'Client Comptoir').toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Téléphone :</span>
            <span class="info-val">${rep.clientTelephone || '-'}</span>
          </div>
          ${rep.clientAdresse ? `
            <div class="info-row">
              <span class="info-label">Adresse :</span>
              <span class="info-val">${rep.clientAdresse}</span>
            </div>
          ` : ''}
        </div>

        <div class="divider-dashed"></div>

        <!-- Fiche Technique de l'Appareil -->
        <div>
          <div class="section-title">2. FICHE TECHNIQUE APPAREIL</div>
          <div class="info-row">
            <span class="info-label">Appareil :</span>
            <span class="info-val">${rep.appareilType || 'Téléphone'} ${rep.marque || ''} ${rep.modele || ''}</span>
          </div>
          ${rep.numeroSerie ? `
            <div class="info-row">
              <span class="info-label">S/N ou IMEI :</span>
              <span class="info-val font-mono">${rep.numeroSerie}</span>
            </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Code / PIN / Schéma :</span>
            <span class="info-val">${rep.motDePasseAppareil || 'Non verrouillé'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Accessoires laissés :</span>
            <span class="info-val">${rep.accessoires || 'Appareil seul'}</span>
          </div>
          ${rep.etatAppareil ? `
            <div class="info-row">
              <span class="info-label">État physique :</span>
              <span class="info-val">${rep.etatAppareil}</span>
            </div>
          ` : ''}
        </div>

        <div class="divider-dashed"></div>

        <!-- Panne et Diagnostic -->
        <div>
          <div class="section-title">3. PANNE & DIAGNOSTIC DÉCLARÉ</div>
          <div class="box-text">
            <b>Panne signalée :</b> ${rep.panneDeclaree || 'Diagnostic complet requis'}
          </div>
          ${rep.diagnostic ? `
            <div class="box-text" style="margin-top: 2px;">
              <b>Diagnostic atelier :</b> ${rep.diagnostic}
            </div>
          ` : ''}
        </div>

        <div class="divider-dashed"></div>

        <!-- Devis et Acompte Financier -->
        <div>
          <div class="section-title">4. ESTIMATION FINANCIÈRE</div>
          <table class="totals-table">
            <tr>
              <td>Estimation devis :</td>
              <td style="text-align: right;">${formatCurrencyDz(devis)} DA</td>
            </tr>
            <tr>
              <td>Acompte versé à la dépose :</td>
              <td style="text-align: right;">${formatCurrencyDz(acompte)} DA</td>
            </tr>
            <tr style="border-top: 1.5px dashed #000;">
              <td style="padding-top: 2px;">Reste estimé à payer :</td>
              <td style="text-align: right; padding-top: 2px; font-size: 14px;">${formatCurrencyDz(reste)} DA</td>
            </tr>
          </table>
        </div>

        <div class="divider-dashed"></div>

        <div class="barcode-wrapper">
          ${barcodeUrl ? `<img src="${barcodeUrl}" class="barcode-img" alt="${rep.numeroReparation}" />` : ''}
          <div class="barcode-num">${rep.numeroReparation}</div>
        </div>

        <div class="clauses">
          <b>CONDITIONS SAV :</b><br/>
          • Reçu obligatoire pour la restitution de l'appareil.<br/>
          • L'atelier décline toute responsabilité pour les données personnelles.<br/>
          • Tout appareil non récupéré après 30 jours fera l'objet de frais de garde.
        </div>

        <div class="signature-box">
          <div>
            <div>Signature Client :</div>
            <div class="sign-line"></div>
          </div>
          <div style="text-align: right;">
            <div>Cachet Atelier :</div>
            <div class="sign-line" style="margin-left: auto;"></div>
          </div>
        </div>

        <div class="cut-space"></div>
      </body>
    </html>
  `;
}

/**
 * Génère le Bon de Livraison / Restitution & Facture SAV (Remise appareil au client ou Bon de retour)
 */
export function generateRepairDeliveryHtml(rep, isReturn = false, settings = null) {
  const cfg = settings || getPrinterSettings();
  const barcodeUrl = createBarcodeDataUrl(rep.numeroReparation || 'REP-0001', { width: 2, height: 40 });
  const dateObj = new Date(rep.dateLivraison || Date.now());
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const dateStr = `${day}/${month}/${year} à ${hours}:${minutes}`;

  let userStoredName = '';
  try {
    const rawUser = localStorage.getItem('commercepost_auth_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      userStoredName = u?.nom || u?.username || '';
    }
  } catch (e) {}

  const pieces = rep.pieces || [];
  let totalPieces = 0;

  const piecesRows = pieces.map((p) => {
    const qte = isReturn ? -Math.abs(p.quantite || 1) : (p.quantite || 1);
    const pu = Number(p.prixUnitaire || 0);
    const tot = qte * pu;
    totalPieces += tot;

    return `
      <tr>
        <td colspan="4" style="padding-top: 3px; font-size: 12px; font-weight: 900; text-align: left;">
          ${(p.nom || 'Pièce de rechange').toUpperCase()}
        </td>
      </tr>
      <tr style="border-bottom: 1px dotted #999;">
        <td style="width: 40%;"></td>
        <td style="width: 15%; text-align: center; font-weight: 900;">${qte}</td>
        <td style="width: 22%; text-align: right; font-weight: 900;">${formatCurrencyDz(pu)}</td>
        <td style="width: 23%; text-align: right; font-weight: 900;">${formatCurrencyDz(tot)}</td>
      </tr>
    `;
  }).join('');

  const coutMainOeuvre = Number(rep.coutMainOeuvre || 0);
  const totalTTC = Number(rep.totalTTC || (totalPieces + coutMainOeuvre));
  const acompte = Number(rep.acomptePaye || 0);
  const netAPayer = Math.max(0, totalTTC - acompte);
  const montantPaye = Number(rep.montantPaye || netAPayer);
  const soldeRestant = Number(rep.montantReste ?? Math.max(0, totalTTC - acompte - montantPaye));

  const docTitle = isReturn ? 'BON DE RETOUR SAV (AVOIR)' : 'BON DE LIVRAISON & RESTITUTION SAV';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${docTitle} - ${rep.numeroReparation}</title>
        <style>
          @page { margin: 0; size: auto; }
          * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; font-family: Arial, "Helvetica Neue", sans-serif; -webkit-print-color-adjust: exact !important; }
          body { width: 70mm !important; max-width: 70mm !important; margin: 0 auto !important; padding: 2mm 1mm; background: #fff; font-size: 12px; font-weight: 900 !important; line-height: 1.25; overflow: hidden !important; }
          .text-center { text-align: center; }
          .logo-wrapper { text-align: center; margin: 0 auto 4px auto; }
          .store-logo-img { max-width: 130px; max-height: 65px; object-fit: contain; margin: 0 auto; display: block; filter: grayscale(100%); }
          .store-title { font-size: 18px; font-weight: 900 !important; text-transform: uppercase; margin-bottom: 1px; }
          .store-sub { font-size: 13px; font-weight: 900 !important; text-transform: uppercase; margin-bottom: 2px; }
          .store-contact { font-size: 11.5px; font-weight: 900 !important; }
          .doc-title { font-size: 14px; font-weight: 900 !important; text-transform: uppercase; margin: 4px 0 2px 0; letter-spacing: 0.5px; }
          .rep-num { font-size: 16px; font-weight: 900 !important; letter-spacing: 1px; margin-bottom: 2px; }
          .divider-dashed { width: 100%; border-top: 1.5px dashed #000; margin: 4px 0; font-size: 0; }
          .section-title { font-size: 12px; font-weight: 900 !important; text-transform: uppercase; margin-bottom: 2px; text-decoration: underline; }
          .info-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5px 0; font-size: 12px; }
          .info-label { font-weight: 900 !important; text-transform: uppercase; }
          .info-val { font-weight: 900 !important; text-align: right; }
          table.items-table { width: 100%; border-collapse: collapse; margin: 3px 0; font-size: 12px; }
          table.items-table th { padding: 3px 0; font-size: 11px; font-weight: 900 !important; text-transform: uppercase; border-bottom: 1px solid #000; }
          .totals-table { width: 100%; border-collapse: collapse; margin: 3px 0; }
          .totals-table td { padding: 2px 0; font-size: 13px; font-weight: 900 !important; }
          .barcode-wrapper { text-align: center; margin: 6px auto 3px auto; }
          .barcode-img { max-width: 85%; height: 40px; object-fit: contain; margin: 0 auto; display: block; }
          .barcode-num { font-family: monospace; font-size: 13px; letter-spacing: 1.5px; margin-top: 2px; }
          .signature-box { display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; font-weight: 900 !important; }
          .sign-line { width: 45%; height: 35px; border-bottom: 1px solid #000; margin-top: 2px; }
          .cut-space { height: 5mm; }
        </style>
      </head>
      <body>
        ${(cfg.showReceiptLogo && cfg.storeLogo) ? `
          <div class="logo-wrapper">
            <img src="${cfg.storeLogo}" alt="Logo" class="store-logo-img" />
          </div>
        ` : ''}

        <div class="text-center">
          <div class="store-title">${cfg.storeName || 'COMMERCE PRO'}</div>
          ${cfg.storeSubtitle ? `<div class="store-sub">${cfg.storeSubtitle}</div>` : ''}
          ${cfg.storeAddress ? `<div class="store-contact">${cfg.storeAddress}</div>` : ''}
          ${cfg.storeCity ? `<div class="store-contact">${cfg.storeCity}</div>` : ''}
          ${cfg.storePhone ? `<div class="store-contact">Tél: ${cfg.storePhone}</div>` : ''}
        </div>

        <div class="divider-dashed"></div>

        <div class="text-center">
          <div class="doc-title">★ ${docTitle} ★</div>
          <div class="rep-num">N° : ${rep.numeroReparation}</div>
          <div style="font-size: 11.5px; font-weight: 900;">Date de restitution : ${dateStr}</div>
        </div>

        <div class="divider-dashed"></div>

        <div>
          <div class="info-row">
            <span class="info-label">Client :</span>
            <span class="info-val">${(rep.clientNom || 'Client Comptoir').toUpperCase()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Téléphone :</span>
            <span class="info-val">${rep.clientTelephone || '-'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Appareil :</span>
            <span class="info-val">${rep.appareilType || 'Téléphone'} ${rep.marque || ''} ${rep.modele || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Technicien SAV :</span>
            <span class="info-val">${(rep.reparateurNom || rep.technicien || rep.creePar || userStoredName || 'Atelier SAV').toUpperCase()}</span>
          </div>
        </div>

        <div class="divider-dashed"></div>

        <div>
          ${pieces.length > 0 ? `
            <div class="section-title">PIÈCES DE RECHANGE UTILISÉES</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 40%; text-align: left;">LIBELLE</th>
                  <th style="width: 15%; text-align: center;">QTE</th>
                  <th style="width: 22%; text-align: right;">P.U</th>
                  <th style="width: 23%; text-align: right;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${piecesRows}
              </tbody>
            </table>
          ` : `
            <div style="font-size: 12px; font-weight: 800; padding: 2px 0;">
              Intervention technique & réparation en atelier (Sans pièce de rechange)
            </div>
          `}
        </div>

        <div class="divider-dashed"></div>

        <div>
          <table class="totals-table">
            <tr>
              <td>Total Général (TTC) :</td>
              <td style="text-align: right;">${formatCurrencyDz(totalTTC)} DA</td>
            </tr>
            <tr>
              <td>Acompte déjà versé :</td>
              <td style="text-align: right;">-${formatCurrencyDz(acompte)} DA</td>
            </tr>
            <tr style="font-size: 14.5px;">
              <td style="padding: 2px 0;">Net Réglé (Comptant) :</td>
              <td style="text-align: right;">${formatCurrencyDz(montantPaye)} DA</td>
            </tr>
            ${soldeRestant > 0 ? `
              <tr style="border-top: 1.5px dashed #000; color: #b91c1c;">
                <td style="padding-top: 2px;">Reste à payer (Dette) :</td>
                <td style="text-align: right; padding-top: 2px; font-size: 14px;">${formatCurrencyDz(soldeRestant)} DA</td>
              </tr>
            ` : ''}
          </table>
        </div>

        <div class="divider-dashed"></div>

        <div class="barcode-wrapper">
          ${barcodeUrl ? `<img src="${barcodeUrl}" class="barcode-img" alt="${rep.numeroReparation}" />` : ''}
          <div class="barcode-num">${rep.numeroReparation}</div>
        </div>

        <div style="font-size: 11px; font-weight: 800; text-align: center; margin-top: 3px;">
          Garantie de 30 jours sur les pièces remplacées.<br/>
          Appareil testé et remis en parfait état de marche.
        </div>

        <div class="signature-box">
          <div>
            <div>Bon pour restitution :</div>
            <div class="sign-line"></div>
          </div>
          <div style="text-align: right;">
            <div>Responsable Atelier :</div>
            <div class="sign-line" style="margin-left: auto;"></div>
          </div>
        </div>

        <div class="cut-space"></div>
      </body>
    </html>
  `;
}

/**
 * Génère le Devis Estimatif Client (Format Ticket 80mm ou Document SAV)
 */
export function generateRepairEstimateHtml(rep, settings = null) {
  const cfg = settings || getPrinterSettings();
  const barcodeUrl = createBarcodeDataUrl(rep.numeroReparation || 'REP-0001', { width: 2, height: 40 });
  const dateStr = new Date(rep.dateReception || Date.now()).toLocaleDateString('fr-DZ');
  const pieces = Array.isArray(rep.pieces) ? rep.pieces : [];
  const coutPieces = Number(rep.coutPieces || 0);
  const coutMO = Number(rep.coutMainOeuvre || 0);
  const devis = Number(rep.estimationDevis || (coutPieces + coutMO) || 0);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Devis Réparation - ${rep.numeroReparation}</title>
        <style>
          @page { margin: 0; size: auto; }
          * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; font-family: Arial, sans-serif; }
          body { width: 100%; max-width: 100%; margin: 0; padding: 4mm 2mm; background: #fff; font-size: 12px; font-weight: 800; line-height: 1.3; }
          .text-center { text-align: center; }
          .store-title { font-size: 17px; font-weight: 900; text-transform: uppercase; }
          .doc-title { font-size: 15px; font-weight: 900; margin: 4px 0; }
          .divider { border-top: 1.5px dashed #000; margin: 5px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .table { width: 100%; border-collapse: collapse; margin: 5px 0; }
          .table th, .table td { border-bottom: 1px solid #ddd; padding: 3px 0; font-size: 11px; }
          .total-box { border: 1.5px solid #000; padding: 6px; margin: 6px 0; text-align: center; font-size: 15px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="store-title">${cfg.storeName || 'COMMERCE PRO'}</div>
          <div>${cfg.storePhone ? 'Tél: ' + cfg.storePhone : ''}</div>
          <div class="divider"></div>
          <div class="doc-title">★ DEVIS ESTIMATIF RÉPARATION ★</div>
          <div style="font-size: 14px; font-weight: 900;">${rep.numeroReparation}</div>
          <div>Date : ${dateStr}</div>
        </div>
        <div class="divider"></div>
        <div>
          <div class="info-row"><span>Client :</span><span>${rep.clientNom || 'Client'}</span></div>
          <div class="info-row"><span>Téléphone :</span><span>${rep.clientTelephone || '-'}</span></div>
          <div class="info-row"><span>Appareil :</span><span>${rep.marque || ''} ${rep.modele || ''}</span></div>
          <div class="info-row"><span>Panne :</span><span>${rep.panneDeclaree || '-'}</span></div>
        </div>
        <div class="divider"></div>
        <div class="total-box">
          TOTAL DEVIS ESTIMÉ : ${formatCurrencyDz(devis)} DA
        </div>
        <div style="font-size: 10px; text-align: justify; margin-top: 5px;">
          Ce devis est valable 15 jours. L'accord du client est obligatoire avant intervention.
        </div>
        ${barcodeUrl ? `<div class="text-center" style="margin-top: 6px;"><img src="${barcodeUrl}" style="max-width: 80%; height: 35px;" /></div>` : ''}
      </body>
    </html>
  `;
}

/**
 * Génère la Fiche Atelier Interne de Réparation (Fiche Suivi Technicien)
 */
export function generateRepairWorkshopSheetHtml(rep, settings = null) {
  const cfg = settings || getPrinterSettings();
  const barcodeUrl = createBarcodeDataUrl(rep.numeroReparation || 'REP-0001', { width: 2, height: 40 });
  const pieces = Array.isArray(rep.pieces) ? rep.pieces : [];

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Fiche Atelier - ${rep.numeroReparation}</title>
        <style>
          @page { margin: 10mm; size: A4 portrait; }
          * { box-sizing: border-box; margin: 0; padding: 0; color: #000; font-family: Arial, sans-serif; }
          body { padding: 15px; font-size: 12px; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px; }
          .box { border: 1px solid #999; border-radius: 6px; padding: 8px; }
          .title { font-weight: 900; text-transform: uppercase; font-size: 13px; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #999; padding: 5px; font-size: 11px; }
          th { background: #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 style="font-size: 20px; font-weight: 900;">${cfg.storeName || 'COMMERCE PRO'} - ATELIER SAV</h1>
            <p>FICHE TECHNIQUE DE SUIVI D'INTERVENTION</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 900;">${rep.numeroReparation}</div>
            <div>Date : ${new Date(rep.dateReception || Date.now()).toLocaleDateString('fr-DZ')}</div>
            ${barcodeUrl ? `<img src="${barcodeUrl}" style="height: 35px; margin-top: 4px;" />` : ''}
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="title">CLIENT</div>
            <div><strong>Nom :</strong> ${rep.clientNom || '-'}</div>
            <div><strong>Téléphone :</strong> ${rep.clientTelephone || '-'}</div>
          </div>
          <div class="box">
            <div class="title">ÉQUIPEMENT</div>
            <div><strong>Appareil :</strong> ${rep.appareilType || 'Smartphone'} ${rep.marque || ''} ${rep.modele || ''}</div>
            <div><strong>N° Série / IMEI :</strong> ${rep.numeroSerie || '-'}</div>
            <div><strong>Code PIN / Mot de passe :</strong> ${rep.motDePasseAppareil || 'Aucun'}</div>
            <div><strong>Accessoires :</strong> ${rep.accessoires || 'Aucun'}</div>
          </div>
        </div>

        <div class="box" style="margin-bottom: 12px;">
          <div class="title">SYMPTÔMES DÉCLARÉS & DIAGNOSTIC</div>
          <p><strong>Panne :</strong> ${rep.panneDeclaree || 'À diagnostiquer'}</p>
          ${rep.constatTechnique ? `<p style="margin-top: 5px;"><strong>Constat Technique :</strong> ${rep.constatTechnique}</p>` : ''}
        </div>

        <div class="box">
          <div class="title">TRAVAUX & PIÈCES UTILISÉES</div>
          <table>
            <thead>
              <tr>
                <th>Pièce / Opération</th>
                <th style="width: 15%; text-align: center;">Quantité</th>
                <th style="width: 20%; text-align: right;">P.U (DA)</th>
                <th style="width: 20%; text-align: right;">Total (DA)</th>
              </tr>
            </thead>
            <tbody>
              ${pieces.map(p => `
                <tr>
                  <td>${p.nom}</td>
                  <td style="text-align: center;">${p.quantite}</td>
                  <td style="text-align: right;">${formatCurrencyDz(p.prixUnitaire)}</td>
                  <td style="text-align: right;">${formatCurrencyDz(Number(p.quantite) * Number(p.prixUnitaire))}</td>
                </tr>
              `).join('')}
              <tr>
                <td colspan="3"><strong>Main d'œuvre atelier</strong></td>
                <td style="text-align: right;"><strong>${formatCurrencyDz(rep.coutMainOeuvre || 0)} DA</strong></td>
              </tr>
              <tr style="font-weight: 900; background: #eee;">
                <td colspan="3">TOTAL GÉNÉRAL TTC</td>
                <td style="text-align: right;">${formatCurrencyDz(rep.totalTTC || 0)} DA</td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

