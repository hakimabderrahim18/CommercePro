const fs = require('fs');
const path = require('path');

let count = 0;
function checkDir(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== 'release') checkDir(p);
    } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
      const txt = fs.readFileSync(p, 'utf8');
      const lines = txt.split('\n');
      lines.forEach((l, i) => {
        if (l.match(/\bF\b/) && !l.includes('from') && !l.includes('Function') && !l.includes('false') && !l.includes('filter') && !l.includes('for') && !l.includes('fetch') && !l.includes('FormData') && !l.includes('File') && !l.includes('FA-') && !l.includes('FAC-') && !l.includes('find') && !l.includes('focus') && !l.includes('font') && !l.includes('flex') && !l.includes('fixed') && !l.includes('full') && !l.includes('feed') && !l.includes('form') && !l.includes('failed') && !l.includes('fr-DZ') && !l.includes('fr-FR')) {
          console.log(`[Trouvé] ${path.relative(__dirname, p)}:${i+1}: ${l.trim()}`);
          count++;
        }
      });
    }
  }
}

checkDir(path.join(__dirname, '../../src'));
console.log(`Total occurrences résiduelles de F : ${count}`);
