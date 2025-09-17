import { db, toImageSrc, formatPrice } from './firebase-config.js';
import { ref, get, child } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { getQueryParam } from '../../js/router-helpers.js';
import { addToCart, setCheckoutSelection } from '../../js/storage.js';
import { setupNavToggle, updateNavbarCartBadge, showToast, qs } from '../../js/ui.js';

setupNavToggle();
updateNavbarCartBadge();

const id = getQueryParam('id');

const render = (p) => {
  const imgCol = qs('#image-col');
  const detCol = qs('#details-col');
  if(!p){ imgCol.innerHTML=''; detCol.textContent='Product not found'; return; }
  imgCol.innerHTML = `<article class="card"><div class="card-media"><img src="${toImageSrc(p.image)}" alt="${p.productName||''}" /></div><div class="card-body"><h1 class="card-title">${p.productName||''}</h1><p class="muted">${p.description||''}</p></div></article>`;
  const inStock = Number(p.stock)>0;
  const maxQty = inStock ? Math.max(1, Number(p.stock||1)) : 9999;
  detCol.innerHTML = `
    <div>
      <div class="row" style="align-items:center;justify-content:space-between">
        <span class="badge ${inStock?'badge-success':'badge-warning'}">${inStock?'In Stock':'Pre-order'}</span>
        ${inStock?`<span class="badge">Stock: ${p.stock}</span>`:''}
      </div>
      <p class="price" style="margin:10px 0">${formatPrice(p.price||0)}</p>
      <div class="controls">
        <label class="label" for="qty">Quantity</label>
        <input id="qty" class="input" type="number" min="1" value="1" ${inStock?'max="'+maxQty+'"':''} />
      </div>
      <div class="row" style="margin-top:12px;gap:10px">
        <button id="add" class="btn">Add to Cart</button>
        <button id="buy" class="btn btn-outline">Buy Now</button>
      </div>
    </div>`;
  const qtyEl = qs('#qty');
  const clamp = () => { let v = Number(qtyEl.value||1); if(inStock){ v = Math.max(1, Math.min(maxQty, v)); } else { v = Math.max(1, v); } qtyEl.value = String(v); };
  qtyEl.addEventListener('input', clamp); clamp();
  const add = () => {
    const quantity = Number(qtyEl.value||1);
    const isPreOrder = !inStock;
    addToCart({ productId:id, name:p.productName, price:Number(p.price||0), image:toImageSrc(p.image), quantity, isPreOrder });
    updateNavbarCartBadge();
    showToast('Added to cart');
  };
  qs('#add').addEventListener('click', add);
  qs('#buy').addEventListener('click', ()=>{
    const quantity = Number(qtyEl.value||1);
    add();
    const selectedItem = [{ productId:id, name:p.productName, price:Number(p.price||0), image:toImageSrc(p.image), quantity, isPreOrder:!inStock }];
    setCheckoutSelection(selectedItem, [id], quantity * Number(p.price||0));
    location.href = 'order-review.html';
  });
};

const init = async () => {
  if(!id){ render(null); return; }
  const snapshot = await get(child(ref(db), `TBL_PRODUCTS/${id}`));
  render(snapshot.exists()? snapshot.val() : null);
};

init();
