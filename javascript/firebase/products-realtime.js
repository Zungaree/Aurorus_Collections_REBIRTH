import { db, toImageSrc, formatPrice } from './firebase-config.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { addToCart } from '../../js/storage.js';
import { updateNavbarCartBadge, showToast } from '../../js/ui.js';

const grid = document.querySelector('#catalog-grid') || document.querySelector('#featured-grid');
const summary = document.querySelector('#summary');

const render = (products) => {
  if (!grid) return;
  grid.innerHTML = '';
  const items = Object.entries(products||{}).map(([id, p]) => ({ id, ...p }));
  if(items.length===0){
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No products found.';
    grid.appendChild(empty);
  }
  items.forEach(p => {
    const inStock = Number(p.stock) > 0;
    const article = document.createElement('article');
    article.className = 'card product-card';
    article.innerHTML = `
      <a class="card-media" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="View ${p.productName||''}">
        <img src="${toImageSrc(p.image)}" alt="${p.productName||''}" loading="lazy" />
      </a>
      <div class="card-body">
        <h3 class="card-title">${p.productName||''}</h3>
        <div class="card-meta">
          <span class="price">${formatPrice(p.price||0)}</span>
          <span class="badge ${inStock?'badge-success':'badge-danger'}">Stock: ${p.stock||0}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" data-add="${p.id}">Add to Cart</button>
          <a class="btn btn-sm btn-outline" href="product.html?id=${encodeURIComponent(p.id)}">Details</a>
        </div>
      </div>`;
    grid.appendChild(article);
  });
  if (summary) summary.textContent = items.length? `Showing 1–${items.length} of ${items.length}` : 'No products found';

  grid.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-add]');
    if(!btn) return;
    const id = btn.getAttribute('data-add');
    const p = items.find(x=> String(x.id)===String(id));
    if(!p) return;
    const isPreOrder = !(Number(p.stock)>0);
    await addToCart({ productId:p.id, name:p.productName, price:Number(p.price||0), image:toImageSrc(p.image), quantity:1, isPreOrder });
    updateNavbarCartBadge();
    showToast('Added to cart');
  });
};

const init = () => {
  const productsRef = ref(db, 'TBL_PRODUCTS');
  onValue(productsRef, (snap) => {
    render(snap.val());
  });
};

init();
