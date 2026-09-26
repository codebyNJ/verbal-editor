// The landing's art: the night scene cut into pieces, each averaged into pixel blocks and mapped onto five
// inks from night (#0f1014) to lantern amber (#fca942). Rendered once in Chromium so every engine shows the
// same pixels; the page scales them up with image-rendering: pixelated.   node scripts/duotone.js
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('demo/public/cover/night.jpg').toString('base64');
// name: [x, y, w, h, block, black point (percentile), dark dead zone, gamma]
const crops = {
  writer: [185, 330, 240, 370, 3, 0.6, 0.18, 0.7],
  cliff: [60, 380, 500, 260, 4, 0.55, 0.16, 0.75],
  summit: [1440, 160, 420, 280, 4],
  reflection: [1330, 560, 240, 150, 3, 0.2, 0.14],
  moon: [1520, 150, 260, 220, 4],
  peaks: [1300, 350, 600, 240, 5],
  lake: [1000, 560, 900, 180, 5],
  clouds: [0, 270, 440, 160, 4],
  trees: [1480, 430, 500, 200, 5],
  ridge: [380, 420, 700, 180, 5],
  shore: [0, 520, 2000, 220, 5],
};
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent('<body></body>');
const out = await p.evaluate(async ([src, crops]) => {
  const im = new Image(); im.src = `data:image/jpeg;base64,${src}`; await im.decode();
  const ink = [15, 16, 20], amber = [252, 169, 66];
  const levels = [0, 0.18, 0.42, 0.7, 1];
  const result = {};
  for (const [name, [x, y, w, h, f, black = 0.2, dead = 0.14, gamma = 1]] of Object.entries(crops)) {
    const W = Math.round(w / f), H = Math.round(h / f);
    const cv = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(im, x, y, w, h, 0, 0, W, H);
    const d = c.getImageData(0, 0, W, H);
    const lum = [];
    for (let i = 0; i < d.data.length; i += 4) lum.push(0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]);
    const sorted = [...lum].sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * black)], hi = sorted[Math.floor(sorted.length * 0.997)];
    lum.forEach((l, i) => {
      const t = Math.pow(Math.min(1, Math.max(0, (l - lo) / Math.max(1, hi - lo))), gamma);
      // Bands with a wide dead zone at the dark end, so the sky's faint texture stays solid ink.
      const q = t < dead ? 0 : t < 0.36 ? levels[1] : t < 0.6 ? levels[2] : t < 0.84 ? levels[3] : 1;
      for (let k = 0; k < 3; k++) d.data[i * 4 + k] = Math.round(ink[k] + (amber[k] - ink[k]) * q);
      d.data[i * 4 + 3] = 255;
    });
    c.putImageData(d, 0, 0);
    result[name] = { w: W, h: H, png: cv.toDataURL('image/png').split(',')[1] };
  }
  return result;
}, [src, crops]);
for (const [name, { w, h, png }] of Object.entries(out)) {
  writeFileSync(`demo/public/landing/${name}.png`, Buffer.from(png, 'base64'));
  console.log(name.padEnd(8), `${w}x${h}`, Buffer.from(png, 'base64').length, 'B');
}
await b.close();
