/* split heading words */
document.querySelectorAll('[data-words]').forEach(el=>{
  const words = el.textContent.trim().split(' ');
  el.innerHTML = words.map((w,i)=>`<span style="--i:${i}">${w}</span>`).join(' ');
  el.classList.add('words');
});

/* reveal on scroll */
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
  });
},{threshold:.15});
document.querySelectorAll('.r, .words, #steps').forEach(el=>io.observe(el));

/* progress + header */
const progress = document.getElementById('progress');
const topbar = document.getElementById('topbar');
window.addEventListener('scroll', ()=>{
  const h = document.documentElement;
  progress.style.transform = `scaleX(${h.scrollTop/(h.scrollHeight-h.clientHeight||1)})`;
  topbar.classList.toggle('scrolled', window.scrollY > 40);
},{passive:true});

/* dock active pill */
const dock = document.getElementById('dock');
const pill = document.getElementById('pill');
const dockLinks = [...dock.querySelectorAll('a')];
function movePill(a){
  const r = a.getBoundingClientRect(), d = dock.getBoundingClientRect();
  pill.style.left = (r.left - d.left) + 'px';
  pill.style.width = r.width + 'px';
}
const current = dockLinks.find(a=>a.dataset.id==='services');
dockLinks.forEach(a=>a.classList.toggle('active', a===current));
movePill(current);
setTimeout(()=>dock.classList.add('show'), 150);
window.addEventListener('resize', ()=>movePill(current));

/* cursor + tilt */
const cursor = document.getElementById('cursor');
const fine = matchMedia('(pointer:fine)').matches;
let mx=0,my=0,cx=0,cy=0;
if(fine){
  window.addEventListener('pointermove', e=>{ mx=e.clientX; my=e.clientY; });
  (function loop(){
    cx += (mx-cx)*.2; cy += (my-cy)*.2;
    cursor.style.left = cx+'px'; cursor.style.top = cy+'px';
    requestAnimationFrame(loop);
  })();
  document.addEventListener('pointerover', e=>{ if(e.target.closest('.svc, .metric, .step')) cursor.classList.add('big'); });
  document.addEventListener('pointerout', e=>{ if(e.target.closest('.svc, .metric, .step')) cursor.classList.remove('big'); });
  document.querySelectorAll('.svc').forEach(card=>{
    card.addEventListener('pointermove', e=>{
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left)/r.width - .5;
      const y = (e.clientY - r.top)/r.height - .5;
      card.style.transform = `perspective(1100px) rotateX(${-y*3}deg) rotateY(${x*3}deg) translateY(-6px)`;
    });
    card.addEventListener('pointerleave', ()=>{ card.style.transform=''; });
  });
}

document.querySelectorAll('.yr').forEach(el=>el.textContent = new Date().getFullYear());
/* show the Admin link only for the admin account */
showAdminLinkIfAdmin();
