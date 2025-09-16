import { db, auth } from '../javascript/firebase/firebase-config.js';
import { requireAuth } from '../javascript/firebase/auth.js';
import { ref, get, set, update, child } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

const CART_COUNT_KEY='cartCount';
const SELECTED_ITEMS_KEY='selectedCartItems';
const SELECTED_IDS_KEY='selectedCartItemIds';
const CART_TOTAL_KEY='cartTotal';

const setBadgeCount = (items)=>{ const count = items.reduce((s,i)=> s + Number(i.quantity||0), 0); localStorage.setItem(CART_COUNT_KEY, String(count)); };

const usernameFromUser = (user) => {
  const base = (user?.displayName || user?.email || '').trim();
  const uname = base.includes('@') ? base.split('@')[0] : base;
  return uname.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
};

const cartBaseUser = (username) => `TBL_CART/${username}`;
const cartBaseUid = (uid) => `TBL_CART/${uid}`;

const readMapAt = async (path) => { const snap = await get(ref(db, path)); return snap.exists()? (snap.val() || {}) : {}; };

const readCartMap = async (username, uid) => {
  const byUser = await readMapAt(cartBaseUser(username));
  const byUid = await readMapAt(cartBaseUid(uid));
  // Merge (username wins), values are quantities
  return { ...byUid, ...byUser };
};

const writeCartMap = async (username, mapObj) => {
  await set(ref(db, cartBaseUser(username)), mapObj);
};

const enrichItems = async (mapObj) => {
  const prodSnap = await get(ref(db, 'TBL_PRODUCTS'));
  const allProds = prodSnap.exists()? prodSnap.val() : {};
  const items = Object.entries(mapObj).map(([productId, quantity]) => {
    const p = allProds[productId] || {};
    const inStock = Number(p.stock||0) > 0;
    return {
      productId,
      name: p.productName || 'Unknown',
      price: Number(p.price||0),
      image: p.image ? (String(p.image).startsWith('data:image')? p.image : `data:image/png;base64,${p.image}`) : '',
      quantity: Number(quantity||0),
      isPreOrder: !inStock
    };
  });
  return items;
};

export const getCartMap = async () => {
  const user = auth.currentUser; if(!user) return {};
  const username = usernameFromUser(user);
  return await readCartMap(username, user.uid);
};

export const getCartItems = async () => {
  const user = auth.currentUser;
  if(!user){ setBadgeCount([]); return [];
  }
  const username = usernameFromUser(user);
  const mapObj = await readCartMap(username, user.uid);
  const items = await enrichItems(mapObj);
  setBadgeCount(items);
  return items;
};

export const setCartItems = async (items) => {
  const user = await requireAuth();
  const username = usernameFromUser(user);
  const mapObj = {};
  items.forEach(i=>{ mapObj[String(i.productId)] = Number(i.quantity||0); });
  await writeCartMap(username, mapObj);
  setBadgeCount(items);
};

export const getCartCount = () => Number(localStorage.getItem(CART_COUNT_KEY)||'0');

export const addToCart = async (item) => {
  const user = await requireAuth();
  const username = usernameFromUser(user);
  const key = String(item.productId);
  const byUserRef = ref(db, `${cartBaseUser(username)}/${key}`);
  const snap = await get(byUserRef);
  const current = snap.exists()? Number(snap.val()||0) : 0;
  const nextQty = current + Number(item.quantity||0);
  await set(byUserRef, nextQty);
  const mapObj = await getCartMap();
  const items = await enrichItems(mapObj);
  setBadgeCount(items);
};

export const updateQuantity = async (productId, quantity) => {
  const user = await requireAuth();
  const username = usernameFromUser(user);
  const key = String(productId);
  await set(ref(db, `${cartBaseUser(username)}/${key}`), Number(quantity||1));
  const mapObj = await getCartMap();
  const items = await enrichItems(mapObj);
  setBadgeCount(items);
};

export const removeFromCart = async (productId) => {
  const user = await requireAuth();
  const username = usernameFromUser(user);
  const key = String(productId);
  await set(ref(db, `${cartBaseUser(username)}/${key}`), null);
  const mapObj = await getCartMap();
  const items = await enrichItems(mapObj);
  setBadgeCount(items);
};

export const setCheckoutSelection = (selectedItems, selectedIds, total) => { try{ localStorage.setItem(SELECTED_ITEMS_KEY, JSON.stringify(selectedItems)); localStorage.setItem(SELECTED_IDS_KEY, JSON.stringify(selectedIds)); localStorage.setItem(CART_TOTAL_KEY, JSON.stringify(total)); } catch{} };
export const readCheckoutSelection = () => ({ items: JSON.parse(localStorage.getItem(SELECTED_ITEMS_KEY)||'[]'), ids: JSON.parse(localStorage.getItem(SELECTED_IDS_KEY)||'[]'), total: JSON.parse(localStorage.getItem(CART_TOTAL_KEY)||'0') });
export const clearCheckoutSelection = () => { localStorage.removeItem(SELECTED_ITEMS_KEY); localStorage.removeItem(SELECTED_IDS_KEY); localStorage.removeItem(CART_TOTAL_KEY); };

// Order Review Data
const ORDER_REVIEW_KEY = 'orderReviewData';
export const setOrderReviewData = (data) => { try{ localStorage.setItem(ORDER_REVIEW_KEY, JSON.stringify(data)); } catch{} };
export const readOrderReviewData = () => JSON.parse(localStorage.getItem(ORDER_REVIEW_KEY)||'null');
export const clearOrderReviewData = () => { localStorage.removeItem(ORDER_REVIEW_KEY); };

// Payment Method Data
const PAYMENT_METHOD_KEY = 'paymentMethodData';
export const setPaymentMethodData = (data) => { try{ localStorage.setItem(PAYMENT_METHOD_KEY, JSON.stringify(data)); } catch{} };
export const readPaymentMethodData = () => JSON.parse(localStorage.getItem(PAYMENT_METHOD_KEY)||'null');
export const clearPaymentMethodData = () => { localStorage.removeItem(PAYMENT_METHOD_KEY); };

// Clear cart after successful order
export const clearCart = async () => {
  const user = await requireAuth();
  const username = usernameFromUser(user);
  await set(ref(db, cartBaseUser(username)), {});
  setBadgeCount([]);
};

// Clear selected items from cart (for checkout items)
export const clearSelectedFromCart = async (productIds) => {
  const user = await requireAuth();
  const username = usernameFromUser(user);
  
  for (const productId of productIds) {
    await set(ref(db, `${cartBaseUser(username)}/${productId}`), null);
  }
  
  // Update cart count
  const mapObj = await getCartMap();
  const items = await enrichItems(mapObj);
  setBadgeCount(items);
};

// Update product stock in database
export const updateProductStock = async (productId, quantityToReduce) => {
  try {
    const productRef = ref(db, `TBL_PRODUCTS/${productId}`);
    const snapshot = await get(productRef);
    
    if (!snapshot.exists()) {
      throw new Error(`Product ${productId} not found`);
    }
    
    const product = snapshot.val();
    const currentStock = Number(product.stock || 0);
    const newStock = Math.max(0, currentStock - quantityToReduce);
    
    await update(productRef, { stock: newStock });
    
    console.log(`Updated stock for ${productId}: ${currentStock} -> ${newStock} (reduced by ${quantityToReduce})`);
    return newStock;
  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
};

// Update multiple products' stock
export const updateMultipleProductStock = async (items) => {
  const updates = [];
  
  for (const item of items) {
    try {
      const newStock = await updateProductStock(item.productId, item.quantity);
      updates.push({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        newStock: newStock
      });
    } catch (error) {
      console.error(`Failed to update stock for ${item.productId}:`, error);
      throw error;
    }
  }
  
  return updates;
};
