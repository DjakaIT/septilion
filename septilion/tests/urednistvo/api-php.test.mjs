// Testovi uredništva za PHP pozadinu (hosting). Testovi su u api.mjs; PHP iz PHP_BINARY ili PATH-a.
process.env.UREDNISTVO_POSLUZITELJ = 'php';
await import('./api.mjs');
