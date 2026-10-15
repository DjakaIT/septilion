// Sigurno pisanje datoteka: privremena datoteka u istoj mapi + fsync + preimenovanje (nikad napola zapisano).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function pisiAtomarno(putanja, sadrzaj, mode = 0o600) {
  fs.mkdirSync(path.dirname(putanja), { recursive: true, mode: 0o700 });
  const tmp = `${putanja}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'wx', mode);
  try { fs.writeSync(fd, sadrzaj); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, putanja);
}

export const pisiJson = (putanja, podaci) => pisiAtomarno(putanja, JSON.stringify(podaci, null, 1));

export function citajJson(putanja, zadano = null) {
  try { return JSON.parse(fs.readFileSync(putanja, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return zadano; throw e; }
}

/** jednostavna brava: operacije nad istim podacima idu jedna za drugom */
export function brava() {
  let rep = Promise.resolve();
  return (fn) => { const r = rep.then(fn, fn); rep = r.catch(() => {}); return r; };
}
