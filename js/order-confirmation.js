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
const processingMessage = qs('#processing-message');
const fulfillmentMessage = qs('#fulfillment-message');

let currentUser = null;
let orderData = null;

const init = async () => {
  currentUser = await requireAuth();
  
  // Get order ID from URL parameters or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let orderId = urlParams.get('orderId');
  
  // If no order ID in URL, check localStorage (for cash/credits orders)
  if (!orderId) {
    orderId = localStorage.getItem('lastOrderId');
    if (orderId) {
      // Clear the stored order ID after using it
      localStorage.removeItem('lastOrderId');
    }
  }
  
  if (!orderId) {
    showToast('No order ID provided', 'error');
    setTimeout(() => {
      window.location.href = 'orders.html';
    }, 2000);
    return;
  }
  
  await loadOrderData(orderId);
};

const loadOrderData = async (orderId) => {
  try {
    // Create username key from current user's display name
    const username = currentUser.displayName?.toLowerCase().replace(/\s+/g, '_') || currentUser.email.split('@')[0];
    
    const orderRef = ref(db, `TBL_ORDERS/${username}/${orderId}`);
    const snapshot = await get(orderRef);
    
    if (!snapshot.exists()) {
      showToast('Order not found', 'error');
      setTimeout(() => {
        window.location.href = 'orders.html';
      }, 2000);
      return;
    }
    
    orderData = snapshot.val();
    
    // Verify user owns this order
    if (orderData.userId !== currentUser.uid) {
      showToast('Access denied', 'error');
      setTimeout(() => {
        window.location.href = 'orders.html';
      }, 2000);
      return;
    }
    
    renderOrderDetails();
    
  } catch (error) {
    console.error('Error loading order:', error);
    showToast('Error loading order details', 'error');
  }
};

const renderOrderDetails = () => {
  // Basic order info
  orderIdEl.textContent = orderData.orderId;
  orderDateEl.textContent = new Date(orderData.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Status with appropriate styling (match order-details page)
  orderStatusEl.textContent = getStatusDisplayName(orderData.status);
  orderStatusEl.className = `value status-chip status-${orderData.status}`;
  
  // Payment method
  const paymentMethod = orderData.payment?.method || 'Unknown';
  paymentMethodEl.textContent = getPaymentMethodDisplayName(paymentMethod);
  
  // Order items
  renderOrderItems();
  
  // Totals
  subtotalEl.textContent = formatPrice(orderData.totals?.subtotal || 0);
  shippingCostEl.textContent = formatPrice(orderData.totals?.shipping || 0);
  totalEl.textContent = formatPrice(orderData.totals?.grandTotal || 0);
  
  // Shipping info
  renderShippingInfo();
  
  // Update next steps based on payment method
  updateNextSteps();
};

const renderOrderItems = () => {
  orderItemsList.innerHTML = '';
  
  orderData.items.forEach(item => {
    const itemEl = createEl('div', { class: 'order-item' });
    itemEl.innerHTML = `
      <div class="item-image">
        <img src="${item.image}" alt="${item.name}" />
      </div>
      <div class="item-details">
        <h4>${item.name}</h4>
        <div class="item-meta">
          <span class="price">${formatPrice(item.price)}</span>
          <span class="quantity">Qty: ${item.quantity}</span>
          ${item.isPreOrder ? '<span class="badge badge-warning">Pre-order</span>' : ''}
        </div>
      </div>
      <div class="item-total">
        ${formatPrice(item.price * item.quantity)}
      </div>
    `;
    orderItemsList.appendChild(itemEl);
  });
};

const renderShippingInfo = () => {
  const shipping = orderData.shipping;
  
  if (shipping.type === 'delivery') {
    shippingInfo.innerHTML = `
      <div class="shipping-address">
        <h4>Delivery Address</h4>
        <p><strong>${shipping.name}</strong></p>
        <p>${shipping.address}</p>
        <p>${shipping.city} ${shipping.zip}</p>
      </div>
    `;
  } else {
    shippingInfo.innerHTML = `
      <div class="shipping-address">
        <h4>Store Pickup</h4>
        <p><strong>${shipping.name}</strong></p>
        <p>Aurorus Connect Store</p>
        <p>123 Gaming Street, Manila, Philippines</p>
        <p class="muted">Please bring a valid ID for pickup</p>
      </div>
    `;
  }
};

const updateNextSteps = () => {
  const paymentMethod = orderData.payment?.method;
  
  if (paymentMethod === 'cash' || paymentMethod === 'store_credits') {
    processingMessage.textContent = 'Your order is ready for processing. Please visit our store to complete payment.';
    fulfillmentMessage.textContent = 'Once payment is received, we\'ll prepare your order for pickup.';
  } else {
    processingMessage.textContent = 'We\'re reviewing your payment and will update your order status soon.';
    fulfillmentMessage.textContent = 'Once payment is verified, we\'ll prepare your order for shipping or pickup.';
  }
};

const getStatusDisplayName = (status) => {
  const statusMap = {
    'pending_payment': 'Pending Payment',
    'payment_submitted': 'Payment Submitted',
    'payment_verified': 'Payment Verified',
    'processing': 'Processing',
    'ready_for_pickup': 'Ready for Pickup',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded'
  };
  return statusMap[status] || status;
};

const getPaymentMethodDisplayName = (method) => {
  const methodMap = {
    'cash': 'Cash (In-Store)',
    'store_credits': 'Store Credits',
    'gcash': 'GCash',
    'maya': 'Maya'
  };
  return methodMap[method] || method;
};

// Initialize on page load
init();





