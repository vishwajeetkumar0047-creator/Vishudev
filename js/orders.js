/* My orders: shows the client's own orders and lets them pay by UPI */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const STATUS = { pending:'Awaiting payment', in_progress:'In progress', completed:'Completed', cancelled:'Cancelled' };
const list = document.getElementById('list');
const MAX_FILE = 5 * 1024 * 1024;
let upi = { id:'', name:'' }, userId = '';

(async function start(){
  const { data } = await db.auth.getSession();
  if(!data.session){ location.replace('store.html'); return; }
  userId = data.session.user.id;
  document.getElementById('loading').hidden = true;
  const s = await db.from('site_settings').select('key,value').in('key', ['upi_id','upi_name']);
  (s.data || []).forEach(r => { if(r.key === 'upi_id') upi.id = r.value; if(r.key === 'upi_name') upi.name = r.value; });
  await load();
})();

async function load(){
  const [o, p, pr] = await Promise.all([
    db.from('orders').select('*').order('created_at', { ascending:false }),
    db.from('payments').select('*'),
    db.from('payment_proofs').select('*').order('created_at', { ascending:false })
  ]);
  if(o.error){ list.innerHTML = '<p class="meta">Could not load your orders. Please refresh.</p>'; return; }
  if(!o.data.length){ list.innerHTML = '<p class="meta">No orders yet. Pick a package in the Store to place one.</p>'; return; }
  list.innerHTML = o.data.map(order => orderCard(order, p.data || [], pr.data || [])).join('');
}

function orderCard(order, payments, proofs){
  const paid = payments.filter(x => x.order_id === order.id).reduce((n,x) => n + Number(x.amount), 0);
  const waiting = proofs.filter(x => x.order_id === order.id && x.status === 'pending');
  const due = Number(order.amount_total) - paid;
  const open = due > 0 && (order.status === 'pending' || order.status === 'in_progress');
  const cancellable = order.status === 'pending' && paid === 0 && waiting.length === 0;
  const badge = order.status === 'completed' ? 'ok' : (waiting.length ? 'warn' : '');
  const label = waiting.length ? 'Payment under review' : (STATUS[order.status] || order.status);
  const history = proofs.filter(x => x.order_id === order.id).map(x => `
    <div><span>UTR ${esc(x.utr)} · ${money(x.amount)}</span>
      <span>${esc(x.status === 'pending' ? 'Under review' : x.status === 'approved' ? 'Approved' : 'Rejected')}${x.admin_note && x.status === 'rejected' ? ' — ' + esc(x.admin_note) : ''}</span></div>`).join('');
  // progress: Placed -> Paid -> In progress -> Completed (cancelled orders show no progress)
  const stage = order.status === 'completed' ? 3 : order.status === 'in_progress' ? 2 : (paid > 0 || waiting.length) ? 1 : 0;
  const progress = order.status === 'cancelled' ? '' : `
    <ol class="progress" aria-label="Order progress">
      ${['Placed','Paid','In progress','Completed'].map((t,i) => `<li class="${i < stage ? 'done' : i === stage ? 'now' : ''}">${t}</li>`).join('')}
    </ol>`;
  return `
  <article class="card" data-order-card="${esc(order.id)}">
    ${progress}
    <div class="row">
      <div>
        <small>${esc(new Date(order.created_at).toLocaleDateString('en-IN'))}</small>
        <h3>${esc(order.package_name || 'Custom order')}</h3>
        <small>Total ${money(order.amount_total)} · Paid ${money(paid)} · Due ${money(due)}</small>
      </div>
      <span class="badge-status ${badge}">${esc(label)}</span>
    </div>
    ${history ? `<div class="proofs">${history}</div>` : ''}
    ${cancellable ? `<div style="margin-top:14px"><button class="linkbtn" type="button" data-cancel="${esc(order.id)}">Cancel order</button></div>` : ''}
    ${order.status === 'completed' ? `<div style="margin-top:16px"><a class="submit" href="product.html?order=${esc(order.id)}" style="display:inline-block;text-decoration:none">Claim your product →</a></div>` : ''}
    ${order.status === 'cancelled' ? `<p class="sub" style="margin-top:12px">This order was cancelled. You can add the package to your cart again from the Store.</p>` : ''}
    ${open ? `
      <div style="margin-top:16px"><button class="ghost" type="button" data-togglepay="${esc(order.id)}">Pay now</button></div>
      <div class="pay" hidden data-paybox="${esc(order.id)}">
        ${upi.id ? `
          <div>
            <div class="qr" data-qr="${esc(order.id)}"></div>
            <small class="mono" style="display:block;margin-top:8px">${esc(upi.name || '')} · ${esc(upi.id)}</small>
          </div>
          <form class="payform" data-pay="${esc(order.id)}" data-due="${due}">
            <label class="field">Amount paid (₹)
              <input name="amount" type="number" min="1" max="${due}" step="0.01" value="${due}" required>
            </label>
            <label class="field">UTR / transaction ID (from your UPI app)
              <input name="utr" required minlength="6" maxlength="30" pattern="[A-Za-z0-9]{6,30}" placeholder="e.g. 412345678901">
            </label>
            <label class="field">Payment screenshot (PNG, JPG or WebP, max 5 MB)
              <input name="shot" type="file" accept="image/png,image/jpeg,image/webp" required>
            </label>
            <button class="submit" type="submit">Submit payment for approval</button>
            <div class="msg" data-paymsg></div>
          </form>` : `<p class="sub">Payment details are not set up yet. Please contact us.</p>`}
      </div>` : ''}
  </article>`;
}

/* cancel an unpaid order */
list.addEventListener('click', async e => {
  const c = e.target.closest('[data-cancel]'); if(!c) return;
  if(!confirm('Cancel this order? You can add the package to your cart again later.')) return;
  c.disabled = true;
  const { error } = await db.rpc('cancel_order', { p_id: c.dataset.cancel });
  if(error){ alert('Could not cancel: ' + error.message); c.disabled = false; return; }
  load();
});

/* show or hide the payment box; draw the UPI QR for the amount */
list.addEventListener('click', e => {
  const t = e.target.closest('[data-togglepay]'); if(!t) return;
  const box = list.querySelector(`[data-paybox="${t.dataset.togglepay}"]`);
  box.hidden = !box.hidden;
  if(!box.hidden) drawQr(t.dataset.togglepay);
});
list.addEventListener('input', e => {
  const f = e.target.closest('form[data-pay]'); if(f && e.target.name === 'amount') drawQr(f.dataset.pay);
});

function drawQr(orderId){
  const form = list.querySelector(`form[data-pay="${orderId}"]`);
  const el = list.querySelector(`[data-qr="${orderId}"]`);
  if(!form || !el || typeof QrCreator === 'undefined') return;
  const amount = Number(form.elements.amount.value || 0);
  if(!(amount > 0)) return;
  const uri = `upi://pay?pa=${encodeURIComponent(upi.id)}&pn=${encodeURIComponent(upi.name || 'Vishu')}` +
              `&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Order ' + orderId.slice(0,8))}`;
  el.innerHTML = '';
  QrCreator.render({ text: uri, radius: 0.3, ecLevel: 'M', fill: '#0a0a0a', background: '#ffffff', size: 200 }, el);
}

/* submit: upload screenshot to the private bucket, then record the proof for admin approval */
list.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-pay]'); if(!f) return;
  e.preventDefault();
  const out = f.querySelector('[data-paymsg]'), btn = f.querySelector('button');
  const fail = t => { out.textContent = t; out.className = 'msg err'; btn.disabled = false; };
  const amount = Number(f.elements.amount.value), due = Number(f.dataset.due);
  const file = f.elements.shot.files[0];
  if(!(amount > 0) || amount > due) return fail('Amount must be between ₹1 and the amount due.');
  if(!file) return fail('Please choose the screenshot.');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)) return fail('Screenshot must be PNG, JPG or WebP.');
  if(file.size > MAX_FILE) return fail('Screenshot is larger than 5 MB.');
  btn.disabled = true; out.textContent = 'Uploading…'; out.className = 'msg';

  const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const up = await db.storage.from('payment-proofs').upload(path, file, { contentType: file.type });
  if(up.error) return fail('Could not upload the screenshot: ' + up.error.message);

  const { error } = await db.rpc('submit_payment_proof', {
    p_order_id: f.dataset.pay, p_amount: amount, p_utr: f.elements.utr.value.trim(), p_path: path
  });
  if(error){
    await db.storage.from('payment-proofs').remove([path]);
    const msg = error.message.includes('duplicate') || error.message.includes('payment_proofs_utr_unique')
      ? 'This UTR number was already submitted.' : (error.message || 'Could not submit.');
    return fail(msg);
  }
  out.textContent = 'Submitted. We will confirm your payment shortly.'; out.className = 'msg ok';
  load();
});

document.querySelectorAll('.yr').forEach(el => el.textContent = new Date().getFullYear());
