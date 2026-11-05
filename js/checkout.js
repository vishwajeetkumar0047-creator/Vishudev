/* Checkout: review the cart, then place the orders. Prices always come from the database. */
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
let items = [];

(async function start(){
  const { data } = await db.auth.getSession();
  if(!data.session){ location.replace('store.html'); return; }
  await syncCart();
  $('loading').hidden = true;
  await render();
})();

async function render(){
  const ids = getCart();
  $('coMsg').textContent = '';
  if(!ids.length){ $('cart').hidden = true; $('empty').hidden = false; return; }

  const { data, error } = await db.from('packages').select('id,name,group_name,tier,price_amount,extra_note,is_free').in('id', ids);
  if(error){ $('coMsg').textContent = 'Could not load your cart. Please refresh.'; $('coMsg').className = 'msg err'; return; }

  // keep cart order, drop anything that no longer exists or cannot be ordered online
  items = ids.map(id => data.find(p => p.id === id)).filter(p => p && (p.is_free || p.price_amount));
  if(items.length !== ids.length){
    saveCart(items.map(p => p.id));
    $('coMsg').textContent = 'Some items were removed because they are no longer available.';
    $('coMsg').className = 'msg err';
  }
  if(!items.length){ $('cart').hidden = true; $('empty').hidden = false; return; }

  $('empty').hidden = true;
  $('cart').hidden = false;
  $('items').innerHTML = items.map(p => `
    <article class="card" style="margin-bottom:16px">
      <div class="row">
        <div>
          <small>${esc(p.group_name)} · ${esc(p.tier || '')}</small>
          <h3>${esc(p.name)}</h3>
          ${p.extra_note ? `<small>Not included: ${esc(p.extra_note)}</small>` : ''}
        </div>
        <div style="text-align:right">
          <b>${p.is_free ? 'Free' : money(p.price_amount)}</b><br>
          <button class="linkbtn" type="button" data-remove="${esc(p.id)}">Remove</button>
        </div>
      </div>
    </article>`).join('');
  $('total').textContent = money(items.reduce((n, p) => n + Number(p.price_amount || 0), 0));
  $('placeBtn').disabled = false;
}

$('items').addEventListener('click', e => {
  const b = e.target.closest('[data-remove]'); if(!b) return;
  removeFromCart(b.dataset.remove);
  render();
});

$('clearBtn').addEventListener('click', () => {
  if(!confirm('Remove everything from your cart?')) return;
  saveCart([]);
  render();
});

/* place the orders: each one is created on the server with the database price.
   If one fails, the others stay in the cart, so nothing is lost. */
$('placeBtn').addEventListener('click', async () => {
  $('placeBtn').disabled = true;
  $('coMsg').textContent = 'Placing your order…'; $('coMsg').className = 'msg';
  for(const p of items){
    const { error } = await db.rpc('create_order', { p_package_id: p.id });   // free items complete at once
    if(error){
      $('coMsg').textContent = `Could not place "${p.name}": ${error.message}`;
      $('coMsg').className = 'msg err';
      $('placeBtn').disabled = false;
      return;
    }
  }
  saveCart([]);
  location.href = 'orders.html';
});

document.querySelectorAll('.yr').forEach(el => el.textContent = new Date().getFullYear());
