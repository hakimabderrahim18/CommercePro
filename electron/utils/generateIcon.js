const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// Generate a clean PNG icon for assets
async function createIcon() {
  const assetsDir = path.join(__dirname, '../assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Create high-res PNG
  const pngPath = path.join(assetsDir, 'icon.png');
  await QRCode.toFile(pngPath, 'CommercePost - Gestion Commerciale & Stock', {
    width: 256,
    margin: 2,
    color: {
      dark: '#1E3A8A',
      light: '#FFFFFF'
    }
  });

  // Create placeholder .ico
  const icoPath = path.join(assetsDir, 'icon.ico');
  fs.copyFileSync(pngPath, icoPath);

  console.log('Icônes générées dans assets/icon.png et assets/icon.ico');
}

createIcon().catch(console.error);
