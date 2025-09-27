export const qs = (sel, root=document) => root.querySelector(sel);
export const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
export const createEl = (tag, attrs={}) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k,v])=> el.setAttribute(k, v)); return el; };
export const formatPrice = (n) => new Intl.NumberFormat(undefined,{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(n);

export const showToast = (message, type='success', timeout=2200) => {
  const container = qs('#toast-container') || (()=>{ const c = createEl('div',{id:'toast-container',class:'toast-container'}); document.body.appendChild(c); return c; })();
  const toast = createEl('div',{class:`toast toast-${type}`,role:'status'}); toast.textContent = message; container.appendChild(toast);
  setTimeout(()=> toast.remove(), timeout);
};

export const updateNavbarCartBadge = () => {
  try { const count = Number(localStorage.getItem('cartCount')||'0'); const badge = qs('.cart-badge'); if (badge) badge.textContent = String(count); } catch {}
};

// Modal with focus trap
let lastFocused = null;
export const openModal = (title, contentNode, actions=[]) => {
  lastFocused = document.activeElement;
  const backdrop = createEl('div',{class:'modal-backdrop','data-modal':'1'});
  backdrop.addEventListener('click', (e)=> { if (e.target === backdrop) closeModal(); });
  const modal = createEl('div',{class:'modal',role:'dialog','aria-modal':'true'});
  const header = createEl('div',{class:'modal-header'});
  const h = createEl('h3'); h.textContent = title; header.appendChild(h);
  
  // Create close icon button
  const closeBtn = createEl('button',{class:'modal-close', 'aria-label':'Close modal'});
  closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  closeBtn.addEventListener('click', closeModal);
  header.appendChild(closeBtn);
  
  modal.appendChild(header);
  
  // Add content wrapper
  const contentWrapper = createEl('div',{class:'modal-content'});
  contentWrapper.appendChild(contentNode);
  modal.appendChild(contentWrapper);
  
  // Only add actions if there are any
  if (actions.length > 0) {
    const actionsEl = createEl('div',{class:'modal-actions'});
    actions.forEach(a => { 
      const b = createEl('a',{class:`btn ${a.variant||''}`, href:a.href||'#'}); 
      b.textContent=a.label; 
      if (a.onClick){ 
        b.addEventListener('click', (e)=>{ e.preventDefault(); a.onClick();}); 
      } 
      actionsEl.appendChild(b); 
    });
    modal.appendChild(actionsEl);
  }
  
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  const focusable = qsa('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])', modal);
  const first = focusable[0], last = focusable[focusable.length-1];
  const trap = (e)=>{ if(e.key==='Tab'){ if (e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); } else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); } } if(e.key==='Escape'){ closeModal(); } };
  backdrop.addEventListener('keydown', trap);
  setTimeout(()=> first?.focus(), 0);
};
export const closeModal = () => { const m = qs('[data-modal]'); if (m) m.remove(); lastFocused?.focus(); };

// Mobile nav toggle helper
export const setupNavToggle = () => {
  qs('.nav-toggle')?.addEventListener('click', (e)=>{ const btn=e.currentTarget; const nav=qs('.nav-links'); const expanded=btn.getAttribute('aria-expanded')==='true'; btn.setAttribute('aria-expanded', String(!expanded)); nav.classList.toggle('open'); });
  const header = qs('.site-header');
  const onScroll = ()=>{ if(!header) return; header.classList.toggle('with-shadow', window.scrollY>2); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive:true });
};
