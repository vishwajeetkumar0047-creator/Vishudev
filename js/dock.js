/* bottom dock: highlights the current page and shows the dock after a short delay */
(function(){
  const dock = document.getElementById('dock');
  if(!dock) return;
  const pill = document.getElementById('pill');
  const current = dock.querySelector('.active');
  function movePill(a){
    if(!pill) return;
    if(!a){ pill.style.width = '0px'; return; }
    const r = a.getBoundingClientRect(), d = dock.getBoundingClientRect();
    pill.style.left = (r.left - d.left) + 'px';
    pill.style.width = r.width + 'px';
  }
  movePill(current);
  setTimeout(() => dock.classList.add('show'), 150);
  window.addEventListener('resize', () => movePill(current));
})();
