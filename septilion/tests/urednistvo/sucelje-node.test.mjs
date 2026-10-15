// Sučelje uredništva u pregledniku, Node pozadina (npm start). Testovi su u sucelje.mjs.
process.env.UREDNISTVO_POSLUZITELJ = 'node';
await import('./sucelje.mjs');
