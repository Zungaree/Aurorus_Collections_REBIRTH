import { getCartMap, updateQuantity, removeFromCart } from './storage.js';
import { createEl, formatPrice, qs, qsa, showToast, updateNavbarCartBadge, setupNavToggle } from './ui.js';
import { db, auth } from '../javascript/firebase/firebase-config.js';
import { ref, get, onValue } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';

setupNavToggle();
updateNavbarCartBadge();

const tbody = qs('#cart-body');
const selectAll = qs('#select-all');
const selectedQtyEl = qs('#selected-qty');
const selectedSubtotalEl = qs('#selected-subtotal');
const checkoutBtn = qs('#checkout-btn');

let items = [];
let selectedIds = new Set();
let unsubCart = null;

const usernameFromUser = (user) => {
  const base = (user?.displayName || user?.email || '').trim();
  const uname = base.includes('@') ? base.split('@')[0] : base;
  return uname.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
};

const recalc = () => {
  const sel = items.filter(i=> selectedIds.has(String(i.productId)));
  const qty = sel.reduce((s,i)=> s + Number(i.quantity||0), 0);
  const subtotal = sel.reduce((s,i)=> s + Number(i.quantity||0)*Number(i.price||0), 0);
  selectedQtyEl.textContent = String(qty);
  selectedSubtotalEl.textContent = formatPrice(subtotal);
  selectAll.checked = sel.length === items.length && items.length>0;
  checkoutBtn.classList.toggle('btn-disabled', sel.length===0);
};

const loadJoinedItems = async () => {
  const map = await getCartMap();
  const prodSnap = await get(ref(db, 'TBL_PRODUCTS'));
  const prods = prodSnap.exists()? prodSnap.val(): {};
  const joined = Object.entries(map).map(([pid, qty])=>{
    const p = prods[pid] || {};
    const inStock = Number(p.stock||0) > 0;
    return {
      productId: pid,
      name: p.productName || 'Unknown',
      price: Number(p.price||0),
      image: p.image ? (String(p.image).startsWith('data:image')? p.image : `data:image/png;base64,${p.image}`) : '',
      quantity: Number(qty||0),
      isPreOrder: !inStock
    };
  });
  return joined;
};

const render = async () => {
  items = await loadJoinedItems();
  if(selectedIds.size===0) selectedIds = new Set(items.map(i=> String(i.productId)));
  tbody.innerHTML = '';
  items.forEach(it => {
    const tr = createEl('tr');
    tr.innerHTML = `
      <td><input type=\"checkbox\" data-id=\"${it.productId}\" ${selectedIds.has(String(it.productId))?'checked':''} /></td>
      <td>
        <div class=\"row\" style=\"align-items:center;gap:12px\">
          <img src=\"${it.image}\" alt=\"${it.name}\" style=\"width:64px;height:64px;object-fit:cover;border-radius:6px\" />
          <div>
            <div>${it.name}</div>
            <div class=\"muted\">${it.isPreOrder?'<span class=\\\"badge badge-warning\\\">Pre-order</span>':''}</div>
          </div>
        </div>
      </td>
      <td>${formatPrice(it.price)}</td>
      <td>
        <input type=\"number\" class=\"input\" style=\"max-width:90px\" min=\"1\" value=\"${it.quantity}\" data-qty=\"${it.productId}\" />
      </td>
      <td>${formatPrice(it.quantity*it.price)}</td>
      <td><button class=\"btn btn-outline\" data-remove=\"${it.productId}\">Remove</button></td>`;
    tbody.appendChild(tr);
  });
  recalc();
};

selectAll.addEventListener('change', async (e)=>{
  if(e.target.checked){ selectedIds = new Set(items.map(i=> String(i.productId))); }
  else { selectedIds = new Set(); }
  await render();
});

tbody.addEventListener('change', async (e)=>{
  const cb = e.target.matches('input[type=\"checkbox\"][data-id]') ? e.target : null;
  if(cb){ const id = cb.getAttribute('data-id'); if(cb.checked) selectedIds.add(id); else selectedIds.delete(id); recalc(); return; }
  const qtyEl = e.target.matches('input[data-qty]') ? e.target : null;
  if(qtyEl){ const id = qtyEl.getAttribute('data-qty'); let v = Math.max(1, Number(qtyEl.value||1)); qtyEl.value = String(v); await updateQuantity(id, v); showToast('Quantity updated'); return; }
});

tbody.addEventListener('click', async (e)=>{
  const rm = e.target.closest('[data-remove]');
  if(rm){ const id = rm.getAttribute('data-remove'); await removeFromCart(id); showToast('Removed from cart'); }
});

checkoutBtn.addEventListener('click', async (e)=>{
  const sel = items.filter(i=> selectedIds.has(String(i.productId)));
  if(sel.length===0){ e.preventDefault(); showToast('Select at least one item'); return; }
  const total = sel.reduce((s,i)=> s + Number(i.quantity||0)*Number(i.price||0), 0);
  import('./storage.js').then(({ setCheckoutSelection })=> setCheckoutSelection(sel, sel.map(i=> i.productId), total));
});

const bindCartRealtime = (user) => {
  if(unsubCart){ unsubCart(); unsubCart=null; }
  if(!user) return;
  const username = usernameFromUser(user);
  const cartRef = ref(db, `TBL_CART/${username}`);
  unsubCart = onValue(cartRef, ()=>{ render(); updateNavbarCartBadge(); });
};

onAuthStateChanged(auth, (user)=>{ bindCartRealtime(user); render(); });

render();
