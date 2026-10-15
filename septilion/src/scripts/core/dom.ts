export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Zajednička funkcija šava (ista u GLSL-u ulaza i u prijelazu između lokala). */
export function seamAt(u: number, t: number, base: number, amp: number) {
  return base + amp * (0.03 * Math.sin(u * 6.0 + t * 0.9) + 0.018 * Math.sin(u * 13.0 - t * 1.4) + 0.008 * Math.sin(u * 27.0 + t * 2.1));
}
