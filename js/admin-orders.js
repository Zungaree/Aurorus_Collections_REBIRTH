import { db } from '../javascript/firebase/firebase-config.js';
import { ref, get, update, push } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { getAllOrders, verifyPayment, updateOrderStatus } from './order-utils.js';

/**
 * Get orders by status
 */
export const getOrdersByStatus = async (status) => {
  try {
    const allOrders = await getAllOrders();
    return allOrders.filter(order => order.status === status);
  } catch (error) {
    console.error('Error getting orders by status:', error);
    throw error;
  }
};

/**
 * Get pending payment orders
 */
export const getPendingPaymentOrders = async () => {
  return await getOrdersByStatus('payment_submitted');
};

/**
 * Get verified payment orders
 */
export const getVerifiedPaymentOrders = async () => {
  return await getOrdersByStatus('payment_verified');
};

/**
 * Get processing orders
 */
export const getProcessingOrders = async () => {
  return await getOrdersByStatus('processing');
};

/**
 * Get ready for pickup orders
 */
export const getReadyForPickupOrders = async () => {
  return await getOrdersByStatus('ready_for_pickup');
};

/**
 * Get completed orders
 */
export const getCompletedOrders = async () => {
  return await getOrdersByStatus('completed');
};

/**
 * Verify payment (approve or reject)
 */
export const adminVerifyPayment = async (orderId, adminId, approved = true) => {
  try {
    await verifyPayment(orderId, adminId, approved);
    
    if (approved) {
      // Move to processing status
      await updateOrderStatus(orderId, 'processing', 'Payment verified, order being prepared');
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};

/**
 * Mark order as ready for pickup
 */
export const markOrderReadyForPickup = async (orderId, adminId) => {
  try {
    await updateOrderStatus(orderId, 'ready_for_pickup', 'Order ready for customer pickup');
    
    // Add admin note
    await update(ref(db, `TBL_ORDERS/${orderId}/admin`), {
      assignedTo: adminId,
      lastReviewed: Date.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error marking order ready:', error);
    throw error;
  }
};

/**
 * Mark order as shipped
 */
export const markOrderShipped = async (orderId, adminId, trackingNumber = '') => {
  try {
    const note = trackingNumber ? `Order shipped with tracking: ${trackingNumber}` : 'Order shipped';
    await updateOrderStatus(orderId, 'shipped', note);
    
    return true;
  } catch (error) {
    console.error('Error marking order shipped:', error);
    throw error;
  }
};

/**
 * Mark order as completed
 */
export const markOrderCompleted = async (orderId, adminId) => {
  try {
    await updateOrderStatus(orderId, 'completed', 'Order completed successfully');
    
    return true;
  } catch (error) {
    console.error('Error marking order completed:', error);
    throw error;
  }
};

/**
 * Cancel order
 */
export const cancelOrder = async (orderId, adminId, reason = '') => {
  try {
    const note = reason ? `Order cancelled: ${reason}` : 'Order cancelled by admin';
    await updateOrderStatus(orderId, 'cancelled', note);
    
    return true;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
};

/**
 * Add admin note to order
 */
export const addAdminNote = async (orderId, adminId, note) => {
  try {
    await update(ref(db, `TBL_ORDERS/${orderId}/admin`), {
      notes: note,
      lastReviewed: Date.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error adding admin note:', error);
    throw error;
  }
};

/**
 * Get order statistics
 */
export const getOrderStatistics = async () => {
  try {
    const allOrders = await getAllOrders();
    
    const stats = {
      total: allOrders.length,
      pending_payment: 0,
      payment_submitted: 0,
      payment_verified: 0,
      processing: 0,
      ready_for_pickup: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      refunded: 0
    };
    
    allOrders.forEach(order => {
      if (stats.hasOwnProperty(order.status)) {
        stats[order.status]++;
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting order statistics:', error);
    throw error;
  }
};


