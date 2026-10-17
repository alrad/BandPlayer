// Register an offline shell. Vendor files are cached on first successful fetch.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline installation unavailable:', error)));
}
