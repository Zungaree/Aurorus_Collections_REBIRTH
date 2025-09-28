import { formatPrice, qs, qsa, createEl, showToast, updateNavbarCartBadge, setupNavToggle } from './ui.js';
import { requireAuth } from '../javascript/firebase/auth.js';
import { db } from '../javascript/firebase/firebase-config.js';
import { ref, get, query, orderByChild, equalTo, onValue, update, push } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

setupNavToggle();
updateNavbarCartBadge();

const ordersContainer = qs('#orders-container');
const statusFilter = qs('#status-filter');
const searchInput = qs('#search-orders');

let currentUser = null;
let allOrders = [];
let filteredOrders = [];

const init = async () => {
  currentUser = await requireAuth();
  adjustOrdersContainerHeight();
  window.addEventListener('resize', adjustOrdersContainerHeight, { passive:true });
  setupEventListeners();
  loadOrders();
};

const setupEventListeners = () => {
  // Status filter
  if (statusFilter) {
    statusFilter.addEventListener('change', filterOrders);
  }
  
  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', filterOrders);
  }
};

const loadOrders = () => {
  if (!currentUser) return;
  
  // Create username key from current user's display name
  const username = currentUser.displayName?.toLowerCase().replace(/\s+/g, '_') || currentUser.email.split('@')[0];
  
  const userOrdersRef = ref(db, `TBL_ORDERS/${username}`);
  
  onValue(userOrdersRef, (snapshot) => {
    const orders = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const order = childSnapshot.val();
        order.key = childSnapshot.key;
        orders.push(order);
      });
    }
    
    // Sort by creation date (newest first)
    allOrders = orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    filteredOrders = [...allOrders];
    renderOrders();
  });
};

const filterOrders = () => {
  const status = statusFilter?.value || 'all';
  const searchTerm = searchInput?.value.toLowerCase() || '';
  
  filteredOrders = allOrders.filter(order => {
    const matchesStatus = status === 'all' || order.status === status;
    const matchesSearch = searchTerm === '' || 
      order.orderId.toLowerCase().includes(searchTerm) ||
      order.items.some(item => item.name.toLowerCase().includes(searchTerm));
    
    return matchesStatus && matchesSearch;
  });
  
  renderOrders();
};

const renderOrders = () => {
  if (!ordersContainer) return;
  // Ensure container size is recalculated after content updates
  adjustOrdersContainerHeight();
  
  if (filteredOrders.length === 0) {
    ordersContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>No orders found</h3>
        <p>You haven't placed any orders yet, or no orders match your current filters.</p>
        <a href="products.html" class="btn btn-primary">Start Shopping</a>
      </div>
    `;
    return;
  }
  
  ordersContainer.innerHTML = '';
  
  filteredOrders.forEach(order => {
    const orderCard = createOrderCard(order);
    ordersContainer.appendChild(orderCard);
  });
};

const createOrderCard = (order) => {
  const card = createEl('div', { class: 'order-card' });
  
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const statusClass = `status-${order.status}`;
  const statusText = getStatusDisplayName(order.status);
  
  const itemsPreview = order.items.slice(0, 2).map(item => item.name).join(', ');
  const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';
  
  card.innerHTML = `
    <div class="order-header">
      <div class="order-info">
        <h3 class="order-id">${order.orderId}</h3>
        <p class="order-date">${orderDate}</p>
      </div>
      <div class="order-status">
        <span class="status ${statusClass}">${statusText}</span>
      </div>
    </div>
    
    <div class="order-content">
      <div class="order-items-preview">
        <h4>Items</h4>
        <p>${itemsPreview}${moreItems}</p>
      </div>
      
      <div class="order-totals">
        <div class="total-row">
          <span>Total:</span>
          <span class="total-amount">${formatPrice(order.totals?.grandTotal || 0)}</span>
        </div>
      </div>
      
      <div class="order-actions">
        <a href="order-details.html?orderId=${order.orderId}" class="btn btn-outline btn-sm">
          View Details
        </a>
        ${getActionButton(order)}
      </div>
    </div>
  `;
  
  return card;
};

// Dynamically fit orders container to viewport without altering card design
const adjustOrdersContainerHeight = () => {
  if (!ordersContainer) return;
  const rect = ordersContainer.getBoundingClientRect();
  const bottomPadding = 16; // space below panel
  const available = Math.max(220, Math.floor(window.innerHeight - rect.top - bottomPadding));
  ordersContainer.style.maxHeight = available + 'px';
};

const getStatusDisplayName = (status) => {
  const statusMap = {
    'PENDING_PAYMENT': 'Pending Payment',
    'PAYMENT_SUBMITTED': 'Payment Submitted',
    'PAYMENT_VERIFIED': 'Payment Verified',
    'PROOF_DECLINED': 'Proof Declined',
    'TO_SHIP': 'To Ship',
    'READY_TO_PICKUP': 'Ready to Pickup',
    'COMPLETED': 'Completed',
    'CANCELLED': 'Cancelled',
    // Legacy status support
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

const getActionButton = (order) => {
  switch (order.status) {
    case 'PENDING_PAYMENT':
    case 'pending_payment':
      return '<span class="btn btn-outline btn-sm btn-disabled">Awaiting Payment</span>';
    case 'PAYMENT_SUBMITTED':
    case 'payment_submitted':
      return '<span class="btn btn-outline btn-sm btn-disabled">Payment Under Review</span>';
    case 'PAYMENT_VERIFIED':
    case 'payment_verified':
    case 'processing':
      return '<span class="btn btn-outline btn-sm btn-disabled">Processing</span>';
    case 'PROOF_DECLINED':
      return '<span class="btn btn-outline btn-sm btn-disabled">Payment Declined</span>';
    case 'TO_SHIP':
      return '<span class="btn btn-outline btn-sm btn-disabled">Preparing to Ship</span>';
    case 'READY_TO_PICKUP':
    case 'ready_for_pickup':
      return '<a href="#" class="btn btn-primary btn-sm">Ready for Pickup</a>';
    case 'shipped':
      return '<span class="btn btn-outline btn-sm btn-disabled">In Transit</span>';
    case 'delivered':
      return '<span class="btn btn-outline btn-sm btn-disabled">Delivered</span>';
    case 'COMPLETED':
    case 'completed':
      return '<a href="#" class="btn btn-outline btn-sm">Reorder</a>';
    case 'CANCELLED':
    case 'cancelled':
      return '<span class="btn btn-outline btn-sm btn-disabled">Cancelled</span>';
    case 'refunded':
      return '<span class="btn btn-outline btn-sm btn-disabled">Refunded</span>';
    default:
      return '';
  }
};

// Export functions for use in other modules
export const getOrderById = async (username, orderId) => {
  const orderRef = ref(db, `TBL_ORDERS/${username}/${orderId}`);
  const snapshot = await get(orderRef);
  return snapshot.exists() ? snapshot.val() : null;
};

export const updateOrderStatus = async (username, orderId, newStatus, note = '') => {
  const orderRef = ref(db, `TBL_ORDERS/${username}/${orderId}`);
  const updates = {
    status: newStatus,
    updatedAt: Date.now()
  };
  
  // Add to timeline
  const timelineRef = ref(db, `TBL_ORDERS/${username}/${orderId}/timeline`);
  const timelineEntry = {
    status: newStatus,
    timestamp: Date.now(),
    note: note
  };
  
  await update(orderRef, updates);
  await push(timelineRef, timelineEntry);
};

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}





