// Firebase initialization (Realtime Database) using CDN modular SDK
// Replace the config object with your Firebase project credentials
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBkFXrNVMoqgsI0BVOBaiZP0fgoLTp6bJ8",
  authDomain: "db-aurorus.firebaseapp.com",
  databaseURL: "https://db-aurorus-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "db-aurorus",
  storageBucket: "db-aurorus.firebasestorage.app",
  messagingSenderId: "1023143491483",
  appId: "1:1023143491483:web:1083156a3d16c0a7eed33e",
  measurementId: "G-VTBEQJ46YZ"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, storageRef, uploadBytes, getDownloadURL };

export const toImageSrc = (base64OrDataUrl) => {
  if (!base64OrDataUrl) return '';
  if (base64OrDataUrl.startsWith('data:image')) return base64OrDataUrl;
  // Heuristic: if base64 starts with '/9j', it's likely JPEG
  const isJpeg = base64OrDataUrl.startsWith('/9j');
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${base64OrDataUrl}`;
};

export const formatPrice = (n) => new Intl.NumberFormat(undefined,{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(Number(n||0));
