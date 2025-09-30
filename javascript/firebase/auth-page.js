import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { ref, set } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { qs, showToast } from '../../js/ui.js';

const emailEl = qs('#email');
const passEl = qs('#password');
const form = qs('#auth-form');
const toggleBtn = qs('#toggle-mode');
const submitBtn = qs('#submit-btn');
const modeSub = qs('#mode-sub');
const title = qs('#mode-title');
// Signup-only fields
const firstNameEl = qs('#first-name');
const middleNameEl = qs('#middle-name');
const lastNameEl = qs('#last-name');
const birthdateEl = qs('#birthdate');
const genderEl = qs('#gender');
const profileEl = qs('#profile-picture');
const signupFields = qs('#signup-fields');
const confirmWrap = qs('#confirm-password-wrap');
const createContainer = qs('.create-container');
const confirmPassEl = qs('#confirm-password');

let isSignup = false;
let authFlowActive = false; // prevent onAuthStateChanged redirect during processing

const getRedirect = () => new URLSearchParams(location.search).get('redirect') || 'index.html';

const setMode = (signup) => {
  isSignup = signup;
  submitBtn.textContent = signup? 'Create Account' : 'Sign In';
  title.textContent = signup? 'Create Account' : 'Sign In';
  modeSub.textContent = signup? 'Create your account to continue.' : 'Welcome back. Use your email and password.';
  toggleBtn.textContent = signup? 'I already have an account' : 'Create an account';
  signupFields?.classList.toggle('hidden', !signup);
  confirmWrap?.classList.toggle('hidden', !signup);
  createContainer?.classList.toggle('hidden', !signup);
  document.body.classList.toggle('auth-signup', signup);
  passEl.setAttribute('autocomplete', signup? 'new-password':'current-password');

  // Move email/password below gender/profile on signup for visual order
  try{
    const credBlock = document.querySelector('#credentials');
    const anchor = document.querySelector('#signup-credentials-anchor');
    if (signup && credBlock && anchor && anchor.parentElement){
      anchor.parentElement.insertBefore(credBlock, anchor.nextSibling);
    } else if (!signup) {
      // Move credentials back above create-container when switching to sign-in
      const form = document.querySelector('#auth-form');
      if (form && credBlock){
        form.insertBefore(credBlock, document.querySelector('.create-container'));
      }
    }
  } catch {}
};

setMode(false);

// Check if user is already authenticated and redirect
onAuthStateChanged(auth, (user) => {
  console.log('Auth page - Auth state changed:', user ? 'User signed in' : 'User signed out');
  if (user) {
    if (authFlowActive) { return; }
    // User is already signed in, redirect them
    const redirect = getRedirect();
    console.log('Redirecting to:', redirect);
    if (redirect && redirect !== 'auth.html') {
      location.href = redirect;
    } else {
      location.href = 'index.html';
    }
  }
});

toggleBtn.addEventListener('click', ()=> setMode(!isSignup));

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = isSignup ? 'Creating Account...' : 'Signing In...';
  authFlowActive = true;
  
  try{
    if(isSignup){
      // Validate fields to mirror mobile app
      const first = firstNameEl?.value.trim()||'';
      const middle = middleNameEl?.value.trim()||'';
      const last = lastNameEl?.value.trim()||'';
      const birth = birthdateEl?.value.trim()||'';
      const gender = genderEl?.value.trim()||'';
      if(!first){ showToast('First name is required', 'error'); throw new Error('validation'); }
      if(!last){ showToast('Last name is required', 'error'); throw new Error('validation'); }
      if(!birth){ showToast('Birthdate is required', 'error'); throw new Error('validation'); }
      if(!gender || !(gender==='Male' || gender==='Female')){ showToast('Select gender: Male or Female', 'error'); throw new Error('validation'); }
      const email = emailEl.value.trim();
      const pass = passEl.value;
      const confirm = confirmPassEl?.value||'';
      if(!email){ showToast('Email is required', 'error'); throw new Error('validation'); }
      if(!pass){ showToast('Password is required', 'error'); throw new Error('validation'); }
      if(pass.length<6){ showToast('Password should be at least 6 characters', 'error'); throw new Error('validation'); }
      if(pass!==confirm){ showToast('Passwords do not match', 'error'); throw new Error('validation'); }
      const file = profileEl?.files?.[0];
      if(!file){ showToast('Profile picture is required', 'error'); throw new Error('validation'); }

      const fullName = middle? `${first} ${middle} ${last}` : `${first} ${last}`;
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: fullName });
      try { await sendEmailVerification(cred.user); } catch {}
      // Prepare user record with compact base64 (no data URL prefix)
      const dataUrl = await readFileAsBase64(file);
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx>0 ? dataUrl.slice(commaIdx+1) : dataUrl;
      const uid = cred.user.uid;
      const userData = {
        name: fullName,
        email,
        createdAt: Date.now(),
        middleName: middle,
        birthdate: birth,
        gender,
        // Store raw base64 only (Android app will add mime prefix)
        profilePicture: base64
      };
      await set(ref(db, `users/${uid}`), userData);
      showToast('Account created! Please verify your email.');
    } else {
      await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
      showToast('Signed in successfully!');
    }
    
    // Wait a moment for the auth state to update, then redirect
    setTimeout(() => {
      location.href = getRedirect();
    }, 1000);
    
  } catch(err){ 
    console.error('Auth error:', err);
    let errorMessage = 'Authentication failed';
    
    if (err.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email';
    } else if (err.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password';
    } else if (err.code === 'auth/email-already-in-use') {
      errorMessage = 'An account with this email already exists';
    } else if (err.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters';
    } else if (err.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    }
    
    showToast(errorMessage, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
    // Let the redirect happen (either our manual one or the auth state one)
    setTimeout(()=>{ authFlowActive = false; }, 500);
  }
});
