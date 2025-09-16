import { formatPrice, qs, createEl, showToast, updateNavbarCartBadge, setupNavToggle } from './ui.js';
import { readCheckoutSelection, clearCheckoutSelection, getCartItems, setCartItems } from './storage.js';
import { requireAuth } from '../javascript/firebase/auth.js';
import { db, storage, storageRef, uploadBytes, getDownloadURL } from '../javascript/firebase/firebase-config.js';
import { ref, get, child, set } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

setupNavToggle();
updateNavbarCartBadge();

const summaryEl = qs('#order-items');
const totalEl = qs('#order-total');
const nameEl = qs('#name');
const addressEl = qs('#address');
const cityEl = qs('#city');
const zipEl = qs('#zip');
const paymentProof = qs('#payment-proof');
const refEl = qs('#ref');
const screenshotEl = qs('#screenshot');
const previewEl = qs('#preview');
const placeBtn = qs('#place-order');
const successEl = qs('#success');

const sel = readCheckoutSelection();
let shipping = 'delivery';
let payment = 'gcash';
let currentUser = null;

const renderSummary = () => {
  summaryEl.innerHTML = '';
  sel.items.forEach(i=>{
    const row = createEl('div',{class:'row', style:'justify-content:space-between'});
    row.innerHTML = `<span>${i.name} × ${i.quantity}</span><strong>${formatPrice(i.price*i.quantity)}</strong>`;
    summaryEl.appendChild(row);
  });
  totalEl.textContent = formatPrice(sel.total||0);
};

renderSummary();

qsa('input[name="shipping"]').forEach(r=> r.addEventListener('change', (e)=>{
  shipping = e.target.value;
  qs('#address-form').classList.toggle('hidden', shipping !== 'delivery');
}));

qsa('input[name="payment"]').forEach(r=> r.addEventListener('change', (e)=>{
  payment = e.target.value;
  paymentProof.classList.toggle('hidden', false);
}));

screenshotEl.addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(file){ const url = URL.createObjectURL(file); previewEl.innerHTML = `<img src="${url}" alt="Payment screenshot" style="max-width:100%;border:1px solid var(--hairline);border-radius:8px" />`; previewEl.classList.remove('hidden'); }
  else { previewEl.classList.add('hidden'); previewEl.innerHTML=''; }
});

const validate = () => {
  if(!sel.items.length){ showToast('No items selected'); return false; }
  if(shipping==='delivery'){
    if(!nameEl.value.trim() || !addressEl.value.trim() || !cityEl.value.trim() || !zipEl.value.trim()){
      showToast('Please fill in address details'); return false;
    }
  }
  if(payment==='gcash' || payment==='paymaya'){
    if(!refEl.value.trim()){ showToast('Reference number is required'); return false; }
    if(!screenshotEl.files || !screenshotEl.files[0]){ showToast('Payment screenshot is required'); return false; }
  }
  return true;
};

const generateOrderId = () => {
  const d = new Date();
  const ymd = d.toISOString().slice(0,10).replaceAll('-','');
  const rnd = String(Math.floor(Math.random()*10000)).padStart(4,'0');
  return `ORD-${ymd}-${rnd}`;
};

const checkStock = async () => {
  const insufficient = [];
  for(const i of sel.items){
    if(i.isPreOrder) continue;
    const snap = await get(child(ref(db), `TBL_PRODUCTS/${i.productId}`));
    if(!snap.exists()) { insufficient.push(`${i.name} (missing)`); continue; }
    const p = snap.val();
    if(Number(p.stock||0) < Number(i.quantity||0)) insufficient.push(`${i.name}`);
  }
  return insufficient;
};

const uploadProof = async (uid, orderId) => {
  const file = screenshotEl.files[0];
  const ext = file.type.includes('png')? 'png' : 'jpg';
  const path = `paymentProofs/${uid}/${orderId}.${ext}`;
  const refPath = storageRef(storage, path);
  await uploadBytes(refPath, file);
  return await getDownloadURL(refPath);
};

const clearSelectedFromCart = async (ids) => {
  const remaining = getCartItems().filter(i=> !ids.includes(i.productId));
  setCartItems(remaining);
};

const init = async () => {
  currentUser = await requireAuth();
};

placeBtn.addEventListener('click', async ()=>{
  currentUser = await requireAuth();
  if(!validate()) return;
  const insufficient = await checkStock();
  if(insufficient.length){ showToast(`Insufficient stock: ${insufficient.join(', ')}`); return; }
  const orderId = generateOrderId();
  let proofUrl = '';
  if(payment==='gcash' || payment==='paymaya'){
    proofUrl = await uploadProof(currentUser.uid, orderId);
  }
  const order = {
    orderId,
    uid: currentUser.uid,
    createdAt: Date.now(),
    items: sel.items,
    totals: { subtotal: sel.total||0, shipping: 0, grandTotal: sel.total||0 },
    shipping: { type: shipping, name: nameEl.value.trim(), address: addressEl.value.trim(), city: cityEl.value.trim(), zip: zipEl.value.trim() },
    payment: { method: payment, refNumber: refEl.value.trim(), proofUrl },
    status: 'under_review'
  };
  await set(ref(db, `TBL_ORDERS/${orderId}`), order);
  await clearSelectedFromCart(sel.ids||[]);
  clearCheckoutSelection();
  updateNavbarCartBadge();
  const details = createEl('div');
  details.innerHTML = `
    <h2>Order Submitted</h2>
    <p>Order ID: <strong>${orderId}</strong></p>
    <p>Status: <strong>Under Review</strong></p>`;
  successEl.innerHTML = '';
  successEl.appendChild(details);
  successEl.classList.remove('hidden');
  showToast('Order submitted for review');
});

init();
