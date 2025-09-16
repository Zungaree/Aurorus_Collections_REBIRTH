import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { qs, showToast } from '../../js/ui.js';

const emailEl = qs('#email');
const passEl = qs('#password');
const form = qs('#auth-form');
const toggleBtn = qs('#toggle-mode');
const submitBtn = qs('#submit-btn');
const modeSub = qs('#mode-sub');
const title = qs('#mode-title');

let isSignup = false;

const getRedirect = () => new URLSearchParams(location.search).get('redirect') || 'index.html';

const setMode = (signup) => {
  isSignup = signup;
  submitBtn.textContent = signup? 'Create Account' : 'Sign In';
  title.textContent = signup? 'Create Account' : 'Sign In';
  modeSub.textContent = signup? 'Create your account to continue.' : 'Welcome back. Use your email and password.';
  toggleBtn.textContent = signup? 'I already have an account' : 'Create an account';
};

setMode(false);

// Check if user is already authenticated and redirect
onAuthStateChanged(auth, (user) => {
  console.log('Auth page - Auth state changed:', user ? 'User signed in' : 'User signed out');
  if (user) {
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

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = isSignup ? 'Creating Account...' : 'Signing In...';
  
  try{
    if(isSignup){
      const cred = await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
      await updateProfile(cred.user, { displayName: cred.user.email.split('@')[0] });
      showToast('Account created successfully!');
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
  }
});
