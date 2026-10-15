// Slike: lokalne iz src/assets/img (izvučene iz prototipa v4) i one učitane u uredništvu (podaci/slike, alias @podaci).
// Sve prolaze isti postupak (AVIF/WebP u više veličina, poslužuje ih naša domena).
// Kad stignu originali s Drivea, zamijene se lokalne datoteke istog imena — kod se ne mijenja.
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

/** ključ slike: npr. 'pr_hero' (src/assets/img) ili 'n-…' (učitano u uredništvu) */
export type ImgRef = string;

const files = {
  ...import.meta.glob<{ default: ImageMetadata }>('../assets/img/*.{webp,jpg,jpeg,png}', { eager: true }),
  ...import.meta.glob<{ default: ImageMetadata }>('@podaci/slike/*.webp', { eager: true }),
};
const byKey: Record<string, ImageMetadata> = {};
for (const [p, mod] of Object.entries(files)) byKey[p.split('/').pop()!.replace(/\.[^.]+$/, '')] = mod.default;

export function img(key: string): ImageMetadata {
  const m = byKey[key];
  if (!m) throw new Error(`Nema slike "${key}" (src/assets/img ili podaci/slike)`);
  return m;
}

/** Širine koje imaju smisla za danu sliku (bez povećavanja iznad izvorne). */
export function widthsFor(key: ImgRef, wanted: number[]) {
  const max = img(key).width;
  const w = wanted.filter((x) => x < max);
  return [...w, Math.min(max, Math.max(...wanted))].filter((x, i, a) => a.indexOf(x) === i);
}

export async function srcset(key: ImgRef, wanted: number[], format: 'webp' | 'avif' = 'webp') {
  const src = img(key);
  const widths = widthsFor(key, wanted);
  const r = await getImage({ src, widths, format, quality: format === 'avif' ? 55 : 72 });
  return { src: r.src, srcset: r.srcSet.attribute, width: src.width, height: src.height };
}

/** Jedna veličina (npr. za WebGL teksturu ili JS koji mijenja src). */
export async function single(key: ImgRef, width: number, format: 'webp' | 'avif' = 'webp') {
  const src = img(key);
  const r = await getImage({ src, width: Math.min(width, src.width), format, quality: 74 });
  return r.src;
}
