const QRCode = require('qrcode');

/**
 * Génère un QR Code sous forme de DataURL (base64 image)
 * @param {string|object} data Données à encoder
 * @param {object} options Options QR code (largeur, marge, correction d'erreur)
 * @returns {Promise<string>} Data URL base64
 */
async function generateQRCodeDataURL(data, options = {}) {
  try {
    const stringData = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const opts = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: options.width || 250,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      ...options
    };
    return await QRCode.toDataURL(stringData, opts);
  } catch (error) {
    console.error('Erreur génération QR Code:', error);
    throw error;
  }
}

/**
 * Génère le format de QR code standardisé pour un produit
 */
async function generateProductQRCode(product) {
  const qrData = `PROD:${product.reference}|${product.nom}|${product.prixVente}`;
  const qrImage = await generateQRCodeDataURL(qrData, { width: 200 });
  return { qrData, qrImage };
}

/**
 * Génère le format de QR code standardisé pour une facture
 */
async function generateInvoiceQRCode(invoice) {
  const qrData = `FAC:${invoice.numeroFacture}|TTC:${invoice.totalTTC}|DATE:${new Date(invoice.createdAt || Date.now()).toISOString().slice(0, 10)}`;
  const qrImage = await generateQRCodeDataURL(qrData, { width: 220 });
  return { qrData, qrImage };
}

module.exports = {
  generateQRCodeDataURL,
  generateProductQRCode,
  generateInvoiceQRCode
};
