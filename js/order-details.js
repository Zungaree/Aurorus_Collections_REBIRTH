import { formatPrice, qs, createEl, showToast, updateNavbarCartBadge, setupNavToggle } from './ui.js';
import { requireAuth } from '../javascript/firebase/auth.js';
import { db } from '../javascript/firebase/firebase-config.js';
import { ref, get } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

setupNavToggle();
updateNavbarCartBadge();

const orderIdEl = qs('#order-id');
const orderDateEl = qs('#order-date');
const orderStatusEl = qs('#order-status');
const paymentMethodEl = qs('#payment-method');
const orderItemsList = qs('#order-items-list');
const subtotalEl = qs('#subtotal');
const shippingCostEl = qs('#shipping-cost');
const totalEl = qs('#total');
const shippingInfo = qs('#shipping-info');

let currentUser = null;
let orderData = null;

const init = async () => {
  currentUser = await requireAuth();
  
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  
  if (!orderId) {
    showToast('No order ID provided', 'error');
    setTimeout(() => { window.location.href = 'orders.html'; }, 1500);
    return;
  }
  
  await loadOrder(orderId);
};

const usernameKey = (user) => {
  const base = (user.displayName || user.email).trim();
  const handle = base.includes('@') ? base.split('@')[0] : base;
  return handle.toLowerCase().replace(/\s+/g, '_');
};

const loadOrder = async (orderId) => {
  try {
    const uname = usernameKey(currentUser);
    const orderRef = ref(db, `TBL_ORDERS/${uname}/${orderId}`);
    const snap = await get(orderRef);
    if (!snap.exists()) {
      showToast('Order not found', 'error');
      setTimeout(() => { window.location.href = 'orders.html'; }, 1500);
      return;
    }
    orderData = snap.val();
    if (orderData.userId !== currentUser.uid) {
      showToast('Access denied', 'error');
      setTimeout(() => { window.location.href = 'orders.html'; }, 1500);
      return;
    }
    render();
  } catch (err) {
    console.error('Failed to load order', err);
    showToast('Error loading order', 'error');
  }
};

const statusText = (status) => ({
  pending_payment: 'Pending Payment',
  payment_submitted: 'Payment Submitted',
  payment_verified: 'Payment Verified',
  processing: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded'
}[status] || status);

const paymentText = (method) => ({
  cash: 'Cash (In-Store)',
  store_credits: 'Store Credits',
  credits: 'Store Credits',
  gcash: 'GCash',
  maya: 'Maya'
}[method] || method);

const render = () => {
  orderIdEl.textContent = orderData.orderId;
  orderDateEl.textContent = new Date(orderData.createdAt).toLocaleString();
  orderStatusEl.textContent = statusText(orderData.status);
  orderStatusEl.className = `value status status-${orderData.status}`;
  paymentMethodEl.textContent = paymentText(orderData.payment?.method);
  
  // Items
  orderItemsList.innerHTML = '';
  orderData.items.forEach(item => {
    const el = createEl('div', { class: 'order-item' });
    el.innerHTML = `
      <div class="item-image"><img src="${item.image}" alt="${item.name}"></div>
      <div class="item-details">
        <h4>${item.name}</h4>
        <div class="item-meta">
          <span class="price">${formatPrice(item.price)}</span>
          <span class="quantity">Qty: ${item.quantity}</span>
          ${item.isPreOrder ? '<span class="badge badge-warning">Pre-order</span>' : ''}
        </div>
      </div>
      <div class="item-total">${formatPrice(item.price * item.quantity)}</div>
    `;
    orderItemsList.appendChild(el);
  });
  
  subtotalEl.textContent = formatPrice(orderData.totals?.subtotal || 0);
  shippingCostEl.textContent = formatPrice(orderData.totals?.shipping || 0);
  totalEl.textContent = formatPrice(orderData.totals?.grandTotal || 0);
  
  if (orderData.shipping?.type === 'delivery') {
    const s = orderData.shipping;
    shippingInfo.innerHTML = `
      <div class="shipping-address">
        <h4>Delivery Address</h4>
        <p><strong>${s.name}</strong></p>
        <p>${s.address}</p>
        <p>${s.city} ${s.zip}</p>
      </div>
    `;
  } else {
    const s = orderData.shipping;
    shippingInfo.innerHTML = `
      <div class="shipping-address">
        <h4>Store Pickup</h4>
        <p><strong>${s.name}</strong></p>
        <p>Aurorus Connect Store</p>
        <p>123 Gaming Street, Manila, Philippines</p>
        <p class="muted">Please bring a valid ID for pickup</p>
      </div>
    `;
  }
};

init();


