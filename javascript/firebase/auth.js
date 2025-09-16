import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { qs } from '../../js/ui.js';

export const goToAuthPage = () => {
  const redirect = encodeURIComponent(location.pathname + location.search);
  location.href = `auth.html?redirect=${redirect}`;
};

export const signOutUser = async () => {
  try { const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js'); await signOut(auth); } catch (e) { console.error(e); }
};

export const requireAuth = async () => {
  if (auth.currentUser) return auth.currentUser;
  
  // Wait for auth state to be determined
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        goToAuthPage();
        reject(new Error('User not authenticated'));
      }
    });
  });
};

const applyHeaderState = (user) => {
  const inBtn = qs('#sign-in-btn');
  const outBtn = qs('#sign-out-btn');
  const ordersLink = qs('#my-orders-link');
  if (user){
    inBtn?.classList.add('hidden');
    outBtn?.classList.remove('hidden');
    ordersLink?.classList.remove('hidden');
  } else {
    inBtn?.classList.remove('hidden');
    outBtn?.classList.add('hidden');
    ordersLink?.classList.add('hidden');
  }
};

let cartUnsub = null;
const updateBadge = (count) => { try { localStorage.setItem('cartCount', String(count)); const b = document.querySelector('.cart-badge'); if(b) b.textContent = String(count); } catch{} };

onAuthStateChanged(auth, (user)=> {
  console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
  applyHeaderState(user);
  if(cartUnsub){ cartUnsub(); cartUnsub=null; }
  if(user){
    const base = (user.displayName || user.email || '').trim();
    const username = (base.includes('@')? base.split('@')[0]: base).replaceAll(/[^a-zA-Z0-9_-]/g, '_');
    const cartRef = ref(db, `TBL_CART/${username}`);
    cartUnsub = onValue(cartRef, (snap)=>{
      const map = snap.val() || {};
      const count = Object.values(map).reduce((s,n)=> s + Number(n||0), 0);
      updateBadge(count);
    });
  } else {
    updateBadge(0);
  }
});

document.addEventListener('click', (e)=>{
  const signIn = e.target.closest('#sign-in-btn');
  if(signIn){ e.preventDefault(); goToAuthPage(); }
  const signOut = e.target.closest('#sign-out-btn');
  if(signOut){ e.preventDefault(); signOutUser(); }
});
