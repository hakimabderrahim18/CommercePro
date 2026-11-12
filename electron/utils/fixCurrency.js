const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'release') {
        replaceInDir(fullPath);
      }
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;

      // Replacements:
      // ' DA' -> ' DA'
      // ` DA` -> ` DA`
      // "(DA)" -> "(DA)"
      // "DA" -> "DA"
      // "toLocaleString('fr-DZ')" -> "toLocaleString('fr-DZ')"
      content = content
        .replace(/toLocaleString\('fr-FR'\)/g, "toLocaleString('fr-DZ')")
        .replace(/\(F\)/g, '(DA)')
        .replace(/ DA/g, ' DA')
        .replace(/DA/g, 'DA')
        .replace(/ DA`/g, ' DA`')
        .replace(/ DA'/g, " DA'")
        .replace(/ DA"/g, ' DA"')
        .replace(/ DA\b/g, ' DA')
        .replace(/>DA</g, '>DA<')
        .replace(/ DA\)/g, ' DA)')
        .replace(/ DA /g, ' DA ');

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Mis à jour en DA : ${path.relative(__dirname, fullPath)}`);
      }
    }
  }
}

replaceInDir(path.join(__dirname, '../../src'));
replaceInDir(path.join(__dirname, '../../electron'));
console.log('--- Remplacement de toutes les devises par DA terminé avec succès ! ---');
