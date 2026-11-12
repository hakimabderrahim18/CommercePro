export const CURRENCY = 'DA'; // Dinar Algérien (DZD)

/**
 * Formate un montant numérique en Dinars Algériens (DA) avec 3 décimales
 * @param {number|string} amount 
 * @param {boolean} withSymbol 
 * @param {number} decimals 
 * @returns {string} Ex: "15 000,000 DA" ou "15 000,000"
 */
export function formatMoney(amount, withSymbol = true, decimals = 3) {
  const val = Number(amount) || 0;
  const formatted = val.toLocaleString('fr-DZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return withSymbol ? `${formatted} ${CURRENCY}` : formatted;
}

export function formatPrice(amount, decimals = 3) {
  const val = Number(amount) || 0;
  return val.toLocaleString('fr-DZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
