import { db, toImageSrc } from './firebase-config.js';
import { ref, onValue, get, child } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { openModal } from '../../js/ui.js';

const grid = document.querySelector('#events-grid');
const summary = document.querySelector('#event-summary');
const pastChampionsGrid = document.querySelector('#past-champions');

const peso = (n) => new Intl.NumberFormat(undefined,{style:'currency',currency:'PHP'}).format(Number(n||0));

const normalizeWinners = (winners) => {
  if (!winners || typeof winners !== 'object') return {};
  const sample = Object.values(winners)[0];
  if (typeof sample === 'string') {
    const out = {};
    Object.entries(winners).forEach(([uid, place])=>{
      const k = String(place||'').toUpperCase();
      if (k==='FIRSTPLACE') out.FIRSTPLACE = uid;
    });
    return out;
  }
  return winners;
};

const render = (events) => {
  if (!grid) return;
  grid.innerHTML = '';
  const items = Object.entries(events||{}).map(([id, e]) => ({ id, ...e }));
  if(items.length===0){
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No events found.';
    grid.appendChild(empty);
  }
  items.forEach(ev => {
    const canRegister = String(ev.status||'').toLowerCase()==='open' || String(ev.status||'').toLowerCase()==='active';
    const status = String(ev.status||'').toLowerCase();
    const statusClass = status==='active'?'status-active' : status==='completed'?'status-completed' : 'status-upcoming';
    const article = document.createElement('article');
    article.className = 'card event-card';
    article.innerHTML = `
      <a class="card-media" href="event.html?id=${encodeURIComponent(ev.id)}" aria-label="View ${ev.eventName||''}">
        <img src="${toImageSrc(ev.image)}" alt="${ev.eventName||''}" loading="lazy" />
      </a>
      <div class="card-body">
        <span class="badge ${statusClass} status-ribbon">${(ev.status||'').toString()}</span>
        <h3 class="card-title">${ev.eventName||''}</h3>
        <div class="card-meta"><span>${ev.eventDate||''} ${ev.eventTime||''}</span><span>${ev.location||''}</span></div>
        <div class="card-actions">
          <a class="btn btn-sm" href="event.html?id=${encodeURIComponent(ev.id)}">${status==='completed'?'View Results':'Details'}</a>
          ${canRegister?`<button class="btn btn-sm" data-register="${ev.id}">Register</button>`:''}
        </div>
      </div>`;
    grid.appendChild(article);
  });
  if (summary) summary.textContent = items.length? `Showing 1–${items.length} of ${items.length}` : 'No events found';

  grid.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-register]');
    if(!btn || btn.disabled) return;
    const id = btn.getAttribute('data-register');
    const ev = items.find(x=> String(x.id)===String(id));
    if(!ev) return;
    const content = document.createElement('div');
    content.innerHTML = `<p>Event registration is available only in the AURORUS mobile app.</p><p>Deep link:</p><p><code>aurorus://events/${encodeURIComponent(ev.id)}</code></p>`;
    openModal('Register in the App', content, [
      { label:'Get the App (Android)', href:'https://play.google.com/store/apps/details?id=com.aurorus.app' },
      { label:'Get the App (iOS)', href:'https://apps.apple.com/app/id0000000000' },
      { label:'Cancel', href:'#', onClick:()=>{} }
    ]);
  });
};

const userCache = new Map();
const getUserById = async (userId) => {
  if (!userId) return null;
  if (userCache.has(userId)) return userCache.get(userId);
  const snap = await get(child(ref(db), `users/${userId}`));
  const val = snap.exists()? snap.val() : null;
  userCache.set(userId, val);
  return val;
};

const resolvePlayerInfo = async (playerLike) => {
  if (!playerLike) return { name: 'Unknown', avatar: '' };
  if (typeof playerLike === 'object') {
    const directName = playerLike.player1name || playerLike.player2name || playerLike.name || playerLike.displayName || playerLike.playerName;
    const directAvatar = playerLike.avatar || playerLike.photoURL || playerLike.profilePicture || '';
    if (playerLike.userId) {
      const user = await getUserById(playerLike.userId);
      return { name: (directName || user?.displayName || user?.name || 'Unknown'), avatar: (directAvatar || user?.photoURL || user?.avatar || user?.profilePicture || '') };
    }
    return { name: (directName || 'Unknown'), avatar: directAvatar || '' };
  }
  const id = String(playerLike);
  if (/^[A-Za-z0-9_-]{8,}$/.test(id)) {
    const user = await getUserById(id);
    if (user) return { name: (user.displayName || user.name || id), avatar: (user.photoURL || user.avatar || user.profilePicture || '') };
  }
  return { name: id, avatar: '' };
};

const buildPastChampions = async (eventsMap, matchesMap) => {
  if (!pastChampionsGrid) return;
  pastChampionsGrid.innerHTML = '';
  const items = Object.entries(eventsMap||{})
    .map(([id, e]) => ({ id, ...e }))
    .filter(ev => String(ev.status||'').toLowerCase()==='completed');
  if (items.length===0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No completed events yet.';
    pastChampionsGrid.appendChild(empty);
    return;
  }
  for (const ev of items) {
    const card = document.createElement('article');
    card.className = 'card event-card';
    card.innerHTML = `
      <a class="card-media" href="event.html?id=${encodeURIComponent(ev.id)}" aria-label="View ${ev.eventName||''}">
        <img src="${toImageSrc(ev.image)}" alt="${ev.eventName||''}" loading="lazy" />
      </a>
      <div class="card-body">
        <h3 class="card-title">${ev.eventName||''}</h3>
        <div class="card-meta"><span>${ev.eventDate||''}</span><span>${ev.location||''}</span></div>
        <div class="card-actions"><a class="btn btn-sm" href="event.html?id=${encodeURIComponent(ev.id)}">View Results</a></div>
      </div>`;
    pastChampionsGrid.appendChild(card);
  }
};

const init = () => {
  const eventsRef = ref(db, 'TBL_EVENTS');
  const matchesRef = ref(db, 'TBL_MATCHES');
  let latestEvents = {};
  let latestMatches = {};
  onValue(eventsRef, (snap) => {
    latestEvents = snap.val()||{};
    render(latestEvents);
    buildPastChampions(latestEvents, latestMatches);
  });
  onValue(matchesRef, (snap) => {
    latestMatches = snap.val()||{};
    buildPastChampions(latestEvents, latestMatches);
  });
};

init();
