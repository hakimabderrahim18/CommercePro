const { initDatabase, getDB, getDbPath } = require('./sqlite');

async function connectDB() {
  try {
    const db = await initDatabase();
    console.log('[SQLite] Base de données locale connectée avec succès.');
    return db;
  } catch (err) {
    console.error('[SQLite] Erreur d’ouverture de la base locale :', err);
    throw err;
  }
}

function getStatus() {
  try {
    const db = getDB();
    const isAlive = db.open;
    return {
      connected: isAlive,
      readyState: isAlive ? 1 : 0,
      host: 'SQLite Local',
      name: 'commercepost.db',
      dbPath: getDbPath()
    };
  } catch (e) {
    return {
      connected: false,
      readyState: 0,
      host: 'SQLite Local',
      name: 'commercepost.db',
      error: e.message
    };
  }
}

module.exports = {
  connectDB,
  getStatus
};
