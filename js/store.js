/* Store page: login with Supabase Auth, packages read from the database */
const CONTACT_URL = 'contact.html';

/* auth UI */
let mode = 'login';
const tabs = document.getElementById('tabs');
const form = document.getElementById('authForm');
const emailEl = document.getElementById('email');
const pwEl = document.getElementById('password');
const confirmRow = document.getElementById('confirmRow');
const confirmEl = document.getElementById('confirm');
const submitBtn = document.getElementById('submitBtn');
const msg = document.getElementById('msg');
const authBox = document.getElementById('authBox');

function setMode(m){
  mode = m;
  tabs.classList.toggle('signup', m==='signup');
  tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.mode===m));
  confirmRow.hidden = m!=='signup';
  document.getElementById('forgotRow').hidden = m!=='login';
  submitBtn.textContent = m==='signup' ? 'Create account →' : 'Log in →';
  msg.textContent=''; msg.className='msg';
}
tabs.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>setMode(b.dataset.mode)));

function showError(text){
  msg.textContent = text; msg.className = 'msg err';
  authBox.classList.remove('shake'); void authBox.offsetWidth; authBox.classList.add('shake');
}

function showInfo(text){ msg.textContent = text; msg.className = 'msg ok'; }

document.getElementById('forgotBtn').addEventListener('click', async ()=>{
  const email = emailEl.value.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)) return showError('Type your email above first, then click Forgot password.');
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: new URL('reset.html', location.href).href });
  if(error) return showError(authErrorText(error));
  showInfo('If an account exists for this email, a reset link is on its way. Check your inbox.');
});

form.addEventListener('submit', async e=>{
  e.preventDefault();
  const email = emailEl.value.trim().toLowerCase();
  const pw = pwEl.value;
  if(!/^\S+@\S+\.\S+$/.test(email)) return showError('Enter a valid email address.');
  if(pw.length < 8) return showError('Password must be at least 8 characters.');

  submitBtn.disabled = true;
  try{
    if(mode === 'signup'){
      if(pw !== confirmEl.value) return showError('Passwords do not match.');
      const { data, error } = await db.auth.signUp({ email, password: pw });
      if(error) return showError(authErrorText(error));
      if(data.session){
        await showStore(email);
      } else {
        setMode('login');
        showInfo('Account created. Check your email for the confirmation link, then log in.');
      }
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password: pw });
      if(error) return showError(authErrorText(error));
      await showStore(data.user.email);
    }
  } finally {
    submitBtn.disabled = false;
  }
});

/* views */
const gate = document.getElementById('gate');
const app = document.getElementById('app');
const who = document.getElementById('who');
const whoEmail = document.getElementById('whoEmail');

const GROUP_TIME = {'Discord bots':'Setup in 3–7 days', 'Websites':'Setup in 1–3 weeks'};

async function loadPackages(){
  const { data, error } = await db.from('packages')
    .select('*, package_images(image_url, sort_order)')
    .order('sort_order').order('created_at');
  if(error) return null;
  return data.map(r => {
    const gallery = (r.package_images || []).slice().sort((a,b)=>a.sort_order-b.sort_order).map(g => g.image_url);
    const photos = (gallery.length ? gallery : [r.image_url]).filter(u => u && /^https:\/\//.test(u));
    return {
      id: r.id, group: r.group_name, tier: r.tier, name: r.name, desc: r.description,
      features: r.features || [], price: r.price, hot: r.is_hot, photos,
      amount: r.price_amount, extra: r.extra_note || '', free: !!r.is_free, created: r.created_at || ''
    };
  });
}

/* photo gallery on each card: main photo, prev/next, thumbnails, click to enlarge */
const galleries = {};   // package id -> [photo urls]
const galIndex = {};    // package id -> currently shown photo
function photoGallery(p){
  const photos = p.photos || [];
  if(!photos.length) return '';
  galleries[p.id] = photos; galIndex[p.id] = 0;
  const id = esc(p.id), n = photos.length;
  return `
    <div class="gal" data-gal="${id}">
      <div class="gal-stage">
        <button class="gal-main" type="button" data-zoom="${id}" aria-label="Open photo full size">
          <img class="pkg-img" src="${esc(photos[0])}" alt="${esc(p.name)}" loading="lazy" decoding="async">
        </button>
        ${n > 1 ? `
          <button class="gal-arrow gal-prev" type="button" data-step="-1" data-pid="${id}" aria-label="Previous photo">‹</button>
          <button class="gal-arrow gal-next" type="button" data-step="1" data-pid="${id}" aria-label="Next photo">›</button>
          <span class="gal-pos mono" data-pos="${id}">1 / ${n}</span>` : ''}
      </div>
      ${n > 1 ? `<div class="gal-dots">${photos.map((u,i)=>`<button class="gal-dot${i===0?' on':''}" type="button" data-dot="${i}" data-pid="${id}" aria-label="Show photo ${i+1}"></button>`).join('')}</div>` : ''}
    </div>`;
}
function showPhoto(pid, i){
  const list = galleries[pid]; if(!list || !list.length) return;
  galIndex[pid] = (i + list.length) % list.length;
  const card = document.querySelector(`.gal[data-gal="${CSS.escape(pid)}"]`); if(!card) return;
  card.querySelector('.gal-main img').src = list[galIndex[pid]];
  const pos = card.querySelector(`[data-pos="${CSS.escape(pid)}"]`);
  if(pos) pos.textContent = `${galIndex[pid]+1} / ${list.length}`;
  card.querySelectorAll('.gal-dot').forEach((d,k)=>d.classList.toggle('on', k===galIndex[pid]));
}

/* full-size preview */
const lb = document.getElementById('lightbox');
let lbList = [], lbPos = 0;
function openLightbox(pid, i){
  lbList = galleries[pid] || []; lbPos = i || 0;
  lbShow(); lb.showModal();
}
function lbShow(){
  if(!lbList.length) return;
  lbPos = (lbPos + lbList.length) % lbList.length;
  document.getElementById('lbImg').src = lbList[lbPos];
  document.getElementById('lbPos').textContent = lbList.length > 1 ? `${lbPos+1} / ${lbList.length}` : '';
  document.getElementById('lbPrev').hidden = document.getElementById('lbNext').hidden = lbList.length < 2;
}
document.getElementById('lbClose').addEventListener('click', ()=> lb.close());
document.getElementById('lbPrev').addEventListener('click', ()=>{ lbPos--; lbShow(); });
document.getElementById('lbNext').addEventListener('click', ()=>{ lbPos++; lbShow(); });
lb.addEventListener('click', e => { if(e.target === lb) lb.close(); });   // click outside the photo closes it
document.addEventListener('keydown', e => {
  if(!lb.open) return;
  if(e.key === 'ArrowLeft'){ lbPos--; lbShow(); }
  if(e.key === 'ArrowRight'){ lbPos++; lbShow(); }
});

/* ---------- filter and sort ---------- */
const view = { price:'all', cat:'all', sort:'relevant' };
let catalog = [];

function visiblePackages(){
  let list = catalog.filter(p =>
    (view.price === 'all' || (view.price === 'free' ? p.free : !p.free)) &&
    (view.cat === 'all' || p.group === view.cat));
  // a price for sorting: free = 0, "price on request" goes last
  const priceOf = p => p.free ? 0 : (p.amount ? Number(p.amount) : Infinity);
  if(view.sort === 'recent') list = list.slice().sort((a,b) => String(b.created).localeCompare(String(a.created)));
  else if(view.sort === 'low') list = list.slice().sort((a,b) => priceOf(a) - priceOf(b));
  else if(view.sort === 'high') list = list.slice().sort((a,b) => (isFinite(priceOf(b)) ? priceOf(b) : -1) - (isFinite(priceOf(a)) ? priceOf(a) : -1));
  else list = list.slice().sort((a,b) => (b.hot - a.hot));   // most relevant: popular first, then the admin's order
  return list;
}

function applyView(){
  const wrap = document.getElementById('packages');
  const empty = document.getElementById('empty');
  const list = visiblePackages();
  const filtered = view.price !== 'all' || view.cat !== 'all';
  document.getElementById('resultCount').textContent = `${list.length} of ${catalog.length} shown`;
  document.getElementById('filterCount').hidden = !filtered;
  document.getElementById('filterCount').textContent = filtered ? '•' : '';
  document.querySelectorAll('[data-f-price]').forEach(b => b.classList.toggle('on', b.dataset.fPrice === view.price));
  document.querySelectorAll('[data-f-cat]').forEach(b => b.classList.toggle('on', b.dataset.fCat === view.cat));
  document.querySelectorAll('[data-f-sort]').forEach(b => b.classList.toggle('on', b.dataset.fSort === view.sort));
  if(!list.length){
    wrap.innerHTML = catalog.length
      ? '<div class="empty r in"><h3>No packages match these filters.</h3><p>Try another price or category, or <button class="linkbtn" type="button" id="noMatchReset">reset filters</button>.</p></div>'
      : '';
    empty.hidden = catalog.length > 0; if(!catalog.length) empty.classList.add('in');
    return;
  }
  empty.hidden = true;
  // keep the category groups in the order they first appear in the sorted list
  const groups = [...new Set(list.map(p => p.group))];
  wrap.innerHTML = groups.map(g => {
    const items = list.filter(p => p.group === g);
    return `
    <div class="pkg-group">
      <div class="pkg-title r in"><h3>${esc(g)}</h3><span>${esc(GROUP_TIME[g] || '')}</span></div>
      <div class="pkgs">
        ${items.map((p,i) => `
          <article class="pkg ${p.hot ? 'hot' : ''} r in" style="--d:${i*.1}s">
            ${photoGallery(p)}
            <div class="tier"><span>${esc(p.tier || '')}</span><span>${p.free ? 'FREE' : (p.amount ? 'PAID' : '')}</span></div>
            <h4>${esc(p.name)}</h4>
            <p>${esc(p.desc || '')}</p>
            <ul>${(p.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
            ${p.extra ? `<p class="extra"><b>Not included:</b> ${esc(p.extra)}</p>` : ''}
            <div class="price"><b>${esc(p.free ? 'Free' : (p.amount ? '₹' + Number(p.amount).toLocaleString('en-IN') : (p.price || 'Price on request')))}</b>
              ${(p.free || p.amount)
                ? (getCart().includes(p.id)
                    ? `<button class="buy" type="button" data-cart="${esc(p.id)}" disabled>In cart ✓</button>`
                    : `<button class="buy" type="button" data-cart="${esc(p.id)}">${p.free ? 'Get it free +' : 'Add to cart +'}</button>`)
                : `<a class="buy" href="${CONTACT_URL}">Enquire →</a>`}
            </div>
          </article>`).join('')}
      </div>
    </div>`;
  }).join('');
  // a photo that cannot be loaded is removed quietly, the card still looks right
  wrap.querySelectorAll('.gal img').forEach(img => {
    img.addEventListener('error', () => {
      const holder = img.closest('.gal-thumb, .gal-main');
      if(holder) holder.remove();
    }, { once: true });
  });
}

async function renderPackages(){
  const list = await loadPackages();
  if(list === null){
    document.getElementById('packages').innerHTML = '<p class="msg err">Could not load packages. Please refresh the page.</p>';
    document.getElementById('empty').hidden = true; return;
  }
  catalog = list;
  applyView();
}

/* filter & sort controls */
document.getElementById('filterBtn').addEventListener('click', () => {
  const panel = document.getElementById('filterPanel');
  panel.hidden = !panel.hidden;
  document.getElementById('filterBtn').setAttribute('aria-expanded', String(!panel.hidden));
});
document.getElementById('app').addEventListener('click', e => {
  const p = e.target.closest('[data-f-price]'); if(p){ view.price = p.dataset.fPrice; applyView(); return; }
  const c = e.target.closest('[data-f-cat]'); if(c){ view.cat = c.dataset.fCat; applyView(); return; }
  const o = e.target.closest('[data-f-sort]'); if(o){ view.sort = o.dataset.fSort; applyView(); return; }
  if(e.target.closest('#filterReset')){ view.price = 'all'; view.cat = 'all'; view.sort = 'relevant'; applyView(); return; }
  if(e.target.closest('#noMatchReset')){ view.price = 'all'; view.cat = 'all'; applyView(); return; }
});

async function showStore(email){
  gate.hidden = true;
  app.hidden = false;
  who.hidden = false;
  whoEmail.textContent = email;
  await syncCart();          // the account's cart shows here, on any device
  await renderPackages();
  window.scrollTo({top:0,behavior:'instant'});
}
function showGate(){
  app.hidden = true;
  who.hidden = true;
  gate.hidden = false;
  form.reset();
  setMode('login');
  gate.querySelectorAll('.r').forEach(el=>el.classList.add('in'));
}
document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await db.auth.signOut();
  showGate();
});

function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

document.getElementById('packages').addEventListener('click', e=>{
  const step = e.target.closest('[data-step]');
  if(step){ showPhoto(step.dataset.pid, galIndex[step.dataset.pid] + Number(step.dataset.step)); return; }
  const dot = e.target.closest('[data-dot]');
  if(dot){ showPhoto(dot.dataset.pid, Number(dot.dataset.dot)); return; }
  const zoom = e.target.closest('[data-zoom]');
  if(zoom){ openLightbox(zoom.dataset.zoom, galIndex[zoom.dataset.zoom]); return; }
  const b = e.target.closest('[data-cart]'); if(!b || b.disabled) return;
  addToCart(b.dataset.cart);
  b.disabled = true; b.textContent = 'In cart ✓';
});

/* start: if already logged in, go straight to the packages */
(async function start(){
  const { data } = await db.auth.getSession();
  if(data.session) await showStore(data.session.user.email); else showGate();
})();

/* reveal */
const io = new IntersectionObserver(entries=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
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

/* dock */
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

/* cursor */
const cursor = document.getElementById('cursor');
if(matchMedia('(pointer:fine)').matches){
  let mx=0,my=0,cx=0,cy=0;
  window.addEventListener('pointermove', e=>{ mx=e.clientX; my=e.clientY; });
  (function loop(){ cx += (mx-cx)*.2; cy += (my-cy)*.2; cursor.style.left = cx+'px'; cursor.style.top = cy+'px'; requestAnimationFrame(loop); })();
}

document.querySelectorAll('.yr').forEach(el=>el.textContent = new Date().getFullYear());
/* show the Admin link only for the admin account */
showAdminLinkIfAdmin();
