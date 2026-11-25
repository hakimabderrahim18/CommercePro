const https = require('https');
const fs = require('fs');
const path = require('path');

function getGithubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const { execSync } = require('child_process');
    const out = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n', encoding: 'utf8' });
    const match = out.match(/password=(.+)/);
    if (match) return match[1].trim();
  } catch (e) {}
  return '';
}

const GITHUB_TOKEN = getGithubToken();
const OWNER = 'hakimabderrahim18';
const REPO = 'CommercePro';
const TAG = 'v1.0.3';
const NAME = 'Commerce Pro v1.0.3';
const BODY = `## Commerce Pro v1.0.3 - Mise à jour officielle

### Nouveautés & Améliorations :
- **Attributs d'impression SAV & Réparation 100% configurables et personnalisables :**
  - Nouvel onglet dédié « Impression SAV & Réparation » dans les paramètres.
  - Personnalisation de tous les titres de documents : Bon de Réception, Devis Estimatif, Bon de Restitution & Livraison SAV, Fiche d'Atelier Interne.
  - Toggles (cases à cocher) pour afficher ou masquer chaque élément : Logo, Coordonnées Magasin, Code-Barres, Technicien SAV, Appareil & IMEI, Panne & Diagnostic, Code/Schéma PIN, Tableau des Pièces & Main d'œuvre, Devis estimatif, Acompte, Reste à Payer (Dette), Cadres de signatures, Bloc de garantie, Mentions & avertissements.
  - Textes libres et modifiables pour les clauses de garantie, validité du devis et conditions de prise en charge.
- **Impression thermique optimisée (SPRT 80 / POS-80) :**
  - Zéro coupure de texte à droite, format 68mm sécurisé avec marge de découpe.
- **Fluidité & Vitesse Maximale :**
  - Navigation et changement d'écrans instantané (0 ms).
`;

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function uploadAsset(uploadUrlTemplate, filePath, assetName) {
  const uploadUrlStr = uploadUrlTemplate.replace(/\{(\?.*?)\}/, `?name=${encodeURIComponent(assetName)}`);
  const urlObj = new URL(uploadUrlStr);
  const fileSize = fs.statSync(filePath).size;
  console.log(`Uploading ${assetName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'CommercePro-Publisher',
        'Content-Type': 'application/zip',
        'Content-Length': fileSize
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Asset ${assetName} uploaded successfully!`);
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Asset upload error HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);

    let uploaded = 0;
    fileStream.on('data', (chunk) => {
      uploaded += chunk.length;
      process.stdout.write(`\rProgress: ${((uploaded / fileSize) * 100).toFixed(1)}%`);
    });

    fileStream.on('end', () => {
      process.stdout.write('\n');
    });

    fileStream.pipe(req);
  });
}

async function main() {
  console.log(`Creating GitHub Release ${TAG} on ${OWNER}/${REPO}...`);
  
  // 1. Create or get release
  let release;
  try {
    release = await request({
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/releases`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'CommercePro-Publisher',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({
      tag_name: TAG,
      target_commitish: 'main',
      name: NAME,
      body: BODY,
      draft: false,
      prerelease: false
    }));
    console.log(`✅ Release created: ${release.html_url}`);
  } catch (err) {
    console.warn(`Release create message: ${err.message}`);
    // Check if release already exists
    release = await request({
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'CommercePro-Publisher',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    console.log(`Using existing release: ${release.html_url}`);
  }

  // 2. Upload the zip asset
  const zipPath = path.resolve(__dirname, `../release/CommercePro-${TAG}-windows.zip`);
  if (fs.existsSync(zipPath)) {
    await uploadAsset(release.upload_url, zipPath, `CommercePro-${TAG}-windows.zip`);
  } else {
    console.error(`Zip file not found at ${zipPath}`);
  }

  console.log('🎉 Release publication complete!');
}

main().catch((err) => {
  console.error('Fatal publication error:', err);
  process.exit(1);
});
