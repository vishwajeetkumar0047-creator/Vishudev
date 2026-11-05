/* Product page: shows only the product of the order given in the link, and only once it is completed */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const ORDER_ID = new URLSearchParams(location.search).get('order') || '';
const PRODUCT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* plain text; https links become clickable (nothing else is turned into HTML) */
function linkify(text){
  return esc(text).split(/\n\s*\n/).map(par =>
    '<p>' + par.replace(/https:\/\/[^\s<]+/g, u => `<a href="${u}" rel="noopener nofollow" target="_blank">${u}</a>`) + '</p>').join('');
}

function notReady(title, text){
  $('loading').hidden = true;
  $('nrTitle').textContent = title; $('nrText').textContent = text;
  $('notReady').hidden = false;
}

(async function start(){
  const { data } = await db.auth.getSession();
  if(!data.session){ location.replace('store.html'); return; }
  if(!PRODUCT_ID_RE.test(ORDER_ID)) return notReady('Product not found.', 'Open this page from My orders.');

  // the database only returns this client's own order, and the delivery only when it is completed
  const { data: order } = await db.from('orders').select('package_name, status').eq('id', ORDER_ID).maybeSingle();
  if(!order) return notReady('Product not found.', 'This order does not belong to your account.');
  $('pkgName').textContent = order.package_name || '';
  if(order.status !== 'completed'){
    return notReady('Not ready yet.', order.status === 'cancelled'
      ? 'This order was cancelled, so there is no product to claim.'
      : 'Your product will appear here once the order is marked as completed. Check My orders for the latest status.');
  }

  const { data: delivery } = await db.from('order_deliveries').select('*').eq('order_id', ORDER_ID).maybeSingle();
  if(!delivery) return notReady('Your product is being prepared.', 'Nothing has been added yet. Please check again later, or contact us.');

  $('loading').hidden = true;
  $('content').hidden = false;
  $('dTitle').textContent = delivery.title || order.package_name || 'Your product';
  $('dBody').innerHTML = delivery.content ? linkify(delivery.content) : '<p>No instructions added.</p>';
  if(delivery.file_path){
    $('dFileRow').hidden = false;
    $('dFileBtn').addEventListener('click', async () => {
      const { data: link, error } = await db.storage.from('order-deliveries').createSignedUrl(delivery.file_path, 300);
      if(error){ $('dFileMsg').textContent = 'Could not open the file: ' + error.message; $('dFileMsg').className = 'msg err'; return; }
      window.open(link.signedUrl, '_blank', 'noopener');
    });
  }
})();

document.querySelectorAll('.yr').forEach(el => el.textContent = new Date().getFullYear());
