/* typing terminal */
const script = [
  {t:'dim', x:'// new website\n'},
  {t:'hi',  x:'const site = await build({\n'},
  {t:'',    x:'  type: "portfolio | landing | dashboard",\n  design: "minimal",\n  mobile: true\n});\n\n'},
  {t:'dim', x:'// new discord bot\n'},
  {t:'hi',  x:'client.on("interactionCreate", handle);\n'},
  {t:'em',  x:'> moderation ✓  tickets ✓  leveling ✓  anti-nuke ✓\n'}
];
const typer = document.getElementById('typer');
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const wrapSeg = (c,t) => c ? `<span class="${c}">${esc(t)}</span>` : esc(t);
let si = 0, ci = 0;
function typeStep(){
  if(si >= script.length){
    typer.innerHTML = script.map(s=>wrapSeg(s.t,s.x)).join('') + '<span class="caret"></span>';
    setTimeout(()=>{ si=0; ci=0; typeStep(); }, 4000);
    return;
  }
  const seg = script[si];
  ci++;
  const done = script.slice(0,si).map(s=>wrapSeg(s.t,s.x)).join('');
  typer.innerHTML = done + wrapSeg(seg.t, seg.x.slice(0,ci)) + '<span class="caret"></span>';
  if(ci >= seg.x.length){ si++; ci = 0; }
  setTimeout(typeStep, 22);
}
if(!matchMedia('(prefers-reduced-motion: reduce)').matches) typeStep();
else typer.innerHTML = script.map(s=>wrapSeg(s.t,s.x)).join('');

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
document.querySelectorAll('.r, .words, #steps, .botCard').forEach(el=>io.observe(el));

/* progress + header */
const progress = document.getElementById('progress');
const topbar = document.getElementById('topbar');
window.addEventListener('scroll', ()=>{
  const h = document.documentElement;
  progress.style.transform = `scaleX(${h.scrollTop/(h.scrollHeight-h.clientHeight||1)})`;
  topbar.classList.toggle('scrolled', window.scrollY > 40);
},{passive:true});

/* dock + header scroll-spy */
const dock = document.getElementById('dock');
const pill = document.getElementById('pill');
const dockLinks = [...dock.querySelectorAll('a')];
const headLinks = [...topbar.querySelectorAll('[data-link]')];
function movePill(a){
  const r = a.getBoundingClientRect(), d = dock.getBoundingClientRect();
  pill.style.left = (r.left - d.left) + 'px';
  pill.style.width = r.width + 'px';
}
function setActive(name){
  dockLinks.forEach(a=>{
    const on = a.dataset.id === name;
    a.classList.toggle('active', on);
    if(on) movePill(a);
  });
  headLinks.forEach(a=>a.classList.toggle('on', a.dataset.link === name));
}
const spyMap = {home:'home', work:'home', about:'about', store:'store', services:'services', contact:'contact'};
const spy = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting && spyMap[e.target.id]) setActive(spyMap[e.target.id]);
  });
},{rootMargin:'-45% 0px -45% 0px'});
document.querySelectorAll('section[id]').forEach(s=>spy.observe(s));
setActive('home');
setTimeout(()=>dock.classList.add('show'), 150);
window.addEventListener('resize', ()=>{
  const a = dockLinks.find(x=>x.classList.contains('active')); if(a) movePill(a);
});

/* cursor + magnetic + tilt */
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
  document.addEventListener('pointerover', e=>{
    if(e.target.closest('.card, .svc-col, .stat, .pkg')) cursor.classList.add('big');
  });
  document.addEventListener('pointerout', e=>{
    if(e.target.closest('.card, .svc-col, .stat, .pkg')) cursor.classList.remove('big');
  });
  document.querySelectorAll('.links a, .mail, .cta, .dock a').forEach(el=>{
    el.addEventListener('pointermove', e=>{
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX-(r.left+r.width/2))*.12}px,${(e.clientY-(r.top+r.height/2))*.2}px)`;
    });
    el.addEventListener('pointerleave', ()=>{ el.style.transform=''; });
  });
  document.querySelectorAll('.bento .card, .pkg').forEach(card=>{
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
