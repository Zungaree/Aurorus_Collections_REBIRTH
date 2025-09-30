import { formatPrice, qs, qsa, createEl, showToast, updateNavbarCartBadge, setupNavToggle } from './ui.js';
import { readCheckoutSelection, setOrderReviewData, setPaymentMethodData, clearSelectedFromCart, updateMultipleProductStock } from './storage.js';
import { requireAuth } from '../javascript/firebase/auth.js';
import { createOrder } from './order-utils.js';

setupNavToggle();
updateNavbarCartBadge();

const orderItemsList = qs('#order-items-list');
const subtotalEl = qs('#subtotal');
const shippingCostEl = qs('#shipping-cost');
const totalEl = qs('#total');
const proceedBtn = qs('#proceed-to-payment');
const addressForm = qs('#address-form');
const pickupInfo = qs('#pickup-info');
const paymentWarning = qs('#payment-warning');

// Section containers for full show/hide
const addressSection = qs('#address-section');
const pickupSection = qs('#pickup-section');

const nameEl = qs('#name');
const addressEl = qs('#address');
const cityEl = qs('#city');
const zipEl = qs('#zip');
const pickupNameEl = qs('#pickup-name');

let checkoutData = null;
let shippingType = 'delivery';
let paymentMethod = null;
let currentUser = null;

const init = async () => {
  currentUser = await requireAuth();
  checkoutData = readCheckoutSelection();
  
  console.log('Checkout data loaded:', checkoutData);
  
  if (!checkoutData || !checkoutData.items || checkoutData.items.length === 0) {
    showToast('No items selected. Please go back to cart.', 'error');
    setTimeout(() => {
      window.location.href = 'cart.html';
    }, 2000);
    return;
  }
  
  renderOrderItems();
  updateOrderSummary();
  setupEventListeners();
  
  // Initial validation
  setTimeout(() => {
    console.log('Form elements found:', {
      nameEl: !!nameEl,
      addressEl: !!addressEl,
      cityEl: !!cityEl,
      zipEl: !!zipEl,
      pickupNameEl: !!pickupNameEl,
      proceedBtn: !!proceedBtn,
      paymentWarning: !!paymentWarning
    });
    
    // Check initial state of radio buttons
    const selectedShipping = qs('input[name="shipping"]:checked');
    if (selectedShipping) {
      shippingType = selectedShipping.value;
      console.log('Initial shipping type:', shippingType);
      
      // Set initial payment warning state
      if (paymentWarning) {
        paymentWarning.classList.toggle('hidden', shippingType === 'pickup');
      }

      // Set initial section visibility
      if (addressForm) addressForm.classList.toggle('hidden', shippingType !== 'delivery');
      if (pickupInfo) pickupInfo.classList.toggle('hidden', shippingType !== 'pickup');
      if (addressSection) addressSection.classList.toggle('hidden', shippingType !== 'delivery');
      if (pickupSection) pickupSection.classList.toggle('hidden', shippingType !== 'pickup');
    }
    
    const selectedPayment = qs('input[name="payment"]:checked');
    if (selectedPayment) {
      paymentMethod = selectedPayment.value;
      console.log('Initial payment method:', paymentMethod);
    }
    
    validateForm();
  }, 100);
};

const renderOrderItems = () => {
  orderItemsList.innerHTML = '';
  
  checkoutData.items.forEach(item => {
    const itemEl = createEl('div', { class: 'order-item' });
    itemEl.innerHTML = `
      <div class="item-image">
        <img src="${item.image}" alt="${item.name}" />
      </div>
      <div class="item-details">
        <h3>${item.name}</h3>
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

const updateOrderSummary = () => {
  const subtotal = checkoutData.total || 0;
  const shipping = 0; // No additional shipping cost
  const total = subtotal + shipping;
  
  subtotalEl.textContent = formatPrice(subtotal);
  shippingCostEl.textContent = formatPrice(shipping);
  totalEl.textContent = formatPrice(total);
  
  // Update checkout data with shipping info
  checkoutData.shippingCost = shipping;
  checkoutData.grandTotal = total;
};

const setupEventListeners = () => {
  // Shipping type change
  qsa('input[name="shipping"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      shippingType = e.target.value;
      console.log('Shipping type changed to:', shippingType);
      if (addressForm) addressForm.classList.toggle('hidden', shippingType !== 'delivery');
      if (pickupInfo) pickupInfo.classList.toggle('hidden', shippingType !== 'pickup');
      if (addressSection) addressSection.classList.toggle('hidden', shippingType !== 'delivery');
      if (pickupSection) pickupSection.classList.toggle('hidden', shippingType !== 'pickup');
      
      // Show/hide payment warning
      if (paymentWarning) {
        paymentWarning.classList.toggle('hidden', shippingType === 'pickup');
      }
      
      updateOrderSummary();
      validateForm();
    });
  });
  
  // Payment method change
  qsa('input[name="payment"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      paymentMethod = e.target.value;
      console.log('Payment method changed to:', paymentMethod);
      validateForm();
    });
  });
  
  // Form validation on input
  [nameEl, addressEl, cityEl, zipEl].forEach(input => {
    if (input) {
      input.addEventListener('input', validateForm);
    }
  });
  
  // Add validation for pickup name if it exists
  if (pickupNameEl) {
    pickupNameEl.addEventListener('input', validateForm);
  }
  
  // Proceed to payment
  proceedBtn.addEventListener('click', handleProceedToPayment);
};

const validateForm = () => {
  let isValid = true;
  let errorMessage = '';
  
  // Get the appropriate name field based on shipping type
  const currentNameEl = shippingType === 'pickup' ? pickupNameEl : nameEl;
  
  console.log('Validating form:', {
    shippingType,
    paymentMethod,
    nameValue: currentNameEl ? currentNameEl.value.trim() : 'N/A',
    addressValue: addressEl ? addressEl.value.trim() : 'N/A',
    cityValue: cityEl ? cityEl.value.trim() : 'N/A',
    zipValue: zipEl ? zipEl.value.trim() : 'N/A'
  });
  
  // Check shipping information
  if (shippingType === 'delivery') {
    const requiredFields = [nameEl, addressEl, cityEl, zipEl];
    requiredFields.forEach(field => {
      if (!field || !field.value.trim()) {
        isValid = false;
        errorMessage = 'Please fill in all delivery address fields';
      }
    });
  } else {
    // For pickup, only pickup name is required
    if (!pickupNameEl || !pickupNameEl.value.trim()) {
      isValid = false;
      errorMessage = 'Please enter your name for pickup';
    }
  }
  
  // Check payment method selection
  if (!paymentMethod) {
    isValid = false;
    errorMessage = 'Please select a payment method';
  }
  
  // Validate payment method restrictions
  if (paymentMethod === 'cash' && shippingType !== 'pickup') {
    isValid = false;
    errorMessage = 'Cash payment is only available for store pickup';
  }
  if (paymentMethod === 'credits' && shippingType !== 'pickup') {
    isValid = false;
    errorMessage = 'Store credits are only available for store pickup';
  }
  
  console.log('Form validation result:', isValid, errorMessage);
  
  proceedBtn.disabled = !isValid;
  proceedBtn.classList.toggle('btn-disabled', !isValid);
  
  // Add visual feedback for required fields
  const requiredFields = shippingType === 'delivery' ? [nameEl, addressEl, cityEl, zipEl] : [nameEl];
  requiredFields.forEach(field => {
    if (field) {
      field.classList.toggle('error', !field.value.trim());
    }
  });
  
  // Add visual feedback for payment method
  qsa('input[name="payment"]').forEach(radio => {
    const paymentOption = radio.closest('.payment-option');
    const paymentCard = radio.closest('.payment-card');
    
    if (radio.value === 'cash' || radio.value === 'credits') {
      if (shippingType !== 'pickup') {
        paymentOption.classList.add('disabled');
        radio.disabled = true;
        if (paymentMethod === radio.value) {
          paymentMethod = null; // Clear invalid selection
        }
      } else {
        paymentOption.classList.remove('disabled');
        radio.disabled = false;
      }
    } else {
      paymentOption.classList.remove('disabled');
      radio.disabled = false;
    }
  });
  
  return isValid;
};

const createOrderForCashCredits = async (orderReviewData) => {
  try {
    // Get current user
    const user = await requireAuth();
    
    // Prepare order data
    const orderData = {
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName || user.email.split('@')[0],
      items: orderReviewData.items,
      totals: orderReviewData.totals,
      shipping: orderReviewData.shipping,
      payment: {
        method: orderReviewData.payment.method
      }
    };
    
    // Create order in database
    const orderId = await createOrder(orderData);
    console.log('Order created successfully:', orderId);
    
    // Update product stock
    console.log('Updating product stock...');
    await updateMultipleProductStock(orderReviewData.items);
    
    // Clear selected items from cart
    console.log('Clearing selected items from cart...');
    const itemIds = orderReviewData.items.map(item => item.productId);
    await clearSelectedFromCart(itemIds);
    
    // Update cart badge
    updateNavbarCartBadge();
    
    // Store order ID for confirmation page
    localStorage.setItem('lastOrderId', orderId);
    
    return orderId;
  } catch (error) {
    console.error('Error creating order for cash/credits:', error);
    throw error;
  }
};

const handleProceedToPayment = async () => {
  const isValid = validateForm();
  if (!isValid) {
    showToast('Please fill in all required fields and select a payment method', 'error');
    return;
  }
  
  // Prepare order review data
  const orderReviewData = {
    items: checkoutData.items,
    totals: {
      subtotal: checkoutData.total || 0,
      shipping: checkoutData.shippingCost || 0,
      grandTotal: checkoutData.grandTotal || 0
    },
    shipping: {
      type: shippingType,
      name: shippingType === 'pickup' ? pickupNameEl.value.trim() : nameEl.value.trim(),
      address: shippingType === 'delivery' ? addressEl.value.trim() : '',
      city: shippingType === 'delivery' ? cityEl.value.trim() : '',
      zip: shippingType === 'delivery' ? zipEl.value.trim() : ''
    },
    payment: {
      method: paymentMethod
    }
  };
  
  console.log('Order review data:', orderReviewData);
  
  // Store order review data
  setOrderReviewData(orderReviewData);
  
  // For digital payments, also store payment method data
  if (paymentMethod === 'gcash' || paymentMethod === 'maya') {
    const paymentMethodData = {
      method: paymentMethod,
      orderData: orderReviewData
    };
    console.log('Storing payment method data:', paymentMethodData);
    setPaymentMethodData(paymentMethodData);
  }
  
  // Redirect based on payment method
  if (paymentMethod === 'cash' || paymentMethod === 'credits') {
    // For cash/credits, create order and go to confirmation
    try {
      await createOrderForCashCredits(orderReviewData);
      console.log('Order created for cash/credits, redirecting to order-confirmation.html');
      window.location.href = 'order-confirmation.html';
    } catch (error) {
      console.error('Error creating order:', error);
      showToast('Error creating order. Please try again.', 'error');
    }
  } else if (paymentMethod === 'gcash' || paymentMethod === 'maya') {
    // For digital payments, go to payment processing
    console.log('Redirecting to payment-digital.html');
    window.location.href = 'payment-digital.html';
  }
};

// Initialize on page load
init();
