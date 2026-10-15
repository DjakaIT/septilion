// ZIP bez vanjskih paketa (deflate + središnji direktorij, UTF-8 imena): paket za hosting i testovi uredništva.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/** @param {{ ime: string, podaci: Buffer, vrijeme?: Date }[]} datoteke  @returns {Buffer} */
export function zip(datoteke) {
  const lokalni = [], sredisnji = [];
  let pomak = 0;
  for (const d of datoteke) {
    const ime = Buffer.from(d.ime, 'utf8');
    const sazeto = zlib.deflateRawSync(d.podaci, { level: 9 });
    const crc = zlib.crc32(d.podaci);
    const t = d.vrijeme ?? new Date();
    const vrijeme = (t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1);
    const datum = ((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate();
    const zaglavlje = (potpis, dodatno) => {
      const b = Buffer.alloc(dodatno ? 46 : 30);
      let i = 0;
      const w2 = (v) => { b.writeUInt16LE(v, i); i += 2; }, w4 = (v) => { b.writeUInt32LE(v >>> 0, i); i += 4; };
      w4(potpis); if (dodatno) w2(20); w2(20); w2(0x0800); w2(8); w2(vrijeme); w2(datum); w4(crc); w4(sazeto.length); w4(d.podaci.length); w2(ime.length); w2(0);
      if (dodatno) { w2(0); w2(0); w2(0); w4(0); w4(pomak); }
      return b;
    };
    sredisnji.push(zaglavlje(0x02014b50, true), ime);
    const l = [zaglavlje(0x04034b50, false), ime, sazeto];
    lokalni.push(...l);
    pomak += l.reduce((s, x) => s + x.length, 0);
  }
  const cd = Buffer.concat(sredisnji);
  const kraj = Buffer.alloc(22);
  kraj.writeUInt32LE(0x06054b50, 0); kraj.writeUInt16LE(datoteke.length, 8); kraj.writeUInt16LE(datoteke.length, 10);
  kraj.writeUInt32LE(cd.length, 12); kraj.writeUInt32LE(pomak, 16);
  return Buffer.concat([...lokalni, cd, kraj]);
}

/** sve datoteke mape (i skrivene, npr. .htaccess), imena relativna s "/" */
export function zipMape(korijen) {
  const datoteke = [];
  (function obidi(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) obidi(p);
      else datoteke.push({ ime: path.relative(korijen, p).split(path.sep).join('/'), podaci: fs.readFileSync(p), vrijeme: fs.statSync(p).mtime });
    }
  })(korijen);
  datoteke.sort((a, b) => (a.ime < b.ime ? -1 : 1));
  return { podaci: zip(datoteke), broj: datoteke.length };
}
