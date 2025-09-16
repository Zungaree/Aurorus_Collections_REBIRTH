import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { ref, onValue, set, get, serverTimestamp, update } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

let unsubRT = null;
let isApplyingRemote = false;

const getLocal = () => JSON.parse(localStorage.getItem('cartItems')||'[]');
const setLocal = (items) => { localStorage.setItem('cartItems', JSON.stringify(items)); const cnt = items.reduce((s,i)=>s+Number(i.quantity||0),0); localStorage.setItem('cartCount', String(cnt)); };

const mergeCarts = (serverItems=[], localItems=[]) => {
  const byId = new Map();
  serverItems.forEach(i=> byId.set(String(i.productId), { ...i }));
  localItems.forEach(i=>{
    const k = String(i.productId);
    if(byId.has(k)){
      const s = byId.get(k);
      // simple sum strategy
      s.quantity = Number(s.quantity||0) + Number(i.quantity||0);
      byId.set(k, s);
    } else byId.set(k, { ...i });
  });
  return Array.from(byId.values());
};

const writeServerCart = async (uid, items) => {
  await set(ref(db, `users/${uid}/cart`), items);
  await update(ref(db, `users/${uid}`), { cartUpdatedAt: Date.now() });
};

const bindRealtime = (uid) => {
  const cartRef = ref(db, `users/${uid}/cart`);
  unsubRT = onValue(cartRef, (snap)=>{
    const items = snap.val() || [];
    isApplyingRemote = true;
    setLocal(items);
    isApplyingRemote = false;
  });
};

onAuthStateChanged(auth, async (user)=>{
  if(!user){ if(unsubRT){ unsubRT(); unsubRT=null; } return; }
  const serverSnap = await get(ref(db, `users/${user.uid}/cart`));
  const serverItems = serverSnap.exists()? serverSnap.val(): [];
  const localItems = getLocal();
  const merged = mergeCarts(serverItems, localItems);
  await writeServerCart(user.uid, merged);
  bindRealtime(user.uid);
});

// Cart sync deprecated: using TBL_CART as single source of truth.
window.__onCartChanged = null;
