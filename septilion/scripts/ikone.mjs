// Ikone stranice iz public/septillion-icon.svg (npm run ikone; rezultat je u gitu, pokreće se samo kad se znak promijeni):
//   favicon.ico (16, 32, 48), favicon-96x96.png — tražilice (Google traži višekratnik 48 px) i stari preglednici
//   favicon.svg — isti znak (stara datoteka tog imena bila je Viteov predložak)
//   apple-touch-icon.png (180), web-app-manifest-192x192.png, web-app-manifest-512x512.png — puni kvadrat bez prozirnosti
//   site.webmanifest
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

sharp.cache(false);
const PUB = path.resolve('public');
const svg = fs.readFileSync(path.join(PUB, 'septillion-icon.svg'), 'utf8');
// kvadrat do ruba: iOS i Android sami zaobljuju kutove
const kvadrat = svg.replace(/<rect([^>]*?)\srx="[\d.]+"/, '<rect$1');
if (kvadrat === svg) throw new Error('septillion-icon.svg: nema zaobljenog <rect> pozadine');

const png = (izvor, s) => {
  const p = sharp(Buffer.from(izvor), { density: Math.ceil((72 * s) / 64) * 4 }).resize(s, s);
  return (izvor === kvadrat ? p.flatten({ background: '#0F0F10' }) : p).png({ compressionLevel: 9 }).toBuffer();
};

/** ICO s PNG slikama (podržava ga svaki preglednik od 2007.) */
function ico(slike) {
  const zaglavlje = Buffer.alloc(6 + 16 * slike.length);
  zaglavlje.writeUInt16LE(0, 0); zaglavlje.writeUInt16LE(1, 2); zaglavlje.writeUInt16LE(slike.length, 4);
  let pomak = zaglavlje.length;
  slike.forEach(({ s, b }, i) => {
    const o = 6 + 16 * i;
    zaglavlje.writeUInt8(s % 256, o); zaglavlje.writeUInt8(s % 256, o + 1);
    zaglavlje.writeUInt16LE(1, o + 4); zaglavlje.writeUInt16LE(32, o + 6);
    zaglavlje.writeUInt32LE(b.length, o + 8); zaglavlje.writeUInt32LE(pomak, o + 12);
    pomak += b.length;
  });
  return Buffer.concat([zaglavlje, ...slike.map((x) => x.b)]);
}

fs.writeFileSync(path.join(PUB, 'favicon.ico'), ico(await Promise.all([16, 32, 48].map(async (s) => ({ s, b: await png(svg, s) })))));
fs.writeFileSync(path.join(PUB, 'favicon-96x96.png'), await png(svg, 96));
fs.writeFileSync(path.join(PUB, 'favicon.svg'), svg);
fs.writeFileSync(path.join(PUB, 'apple-touch-icon.png'), await png(kvadrat, 180));
fs.writeFileSync(path.join(PUB, 'web-app-manifest-192x192.png'), await png(kvadrat, 192));
fs.writeFileSync(path.join(PUB, 'web-app-manifest-512x512.png'), await png(kvadrat, 512));
fs.writeFileSync(path.join(PUB, 'site.webmanifest'), JSON.stringify({
  name: 'Septillion', short_name: 'Septillion', start_url: '/', display: 'browser',
  background_color: '#0F0F10', theme_color: '#0F0F10',
  icons: [
    { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2) + '\n');
console.log('[ikone] favicon.ico, favicon-96x96.png, favicon.svg, apple-touch-icon.png, web-app-manifest-*.png, site.webmanifest');
