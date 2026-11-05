/* registers the offline / install support (public pages only) */
if('serviceWorker' in navigator && location.protocol === 'https:'){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
