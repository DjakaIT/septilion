// NALJEPNICE — Pasta Rhymes brand sustav (prenijeto iz prototipa v4; sad se SVG radi pri buildu).
const L = (w = 700, wide = 0) => `font-family:Lemon;font-weight:${w};font-variation-settings:'Wide' ${wide}`;

function flower(n: number, r1: number, r2: number, cx = 150, cy = 150) {
  let d = '';
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r2 : r1;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1);
  }
  return d + 'Z';
}
function scallop(n: number, r: number, b: number, cx = 150, cy = 150) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
    const c = [cx + Math.cos(am) * (r + b), cy + Math.sin(am) * (r + b)];
    d += (i ? '' : `M${p0[0].toFixed(1)},${p0[1].toFixed(1)}`) + `Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
  }
  return d + 'Z';
}

export type StickerKind = 'feedme' | 'rap' | 'bowl' | 'micdrop' | 'rhymes' | 'block' | 'spray' | 'aldente';

export function stickerSvg(kind: StickerKind, uid: string): string {
  switch (kind) {
    case 'feedme':
      return `<svg viewBox="0 0 300 160"><ellipse cx="150" cy="80" rx="144" ry="74" fill="#FE0000" stroke="#000" stroke-width="6"/><ellipse cx="150" cy="80" rx="126" ry="58" fill="none" stroke="#000" stroke-width="3"/><text x="150" y="96" text-anchor="middle" font-size="42" style="${L(700, 10)}">FEED ME</text></svg>`;
    case 'rap':
      return `<svg viewBox="0 0 300 300"><defs><path id="rc-${uid}" d="M150,150 m-104,0 a104,104 0 1,1 208,0 a104,104 0 1,1 -208,0"/></defs><circle cx="150" cy="150" r="144" fill="#FF8800" stroke="#000" stroke-width="6"/><text font-size="37" style="${L(700)}" letter-spacing="1"><textPath href="#rc-${uid}">Rap Beats. Hot Eats. ✦ Rap Beats.</textPath></text><polyline points="92,152 122,152 134,122 150,186 164,106 178,152 208,152" fill="none" stroke="#000" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    case 'bowl':
      return `<svg viewBox="0 0 300 300"><path d="M150 8 L272 78 L272 222 L150 292 L28 222 L28 78Z" fill="#FFCE53" stroke="#000" stroke-width="7"/><path d="M76 150 H224 A74 74 0 0 1 76 150Z" fill="none" stroke="#000" stroke-width="9" stroke-linejoin="round"/><path d="M96 150 C106 120 124 150 134 120 C144 150 160 118 170 150 C180 122 196 150 204 132" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round"/><path d="M168 118 L220 70 M182 124 L238 86" stroke="#000" stroke-width="8" stroke-linecap="round"/></svg>`;
    case 'micdrop':
      return `<svg viewBox="0 0 300 300"><path d="${scallop(14, 122, 20)}" fill="#FFCE53" stroke="#000" stroke-width="6"/><text x="150" y="144" text-anchor="middle" font-size="31" style="${L(700, 10)}">MIC DROP</text><text x="150" y="184" text-anchor="middle" font-size="31" style="${L(700, 10)}">FORK UP</text></svg>`;
    case 'rhymes':
      return `<svg viewBox="0 0 300 300"><path d="${flower(12, 146, 108)}" fill="#8B3A96" stroke="#000" stroke-width="6"/><text x="150" y="168" text-anchor="middle" font-size="62" font-family="Don Graffiti" fill="#000">RHYMES</text></svg>`;
    case 'block':
      return `<svg viewBox="0 0 300 300"><defs><path id="bc-${uid}" d="M150,150 m-106,0 a106,106 0 1,1 212,0 a106,106 0 1,1 -212,0"/></defs><circle cx="150" cy="150" r="144" fill="#63CFFE" stroke="#000" stroke-width="6"/><circle cx="150" cy="150" r="78" fill="none" stroke="#000" stroke-width="3"/><text font-size="32" style="${L(700)}" letter-spacing="2"><textPath href="#bc-${uid}">From the block to the bowl · From the block</textPath></text><path d="${flower(5, 34, 14)}" fill="#000"/></svg>`;
    case 'spray':
      return `<svg viewBox="0 0 360 130"><rect x="4" y="4" width="352" height="122" fill="#FF8800" stroke="#000" stroke-width="7"/><rect x="18" y="18" width="324" height="94" fill="none" stroke="#000" stroke-width="3"/><text x="180" y="78" text-anchor="middle" font-size="30" style="${L(700, 10)}">THE SPRAYLIST</text></svg>`;
    case 'aldente':
      return `<svg viewBox="0 0 300 330"><path d="M150 8 L290 50 L270 210 Q250 290 150 322 Q50 290 30 210 L10 50Z" fill="#8B3A96" stroke="#000" stroke-width="7"/><text x="150" y="150" text-anchor="middle" font-size="70" font-family="Don Graffiti" fill="#000">AL</text><text x="150" y="222" text-anchor="middle" font-size="70" font-family="Don Graffiti" fill="#000">DENTE</text></svg>`;
  }
}

export type StickerPos = { kind: StickerKind; x: string; y: string; w: string; r: number };
// Položaji iz prototipa
export const GATE_STICKERS: StickerPos[] = [
  { kind: 'feedme', x: '5%', y: '17%', w: 'clamp(120px,14vw,220px)', r: -9 },
  { kind: 'micdrop', x: '27%', y: '27%', w: 'clamp(90px,9vw,140px)', r: 10 },
  { kind: 'bowl', x: '15%', y: '37%', w: 'clamp(64px,6vw,96px)', r: -6 },
  { kind: 'rap', x: '35%', y: '50%', w: 'clamp(90px,10vw,150px)', r: 8 },
];
export const HERO_STICKERS: StickerPos[] = [
  { kind: 'feedme', x: '5%', y: '12%', w: 'clamp(130px,15vw,230px)', r: -8 },
  { kind: 'rap', x: '77%', y: '9%', w: 'clamp(100px,11vw,170px)', r: 10 },
  { kind: 'rhymes', x: '24%', y: '62%', w: 'clamp(90px,10vw,150px)', r: 12 },
  { kind: 'micdrop', x: '70%', y: '58%', w: 'clamp(100px,10.5vw,160px)', r: -7 },
  { kind: 'bowl', x: '10%', y: '70%', w: 'clamp(70px,7.5vw,118px)', r: -5 },
  { kind: 'block', x: '86%', y: '40%', w: 'clamp(84px,8.5vw,130px)', r: 6 },
];
