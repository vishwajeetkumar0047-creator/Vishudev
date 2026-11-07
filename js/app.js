/* Installable app support (public pages).
   1. registers the offline service worker (HTTPS only)
   2. shows an "Install app" button in the footer when the browser allows installing */
if('serviceWorker' in navigator && location.protocol === 'https:'){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

let deferredPrompt = null;

function addInstallButton(){
  const row = document.querySelector('.site-footer .sf-legal');
  if(!row || document.getElementById('installBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'installBtn';
  btn.type = 'button';
  btn.className = 'sf-install';
  btn.hidden = true;                  // shown only when the browser can install the app
  btn.textContent = 'Install app';
  btn.addEventListener('click', async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    btn.hidden = true;
  });
  row.appendChild(btn);
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();                 // keep the prompt so our button can show it
  deferredPrompt = e;
  addInstallButton();
  const btn = document.getElementById('installBtn');
  if(btn) btn.hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = document.getElementById('installBtn');
  if(btn) btn.hidden = true;
});

/* the button is hidden until the browser says the app can be installed */
document.addEventListener('DOMContentLoaded', addInstallButton);
