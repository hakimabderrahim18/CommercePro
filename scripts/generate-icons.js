const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

async function generateIcons() {
  const svgPath = path.join(__dirname, '../build/icon.svg');
  const buildDir = path.join(__dirname, '../build');
  const assetsDir = path.join(__dirname, '../assets');
  const publicDir = path.join(__dirname, '../public');

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Generate PNGs in multiple standard sizes for Windows ICO
  const sizes = [256, 128, 64, 48, 32, 16];
  const pngPaths = [];

  for (const size of sizes) {
    const p = path.join(buildDir, `icon-${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(p);
    pngPaths.push(p);
  }

  // 512 for high DPI
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(buildDir, 'icon.png'));
  await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(assetsDir, 'icon.png'));
  await sharp(svgBuffer).resize(128, 128).png().toFile(path.join(publicDir, 'logo.png'));
  fs.copyFileSync(svgPath, path.join(publicDir, 'logo.svg'));
  fs.copyFileSync(svgPath, path.join(assetsDir, 'icon.svg'));

  console.log('✓ Multi-size PNG icons generated');

  // 2. Generate ICO file containing all sizes
  const icoBuffer = await pngToIco(pngPaths);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

  console.log('✓ Multi-resolution ICO files written to build/, assets/, and public/');
}

generateIcons().catch(console.error);
