const progress = document.getElementById('progress');
const topbar = document.getElementById('topbar');
window.addEventListener('scroll', ()=>{
  const h = document.documentElement;
  progress.style.transform = `scaleX(${h.scrollTop/(h.scrollHeight-h.clientHeight||1)})`;
  topbar.classList.toggle('scrolled', window.scrollY > 40);
},{passive:true});

const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:.1});
document.querySelectorAll('.r').forEach(el=>io.observe(el));

const cursor = document.getElementById('cursor');
if(matchMedia('(pointer:fine)').matches){
  let mx=0,my=0,cx=0,cy=0;
  window.addEventListener('pointermove', e=>{ mx=e.clientX; my=e.clientY; });
  (function loop(){ cx += (mx-cx)*.2; cy += (my-cy)*.2; cursor.style.left = cx+'px'; cursor.style.top = cy+'px'; requestAnimationFrame(loop); })();
}
document.querySelectorAll('.yr').forEach(el=>el.textContent = new Date().getFullYear());

/* bottom dock: show after a short delay (no page is active here) */
const dock = document.getElementById('dock');
setTimeout(()=>dock.classList.add('show'), 150);

/* show the Admin link only for the admin account */
showAdminLinkIfAdmin();
