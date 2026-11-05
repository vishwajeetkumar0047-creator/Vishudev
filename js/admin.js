/* Admin panel: packages and accounts live in the Supabase database.
   Access is checked on the server (is_admin), so only the admin can change anything. */
const $ = id => document.getElementById(id);
function esc(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

let pkgs = [];          // packages as loaded from the database, in display order
let accountCount = 0;

/* ---------- auth ---------- */
let mode = 'login';
function setMode(m){
  mode = m;
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.mode===m));
  $('confirmRow').hidden = m!=='signup';
  $('submitBtn').textContent = m==='signup' ? 'Create account →' : 'Log in →';
  $('msg').textContent='';
}
document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));

$('authForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const email = $('email').value.trim().toLowerCase();
  const pw = $('password').value;
  const err = t => { $('msg').textContent=t; $('msg').className='msg err'; };
  const info = t => { $('msg').textContent=t; $('msg').className='msg ok'; };
  if(!/^\S+@\S+\.\S+$/.test(email)) return err('Enter a valid email.');
  if(pw.length<8) return err('Password must be at least 8 characters.');
  $('submitBtn').disabled = true;
  try{
    if(mode==='signup'){
      if(email !== ADMIN_EMAIL) return err('Only the admin email can create an admin account here.');
      if(pw!==$('confirm').value) return err('Passwords do not match.');
      const { data, error } = await db.auth.signUp({ email, password: pw });
      if(error) return err(authErrorText(error));
      if(!data.session){
        setMode('login');
        return info('Account created. Confirm your email from the link we sent, then log in here.');
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password: pw });
      if(error) return err(authErrorText(error));
    }
  } finally { $('submitBtn').disabled = false; }
});

$('logoutBtn').addEventListener('click', async ()=>{ $('password').value=''; await db.auth.signOut(); });
$('deniedLogout').addEventListener('click', async ()=>{ await db.auth.signOut(); });

/* ---------- pane switching ---------- */
const PANES = ['packages','messages','orders','blog','analytics','settings','accounts','backup'];
document.querySelectorAll('#tabNav button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#tabNav button').forEach(x=>x.classList.toggle('on', x===b));
  PANES.forEach(p=>{ $('pane-'+p).hidden = p!==b.dataset.pane; });
  const loaders = { messages: loadMessages, orders: loadOrders, blog: loadPosts,
                    analytics: () => { loadAnalytics(); loadErrors(); }, settings: loadSettings,
                    accounts: renderAccounts, backup: loadBackups };
  if(loaders[b.dataset.pane]) loaders[b.dataset.pane]();
}));

/* ---------- data ---------- */
const ZERO_ID = '00000000-0000-0000-0000-000000000000';

function toRow(d){
  return { group_name: d.group, tier: d.tier, name: d.name, description: d.desc,
           features: d.features, price: d.price, is_hot: d.hot, image_url: d.image_url || '',
           price_amount: d.amount ?? null, extra_note: d.extra || '',
           is_free: !!d.free, reward_title: d.rwTitle || '', reward_content: d.rwContent || '',
           reward_file_path: d.rwFilePath ?? '' };
}

async function refresh(){
  const { data, error } = await db.from('packages')
    .select('*, package_images(id, image_url, sort_order)')
    .order('sort_order').order('created_at');
  if(error){ showPkgMsg('Could not load packages: ' + error.message, true); return; }
  pkgs = data.map(r => ({
    id: r.id, group: r.group_name, tier: r.tier || '', name: r.name, desc: r.description || '',
    features: r.features || [], price: r.price, hot: r.is_hot, sortOrder: r.sort_order,
    image_url: r.image_url || '', amount: r.price_amount, extra: r.extra_note || '', free: !!r.is_free,
    rwTitle: r.reward_title || '', rwContent: r.reward_content || '', rwFilePath: r.reward_file_path || '',
    gallery: (r.package_images || []).slice().sort((a,b)=>a.sort_order-b.sort_order)
      .map(g => ({ id: g.id, url: g.image_url }))
  }));
  renderList(); renderStats(); populatePackageSelect();
}

async function saveOrder(list){
  const jobs = list.map((p, idx) => p.sortOrder === idx ? null
    : db.from('packages').update({ sort_order: idx }).eq('id', p.id));
  const results = await Promise.all(jobs.filter(Boolean));
  return results.every(r => !r.error);
}

function showPkgMsg(text, isErr){
  $('pMsg').textContent = text;
  $('pMsg').className = isErr ? 'msg err' : 'msg ok';
}

function fileNameOf(path){ return (path.split('/').pop() || '').replace(/^\d+-/, ''); }

/* ---------- stats ---------- */
function renderStats(){
  $('sPkgs').textContent = pkgs.length;
  $('sHot').textContent = pkgs.filter(p=>p.hot).length;
  $('sAccounts').textContent = accountCount;
  $('sFeatures').textContent = pkgs.reduce((n,p)=>n+(p.features||[]).length,0);
}

/* ---------- packages ---------- */
let editingId = null;
function formData(){
  return {
    group: $('pGroup').value,
    tier: $('pTier').value.trim().toUpperCase(),
    name: $('pName').value.trim(),
    desc: $('pDesc').value.trim(),
    features: $('pFeatures').value.split('\n').map(s=>s.trim()).filter(Boolean),
    price: $('pPrice').value.trim() || 'Price on request',
    free: $('pType').value === 'free',
    amount: $('pType').value === 'free' ? null : ($('pAmount').value ? Number($('pAmount').value) : null),
    extra: $('pExtra').value.trim(),
    rwTitle: $('rwTitle').value.trim(),
    rwContent: $('rwContent').value.trim(),
    hot: $('pHot').checked
  };
}
function updatePreview(){
  const d = formData();
  $('prvName').textContent = d.name || 'Package name';
  $('prvTier').textContent = `${d.tier||'TIER'} · ${d.group}${d.hot?' · POPULAR':''}`;
  $('prvList').innerHTML = (d.features.length ? d.features : ['Feature list appears here']).map(f=>`<li>${esc(f)}</li>`).join('');
}
['pGroup','pTier','pName','pDesc','pFeatures','pPrice','pHot'].forEach(id=>$(id).addEventListener('input',updatePreview));
$('pHot').addEventListener('change',updatePreview);

function resetForm(){
  editingId = null;
  $('pkgForm').reset();
  $('formTitle').textContent='Add package';
  $('saveBtn').textContent='Add package';
  $('cancelEdit').hidden = true;
  $('pMsg').textContent='';
  galleryRemoved = [];
  setGallery([]);
  $('rwFile').value = '';
  $('pType').value = 'paid';
  $('rwFileRemove').checked = false;
  $('rwFileRemoveRow').hidden = true;
  $('rwFileNote').textContent = 'No file.';
  updatePreview();
}

/* ---------- photo gallery editor (up to 8 photos, first = cover) ---------- */
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ['image/png','image/jpeg','image/webp','image/gif'];
let galleryItems = [];   // [{kind:'keep', id, url}] or [{kind:'new', file, url}]
let galleryRemoved = []; // rows of an existing package that were removed in this edit

function revokeNewUrls(items){ items.forEach(it => { if(it.kind === 'new') URL.revokeObjectURL(it.url); }); }

function renderGallery(){
  const box = $('pGallery');
  box.hidden = galleryItems.length === 0;
  box.innerHTML = galleryItems.map((it, i) => `
    <figure class="gal-item ${i===0?'cover':''}">
      <img src="${esc(it.url)}" alt="Photo ${i+1}">
      ${i===0 ? '<span class="gal-tag">Cover</span>' : (it.kind==='new' ? '<span class="gal-tag">New</span>' : (it.kind==='lib' ? '<span class="gal-tag">Library</span>' : ''))}
      <div class="gal-acts">
        <button type="button" data-gmove="-1" data-gi="${i}" ${i===0?'disabled':''} title="Move left">←</button>
        <button type="button" data-gmove="1" data-gi="${i}" ${i===galleryItems.length-1?'disabled':''} title="Move right">→</button>
        <button type="button" data-grm="${i}" title="Remove">×</button>
      </div>
    </figure>`).join('') + (galleryItems.length ? `<p class="mono gal-count">${galleryItems.length} of ${MAX_PHOTOS} photos</p>` : '');
  $('pImgNote').textContent = galleryItems.length
    ? 'Drag order with ← →. The first photo is shown as the cover on the Store page.'
    : 'PNG, JPG, WebP or GIF, up to 2 MB each.';
}

function setGallery(items){
  revokeNewUrls(galleryItems);
  galleryItems = items;
  renderGallery();
}

$('pImage').addEventListener('change', () => {
  const files = [...$('pImage').files];
  $('pImage').value = '';
  for(const f of files){
    if(galleryItems.length >= MAX_PHOTOS){ showPkgMsg(`You can add at most ${MAX_PHOTOS} photos.`, true); break; }
    if(!PHOTO_TYPES.includes(f.type)){ showPkgMsg(`"${f.name}" is not a PNG, JPG, WebP or GIF image.`, true); continue; }
    if(f.size > MAX_PHOTO_BYTES){ showPkgMsg(`"${f.name}" is larger than 2 MB.`, true); continue; }
    galleryItems.push({ kind:'new', file: f, url: URL.createObjectURL(f) });
  }
  renderGallery();
});

$('pLibBtn').addEventListener('click', async () => {
  const box = $('pLib');
  if(!box.hidden){ box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<p class="mono">Loading photos…</p>';
  const { data, error } = await db.from('package_images').select('image_url').order('created_at', { ascending:false }).limit(300);
  if(error){ box.innerHTML = `<p class="mono">Could not load photos: ${esc(error.message)}</p>`; return; }
  const urls = [...new Set(data.map(r => r.image_url))];
  box.innerHTML = urls.length
    ? urls.map(u => `<button type="button" class="lib-item${galleryItems.some(it=>it.url===u)?' on':''}" data-lib="${esc(u)}" title="Click to add or remove"><img src="${esc(u)}" alt=""></button>`).join('')
    : '<p class="mono">No photos uploaded yet. Upload some above first.</p>';
});
$('pLib').addEventListener('click', e => {
  const b = e.target.closest('[data-lib]'); if(!b) return;
  const url = b.dataset.lib;
  const i = galleryItems.findIndex(it => it.url === url);
  if(i >= 0){
    const [it] = galleryItems.splice(i, 1);
    if(it.kind === 'new') URL.revokeObjectURL(it.url);
    if(it.kind === 'keep') galleryRemoved.push(it);
    b.classList.remove('on');
  } else {
    if(galleryItems.length >= MAX_PHOTOS){ showPkgMsg(`You can add at most ${MAX_PHOTOS} photos.`, true); return; }
    galleryItems.push({ kind:'lib', url });
    b.classList.add('on');
  }
  renderGallery();
});

$('pGallery').addEventListener('click', e => {
  const mv = e.target.closest('[data-gmove]');
  if(mv){
    const i = Number(mv.dataset.gi), j = i + Number(mv.dataset.gmove);
    if(j < 0 || j >= galleryItems.length) return;
    [galleryItems[i], galleryItems[j]] = [galleryItems[j], galleryItems[i]];
    renderGallery(); return;
  }
  const rm = e.target.closest('[data-grm]');
  if(rm){
    const [it] = galleryItems.splice(Number(rm.dataset.grm), 1);
    if(it.kind === 'new') URL.revokeObjectURL(it.url);
    else galleryRemoved.push(it);
    renderGallery();
  }
});

/* upload the new photos, return the final list of URLs in order */
async function saveGalleryFiles(){
  const finalItems = [];
  for(let i=0; i<galleryItems.length; i++){
    const it = galleryItems[i];
    if(it.kind === 'keep' || it.kind === 'lib'){ finalItems.push(it); continue; }
    const path = `${Date.now()}-${i}-${it.file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const up = await db.storage.from('package-images').upload(path, it.file, { contentType: it.file.type });
    if(up.error) throw new Error('Photo upload failed: ' + up.error.message);
    finalItems.push({ kind:'keep', url: db.storage.from('package-images').getPublicUrl(path).data.publicUrl, path });
  }
  return finalItems;
}

/* write the gallery rows for a package and delete removed photos */
async function writeGallery(packageId, finalItems){
  // rows removed in this edit: delete the row and the file
  for(const it of galleryRemoved){
    if(!it.id) continue;
    await db.from('package_images').delete().eq('id', it.id);
    const name = it.url.split('/package-images/')[1];
    const { count } = await db.from('package_images').select('id', { count:'exact', head:true }).eq('image_url', it.url);
    if(name && !count) await db.storage.from('package-images').remove([decodeURIComponent(name)]);
  }
  galleryRemoved = [];
  // existing rows: keep their order in sync
  for(let i=0; i<finalItems.length; i++){
    const it = finalItems[i];
    if(it.id) await db.from('package_images').update({ sort_order: i }).eq('id', it.id);
    else await db.from('package_images').insert({ package_id: packageId, image_url: it.url, sort_order: i });
  }
  await db.from('packages').update({ image_url: finalItems[0] ? finalItems[0].url : '' }).eq('id', packageId);
}



$('pkgForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const data = formData();
  if(!data.name){ showPkgMsg('Name is required.', true); return; }
  $('saveBtn').disabled = true;
  try{
    const finalItems = await saveGalleryFiles();
    data.image_url = finalItems[0] ? finalItems[0].url : '';
    // reward file: upload a new one, or remove the old one
    const prevReward = editingId ? (pkgs.find(p=>p.id===editingId)||{}).rwFilePath || '' : '';
    let rewardPath = $('rwFileRemove').checked ? '' : prevReward;
    const rewardFile = $('rwFile').files[0];
    if(rewardFile){
      if(rewardFile.size > 50 * 1024 * 1024) throw new Error('The reward file is larger than 50 MB.');
      const newPath = `rewards/${Date.now()}-${rewardFile.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const up = await db.storage.from('order-deliveries').upload(newPath, rewardFile, { contentType: rewardFile.type || 'application/octet-stream' });
      if(up.error) throw new Error('Reward file upload failed: ' + up.error.message);
      rewardPath = newPath;
    }
    if(prevReward && prevReward !== rewardPath){
      const { count } = await db.from('order_deliveries').select('order_id', { count:'exact', head:true }).eq('file_path', prevReward);
      if(!count) await db.storage.from('order-deliveries').remove([prevReward]);
    }
    data.rwFilePath = rewardPath;
    let error, packageId = editingId;
    if(editingId){
      ({ error } = await db.from('packages').update(toRow(data)).eq('id', editingId));
    } else {
      const next = pkgs.length ? Math.max(...pkgs.map(p=>p.sortOrder)) + 1 : 0;
      const res = await db.from('packages').insert({ ...toRow(data), sort_order: next }).select('id').single();
      error = res.error; packageId = res.data && res.data.id;
    }
    if(error){ showPkgMsg('Could not save: ' + error.message, true); return; }
    await writeGallery(packageId, finalItems);
    const wasEditing = !!editingId;
    resetForm();
    await refresh();
    showPkgMsg(wasEditing ? 'Package updated.' : 'Package added.', false);
  } catch(err){
    showPkgMsg(err.message || 'Could not save.', true);
  } finally { $('saveBtn').disabled = false; }
});
$('cancelEdit').addEventListener('click', resetForm);

function renderList(){
  const q = $('search').value.trim().toLowerCase();
  const list = pkgs.filter(p=>!q || (p.name+' '+p.group+' '+(p.tier||'')).toLowerCase().includes(q));
  $('count').textContent = `${list.length} of ${pkgs.length} shown`;
  $('list').innerHTML = list.length ? list.map(p=>{
    const i = pkgs.findIndex(x=>x.id===p.id);
    return `
    <div class="item ${p.hot?'hot':''}">
      <div>
        <small>${esc(p.group)} · ${esc(p.tier||'')}${p.hot?' · POPULAR':''}</small>
        <h4>${esc(p.name)}</h4>
        <small>${p.free ? 'FREE' : esc(p.amount ? '₹' + Number(p.amount).toLocaleString('en-IN') : (p.price||'Price on request'))} · ${(p.features||[]).length} features</small>
      </div>
      <div class="acts">
        <button class="btn sm" data-up="${p.id}" type="button" ${i===0?'disabled':''} title="Move up">↑</button>
        <button class="btn sm" data-down="${p.id}" type="button" ${i===pkgs.length-1?'disabled':''} title="Move down">↓</button>
        <button class="btn sm" data-edit="${p.id}" type="button">Edit</button>
        <button class="btn sm" data-dup="${p.id}" type="button">Duplicate</button>
        <button class="btn sm danger" data-del="${p.id}" type="button">Delete</button>
      </div>
    </div>`;}).join('') : '<div class="none">No packages yet. Add one on the left, and it will show on the Store page.</div>';
}

async function move(id, dir){
  const list = [...pkgs];
  const i = list.findIndex(p=>p.id===id), j = i+dir;
  if(i<0 || j<0 || j>=list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  if(!(await saveOrder(list))) showPkgMsg('Could not change the order.', true);
  await refresh();
}

$('list').addEventListener('click', async e=>{
  const t = e.target.closest('button'); if(!t) return;
  if(t.dataset.up) return move(t.dataset.up, -1);
  if(t.dataset.down) return move(t.dataset.down, 1);

  if(t.dataset.dup){
    const p = pkgs.find(x=>x.id===t.dataset.dup); if(!p) return;
    const next = Math.max(...pkgs.map(x=>x.sortOrder)) + 1;
    const { error } = await db.from('packages').insert({ ...toRow(p), name: p.name+' (copy)', sort_order: next });
    if(error){ showPkgMsg('Could not duplicate: ' + error.message, true); return; }
    await refresh();
    // put the copy right after the original
    const copy = pkgs[pkgs.length-1];
    const list = pkgs.filter(x=>x.id!==copy.id);
    const at = list.findIndex(x=>x.id===p.id);
    list.splice(at+1, 0, copy);
    await saveOrder(list);
    await refresh();
    return;
  }

  if(t.dataset.edit){
    const p = pkgs.find(x=>x.id===t.dataset.edit); if(!p) return;
    editingId = p.id;
    $('pGroup').value = p.group;
    $('pTier').value = p.tier||'';
    $('pName').value = p.name||'';
    $('pDesc').value = p.desc||'';
    $('pFeatures').value = (p.features||[]).join('\n');
    $('pPrice').value = p.price==='Price on request' ? '' : (p.price||'');
    $('pHot').checked = !!p.hot;
    $('pAmount').value = p.amount ?? '';
    $('pType').value = p.free ? 'free' : 'paid';
    $('pExtra').value = p.extra || '';
    $('rwTitle').value = p.rwTitle || '';
    $('rwContent').value = p.rwContent || '';
    $('rwFile').value = '';
    $('rwFileRemove').checked = false;
    $('rwFileNote').textContent = p.rwFilePath ? 'Current file: ' + fileNameOf(p.rwFilePath) : 'No file.';
    $('rwFileRemoveRow').hidden = !p.rwFilePath;
    $('pImage').value = '';
    galleryRemoved = [];
    setGallery(p.gallery.map(g => ({ kind:'keep', id: g.id, url: g.url })));
    $('formTitle').textContent='Edit package';
    $('saveBtn').textContent='Save changes';
    $('cancelEdit').hidden = false;
    updatePreview();
    $('pkgForm').scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }

  if(t.dataset.del){
    if(!confirm('Delete this package from the store?')) return;
    const pkg = pkgs.find(p => p.id === t.dataset.del);
    const photoUrls = pkg ? pkg.gallery.map(g => g.url) : [];
    const { error } = await db.from('packages').delete().eq('id', t.dataset.del);
    if(error){ showPkgMsg('Could not delete: ' + error.message, true); return; }
    // remove the photo files that no other package uses any more
    for(const url of photoUrls){
      const name = url.split('/package-images/')[1];
      const { count } = await db.from('package_images').select('id', { count:'exact', head:true }).eq('image_url', url);
      if(name && !count) await db.storage.from('package-images').remove([decodeURIComponent(name)]);
    }
    if(editingId===t.dataset.del) resetForm();
    await refresh();
  }
});
$('search').addEventListener('input', renderList);

/* ---------- accounts (read only: the client list comes from the profiles table) ---------- */
async function renderAccounts(){
  const { data, error } = await db.from('profiles').select('id, email, created_at').order('created_at');
  if(error){
    $('accRows').innerHTML = `<tr><td colspan="3" class="mono" style="padding:24px">Could not load accounts: ${esc(error.message)}</td></tr>`;
    return;
  }
  accountCount = data.length;
  renderStats();
  $('accRows').innerHTML = data.length ? data.map(r=>`
    <tr>
      <td>${esc(r.email)}</td>
      <td>${r.email===ADMIN_EMAIL?'<span class="tag me">ADMIN</span>':'<span class="tag">Client</span>'}</td>
      <td class="mono">${esc(new Date(r.created_at).toLocaleDateString())}</td>
      <td style="text-align:right">${r.email===ADMIN_EMAIL?'—':`<button class="btn sm danger" data-delacc="${r.id}" data-email="${esc(r.email)}" type="button">Delete</button>`}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="mono" style="padding:24px">No accounts yet.</td></tr>';
}
$('accRows').addEventListener('click', async e=>{
  const b = e.target.closest('[data-delacc]'); if(!b) return;
  if(!confirm(`Delete account ${b.dataset.email}? Their login will be removed permanently.`)) return;
  b.disabled = true;
  const { error } = await db.functions.invoke('delete-account', { body: { userId: b.dataset.delacc } });
  if(error){ alert('Could not delete account: ' + (await fnErrorText(error))); b.disabled=false; return; }
  renderAccounts();
});

async function fnErrorText(error){
  try{ const j = await error.context.json(); return j.error || error.message; }catch(_){ return error.message || 'Unknown error'; }
}

/* ---------- backup ---------- */
$('exportBtn').addEventListener('click', ()=>{
  const data = {exportedAt: new Date().toISOString(),
    packages: pkgs.map(p=>({group:p.group, tier:p.tier, name:p.name, desc:p.desc, features:p.features, price:p.price, hot:p.hot}))};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vishu-packages-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
});

$('importFile').addEventListener('change', async e=>{
  const f = e.target.files[0]; if(!f) return;
  const msgEl = $('importMsg');
  try{
    const data = JSON.parse(await f.text());
    const list = Array.isArray(data) ? data : data.packages;
    if(!Array.isArray(list)) throw new Error('Invalid file');
    const clean = list.filter(p=>p && p.name).map(p=>({
      group: p.group||'Discord bots', tier: String(p.tier||'').toUpperCase(),
      name: String(p.name), desc: String(p.desc||''), features: Array.isArray(p.features)?p.features.map(String):[],
      price: p.price || 'Price on request', hot: !!p.hot
    }));
    if(!confirm(`Replace current packages with ${clean.length} from the file?`)) return;
    const del = await db.from('packages').delete().neq('id', ZERO_ID);
    if(del.error) throw new Error(del.error.message);
    const ins = await db.from('packages').insert(clean.map((p,idx)=>({...toRow(p), sort_order: idx})));
    if(ins.error) throw new Error(ins.error.message);
    msgEl.textContent = `Imported ${clean.length} packages.`; msgEl.className='msg ok';
    await refresh();
  }catch(err){
    msgEl.textContent = 'Could not import: ' + (err.message || 'Use a backup made by this panel.'); msgEl.className='msg err';
  } finally { e.target.value=''; }
});

$('clearBtn').addEventListener('click', async ()=>{
  if(!confirm('Delete ALL packages? This cannot be undone.')) return;
  if(!confirm('Are you sure? Download a backup first if you need one.')) return;
  const { error } = await db.from('packages').delete().neq('id', ZERO_ID);
  if(error){ showPkgMsg('Could not delete: ' + error.message, true); return; }
  resetForm(); await refresh();
});

/* ---------- router ---------- */
/* ---------- router: the auth state decides what is shown (no manual refresh needed) ---------- */
let routeRun = 0;
let adminUserId = null;   // the admin account currently shown (null = nobody)
function showView(id){
  ['loadingView','authView','deniedView','adminView'].forEach(v => { $(v).hidden = v !== id; });
  $('barRight').hidden = id === 'authView' || id === 'loadingView';
}
async function route(session){
  // Supabase announces the session again when the tab comes back (for example after the
  // file picker closes). If the same admin is already on screen, do nothing, so the
  // selected photos and the open form are kept.
  if(session && adminUserId === session.user.id) return;
  const run = ++routeRun;                       // a newer login/logout cancels this run
  if(!session){ adminUserId = null; showView('authView'); setMode(mode); return; }
  $('whoEmail').textContent = session.user.email;
  showView('loadingView');
  // the database decides who is admin (no browser-side check can be trusted)
  const { data: isAdmin, error } = await db.rpc('is_admin');
  if(run !== routeRun) return;
  if(error || !isAdmin){
    $('deniedEmail').textContent = session.user.email;
    showView('deniedView');
    return;
  }
  adminUserId = session.user.id;
  showView('adminView');
  resetForm();
  // load everything at the same time instead of one after another
  await Promise.all([refresh(), loadMessages(), renderAccounts(), loadOverview()]);
}
db.auth.onAuthStateChange((event, session) => {
  if(event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') route(session);
});

/* ================= shared: email compose (uses the send-email function) ================= */
function composeHtml(to, subject){
  return `
  <form data-mail class="mailform" style="margin-top:14px">
    <div class="field">To<input name="to" value="${esc(to)}" required maxlength="320"></div>
    <div class="field">Subject<input name="subject" value="${esc(subject)}" required maxlength="200"></div>
    <div class="field">Message<textarea name="body" required maxlength="10000" style="min-height:140px"></textarea></div>
    <div class="actions"><button class="btn solid" type="submit">Send email</button></div>
    <div class="msg" data-mailmsg></div>
  </form>`;
}
document.addEventListener('submit', async e=>{
  if(!e.target.matches('form[data-mail]')) return;
  e.preventDefault();
  const f = e.target, out = f.querySelector('[data-mailmsg]'), btn = f.querySelector('button');
  btn.disabled = true; out.textContent = 'Sending…'; out.className = 'msg';
  const { error } = await db.functions.invoke('send-email', {
    body: { to: f.elements.to.value, subject: f.elements.subject.value, body: f.elements.body.value }
  });
  btn.disabled = false;
  if(error){ out.textContent = 'Could not send: ' + (await fnErrorText(error)); out.className = 'msg err'; }
  else { out.textContent = 'Email sent.'; out.className = 'msg ok'; f.reset(); }
});

/* ================= messages (contact form inbox) ================= */
let messages = [];
let openMsgId = null;

async function loadMessages(){
  const { data, error } = await db.from('messages').select('*').order('created_at', { ascending:false });
  if(error){ $('msgList').innerHTML = `<div class="none">Could not load messages: ${esc(error.message)}</div>`; return; }
  messages = data;
  renderMessages();
  if(openMsgId) openMessage(openMsgId);
}
let mPage = 1;
const PAGE = 15;
/* a small pager under a list: shows Prev / page / Next */
function renderPager(el, total, page, onGo){
  const pages = Math.max(1, Math.ceil(total / PAGE));
  el.innerHTML = pages <= 1 ? '' : `
    <button class="btn sm" type="button" data-pg="${page-1}" ${page<=1?'disabled':''}>‹ Prev</button>
    <span class="mono">Page ${page} of ${pages}</span>
    <button class="btn sm" type="button" data-pg="${page+1}" ${page>=pages?'disabled':''}>Next ›</button>`;
  el.onclick = e => { const b = e.target.closest('[data-pg]'); if(b && !b.disabled) onGo(Number(b.dataset.pg)); };
}
function renderMessages(){
  const q = ($('mSearch').value || '').trim().toLowerCase();
  const all = messages.filter(m => !q || (m.name+' '+m.email+' '+m.body+' '+(m.project_type||'')).toLowerCase().includes(q));
  const unread = messages.filter(m=>!m.is_read).length;
  $('msgCount').textContent = `${all.length} shown · ${unread} unread`;
  const badge = $('unreadBadge'); badge.hidden = !unread; badge.textContent = unread;
  const start = (mPage - 1) * PAGE;
  const list = all.slice(start, start + PAGE);
  $('msgList').innerHTML = list.length ? list.map(m=>`
    <div class="item ${m.is_read?'':'hot'}" data-msg="${m.id}" style="cursor:pointer">
      <div>
        <small>${esc(new Date(m.created_at).toLocaleString())}${m.is_read?'':' · NEW'}</small>
        <h4>${esc(m.name)}</h4>
        <small>${esc(m.email)} · ${esc(m.project_type||'No project type')}</small>
      </div>
    </div>`).join('') : '<div class="none">No messages match.</div>';
  renderPager($('mPager'), all.length, mPage, p => { mPage = p; renderMessages(); });
}
$('mSearch').addEventListener('input', () => { mPage = 1; renderMessages(); });
$('msgList').addEventListener('click', e=>{
  const el = e.target.closest('[data-msg]'); if(el) openMessage(el.dataset.msg);
});
async function openMessage(id){
  openMsgId = id;
  const m = messages.find(x=>x.id===id); if(!m) return;
  if(!m.is_read){
    await db.from('messages').update({ is_read:true }).eq('id', id);
    m.is_read = true; renderMessages();
  }
  $('msgDetail').innerHTML = `
    <h2>${esc(m.name)}</h2>
    <p class="mono">${esc(m.email)} · ${esc(new Date(m.created_at).toLocaleString())}</p>
    <p class="mono">Project: ${esc(m.project_type||'—')}${m.features.length ? ' · ' + esc(m.features.join(', ')) : ''}</p>
    <p style="white-space:pre-wrap;margin:16px 0">${esc(m.body)}</p>
    <div class="actions">
      <button class="btn sm" type="button" data-reply="${id}">Reply by email</button>
      <button class="btn sm danger" type="button" data-delmsg="${id}">Delete</button>
    </div>
    <div id="replyBox"></div>`;
}
$('msgDetail').addEventListener('click', async e=>{
  const r = e.target.closest('[data-reply]');
  if(r){
    const m = messages.find(x=>x.id===r.dataset.reply);
    $('replyBox').innerHTML = composeHtml(m.email, 'Re: your project enquiry');
    return;
  }
  const d = e.target.closest('[data-delmsg]');
  if(d){
    if(!confirm('Delete this message?')) return;
    const { error } = await db.from('messages').delete().eq('id', d.dataset.delmsg);
    if(error){ alert('Could not delete: ' + error.message); return; }
    openMsgId = null;
    $('msgDetail').innerHTML = '<p class="sub">Message deleted.</p>';
    loadMessages();
  }
});

/* ================= orders and payments ================= */
let orders = [];
let payments = [];
let deliveries = {};   // order id -> product delivered for that order
const STATUS_LABEL = { pending:'Pending', in_progress:'In progress', completed:'Completed', cancelled:'Cancelled' };
const money = n => '₹' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const paidFor = id => payments.filter(x=>x.order_id===id).reduce((n,x)=>n+Number(x.amount),0);

function populatePackageSelect(){
  const sel = $('oPackage'); if(!sel) return;
  const keep = sel.value;
  sel.innerHTML = '<option value="">Custom (no package)</option>' +
    pkgs.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.group)}</option>`).join('');
  if(keep) sel.value = keep;
}

async function loadOrders(){
  const [o, p, d] = await Promise.all([
    db.from('orders').select('*').order('created_at', { ascending:false }),
    db.from('payments').select('*').order('paid_at'),
    db.from('order_deliveries').select('*')
  ]);
  if(o.error || p.error){ $('oList').innerHTML = `<div class="none">Could not load orders.</div>`; return; }
  orders = o.data; payments = p.data;
  deliveries = {}; (d.data || []).forEach(x => { deliveries[x.order_id] = x; });
  renderOrders();
  await loadProofs();
}
let oPage = 1;
function renderOrders(){
  const f = $('oFilter').value;
  const q = ($('oSearch').value || '').trim().toLowerCase();
  const all = orders.filter(o => (!f || o.status===f) &&
    (!q || (((o.client_name||'')+' '+o.client_email+' '+(o.package_name||'')).toLowerCase().includes(q))));
  $('oCount').textContent = `${all.length} of ${orders.length} shown`;
  const start = (oPage - 1) * PAGE;
  const list = all.slice(start, start + PAGE);
  $('oList').innerHTML = list.length ? list.map(o=>{
    const paid = paidFor(o.id), total = Number(o.amount_total), due = total - paid;
    const payText = total>0 && due<=0 ? 'Paid in full' : (paid>0 ? `Paid ${money(paid)} · Due ${money(due)}` : `Due ${money(total)}`);
    return `
    <div class="item" style="flex-direction:column;align-items:stretch" data-order-row="${o.id}">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <small>${esc(new Date(o.created_at).toLocaleDateString())} · ${esc(STATUS_LABEL[o.status]||o.status)}</small>
          <h4>${esc(o.client_name||o.client_email)} — ${esc(o.package_name||'Custom')}</h4>
          <small>${esc(o.client_email)} · ${esc(payText)}</small>
        </div>
        <div class="acts">
          <select data-status="${o.id}">${Object.entries(STATUS_LABEL).map(([k,v])=>`<option value="${k}" ${k===o.status?'selected':''}>${v}</option>`).join('')}</select>
          <button class="btn sm" type="button" data-openorder="${o.id}">Details</button>
        </div>
      </div>
      <div data-orderdetail="${o.id}"></div>
    </div>`;}).join('') : '<div class="none">No orders match.</div>';
  renderPager($('oPager'), all.length, oPage, p => { oPage = p; renderOrders(); });
}
$('oSearch').addEventListener('input', () => { oPage = 1; renderOrders(); });
$('oFilter').addEventListener('change', renderOrders);

$('orderForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const sel = $('oPackage');
  const row = {
    client_email: $('oEmail').value.trim().toLowerCase(),
    client_name: $('oName').value.trim(),
    package_id: sel.value || null,
    package_name: sel.value ? sel.options[sel.selectedIndex].text.replace(/ · .*$/, '') : '',
    amount_total: Number($('oAmount').value || 0),
    notes: $('oNotes').value.trim()
  };
  const { error } = await db.from('orders').insert(row);
  if(error){ $('oMsg').textContent = 'Could not create order: ' + error.message; $('oMsg').className='msg err'; return; }
  $('oMsg').textContent = 'Order created.'; $('oMsg').className = 'msg ok';
  e.target.reset(); populatePackageSelect();
  loadOrders();
});

$('oList').addEventListener('change', async e=>{
  const s = e.target.closest('[data-status]'); if(!s) return;
  const { error } = await db.from('orders').update({ status: s.value, updated_at: new Date().toISOString() }).eq('id', s.dataset.status);
  if(error){ alert('Could not update status: ' + error.message); loadOrders(); return; }
  if(s.value === 'completed'){
    await loadOrders();
    const doneOrder = orders.find(x => x.id === s.dataset.status);
    const mailErr = doneOrder ? await emailCompleted(doneOrder) : null;
    if(mailErr) alert('The order is complete, but the email was not sent: ' + mailErr);
    try{
      const r = await autoDeliverOnComplete(s.dataset.status);
      if(r === 'copied') alert('Order completed. The package reward was added to this order, so the client can claim it.');
      if(r === 'no-reward') alert('Order completed. This package has no reward yet. Add it in Packages, then use "Use package reward" here.');
    } catch(err){ alert('Order completed, but the reward could not be added: ' + err.message); }
  }
  loadOrders();
});

$('oList').addEventListener('click', async e=>{
  const cr = e.target.closest('[data-copyreward]');
  if(cr){
    const box = cr.closest('.delivery-box'); const out = box.querySelector('[data-deliverymsg]');
    cr.disabled = true; out.textContent = 'Copying reward…'; out.className = 'msg';
    try{
      await copyRewardToOrder(cr.dataset.copyreward);
      await loadOrders();
      const again = document.querySelector(`[data-openorder="${cr.dataset.copyreward}"]`);
      if(again) again.click();
      const m = document.querySelector(`[data-orderdetail="${cr.dataset.copyreward}"] [data-deliverymsg]`);
      if(m){ m.textContent = 'Package reward copied to this order.'; m.className = 'msg ok'; }
    } catch(err){ out.textContent = err.message; out.className = 'msg err'; cr.disabled = false; }
    return;
  }
  const det = e.target.closest('[data-openorder]');
  if(det){
    const box = document.querySelector(`[data-orderdetail="${det.dataset.openorder}"]`);
    if(box.innerHTML){ box.innerHTML=''; return; }
    const o = orders.find(x=>x.id===det.dataset.openorder);
    box.innerHTML = orderDetailHtml(o);
    return;
  }
  const mail = e.target.closest('[data-mailclient]');
  if(mail){
    const o = orders.find(x=>x.id===mail.dataset.mailclient);
    const box = document.querySelector(`[data-orderdetail="${o.id}"] [data-mailbox]`);
    box.innerHTML = composeHtml(o.client_email, `Update on your order: ${o.package_name||'your project'}`);
    return;
  }
  const dp = e.target.closest('[data-delpay]');
  if(dp){
    if(!confirm('Delete this payment entry?')) return;
    const { error } = await db.from('payments').delete().eq('id', dp.dataset.delpay);
    if(error) alert('Could not delete: ' + error.message);
    loadOrders(); return;
  }
  const dord = e.target.closest('[data-delorder]');
  if(dord){
    if(!confirm('Delete this order and all its payments?')) return;
    const { error } = await db.from('orders').delete().eq('id', dord.dataset.delorder);
    if(error) alert('Could not delete: ' + error.message);
    loadOrders();
  }
});

function orderDetailHtml(o){
  const rows = payments.filter(x=>x.order_id===o.id);
  const paid = paidFor(o.id);
  return `
  <div style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
    <p class="mono">Total ${money(o.amount_total)} · Paid ${money(paid)} · Due ${money(Number(o.amount_total)-paid)}</p>
    ${o.notes ? `<p style="white-space:pre-wrap;margin:10px 0">${esc(o.notes)}</p>` : ''}
    <table class="table" style="margin:10px 0">
      <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th></th></tr></thead>
      <tbody>${rows.length ? rows.map(x=>`
        <tr>
          <td>${esc(new Date(x.paid_at).toLocaleDateString())}</td>
          <td>${money(x.amount)}</td>
          <td>${esc(x.method)}</td>
          <td>${esc(x.reference)}</td>
          <td style="text-align:right"><button class="btn sm danger" data-delpay="${x.id}" type="button">×</button></td>
        </tr>`).join('') : '<tr><td colspan="5" class="mono">No payments yet.</td></tr>'}</tbody>
    </table>
    <form data-addpay="${o.id}" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount" required style="flex:1;min-width:110px">
      <input name="method" placeholder="Method (UPI, bank…)" maxlength="100" style="flex:1;min-width:130px">
      <input name="reference" placeholder="Reference / txn id" maxlength="200" style="flex:1;min-width:150px">
      <button class="btn sm solid" type="submit">Add payment</button>
    </form>
    <p class="msg" data-paymsg></p>
    <div class="delivery-box">
      <h4>Product delivery</h4>
      <p class="mono">${o.status === 'completed' ? 'Visible to the client now.' : 'The client sees this only after the order is marked Completed.'}</p>
      <form data-delivery="${o.id}" class="delivery-form">
        <label class="field">Title (shown on the product page)
          <input name="title" maxlength="200" value="${esc((deliveries[o.id]||{}).title || '')}" placeholder="e.g. Your Discord bot is ready">
        </label>
        <label class="field">Instructions, access details or links
          <textarea name="content" maxlength="10000" style="min-height:120px" placeholder="Step 1… Download: https://…">${esc((deliveries[o.id]||{}).content || '')}</textarea>
        </label>
        <label class="field">File (optional, up to 50 MB)
          <input name="file" type="file">
          <small class="mono">${(deliveries[o.id]||{}).file_path ? 'Current file: ' + esc((deliveries[o.id].file_path.split('/').pop()||'').replace(/^\d+-/, '')) : 'No file yet.'}</small>
        </label>
        <div class="actions">
          <button class="btn sm solid" type="submit">Save delivery</button>
          <button class="btn sm" type="button" data-copyreward="${o.id}">Use package reward</button>
        </div>
        <p class="msg" data-deliverymsg></p>
      </form>
    </div>
    <div class="actions" style="margin-top:12px">
      <button class="btn sm" data-mailclient="${o.id}" type="button">Email client</button>
      <button class="btn sm danger" data-delorder="${o.id}" type="button">Delete order</button>
    </div>
    <div data-mailbox></div>
  </div>`;
}

$('oList').addEventListener('submit', async e=>{
  const df = e.target.closest('form[data-delivery]');
  if(df){
    e.preventDefault();
    const orderId = df.dataset.delivery, out = df.querySelector('[data-deliverymsg]');
    const btn = df.querySelector('button'); btn.disabled = true;
    const fail = t => { out.textContent = t; out.className = 'msg err'; btn.disabled = false; };
    const prev = deliveries[orderId] || {};
    let filePath = prev.file_path || '';
    const file = df.elements.file.files[0];
    if(file){
      if(file.size > 50 * 1024 * 1024) return fail('The file is larger than 50 MB.');
      out.textContent = 'Uploading…'; out.className = 'msg';
      const newPath = `${orderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const up = await db.storage.from('order-deliveries').upload(newPath, file, { contentType: file.type || 'application/octet-stream' });
      if(up.error) return fail('Upload failed: ' + up.error.message);
      if(prev.file_path && prev.file_path.startsWith(orderId + '/')) await db.storage.from('order-deliveries').remove([prev.file_path]);
      filePath = newPath;
    }
    const { error } = await db.from('order_deliveries').upsert({
      order_id: orderId, title: df.elements.title.value.trim(), content: df.elements.content.value.trim(),
      file_path: filePath, updated_at: new Date().toISOString()
    }, { onConflict: 'order_id' });
    if(error) return fail('Could not save: ' + error.message);
    await loadOrders();
    // keep the same order open after saving
    const again = document.querySelector(`[data-openorder="${orderId}"]`);
    if(again) again.click();
    const m = document.querySelector(`[data-orderdetail="${orderId}"] [data-deliverymsg]`);
    if(m){ m.textContent = 'Delivery saved.'; m.className = 'msg ok'; }
    return;
  }
  const f = e.target.closest('form[data-addpay]'); if(!f) return;
  e.preventDefault();
  const out = f.parentElement.querySelector('[data-paymsg]');
  const amount = Number(f.elements.amount.value);
  if(!(amount > 0)){ out.textContent = 'Enter a valid amount.'; out.className='msg err'; return; }
  const { error } = await db.from('payments').insert({
    order_id: f.dataset.addpay, amount,
    method: f.elements.method.value.trim(), reference: f.elements.reference.value.trim()
  });
  if(error){ out.textContent = 'Could not add payment: ' + error.message; out.className='msg err'; return; }
  loadOrders();
});

/* ================= blog ================= */
let posts = [];
let editingPostId = null;

function slugify(t){
  return t.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
}
$('bTitle').addEventListener('input', ()=>{ if(!editingPostId && !$('bSlug').value) $('bSlug').value = slugify($('bTitle').value); });

async function loadPosts(){
  const { data, error } = await db.from('blog_posts').select('*').order('created_at', { ascending:false });
  if(error){ $('bList').innerHTML = `<div class="none">Could not load posts: ${esc(error.message)}</div>`; return; }
  posts = data;
  $('bList').innerHTML = posts.length ? posts.map(p=>`
    <div class="item ${p.is_published?'':''}">
      <div>
        <small>${p.is_published ? 'PUBLISHED' : 'DRAFT'} · /${esc(p.slug)}</small>
        <h4>${esc(p.title)}</h4>
        <small>${esc(new Date(p.created_at).toLocaleDateString())}</small>
      </div>
      <div class="acts">
        <button class="btn sm" type="button" data-editpost="${p.id}">Edit</button>
        <button class="btn sm danger" type="button" data-delpost="${p.id}">Delete</button>
      </div>
    </div>`).join('') : '<div class="none">No posts yet. Write one on the left.</div>';
}
function resetBlogForm(){
  editingPostId = null;
  $('blogForm').reset();
  $('bFormTitle').textContent = 'New post';
  $('bSave').textContent = 'Save post';
  $('bCancel').hidden = true;
  $('bMsg').textContent = '';
}
$('bCancel').addEventListener('click', resetBlogForm);

$('blogForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const published = $('bPublished').checked;
  const existing = posts.find(p=>p.id===editingPostId);
  const row = {
    title: $('bTitle').value.trim(),
    slug: $('bSlug').value.trim().toLowerCase(),
    excerpt: $('bExcerpt').value.trim(),
    body: $('bBody').value,
    is_published: published,
    published_at: published ? (existing && existing.published_at) || new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const q = editingPostId
    ? db.from('blog_posts').update(row).eq('id', editingPostId)
    : db.from('blog_posts').insert(row);
  const { error } = await q;
  if(error){
    $('bMsg').textContent = error.message.includes('duplicate') ? 'That slug is already used. Choose another.' : 'Could not save: ' + error.message;
    $('bMsg').className = 'msg err'; return;
  }
  const wasEditing = !!editingPostId;
  resetBlogForm();
  $('bMsg').textContent = wasEditing ? 'Post updated.' : 'Post saved.'; $('bMsg').className = 'msg ok';
  loadPosts();
});

$('bList').addEventListener('click', async e=>{
  const ed = e.target.closest('[data-editpost]');
  if(ed){
    const p = posts.find(x=>x.id===ed.dataset.editpost); if(!p) return;
    editingPostId = p.id;
    $('bTitle').value = p.title; $('bSlug').value = p.slug; $('bExcerpt').value = p.excerpt;
    $('bBody').value = p.body; $('bPublished').checked = p.is_published;
    $('bFormTitle').textContent = 'Edit post';
    $('bSave').textContent = 'Save changes';
    $('bCancel').hidden = false;
    window.scrollTo({ top:0, behavior:'smooth' });
    return;
  }
  const dl = e.target.closest('[data-delpost]');
  if(dl){
    if(!confirm('Delete this post permanently?')) return;
    const { error } = await db.from('blog_posts').delete().eq('id', dl.dataset.delpost);
    if(error) alert('Could not delete: ' + error.message);
    if(editingPostId === dl.dataset.delpost) resetBlogForm();
    loadPosts();
  }
});

/* ================= analytics ================= */
async function loadAnalytics(){
  const days = Number($('aDays').value);
  let { data, error } = await db.rpc('analytics_summary', { days });
  if(error){ $('aTotal').textContent = 'Could not load: ' + error.message; return; }
  data = data || {};
  data.by_day = data.by_day || []; data.by_path = data.by_path || [];
  $('aTotal').textContent = `${data.total || 0} views`;
  const max = Math.max(1, ...data.by_day.map(d=>d.views));
  $('aDaily').innerHTML = data.by_day.length ? data.by_day.map(d=>`
    <div style="display:flex;gap:10px;align-items:center;margin:8px 0">
      <span class="mono" style="width:92px">${esc(d.day)}</span>
      <div style="flex:1;background:var(--line);height:10px;border-radius:6px;overflow:hidden">
        <div style="width:${(d.views/max*100).toFixed(1)}%;height:100%;background:var(--ember)"></div>
      </div>
      <span class="mono">${d.views}</span>
    </div>`).join('') : '<p class="mono">No views in this period.</p>';
  $('aPaths').innerHTML = data.by_path.length ? `
    <table class="table"><thead><tr><th>Page</th><th style="text-align:right">Views</th></tr></thead><tbody>
    ${data.by_path.map(p=>`<tr><td>${esc(p.path)}</td><td style="text-align:right">${p.views}</td></tr>`).join('')}
    </tbody></table>` : '<p class="mono">No page views yet.</p>';
}
$('aDays').addEventListener('change', loadAnalytics);

/* ================= settings ================= */
const SETTING_FIELDS = { contact_email:'sContactEmail', social_discord:'sDiscord',
  social_linkedin:'sLinkedin', social_github:'sGithub', footer_tagline:'sFooter',
  upi_id:'sUpi', upi_name:'sUpiName' };

async function loadSettings(){
  const { data, error } = await db.from('site_settings').select('*');
  if(error){ $('sMsg').textContent = 'Could not load settings.'; $('sMsg').className='msg err'; return; }
  data.forEach(r=>{ if(SETTING_FIELDS[r.key]) $(SETTING_FIELDS[r.key]).value = r.value; });
}
$('settingsForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const rows = Object.entries(SETTING_FIELDS).map(([key,id])=>({ key, value: $(id).value.trim() }));
  const bad = rows.find(r => r.key.startsWith('social_') && r.value && !/^https:\/\/[^\s]+$/.test(r.value));
  if(bad){ $('sMsg').textContent = 'Social links must start with https://'; $('sMsg').className = 'msg err'; return; }
  const upi = rows.find(r => r.key === 'upi_id');
  if(upi.value && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(upi.value)){
    $('sMsg').textContent = 'UPI ID looks wrong. It should look like name@bank.'; $('sMsg').className = 'msg err'; return;
  }
  const { error } = await db.from('site_settings').upsert(rows, { onConflict:'key' });
  $('sMsg').textContent = error ? 'Could not save: ' + error.message : 'Settings saved.';
  $('sMsg').className = error ? 'msg err' : 'msg ok';
});

/* ================= payments waiting for approval (UPI screenshot + UTR) ================= */
let proofs = [];
async function loadProofs(){
  const { data, error } = await db.from('payment_proofs').select('*').order('created_at', { ascending:false }).limit(100);
  if(error){ $('proofList').innerHTML = `<div class="none">Could not load: ${esc(error.message)}</div>`; return; }
  proofs = data;
  const pending = data.filter(p=>p.status === 'pending');
  $('proofList').innerHTML = pending.length ? pending.map(p=>{
    const o = orders.find(x=>x.id===p.order_id);
    return `
    <div class="item" style="flex-direction:column;align-items:stretch">
      <div>
        <small>${esc(new Date(p.created_at).toLocaleString())} · UTR ${esc(p.utr)}</small>
        <h4>${esc(p.client_email)} — ${esc(o ? (o.package_name || 'Custom') : 'order')}</h4>
        <small>Amount ${money(p.amount)}</small>
      </div>
      <div class="acts" style="margin-top:8px">
        <button class="btn sm" data-proofshot="${p.id}" type="button">View screenshot</button>
        <button class="btn sm solid" data-approve="${p.id}" type="button">Approve</button>
        <button class="btn sm danger" data-reject="${p.id}" type="button">Reject</button>
      </div>
    </div>`;}).join('') : '<div class="none">No payments waiting for approval.</div>';
}
$('proofList').addEventListener('click', async e=>{
  const shot = e.target.closest('[data-proofshot]');
  if(shot){
    const p = proofs.find(x=>x.id===shot.dataset.proofshot);
    const { data, error } = await db.storage.from('payment-proofs').createSignedUrl(p.screenshot_path, 300);
    if(error){ alert('Could not open screenshot: ' + error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
    return;
  }
  const ap = e.target.closest('[data-approve]');
  if(ap){
    if(!confirm('Approve this payment? It will be recorded against the order.')) return;
    const { error } = await db.rpc('approve_payment_proof', { p_id: ap.dataset.approve, p_note: '' });
    if(error){ alert('Could not approve: ' + error.message); return; }
    const proof = proofs.find(x => x.id === ap.dataset.approve);
    const approvedOrder = proof && orders.find(x => x.id === proof.order_id);
    if(approvedOrder){
      const mailErr = await emailPaymentApproved(approvedOrder);
      if(mailErr) alert('Payment approved, but the email was not sent: ' + mailErr);
    }
    loadOrders(); return;
  }
  const rj = e.target.closest('[data-reject]');
  if(rj){
    const note = prompt('Reason for rejecting (saved for your records):', '');
    if(note === null) return;
    const { error } = await db.rpc('reject_payment_proof', { p_id: rj.dataset.reject, p_note: note });
    if(error){ alert('Could not reject: ' + error.message); return; }
    loadOrders();
  }
});

/* ================= product reward: package reward -> the order's delivery ================= */
/* copies the package's reward to this order (text, and the file into the order's folder) */
async function copyRewardToOrder(orderId){
  const o = orders.find(x => x.id === orderId);
  const pkg = o && o.package_id ? pkgs.find(p => p.id === o.package_id) : null;
  if(!pkg) throw new Error('This order has no package with a reward (custom order).');
  if(!pkg.rwTitle && !pkg.rwContent && !pkg.rwFilePath) throw new Error('This package has no reward yet. Add it in Packages first.');
  const prev = deliveries[orderId] || {};
  let filePath = '';
  if(pkg.rwFilePath){
    const dst = `${orderId}/${Date.now()}-${fileNameOf(pkg.rwFilePath)}`;
    const cp = await db.storage.from('order-deliveries').copy(pkg.rwFilePath, dst);
    if(cp.error) throw new Error('Could not copy the file: ' + cp.error.message);
    filePath = dst;
  }
  if(prev.file_path && prev.file_path.startsWith(orderId + '/')) await db.storage.from('order-deliveries').remove([prev.file_path]);
  const { error } = await db.from('order_deliveries').upsert({
    order_id: orderId, title: pkg.rwTitle, content: pkg.rwContent, file_path: filePath,
    updated_at: new Date().toISOString()
  }, { onConflict: 'order_id' });
  if(error) throw new Error('Could not save the delivery: ' + error.message);
}

/* when an order becomes Completed and has no delivery yet, copy the package reward automatically */
async function autoDeliverOnComplete(orderId){
  const existing = deliveries[orderId];
  if(existing && (existing.title || existing.content || existing.file_path)) return 'kept';
  const o = orders.find(x => x.id === orderId);
  const pkg = o && o.package_id ? pkgs.find(p => p.id === o.package_id) : null;
  if(!pkg || (!pkg.rwTitle && !pkg.rwContent && !pkg.rwFilePath)) return 'no-reward';
  await copyRewardToOrder(orderId);
  return 'copied';
}

/* ================= dashboard summary ================= */
async function loadOverview(){
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [pp, um, ot, rev] = await Promise.all([
    db.from('payment_proofs').select('id', { count:'exact', head:true }).eq('status', 'pending'),
    db.from('messages').select('id', { count:'exact', head:true }).eq('is_read', false),
    db.from('orders').select('id', { count:'exact', head:true }).gte('created_at', startDay),
    db.from('payments').select('amount').gte('paid_at', startMonth)
  ]);
  $('sPendingPay').textContent = pp.count ?? 0;
  $('sUnread').textContent = um.count ?? 0;
  $('sToday').textContent = ot.count ?? 0;
  $('sRevenue').textContent = money((rev.data || []).reduce((n, r) => n + Number(r.amount), 0));
}

/* ================= browser errors ================= */
async function loadErrors(){
  const { data, error } = await db.from('client_errors').select('*').order('created_at', { ascending:false }).limit(50);
  if(error){ $('errList').innerHTML = `<div class="none">Could not load: ${esc(error.message)}</div>`; return; }
  $('errList').innerHTML = data.length ? data.map(e => `
    <div class="item"><div>
      <small>${esc(new Date(e.created_at).toLocaleString())} · ${esc(e.page)}</small>
      <h4 style="font-size:14px;word-break:break-word">${esc(e.message)}</h4>
    </div></div>`).join('') : '<div class="none">No errors reported. Good.</div>';
}
$('errClear').addEventListener('click', async () => {
  if(!confirm('Clear the browser error log?')) return;
  const { error } = await db.from('client_errors').delete().gt('id', 0);
  if(error) alert('Could not clear: ' + error.message);
  loadErrors();
});

/* ================= backups ================= */
async function loadBackups(){
  const { data, error } = await db.from('backups').select('id, created_at').order('created_at', { ascending:false }).limit(14);
  if(error){ $('backupList').innerHTML = `<div class="none">Could not load backups: ${esc(error.message)}</div>`; return; }
  $('backupList').innerHTML = data.length ? data.map(b => `
    <div class="item"><div><small>${esc(new Date(b.created_at).toLocaleString())}</small></div>
      <div class="acts"><button class="btn sm" type="button" data-backup="${b.id}">Download</button></div></div>`).join('')
    : '<div class="none">No backups yet. The first one is made tonight, or save one now.</div>';
}
$('backupNow').addEventListener('click', async () => {
  $('backupNow').disabled = true; $('backupMsg').textContent = 'Saving backup…'; $('backupMsg').className = 'msg';
  const { error } = await db.rpc('admin_backup_now');
  $('backupNow').disabled = false;
  $('backupMsg').textContent = error ? 'Could not save: ' + error.message : 'Backup saved.';
  $('backupMsg').className = error ? 'msg err' : 'msg ok';
  loadBackups();
});
$('backupList').addEventListener('click', async e => {
  const b = e.target.closest('[data-backup]'); if(!b) return;
  const { data, error } = await db.from('backups').select('snapshot, created_at').eq('id', b.dataset.backup).single();
  if(error){ alert('Could not download: ' + error.message); return; }
  const blob = new Blob([JSON.stringify(data.snapshot, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vishu-backup-${new Date(data.created_at).toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ================= email to the client (uses the send-email function) ================= */
async function emailClient(to, subject, text){
  const { error } = await db.functions.invoke('send-email', { body: { to, subject, body: text } });
  return error ? await fnErrorText(error) : null;
}
function claimLink(orderId){ return `${location.origin}/product.html?order=${orderId}`; }

/* when an order is marked Completed, the client gets an email with the link to claim the product */
async function emailCompleted(order){
  const err = await emailClient(order.client_email,
    `Your order is complete: ${order.package_name || 'your package'}`,
    `Hello${order.client_name ? ' ' + order.client_name : ''},\n\nYour order${order.package_name ? ' for ' + order.package_name : ''} is complete.\n\nYou can claim your product here:\n${claimLink(order.id)}\n\nThank you for choosing Vishu.`);
  return err;
}
/* when a payment is approved, the client knows the order is moving forward */
async function emailPaymentApproved(order){
  return await emailClient(order.client_email,
    `Payment received for ${order.package_name || 'your order'}`,
    `Hello${order.client_name ? ' ' + order.client_name : ''},\n\nWe have received and checked your payment. Your order is now in progress. You can follow it on My orders.\n\nThank you for choosing Vishu.`);
}

/* ================= blog photo: upload, then insert it into the text ================= */
$('bImage').addEventListener('change', async () => {
  const f = $('bImage').files[0]; $('bImage').value = '';
  if(!f) return;
  const out = $('bImgMsg');
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)){ out.textContent = 'Use a PNG, JPG, WebP or GIF.'; out.className = 'msg err'; return; }
  if(f.size > 2 * 1024 * 1024){ out.textContent = 'The photo is larger than 2 MB.'; out.className = 'msg err'; return; }
  out.textContent = 'Uploading…'; out.className = 'msg';
  const path = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const up = await db.storage.from('blog-images').upload(path, f, { contentType: f.type });
  if(up.error){ out.textContent = 'Upload failed: ' + up.error.message; out.className = 'msg err'; return; }
  const url = db.storage.from('blog-images').getPublicUrl(path).data.publicUrl;
  const alt = f.name.replace(/\.[^.]+$/, '').replace(/[\[\]()]/g, '').slice(0, 80) || 'photo';
  const box = $('bBody');
  const at = box.selectionStart ?? box.value.length;
  const insert = `\n![${alt}](${url})\n`;
  box.value = box.value.slice(0, at) + insert + box.value.slice(at);
  box.focus();
  out.textContent = 'Photo added to the text.'; out.className = 'msg ok';
});
