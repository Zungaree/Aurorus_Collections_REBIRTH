import { db } from '../javascript/firebase/firebase-config.js';
import { ref, set, get, push, update } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

/**
 * Generate a unique order ID
 * Format: ORD-YYYYMMDD-XXXX
 */
export const generateOrderId = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replaceAll('-', '');
  const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ORD-${dateStr}-${randomNum}`;
};

/**
 * Check if items are in stock before creating order
 */
export const checkStock = async (items) => {
  const insufficientItems = [];
  
  for (const item of items) {
    const productRef = ref(db, `TBL_PRODUCTS/${item.productId}`);
    const snapshot = await get(productRef);
    
    if (!snapshot.exists()) {
      insufficientItems.push({
        productId: item.productId,
        name: item.name,
        reason: 'Product not found'
      });
      continue;
    }
    
    const product = snapshot.val();
    const currentStock = Number(product.stock || 0);
    const requestedQuantity = Number(item.quantity || 0);
    
    if (currentStock < requestedQuantity) {
      insufficientItems.push({
        productId: item.productId,
        name: item.name,
        currentStock,
        requestedQuantity,
        reason: 'Insufficient stock'
      });
    }
  }
  
  return insufficientItems;
};

/**
 * Create a new order in the database
 */
export const createOrder = async (orderData) => {
  try {
    // Check stock availability before creating order
    const insufficientItems = await checkStock(orderData.items);
    if (insufficientItems.length > 0) {
      const errorMessage = insufficientItems.map(item => 
        `${item.name}: ${item.reason}${item.currentStock !== undefined ? ` (Available: ${item.currentStock}, Requested: ${item.requestedQuantity})` : ''}`
      ).join(', ');
      throw new Error(`Insufficient stock: ${errorMessage}`);
    }
    
    const orderId = generateOrderId();
    const timestamp = Date.now();
    
    const order = {
      orderId,
      userId: orderData.userId,
      userEmail: orderData.userEmail,
      userName: orderData.userName,
      status: 'pending_payment',
      createdAt: timestamp,
      updatedAt: timestamp,
      
      items: orderData.items,
      totals: orderData.totals,
      shipping: orderData.shipping,
      payment: {
        method: orderData.payment.method,
        status: 'pending',
        referenceId: '',
        proofBase64: '',
        verifiedAt: null,
        verifiedBy: null
      },
      
      timeline: [
        {
          status: 'order_created',
          timestamp,
          note: 'Order created and awaiting payment'
        }
      ],
      
      admin: {
        assignedTo: null,
        notes: '',
        lastReviewed: null
      }
    };
    
    // Create username key from userName (lowercase, replace spaces with underscores)
    const username = orderData.userName.toLowerCase().replace(/\s+/g, '_');
    
    await set(ref(db, `TBL_ORDERS/${username}/${orderId}`), order);
    return orderId;
    
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (username, orderId, newStatus, note = '') => {
  try {
    const timestamp = Date.now();
    const updates = {
      [`TBL_ORDERS/${username}/${orderId}/status`]: newStatus,
      [`TBL_ORDERS/${username}/${orderId}/updatedAt`]: timestamp
    };
    
    await update(ref(db), updates);
    
    // Add to timeline
    await push(ref(db, `TBL_ORDERS/${username}/${orderId}/timeline`), {
      status: newStatus,
      timestamp,
      note
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

/**
 * Update payment information
 */
export const updatePaymentInfo = async (username, orderId, paymentData) => {
  try {
    const timestamp = Date.now();
    const updates = {
      [`TBL_ORDERS/${username}/${orderId}/payment/referenceId`]: paymentData.referenceId,
      [`TBL_ORDERS/${username}/${orderId}/payment/proofBase64`]: paymentData.proofBase64,
      [`TBL_ORDERS/${username}/${orderId}/payment/status`]: 'submitted',
      [`TBL_ORDERS/${username}/${orderId}/status`]: 'payment_submitted',
      [`TBL_ORDERS/${username}/${orderId}/updatedAt`]: timestamp
    };
    
    await update(ref(db), updates);
    
    // Add to timeline
    await push(ref(db, `TBL_ORDERS/${username}/${orderId}/timeline`), {
      status: 'payment_submitted',
      timestamp,
      note: `Payment proof submitted via ${paymentData.method}`
    });
    
  } catch (error) {
    console.error('Error updating payment info:', error);
    throw error;
  }
};

/**
 * Verify payment (admin function)
 */
export const verifyPayment = async (username, orderId, adminId, verified = true) => {
  try {
    const timestamp = Date.now();
    const status = verified ? 'payment_verified' : 'payment_rejected';
    const paymentStatus = verified ? 'verified' : 'rejected';
    
    const updates = {
      [`TBL_ORDERS/${username}/${orderId}/payment/status`]: paymentStatus,
      [`TBL_ORDERS/${username}/${orderId}/payment/verifiedAt`]: verified ? timestamp : null,
      [`TBL_ORDERS/${username}/${orderId}/payment/verifiedBy`]: verified ? adminId : null,
      [`TBL_ORDERS/${username}/${orderId}/status`]: status,
      [`TBL_ORDERS/${username}/${orderId}/updatedAt`]: timestamp
    };
    
    await update(ref(db), updates);
    
    // Add to timeline
    await push(ref(db, `TBL_ORDERS/${username}/${orderId}/timeline`), {
      status,
      timestamp,
      note: verified ? 'Payment verified by admin' : 'Payment rejected by admin'
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};

/**
 * Get order by username and order ID
 */
export const getOrder = async (username, orderId) => {
  try {
    const snapshot = await get(ref(db, `TBL_ORDERS/${username}/${orderId}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error getting order:', error);
    throw error;
  }
};

/**
 * Get orders by username
 */
export const getUserOrders = async (username) => {
  try {
    const snapshot = await get(ref(db, `TBL_ORDERS/${username}`));
    if (!snapshot.exists()) return [];
    
    const orders = snapshot.val();
    return Object.values(orders);
    
  } catch (error) {
    console.error('Error getting user orders:', error);
    throw error;
  }
};

/**
 * Get all orders (admin function)
 */
export const getAllOrders = async () => {
  try {
    const snapshot = await get(ref(db, 'TBL_ORDERS'));
    if (!snapshot.exists()) return [];
    
    const allOrders = [];
    const users = snapshot.val();
    
    // Iterate through each user's orders
    Object.values(users).forEach(userOrders => {
      Object.values(userOrders).forEach(order => {
        allOrders.push(order);
      });
    });
    
    return allOrders;
  } catch (error) {
    console.error('Error getting all orders:', error);
    throw error;
  }
};

/**
 * Update order for fulfillment
 */
export const updateOrderFulfillment = async (username, orderId, status, note = '') => {
  try {
    const timestamp = Date.now();
    const updates = {
      [`TBL_ORDERS/${username}/${orderId}/status`]: status,
      [`TBL_ORDERS/${username}/${orderId}/updatedAt`]: timestamp
    };
    
    await update(ref(db), updates);
    
    // Add to timeline
    await push(ref(db, `TBL_ORDERS/${username}/${orderId}/timeline`), {
      status,
      timestamp,
      note
    });
    
  } catch (error) {
    console.error('Error updating order fulfillment:', error);
    throw error;
  }
};
