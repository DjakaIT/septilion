// Testovi uredništva za Node pozadinu (npm start). Testovi su u api.mjs.
process.env.UREDNISTVO_POSLUZITELJ = 'node';
await import('./api.mjs');
