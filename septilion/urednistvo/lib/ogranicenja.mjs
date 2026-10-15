// Ograničenje pokušaja (zaštita od pogađanja lozinki i kodova). U memoriji, klizni prozor.
export function ogranicenje({ prozorMs, najvise }) {
  const mapa = new Map();
  const ciscenje = setInterval(() => {
    const t = Date.now();
    for (const [k, v] of mapa) if (v.every((x) => t - x > prozorMs)) mapa.delete(k);
  }, 60_000);
  ciscenje.unref();
  const svjezi = (k) => (mapa.get(k) ?? []).filter((x) => Date.now() - x < prozorMs);
  return {
    /** @returns {number} sekundi čekanja (0 = smije) */
    cekaj(k) {
      const v = svjezi(k);
      return v.length < najvise ? 0 : Math.ceil((prozorMs - (Date.now() - v[0])) / 1000);
    },
    zabiljezi(k) { const v = svjezi(k); v.push(Date.now()); mapa.set(k, v); },
    ponisti(k) { mapa.delete(k); },
  };
}
