// Sučelje uredništva u pregledniku, PHP pozadina (hosting). Testovi su u sucelje.mjs.
process.env.UREDNISTVO_POSLUZITELJ = 'php';
await import('./sucelje.mjs');
