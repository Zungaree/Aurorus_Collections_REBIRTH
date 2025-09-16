import { formatPrice, qs, showToast, updateNavbarCartBadge, setupNavToggle } from './ui.js';
import { readPaymentMethodData, clearPaymentMethodData, clearOrderReviewData, clearCheckoutSelection, clearSelectedFromCart, updateMultipleProductStock } from './storage.js';
import { requireAuth } from '../javascript/firebase/auth.js';
import { createOrder, updatePaymentInfo } from './order-utils.js';
import { db } from '../javascript/firebase/firebase-config.js';
import { ref, get, child } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

setupNavToggle();
updateNavbarCartBadge();

const paymentMethodTitle = qs('#payment-method-title');
const walletName = qs('#wallet-name');
const qrCodeImage = qs('#qr-code-image');
const paymentAmount = qs('#payment-amount');
const paymentReference = qs('#payment-reference');
const subtotalEl = qs('#subtotal');
const shippingCostEl = qs('#shipping-cost');
const totalEl = qs('#total');
const selectedPaymentMethodEl = qs('#selected-payment-method');
const referenceIdEl = qs('#reference-id');
const screenshotEl = qs('#payment-screenshot');
const screenshotPreview = qs('#screenshot-preview');
const previewImage = qs('#preview-image');
const removeScreenshotBtn = qs('#remove-screenshot');
const submitBtn = qs('#submit-payment');

let paymentData = null;
let currentUser = null;

const init = async () => {
  currentUser = await requireAuth();
  paymentData = readPaymentMethodData();
  
  console.log('Payment data found:', paymentData);
  
  if (!paymentData || !paymentData.orderData) {
    console.log('No payment data found, redirecting to cart');
    showToast('No payment data found. Please start over.', 'error');
    setTimeout(() => {
      window.location.href = 'cart.html';
    }, 2000);
    return;
  }
  
  console.log('Form elements found:', {
    referenceIdEl: !!referenceIdEl,
    screenshotEl: !!screenshotEl,
    submitBtn: !!submitBtn
  });
  
  setupPaymentMethod();
  renderOrderSummary();
  setupEventListeners();
  
  // Initial validation
  setTimeout(() => {
    console.log('Running initial validation...');
    validateForm();
  }, 100);
};

const setupPaymentMethod = () => {
  const method = paymentData.method;
  const orderData = paymentData.orderData;
  
  // Update UI based on payment method
  if (method === 'gcash') {
    paymentMethodTitle.textContent = 'GCash Payment';
    walletName.textContent = 'GCash';
    qrCodeImage.src = 'assets/gcash-qr.png';
    qrCodeImage.alt = 'GCash QR Code';
  } else if (method === 'maya') {
    paymentMethodTitle.textContent = 'Maya Payment';
    walletName.textContent = 'Maya';
    qrCodeImage.src = 'assets/maya-qr.png';
    qrCodeImage.alt = 'Maya QR Code';
  }
  
  // Update payment details
  paymentAmount.textContent = formatPrice(orderData.totals.grandTotal);
  paymentReference.textContent = `AURORUS-${Date.now().toString().slice(-6)}`;
  selectedPaymentMethodEl.textContent = method === 'gcash' ? 'GCash' : 'Maya';
};

const renderOrderSummary = () => {
  const orderData = paymentData.orderData;
  subtotalEl.textContent = formatPrice(orderData.totals.subtotal);
  shippingCostEl.textContent = formatPrice(orderData.totals.shipping);
  totalEl.textContent = formatPrice(orderData.totals.grandTotal);
};

const setupEventListeners = () => {
  // Screenshot upload
  screenshotEl.addEventListener('change', handleScreenshotUpload);
  
  // Remove screenshot
  removeScreenshotBtn.addEventListener('click', () => {
    screenshotEl.value = '';
    screenshotPreview.classList.add('hidden');
    validateForm();
  });
  
  // Reference ID input
  referenceIdEl.addEventListener('input', validateForm);
  
  // Submit payment
  submitBtn.addEventListener('click', handleSubmitPayment);
};

const handleScreenshotUpload = (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    previewImage.src = url;
    screenshotPreview.classList.remove('hidden');
  } else {
    screenshotPreview.classList.add('hidden');
  }
  validateForm();
};

const validateForm = () => {
  const hasReference = referenceIdEl.value.trim().length > 0;
  const hasScreenshot = !!(screenshotEl.files && screenshotEl.files[0]);
  
  console.log('Validation check:', {
    hasReference,
    hasScreenshot,
    referenceValue: referenceIdEl.value.trim(),
    filesCount: screenshotEl.files ? screenshotEl.files.length : 0
  });
  
  const isValid = hasReference && hasScreenshot;
  submitBtn.disabled = !isValid;
  submitBtn.classList.toggle('btn-disabled', !isValid);
  
  console.log('Form validation result:', isValid);
  return isValid;
};

const generateOrderId = () => {
  const d = new Date();
  const ymd = d.toISOString().slice(0,10).replaceAll('-','');
  const rnd = String(Math.floor(Math.random()*10000)).padStart(4,'0');
  return `ORD-${ymd}-${rnd}`;
};

const uploadPaymentProof = async () => {
  const file = screenshotEl.files[0];
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      // Convert to base64
      const base64String = reader.result;
      resolve(base64String);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};

const checkStock = async () => {
  const insufficient = [];
  const orderData = paymentData.orderData;
  
  for (const item of orderData.items) {
    if (item.isPreOrder) continue;
    const snap = await get(child(ref(db), `TBL_PRODUCTS/${item.productId}`));
    if (!snap.exists()) {
      insufficient.push(`${item.name} (missing)`);
      continue;
    }
    const product = snap.val();
    if (Number(product.stock || 0) < Number(item.quantity || 0)) {
      insufficient.push(`${item.name}`);
    }
  }
  return insufficient;
};

// Use the imported clearSelectedFromCart from storage.js

const handleSubmitPayment = async () => {
  if (!validateForm()) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';
    
    // Check stock availability
    const insufficient = await checkStock();
    if (insufficient.length > 0) {
      showToast(`Insufficient stock: ${insufficient.join(', ')}`, 'error');
      return;
    }
    
    // Convert payment proof to base64
    const proofBase64 = await uploadPaymentProof();
    
    // Create order data
    const orderData = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUser.displayName || 'Customer',
      items: paymentData.orderData.items,
      totals: paymentData.orderData.totals,
      shipping: paymentData.orderData.shipping,
      payment: {
        method: paymentData.method
      }
    };
    
    // Create order in database
    const orderId = await createOrder(orderData);
    
    // Create username key from userName (lowercase, replace spaces with underscores)
    const username = orderData.userName.toLowerCase().replace(/\s+/g, '_');
    
    // Update payment information
    await updatePaymentInfo(username, orderId, {
      method: paymentData.method,
      referenceId: referenceIdEl.value.trim(),
      proofBase64
    });
    
    // Update product stock
    console.log('Updating product stock...');
    await updateMultipleProductStock(paymentData.orderData.items);
    
    // Clear selected items from cart
    console.log('Clearing selected items from cart...');
    const itemIds = paymentData.orderData.items.map(item => item.productId);
    await clearSelectedFromCart(itemIds);
    
    // Clear all temporary data
    clearPaymentMethodData();
    clearOrderReviewData();
    clearCheckoutSelection();
    
    // Update cart badge
    updateNavbarCartBadge();
    
    // Redirect to confirmation page
    window.location.href = `order-confirmation.html?orderId=${orderId}`;
    
  } catch (error) {
    console.error('Error submitting payment:', error);
    showToast('Error submitting payment. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Payment Proof';
  }
};

// Initialize on page load
init();



