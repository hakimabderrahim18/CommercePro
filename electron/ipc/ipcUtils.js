/**
 * Convertit un document Mongoose ou un tableau de documents en objet JSON pur
 * compatible avec le clonage IPC d'Electron (évite "Error: An object could not be cloned"
 * et "Cast to ObjectId failed for value { buffer: Uint8Array(12)... }")
 */
function toPlain(obj) {
  if (obj === null || obj === undefined) return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    if (obj && typeof obj.toObject === 'function') {
      return JSON.parse(JSON.stringify(obj.toObject()));
    }
    return obj;
  }
}

/**
 * Nettoie et extrait un string standard depuis un ID potentiel (string, ObjectId, ou Buffer)
 */
function cleanId(id) {
  if (!id) return '';
  if (typeof id === 'string') return id.trim();
  if (id._id) return String(id._id).trim();
  if (id.toString && typeof id.toString === 'function') {
    const str = id.toString();
    if (str !== '[object Object]') return str.trim();
  }
  return String(id).trim();
}

/**
 * Génère un numéro séquentiel unique sans collision (évite les erreurs E11000 duplicate key)
 */
async function generateUniqueNumber(Model, fieldName, prefix) {
  const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
  const basePrefix = `${prefix}-${dateStr}`;

  // Récupérer le plus grand numéro existant
  const lastDoc = await Model.findOne({
    [fieldName]: new RegExp(`^${basePrefix}`)
  })
    .sort({ [fieldName]: -1 })
    .lean();

  let nextSeq = 1;
  if (lastDoc && lastDoc[fieldName]) {
    const parts = lastDoc[fieldName].split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  let candidate = `${basePrefix}-${String(nextSeq).padStart(4, '0')}`;

  // Sécurité anti-collision
  while (await Model.exists({ [fieldName]: candidate })) {
    nextSeq++;
    candidate = `${basePrefix}-${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
}

module.exports = {
  toPlain,
  cleanId,
  generateUniqueNumber
};
