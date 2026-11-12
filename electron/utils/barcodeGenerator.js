const bwipjs = require('bwip-js');

/**
 * Génère un Code-Barres 1D standard (Code 128 / EAN) sous forme de Data URL base64 PNG
 * @param {string} text Le code / référence à encoder
 * @param {object} options Options du code-barres
 * @returns {Promise<string>} Data URL base64 PNG
 */
async function generateBarcodeDataURL(text, options = {}) {
  try {
    const cleanText = String(text || 'ART-0000').trim().toUpperCase();
    
    // Détection automatique du type de code : EAN13 si 12 ou 13 chiffres, sinon Code 128 universel
    const isEAN13 = /^\d{12,13}$/.test(cleanText);
    const bcid = options.bcid || (isEAN13 ? 'ean13' : 'code128');

    const pngBuffer = await bwipjs.toBuffer({
      bcid,
      text: cleanText,
      scale: options.scale || 3,
      height: options.height || 12,
      includetext: options.includetext !== false,
      textxalign: 'center',
      textsize: options.textsize || 11,
      backgroundcolor: 'FFFFFF',
      paddingwidth: 5,
      paddingheight: 3
    });

    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Erreur génération Code-Barres:', error);
    // Fallback Code 128 générique si EAN échoue
    try {
      const fallbackPng = await bwipjs.toBuffer({
        bcid: 'code128',
        text: String(text || 'ART-0000').trim().toUpperCase(),
        scale: 3,
        height: 12,
        includetext: true,
        textxalign: 'center',
        backgroundcolor: 'FFFFFF'
      });
      return `data:image/png;base64,${fallbackPng.toString('base64')}`;
    } catch (e) {
      throw error;
    }
  }
}

/**
 * Génère le format de code-barres standardisé pour un produit
 */
async function generateProductBarcode(product) {
  const barcodeValue = (product.codeBarre || product.reference || `ART-${Date.now().toString().slice(-6)}`).trim().toUpperCase();
  const barcodeImage = await generateBarcodeDataURL(barcodeValue);
  return {
    barcodeData: barcodeValue,
    barcodeImage,
    // Alias pour compatibilité
    qrData: barcodeValue,
    qrImage: barcodeImage
  };
}

/**
 * Décode les caractères envoyés par une douchette USB configurée en QWERTY sur un Windows AZERTY
 */
function decodeAzertyBarcode(str) {
  if (!str) return '';
  const azertyMap = {
    '&': '1', 'é': '2', '"': '3', '\'': '4', '(': '5',
    '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0',
    '§': '6'
  };
  return String(str).split('').map(ch => azertyMap[ch] || ch).join('');
}

module.exports = {
  generateBarcodeDataURL,
  generateProductBarcode,
  decodeAzertyBarcode
};

