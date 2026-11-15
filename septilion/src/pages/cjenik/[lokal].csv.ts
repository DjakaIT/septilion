// Cjenik u strojno čitljivom obliku (obveza objave cjenika na mrežnim stranicama, od 17. 11. 2026.): po lokalu jedan
// CSV, redak po cijeni (jelo s dvije veličine ima dva retka), uz aktualnu i baznu cijenu. Gradi se iz istih podataka
// kao stranica, pa ga svaka objava iz uredništva osvježi. UTF-8 s BOM-om i ";" da ga Excel otvori ispravno.
import type { APIRoute } from 'astro';
import { SIDE_A, SALADS, SIDES, baseOf } from '../../data/pasta';
import { JELLY_MENU } from '../../data/jelly-menu';

export const getStaticPaths = () => [{ params: { lokal: 'pasta-rhymes' } }, { params: { lokal: 'jellyfish-in-space' } }];

type Red = { naziv: string; kategorija: string; kolicina: string; cijena: number; bazna: number; datum: string };
const ZAGLAVLJE = ['Naziv', 'Kategorija', 'Količina', 'Maloprodajna cijena (EUR)', 'Posebni oblik prodaje', 'Bazna cijena (EUR)', 'Datum bazne cijene'];
const eur = (v: number) => v.toFixed(2).replace('.', ',');
const datum = (iso: string) => iso.split('-').reverse().join('.') + '.';
const polje = (s: string) => (/[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);

function pasta(): Red[] {
  return ([['Tjestenine', SIDE_A], ['Salate', SALADS], ['Prilozi', SIDES]] as const).flatMap(([kategorija, jela]) =>
    jela.map((x) => { const b = baseOf(x); return { naziv: x.name, kategorija, kolicina: '', cijena: x.price, bazna: b.prices[0], datum: b.date }; }));
}

function jelly(): Red[] {
  return JELLY_MENU.flatMap((c) => c.groups.flatMap((g) => g.items.flatMap((i) => i.prices.map((p, k) => ({
    naziv: i.name.hr, kategorija: g.title ? `${c.title.hr} — ${g.title.hr}` : c.title.hr,
    kolicina: p.size ?? i.portion?.hr.split(/ ili /)[k] ?? '', cijena: p.amount, bazna: i.base.prices[k] ?? p.amount, datum: i.base.date,
  })))));
}

export const GET: APIRoute = ({ params }) => {
  const redovi = params.lokal === 'pasta-rhymes' ? pasta() : jelly();
  const csv = [ZAGLAVLJE, ...redovi.map((r) => [r.naziv, r.kategorija, r.kolicina, eur(r.cijena), 'ne', eur(r.bazna), datum(r.datum)])]
    .map((r) => r.map(polje).join(';')).join('\r\n');
  return new Response(`﻿${csv}\r\n`, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
