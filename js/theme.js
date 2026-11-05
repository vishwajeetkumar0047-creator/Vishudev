/* light / dark mode. Loaded in <head> so the saved theme is applied before the page shows. */
(function(){
  const KEY = 'vishu_theme';
  const root = document.documentElement;
  const apply = t => root.setAttribute('data-theme', t);
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch(e) {}
  apply(saved === 'dark' ? 'dark' : 'light');

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeBtn');
    if(!btn) return;
    const sync = () => {
      const dark = root.getAttribute('data-theme') === 'dark';
      btn.textContent = dark ? '☀' : '☾';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    };
    sync();
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch(e) {}
      sync();
    });
  });
})();
