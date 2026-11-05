/* contact form: saves the message to the database (shown in the admin Messages tab) */
document.getElementById('form').addEventListener('submit', handleSubmit);
async function handleSubmit(e){
  e.preventDefault();
  const btn = document.getElementById('sendBtn');
  const form = e.target;
  const original = 'Send message →';
  const features = [...form.querySelectorAll('.chips input:checked')]
    .map(i => i.nextElementSibling.textContent.trim());
  const row = {
    name: document.getElementById('cName').value.trim(),
    email: document.getElementById('cEmail').value.trim().toLowerCase(),
    project_type: document.getElementById('cProject').value,
    features,
    body: document.getElementById('cBody').value.trim()
  };
  btn.disabled = true; btn.textContent = 'Sending…';
  const { error } = await db.from('messages').insert(row);
  btn.disabled = false;
  if(error){
    btn.textContent = 'Could not send. Try again';
    setTimeout(()=>{ btn.textContent = original; }, 3000);
    return;
  }
  btn.textContent = 'Sent — thank you ✓';
  btn.classList.add('sent');
  setTimeout(()=>{ btn.textContent = original; btn.classList.remove('sent'); form.reset(); }, 3500);
}

/* reveal on scroll */
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
  });
},{threshold:.15});
document.querySelectorAll('.r').forEach(el=>io.observe(el));

/* progress + header */
const progress = document.getElementById('progress');
const topbar = document.getElementById('topbar');
window.addEventListener('scroll', ()=>{
  const h = document.documentElement;
  progress.style.transform = `scaleX(${h.scrollTop/(h.scrollHeight-h.clientHeight||1)})`;
  topbar.classList.toggle('scrolled', window.scrollY > 40);
},{passive:true});

/* dock pill */
const dock = document.getElementById('dock');
const pill = document.getElementById('pill');
const current = dock.querySelector('.active');
function movePill(a){
  const r = a.getBoundingClientRect(), d = dock.getBoundingClientRect();
  pill.style.left = (r.left - d.left) + 'px';
  pill.style.width = r.width + 'px';
}
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
  document.addEventListener('pointerover', e=>{ if(e.target.closest('.info, .btn')) cursor.classList.add('big'); });
  document.addEventListener('pointerout', e=>{ if(e.target.closest('.info, .btn')) cursor.classList.remove('big'); });
}

document.querySelectorAll('.yr').forEach(el=>el.textContent = new Date().getFullYear());
/* show the Admin link only for the admin account */
showAdminLinkIfAdmin();
