import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function convertOklch(str) {
  return str.replace(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/gi, (match, l, c, h, a) => {
    if (typeof l === 'string' && l.endsWith('%')) l = parseFloat(l) / 100;
    else l = parseFloat(l);
    c = parseFloat(c) || 0;
    h = parseFloat(h) || 0;

    const hRad = (h * Math.PI) / 180;
    const ak = c * Math.cos(hRad);
    const bk = c * Math.sin(hRad);

    const l_ = l + 0.3963377774 * ak + 0.2158037573 * bk;
    const m_ = l - 0.1055613458 * ak - 0.0638541728 * bk;
    const s_ = l - 0.0894841775 * ak - 1.2914855480 * bk;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    function toSrgb(x) {
      if (x <= 0.0031308) return Math.max(0, Math.min(255, Math.round(12.92 * x * 255)));
      return Math.max(0, Math.min(255, Math.round((1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055) * 255)));
    }

    const rVal = toSrgb(r);
    const gVal = toSrgb(g);
    const bVal = toSrgb(bl);

    if (a !== undefined) {
      let alphaVal = typeof a === 'string' && a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
      return `rgba(${rVal}, ${gVal}, ${bVal}, ${alphaVal})`;
    }
    return `rgb(${rVal}, ${gVal}, ${bVal})`;
  });
}

function oklchPlugin() {
  return {
    name: 'convert-oklch-to-rgb',
    generateBundle(options, bundle) {
      for (const fileName in bundle) {
        if (fileName.endsWith('.css')) {
          const chunk = bundle[fileName];
          if (chunk && chunk.source) {
            chunk.source = convertOklch(chunk.source);
          }
        }
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), oklchPlugin()],
  base: './',
  root: '.',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome108'
  }
});
