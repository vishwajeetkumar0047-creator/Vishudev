/* Supabase connection for the whole site.
   The publishable key is safe to show in the browser. Real security is set in the
   database (Row Level Security), so changing this file cannot give anyone admin rights. */
const SUPABASE_URL = 'https://rlpdzahhbcngqnynmzie.supabase.co';
const SUPABASE_KEY = 'sb_publishable_6NT9wjYXWKHbQrwQFFHKiQ_ypV1ER2v';
const ADMIN_EMAIL = 'vishwajeetp268@gmail.com';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* remove accounts and packages saved by the old browser-only version of the site */
['vishu_store_users', 'vishu_store_session', 'vishu_store_packages'].forEach(k => {
  try { localStorage.removeItem(k); } catch (e) {}
});

/* only https links or mailto links are allowed from site settings */
function safeLink(v){
  return /^https:\/\/[^\s]+$/.test(v) || /^mailto:[^\s]+$/.test(v);
}

/* friendly text for common login errors */
function authErrorText(error){
  const m = (error && error.message || '').toLowerCase();
  if(m.includes('invalid login')) return 'Incorrect email or password.';
  if(m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists. Log in instead.';
  if(m.includes('password should be at least')) return 'Password must be at least 8 characters.';
  if(m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  return error && error.message ? error.message : 'Something went wrong. Please try again.';
}

/* show the Admin link in the menu only for the admin account (UI only; the database enforces the real rules) */
function showAdminLinkIfAdmin(){
  db.auth.getSession().then(({data}) => {
    if(data.session && data.session.user.email === ADMIN_EMAIL){
      document.querySelectorAll('#adminLink,#adminDock').forEach(el => el.hidden = false);
    }
  });
}

/* analytics: count a page view (the admin page is not counted) */
function whenIdle(fn){
  if('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 3000 });
  else setTimeout(fn, 1500);
}
whenIdle(function recordPageView(){
  const path = (location.pathname.split('/').pop() || 'index.html').slice(0, 200);
  if(path === 'admin.html') return;
  db.from('page_views').insert({ path, referrer: (document.referrer || '').slice(0, 300) })
    .then(() => {}, () => {});
});

/* site settings from the admin panel.
   data-setting-text="key"  -> text is replaced with the value
   data-setting-href="key"  -> link is set to the value (email keys become mailto:)
   data-hide-empty          -> the link is hidden when the value is empty */
async function applySiteSettings(){
  const { data, error } = await db.from('site_settings').select('key,value');
  if(error || !data) return;
  const map = Object.fromEntries(data.map(r => [r.key, r.value]));
  document.querySelectorAll('[data-setting-text]').forEach(el => {
    const v = map[el.dataset.settingText];
    if(v) el.textContent = v;
  });
  document.querySelectorAll('[data-setting-href]').forEach(el => {
    const key = el.dataset.settingHref, v = (map[key] || '').trim();
    if(el.hasAttribute('data-hide-empty')) el.hidden = !v;
    if(!v) return;
    const href = key === 'contact_email' ? 'mailto:' + v : v;
    if(safeLink(href)) el.href = href; else el.hidden = true;
  });
}
if(!location.pathname.endsWith('admin.html')) whenIdle(applySiteSettings);   // the admin page does not need public settings

/* shopping cart: kept in this browser, and also saved to the account when the client is logged in,
   so the same cart shows on another device. */
const CART_KEY = 'vishu_cart';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function getCart(){
  try {
    const a = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(a) ? a.filter(x => typeof x === 'string' && UUID_RE.test(x)) : [];
  } catch(e) { return []; }
}
function saveCartLocal(ids){
  try { localStorage.setItem(CART_KEY, JSON.stringify([...new Set(ids)])); } catch(e) {}
  updateCartBadges();
}
async function currentUserId(){
  const { data } = await db.auth.getSession();
  return data.session ? data.session.user.id : null;
}
/* keep the account's cart in step with this browser's cart */
async function syncCart(){
  const uid = await currentUserId();
  if(!uid) return;
  const { data, error } = await db.from('cart_items').select('package_id');
  if(error) return;
  const remote = data.map(r => r.package_id);
  const merged = [...new Set([...getCart(), ...remote])];
  saveCartLocal(merged);
  const missing = merged.filter(id => !remote.includes(id));
  if(missing.length) await db.from('cart_items').upsert(missing.map(id => ({ user_id: uid, package_id: id })), { onConflict: 'user_id,package_id', ignoreDuplicates: true });
}
async function accountCartAdd(id){
  const uid = await currentUserId(); if(!uid) return;
  await db.from('cart_items').upsert({ user_id: uid, package_id: id }, { onConflict: 'user_id,package_id', ignoreDuplicates: true });
}
async function accountCartRemove(id){
  const uid = await currentUserId(); if(!uid) return;
  await db.from('cart_items').delete().eq('user_id', uid).eq('package_id', id);
}
async function accountCartReplace(ids){
  const uid = await currentUserId(); if(!uid) return;
  await db.from('cart_items').delete().eq('user_id', uid);
  if(ids.length) await db.from('cart_items').insert(ids.map(id => ({ user_id: uid, package_id: id })));
}
function addToCart(id){
  const c = getCart(); if(!c.includes(id)) c.push(id);
  saveCartLocal(c);
  accountCartAdd(id);
}
function removeFromCart(id){
  saveCartLocal(getCart().filter(x => x !== id));
  accountCartRemove(id);
}
function saveCart(ids){
  saveCartLocal(ids);
  accountCartReplace(ids);
}
function updateCartBadges(){
  const n = getCart().length;
  document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = n);
}
document.addEventListener('DOMContentLoaded', updateCartBadges);

/* error monitoring: problems in the browser are reported so the admin can see them */
function reportError(message){
  db.from('client_errors').insert({ page: location.pathname.split('/').pop() || 'index.html', message: String(message || 'unknown error').slice(0, 1000) })
    .then(() => {}, () => {});
}
window.addEventListener('error', e => reportError(e.message + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')));
window.addEventListener('unhandledrejection', e => reportError('promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));
