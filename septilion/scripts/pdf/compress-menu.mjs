// Web verzija PDF jelovnika: JPEG2000 (CMYK) slike -> JPEG (RGB) najviše 1600 px; tekst i vektori ostaju.
// Pokretanje: npm run pdf -- "putanja/do/izvornog.pdf"
// Izlaz: public/jelovnik/jellyfish-in-space-jelovnik.pdf
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from 'pdf-lib';
import { JpxImage } from 'pdfjs-dist/image_decoders/pdf.image_decoders.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = process.argv[2] || path.join(root, '09-2026 Menu.pdf');
const out = path.join(root, 'public/jelovnik/jellyfish-in-space-jelovnik.pdf');
const MAX_W = 1600, QUALITY = 72;

// Node fetch ne čita file:// adrese, pa WASM dekoder dajemo izravno s diska (inače pdf.js pada na sporiji JS)
const WASM_DIR = path.join(root, 'node_modules/pdfjs-dist/wasm/');
JpxImage.setOptions({
  useWasm: true, useWorkerFetch: false, wasmUrl: pathToFileURL(WASM_DIR).href,
  handler: { sendWithPromise: async (_name, { filename }) => new Uint8Array(fs.readFileSync(path.join(WASM_DIR, filename))) },
});

// CMYK -> RGB: isti polinom kojim pdf.js iscrtava DeviceCMYK (Apache-2.0, Mozilla)
function cmykToRgb(cmyk, n) {
  const rgb = Buffer.alloc(n * 3), s = 1 / 255;
  for (let i = 0, j = 0; i < n * 4; i += 4, j += 3) {
    const c = cmyk[i] * s, m = cmyk[i + 1] * s, y = cmyk[i + 2] * s, k = cmyk[i + 3] * s;
    rgb[j] = clamp(255 + c * (-4.387332384609988 * c + 54.48615194189176 * m + 18.82290502165302 * y + 212.25662451639585 * k + -285.2331026137004) + m * (1.7149763477362134 * m - 5.6096736904047315 * y + -17.873870861415444 * k - 5.497006427196366) + y * (-2.5217340131683033 * y - 21.248923337353073 * k + 17.5119270841813) + k * (-21.86122147463605 * k - 189.48180835922747));
    rgb[j + 1] = clamp(255 + c * (8.841041422036149 * c + 60.118027045597366 * m + 6.871425592049007 * y + 31.159100130055922 * k + -79.2970844816548) + m * (-15.310361306967817 * m + 17.575251261109482 * y + 131.35250912493976 * k - 190.9453302588951) + y * (4.444339102852739 * y + 9.8632861493405 * k - 24.86741582555878) + k * (-20.737325471181034 * k - 187.80453709719578));
    rgb[j + 2] = clamp(255 + c * (0.8842522430003296 * c + 8.078677503112928 * m + 30.89978309703729 * y - 0.23883238689178934 * k + -14.183576799673286) + m * (10.49593273432072 * m + 63.02378494754052 * y + 50.606957656360734 * k - 112.23884253719248) + y * (0.03296041114873217 * y + 115.60384449646641 * k + -193.58209356861505) + k * (-22.33816807309886 * k - 180.12613974708367));
  }
  return rgb;
}
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

const doc = await PDFDocument.load(fs.readFileSync(src));
const ctx = doc.context;
let before = 0, after = 0, count = 0;
for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
  if (!(obj instanceof PDFRawStream)) continue;
  const d = obj.dict;
  if (d.get(PDFName.of('Subtype'))?.toString() !== '/Image') continue;
  if (d.get(PDFName.of('Filter'))?.toString() !== '/JPXDecode') continue;
  const cs = d.get(PDFName.of('ColorSpace'))?.toString();
  const w = d.get(PDFName.of('Width')).asNumber(), h = d.get(PDFName.of('Height')).asNumber();
  const comps = cs === '/DeviceCMYK' ? 4 : cs === '/DeviceGray' ? 1 : 3;
  const px = await JpxImage.instance.decode(obj.contents, { numComponents: comps }); // pdfjs 6: dekoder je instanca
  if (px.length !== w * h * comps) { console.warn(`preskačem ${ref}: ${px.length} != ${w}x${h}x${comps}`); continue; }
  const rgb = comps === 4 ? cmykToRgb(px, w * h) : Buffer.from(px);
  const img = sharp(rgb, { raw: { width: w, height: h, channels: comps === 4 ? 3 : comps } });
  const jpg = await img.resize({ width: Math.min(MAX_W, w), withoutEnlargement: true }).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  const dict = ctx.obj({
    Type: 'XObject', Subtype: 'Image', Width: jpg.info.width, Height: jpg.info.height,
    ColorSpace: comps === 1 ? 'DeviceGray' : 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode', Length: PDFNumber.of(jpg.data.length),
  });
  const smask = d.get(PDFName.of('SMask'));
  if (smask) dict.set(PDFName.of('SMask'), smask); // soft mask smije imati drugu razlučivost
  ctx.assign(ref, PDFRawStream.of(dict, jpg.data));
  before += obj.contents.length; after += jpg.data.length; count++;
}
const bytes = await doc.save({ useObjectStreams: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, bytes);
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`${count} slika: ${mb(before)} -> ${mb(after)}; PDF ${mb(fs.statSync(src).size)} -> ${mb(bytes.length)}`);
