import { db, toImageSrc } from './firebase-config.js';
import { ref, get, child } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';
import { getQueryParam } from '../../js/router-helpers.js';
import { setupNavToggle, updateNavbarCartBadge, qs, openModal } from '../../js/ui.js';

setupNavToggle();
updateNavbarCartBadge();

const id = getQueryParam('id');

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
    const directAvatar = playerLike.avatar || playerLike.photoURL || '';
    if (playerLike.userId) {
      const user = await getUserById(playerLike.userId);
      return {
        name: (directName || user?.displayName || user?.name || 'Unknown'),
        avatar: (directAvatar || user?.photoURL || user?.avatar || user?.profilePicture || '')
      };
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

const renderWinners = async (winners) => {
  if (!winners || typeof winners !== 'object') return '';
  // Normalize two possible shapes:
  // A) { FIRSTPLACE: <playerLike>, SECONDPLACE: <playerLike>, ... }
  // B) { <uid>: "FIRSTPLACE" | "SECONDPLACE" | ... }
  const normalized = { FIRSTPLACE: null, SECONDPLACE: null, THIRDPLACE: null, FOURTHPLACE: null };
  const valueSample = Object.values(winners)[0];
  if (typeof valueSample === 'string') {
    // Shape B: reverse map of uid -> placement
    Object.entries(winners).forEach(([uid, place]) => {
      const key = String(place||'').toUpperCase();
      if (normalized.hasOwnProperty(key)) normalized[key] = uid;
    });
  } else {
    // Shape A
    Object.assign(normalized, winners);
  }
  const placements = [
    { key: 'FIRSTPLACE', label: 'Champion', icon: '🥇' },
    { key: 'SECONDPLACE', label: 'Runner-Up', icon: '🥈' },
    { key: 'THIRDPLACE', label: 'Third', icon: '🥉' },
    { key: 'FOURTHPLACE', label: 'Fourth', icon: '🏅' }
  ];
  const items = (await Promise.all(placements.map(async p => {
    const raw = normalized[p.key];
    if (!raw) return null;
    const info = await resolvePlayerInfo(raw);
    return { ...p, info };
  }))).filter(Boolean);
  if (items.length === 0) return '';
  const li = items.map(({ icon, label, info }) => {
    const name = info.name;
    const avatar = info.avatar;
    return `
      <li class="winner-item">
        <div class="winner-person">
          <span class="avatar ${avatar?'':'avatar-fallback'}">${avatar?`<img src="${toImageSrc(avatar)}" alt="${name}">`:(name||'?').slice(0,1)}</span>
          <div class="winner-meta">
            <div class="winner-name">${name}</div>
            <div class="winner-label"><span class="icon">${icon}</span> ${label}</div>
          </div>
        </div>
        <div class="winner-badges">
          ${label==='Champion'?'<span class="badge badge-success">Champion</span>':''}
          ${label==='Runner-Up'?'<span class="badge">Top 2</span>':''}
          ${label==='Third'||label==='Fourth'?'<span class="badge">Top 4</span>':''}
        </div>
      </li>`;
  }).join('');
  return `
    <article class="card">
      <div class="card-body">
        <h2 class="card-title">Tournament Winners</h2>
        <ul class="winner-list">${li}</ul>
        <div class="row">
          <button id="share-results" class="btn btn-outline">Share Results</button>
        </div>
      </div>
    </article>`;
};

const determineWinnerName = async (match) => {
  const result = String(match?.result||'').toLowerCase();
  // Try to resolve player1 and player2 names using direct fields or user lookups
  const p1 = match?.player1name || match?.player1Name || match?.playerAname || match?.playerName1;
  const p2 = match?.player2name || match?.player2Name || match?.playerBname || match?.playerName2;
  const p1Id = match?.player1 || match?.player1Id || match?.playerAId || match?.playerAUID || match?.playerAUserId;
  const p2Id = match?.player2 || match?.player2Id || match?.playerBId || match?.playerBUID || match?.playerBUserId;
  let p1Resolved = p1;
  let p2Resolved = p2;
  if (!p1Resolved && p1Id) {
    const u = await getUserById(String(p1Id));
    p1Resolved = u?.displayName || u?.name || String(p1Id);
  }
  if (!p2Resolved && p2Id) {
    const u = await getUserById(String(p2Id));
    p2Resolved = u?.displayName || u?.name || String(p2Id);
  }
  if (result === 'player1_wins' || result === 'p1_wins' || result === 'player_a_wins') return p1Resolved || 'Player 1';
  if (result === 'player2_wins' || result === 'p2_wins' || result === 'player_b_wins') return p2Resolved || 'Player 2';
  if (result === 'draw' || result === 'tie') return 'Draw';
  // Fallback to explicit winner fields if provided
  const wInfo = await resolvePlayerInfo(match?.winner || match?.winnerId || match?.winnerUID || match?.winnerUserId);
  return wInfo?.name || '';
};

const renderRounds = async (matchesRoot) => {
  if (!matchesRoot || typeof matchesRoot !== 'object') return '';
  const roundKeys = Object.keys(matchesRoot).filter(k => /^Round\d+$/i.test(k)).sort((a,b)=>{
    const na = Number(a.replace(/\D/g,''));
    const nb = Number(b.replace(/\D/g,''));
    return na-nb;
  });
  if (roundKeys.length === 0) return '';
  const sections = await Promise.all(roundKeys.map(async rk => {
    const round = matchesRoot[rk] || {};
    const matches = Array.isArray(round) ? round : Object.values(round||{});
    const lis = (await Promise.all(matches.map(async m => {
      const aInfo = await resolvePlayerInfo(m?.playerA || m?.player1 || m?.playerAId || m?.player1Id || m?.playerAUID || m?.playerAUserId);
      const bInfo = await resolvePlayerInfo(m?.playerB || m?.player2 || m?.playerBId || m?.player2Id || m?.playerBUID || m?.playerBUserId);
      const a = aInfo.name || 'Player A';
      const b = bInfo.name || 'Player B';
      const winner = await determineWinnerName(m);
      const suffix = winner ? (winner === 'Draw' ? '→ Draw' : `→ <strong>${winner}</strong>`) : '';
      return `<li><span>${a}</span> vs <span>${b}</span> ${suffix}</li>`;
    }))).join('');
    return `
      <div class="round">
        <div class="section-title">${rk}</div>
        <ol class="round-list">${lis}</ol>
      </div>`;
  }));
  const sectionsHtml = sections.join('');
  return `
    <article class="card">
      <div class="card-body">
        <h2 class="card-title">Match History</h2>
        ${sectionsHtml}
      </div>
    </article>`;
};

const renderSummary = (ev, matchesRoot) => {
  let participants = 0;
  const p = ev?.participants;
  if (Array.isArray(p)) participants = p.length;
  else if (p && typeof p === 'object') participants = Object.keys(p).length;
  else if (typeof p === 'number') participants = Number(p)||0;
  else participants = Number(ev?.capacity || 0) || 0;
  const roundCount = Object.keys(matchesRoot||{}).filter(k => /^Round\d+$/i.test(k)).length;
  const timestamps = [];
  // Attempt to infer duration from matches data
  Object.keys(matchesRoot||{}).forEach(k => {
    if (!/^Round\d+$/i.test(k)) return;
    const round = matchesRoot[k];
    const ms = Array.isArray(round) ? round : Object.values(round||{});
    ms.forEach(m => {
      if (m?.updatedAt) timestamps.push(Number(m.updatedAt));
      if (m?.timestamp) timestamps.push(Number(m.timestamp));
    });
  });
  const start = Number(ev?.startTimestamp || ev?.startTime || ev?.createdAt || 0);
  const end = Math.max(0, ...timestamps, Number(ev?.endTimestamp || 0));
  const duration = (start && end && end>start) ? humanizeDuration(end - start) : '—';
  return `
    <article class="card">
      <div class="card-body">
        <h2 class="card-title">Tournament Summary</h2>
        <div class="card-meta"><span>Participants: <strong>${participants||'—'}</strong></span><span>Rounds: <strong>${roundCount}</strong></span><span>Duration: <strong>${duration}</strong></span></div>
      </div>
    </article>`;
};

const humanizeDuration = (ms) => {
  const sec = Math.floor(ms/1000);
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  if (h>0) return `${h}h ${m}m`;
  if (m>0) return `${m}m ${s}s`;
  return `${s}s`;
};

const renderMatchHistoryPanel = async (matchesRoot) => {
  const container = qs('#match-history');
  if (!container) return;
  if (!matchesRoot || typeof matchesRoot !== 'object') { container.innerHTML = '<div class="muted">No matches to show.</div>'; return; }
  const keys = Object.keys(matchesRoot).filter(k=>/^Round\d+$/i.test(k)).sort((a,b)=>{
    const na = Number(a.replace(/\D/g,''));
    const nb = Number(b.replace(/\D/g,''));
    return nb-na;
  });
  if (keys.length===0) { container.innerHTML = '<div class="muted">No matches to show.</div>'; return; }
  const titleForIndexFromEnd = (idxFromEnd) => {
    if (idxFromEnd===0) return 'Finals';
    if (idxFromEnd===1) return 'Semi-Finals';
    if (idxFromEnd===2) return 'Quarter-Finals';
    return `Round ${keys.length-idxFromEnd}`;
  };
  const sections = await Promise.all(keys.map(async (rk, index)=>{
    const round = matchesRoot[rk];
    const arr = Array.isArray(round)? round : Object.values(round||{});
    const cards = await Promise.all(arr.map(async m => {
      const aInfo = await resolvePlayerInfo(m?.playerA || m?.player1 || m?.playerAId || m?.player1Id || m?.playerAUID || m?.playerAUserId);
      const bInfo = await resolvePlayerInfo(m?.playerB || m?.player2 || m?.playerBId || m?.player2Id || m?.playerBUID || m?.playerBUserId);
      const winnerName = await determineWinnerName(m);
      const a = aInfo.name || 'Player A';
      const b = bInfo.name || 'Player B';
      const scoreA = (m?.scoreA ?? m?.score_a ?? null);
      const scoreB = (m?.scoreB ?? m?.score_b ?? null);
      const scoreRight = (typeof m?.score === 'string' || typeof m?.score === 'number') ? String(m.score) : '';
      const statusBadge = winnerName && winnerName!=='Draw' ? '<span class="badge badge-completed">Completed</span>' : (m?.live? '<span class="badge badge-live">Live</span>' : '');
      const aWinner = winnerName && winnerName!=='Draw' && winnerName===a;
      const bWinner = winnerName && winnerName!=='Draw' && winnerName===b;
      return `
        <div class=\"match-group\">
          <div class=\"match-header\"><div class=\"title\">${rk}</div><div>${statusBadge}</div></div>
          <div class=\"match-card vertical\">
            <div class=\"player-row ${aWinner?'winner':''}\">
              <div class=\"player-meta\"><span class=\"avatar ${aInfo.avatar?'':'avatar-fallback'}\">${aInfo.avatar?`<img src=\"${toImageSrc(aInfo.avatar)}\" alt=\"${a}\">`:(a||'?').slice(0,1)}</span><span class=\"player-name\">${a}</span>${aWinner?`<span class=\"badge badge-winner\">Winner</span>`:''}</div>
              <div class=\"player-score\">${scoreA!=null?scoreA:''}</div>
            </div>
            <div class=\"vs-divider-line\"><span class=\"vs-pill\">VS</span></div>
            <div class=\"player-row ${bWinner?'winner':''}\">
              <div class=\"player-meta\"><span class=\"avatar ${bInfo.avatar?'':'avatar-fallback'}\">${bInfo.avatar?`<img src=\"${toImageSrc(bInfo.avatar)}\" alt=\"${b}\">`:(b||'?').slice(0,1)}</span><span class=\"player-name\">${b}</span>${bWinner?`<span class=\"badge badge-winner\">Winner</span>`:''}</div>
              <div class=\"player-score\">${scoreB!=null?scoreB:''}</div>
            </div>
            ${(!scoreA && !scoreB && scoreRight)?`<div class=\"row\"><span class=\"badge\">${scoreRight}</span></div>`:''}
          </div>
        </div>`;
    }));
    const body = cards.join('');
    const title = titleForIndexFromEnd(index);
    return `<div class="round"><div class="section-title" style="text-align:center">${title}</div>${body}</div>`;
  }));
  container.innerHTML = sections.join('');
};

const render = async (ev, matchesRoot) => {
  const root = qs('#event-container');
  if(!ev){ root.textContent = 'Event not found'; return; }
  const status = String(ev.status||'').toLowerCase();
  // Friendly date/time formatting
  const parseEventDateTime = (dateStr, timeStr) => {
    if (!dateStr && !timeStr) return null;
    if (dateStr && /T/.test(String(dateStr))) {
      const d = new Date(dateStr);
      return isNaN(d) ? null : d;
    }
    if (dateStr && timeStr) {
      const d = new Date(`${dateStr} ${timeStr}`);
      return isNaN(d) ? null : d;
    }
    if (dateStr) {
      const d = new Date(dateStr);
      return isNaN(d) ? null : d;
    }
    return null;
  };
  const to12h = (d) => {
    try{
      let h = d.getHours();
      const m = d.getMinutes();
      const ampm = h>=12 ? 'PM' : 'AM';
      h = h % 12; if (h === 0) h = 12;
      const mm = String(m).padStart(2,'0');
      return `${h}:${mm} ${ampm}`;
    }catch{ return ''; }
  };
  const formatTimeSoft = (timeLike) => {
    if (!timeLike) return '';
    const s = String(timeLike).trim();
    // If it already contains AM/PM, normalize spacing and casing
    const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
    if (ampmMatch) {
      let hrs = Number(ampmMatch[1]);
      const mins = ampmMatch[2] ? ampmMatch[2] : '00';
      const ampm = ampmMatch[3].toUpperCase();
      if (hrs === 0) hrs = 12;
      if (hrs > 12) hrs = hrs % 12;
      return `${hrs}:${mins} ${ampm}`;
    }
    // 24h like 15:41
    const h24 = s.match(/^(\d{1,2})(?::(\d{2}))$/);
    if (h24) {
      let hrs = Number(h24[1]);
      const mins = h24[2] || '00';
      const ampm = hrs>=12 ? 'PM' : 'AM';
      hrs = hrs % 12; if (hrs === 0) hrs = 12;
      return `${String(hrs)}:${mins} ${ampm}`;
    }
    // Fallback: try Date parsing with today's date
    const d = new Date(`1970-01-01T${s}`);
    if (!isNaN(d)) return to12h(d);
    return s; // show as-is if unrecognized
  };
  const rawTime = ev?.tournamentTime || ev?.eventTime || ev?.time || '';
  const dt = parseEventDateTime(ev?.eventDate || ev?.date, rawTime);
  const dateLabel = dt ? dt.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' }) : (ev?.eventDate || ev?.date || '');
  const timeLabel = rawTime ? formatTimeSoft(rawTime) : (dt ? to12h(dt) : '');
  const locationLabel = ev?.location || ev?.city || ev?.venue || '';
  const showRegister = (status === 'open' || status === 'active');
  let html = `
    <section class="banner">
      <div class="banner-media" style="background-image:url('${toImageSrc(ev.banner||ev.image)}')"></div>
      <div class="banner-content">
        <div class="accent-chip">${(ev.status||'').toString()}</div>
        <h1>${ev.eventName||''}</h1>
        <div class="event-meta">
          <span class="date">${dateLabel}</span>
          ${timeLabel?'<span class="dot"></span><span class="time">'+timeLabel+'</span>':''}
          ${locationLabel?'<span class="dot"></span><span class="location">'+locationLabel+'</span>':''}
        </div>
        <div class="hero-cta">
          <a class="btn btn-outline" href="events.html">Back to Events</a>
          <a class="btn btn-outline" href="#results">View Results</a>
          <a class="btn btn-outline" href="#rules">Tournament Rules</a>
          ${showRegister?'<button id="register" class="btn">Register</button>':''}
        </div>
      </div>
    </section>
    <section class="section">
      <div class="event-layout">
        <div>
          <div class="stat-cards">
            <div class="stat-card">
              <span class="stat-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12c1.933 0 3.5-1.567 3.5-3.5S13.933 5 12 5s-3.5 1.567-3.5 3.5S10.067 12 12 12Z" stroke="#2A94B3" stroke-width="1.8"/>
                  <path d="M5.5 13.5c2.05-1.45 4.95-1.45 7 0M16.5 10.5c1.38 0 2.5-1.12 2.5-2.5S17.88 5.5 16.5 5.5" stroke="#5BC0FF" stroke-width="1.6" stroke-linecap="round"/>
                  <path d="M14.5 14c1.5-.95 3.6-.95 5.1 0" stroke="#2A94B3" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </span>
              <div class="metric"><div class="value" id="stat-participants">—</div><div class="label">Participants</div></div>
            </div>
            <div class="stat-card">
              <span class="stat-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="6" width="6" height="5" rx="1.5" stroke="#2A94B3" stroke-width="1.8"/>
                  <rect x="15" y="13" width="6" height="5" rx="1.5" stroke="#5BC0FF" stroke-width="1.8"/>
                  <path d="M9 9h6M15 9v4M9 13v-4" stroke="#2A94B3" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
              </span>
              <div class="metric"><div class="value" id="stat-rounds">—</div><div class="label">Rounds</div></div>
            </div>
          </div>
          <div id="podium-slot"></div>
          <div class="row">
            <div class="bracket" style="flex:2">
              <h3 class="section-title">Match History</h3>
              <div id="match-history"></div>
            </div>
            <article class="card" style="flex:1">
              <div class="card-body">
                <h2 class="card-title">About This Event</h2>
                <div class="about-event-media"><img src="${toImageSrc(ev.image)}" alt="${ev.eventName||''}" /></div>
                <p style="margin-top:10px">${ev.description||''}</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>`;
  if (status === 'completed') {
    // winners and rounds may need user lookups; render placeholders first, then upgrade asynchronously
    html += '<div id="results-loading" class="muted">Loading results…</div>';
  }
  root.innerHTML = html;
  const reg = qs('#register');
  const reg2 = null;
  const onReg = ()=>{
    const content = document.createElement('div');
    content.innerHTML = `<p>Event registration is available only in the AURORUS mobile app.</p><p><code>aurorus://events/${encodeURIComponent(id)}</code></p>`;
    openModal('Register in the App', content, [
      { label:'Get the App (Android)', href:'https://play.google.com/store/apps/details?id=com.aurorus.app' },
      { label:'Get the App (iOS)', href:'https://apps.apple.com/app/id0000000000' },
      { label:'Cancel', href:'#', onClick:()=>{} }
    ]);
  };
  reg?.addEventListener('click', onReg);
  // second register button removed to avoid duplicates

  // Populate quick stats
  try {
    let participants = 0;
    const p = ev?.participants;
    if (Array.isArray(p)) participants = p.length; else if (p && typeof p === 'object') participants = Object.keys(p).length; else if (typeof p === 'number') participants = Number(p)||0;
    const roundCount = Object.keys(matchesRoot||{}).filter(k => /^Round\d+$/i.test(k)).length;
    const timestamps = [];
    Object.keys(matchesRoot||{}).forEach(k => { if (!/^Round\d+$/i.test(k)) return; const r = matchesRoot[k]; const ms = Array.isArray(r)? r : Object.values(r||{}); ms.forEach(m => { if (m?.updatedAt) timestamps.push(Number(m.updatedAt)); if (m?.timestamp) timestamps.push(Number(m.timestamp)); }); });
    const start = Number(ev?.startTimestamp || ev?.startTime || ev?.createdAt || 0);
    const end = Math.max(0, ...timestamps, Number(ev?.endTimestamp || 0));
    const duration = (start && end && end>start) ? humanizeDuration(end - start) : '—';
    const ps = qs('#stat-participants'); if (ps) ps.textContent = String(participants||'—');
    const rs = qs('#stat-rounds'); if (rs) rs.textContent = String(roundCount||'—');
    const ds = qs('#stat-duration'); if (ds) ds.textContent = String(duration||'—');
  } catch {}

  await renderMatchHistoryPanel(matchesRoot);
  // If completed, hydrate winners + rounds with resolved names
  if (status === 'completed') {
    (async ()=>{
      const container = qs('#results-loading');
      const winnersHtml = await (async ()=>{
        const winners = matchesRoot?.WINNERS || {};
        // Normalize winners into FIRST/SECOND/THIRD
        const normalized = { FIRSTPLACE:null, SECONDPLACE:null, THIRDPLACE:null };
        const sample = Object.values(winners)[0];
        if (typeof sample === 'string') {
          Object.entries(winners).forEach(([uid, place])=>{
            const k = String(place||'').toUpperCase();
            if (k in normalized) normalized[k] = uid;
          });
        } else {
          normalized.FIRSTPLACE = winners.FIRSTPLACE || winners.first || null;
          normalized.SECONDPLACE = winners.SECONDPLACE || winners.second || null;
          normalized.THIRDPLACE = winners.THIRDPLACE || winners.third || null;
        }
        const [first, second, third] = await Promise.all([
          resolvePlayerInfo(normalized.FIRSTPLACE),
          resolvePlayerInfo(normalized.SECONDPLACE),
          resolvePlayerInfo(normalized.THIRDPLACE)
        ]);
        const firstCard = normalized.FIRSTPLACE? `
          <div class="podium-card first" style="animation-delay:.08s">
            <div class="place"><span class="trophy">🏆</span> Champion</div>
            <span class="avatar ${first.avatar?'':'avatar-fallback'}">${first.avatar?`<img src="${toImageSrc(first.avatar)}" alt="${first.name}">`:(first.name||'?').slice(0,1)}</span>
            <div class="winner-name">${first.name||'Champion'}</div>
          </div>` : '';
        const secondCard = normalized.SECONDPLACE? `
          <div class="podium-card second" style="animation-delay:.02s">
            <div class="place">🥈 Runner-Up</div>
            <span class="avatar ${second.avatar?'':'avatar-fallback'}">${second.avatar?`<img src="${toImageSrc(second.avatar)}" alt="${second.name}">`:(second.name||'?').slice(0,1)}</span>
            <div class="winner-name">${second.name||'Runner-Up'}</div>
          </div>` : '';
        const thirdCard = normalized.THIRDPLACE? `
          <div class="podium-card third" style="animation-delay:.14s">
            <div class="place">🥉 Third</div>
            <span class="avatar ${third.avatar?'':'avatar-fallback'}">${third.avatar?`<img src="${toImageSrc(third.avatar)}" alt="${third.name}">`:(third.name||'?').slice(0,1)}</span>
            <div class="winner-name">${third.name||'Third'}</div>
          </div>` : '';
        const podium = (firstCard||secondCard||thirdCard)? `
          <article class="card podium">
            <div class="card-body">
              <h2 class="card-title">Podium</h2>
              <div class="podium-grid">
                ${secondCard}
                ${firstCard}
                ${thirdCard}
              </div>
            </div>
          </article>` : '';
        return podium;
      })();
      const slot = qs('#podium-slot');
      if (slot) slot.innerHTML = winnersHtml || '';
      if (container) container.remove();
      const share = qs('#share-results');
      share?.addEventListener('click', async () => {
        const winners = matchesRoot?.WINNERS || {};
        const champInfo = await resolvePlayerInfo(winners?.FIRSTPLACE);
        const ruInfo = await resolvePlayerInfo(winners?.SECONDPLACE);
        const champ = champInfo.name || 'Unknown';
        const ru = ruInfo.name || '';
        const text = `Results: ${ev?.eventName||'Tournament'}\nChampion: ${champ}${ru?`\nRunner-Up: ${ru}`:''}`;
        try{ await navigator.clipboard.writeText(text); alert('Results copied to clipboard'); }
        catch(_){ prompt('Copy results', text); }
      });
    })();
  }
};

const init = async () => {
  if(!id){ await render(null); return; }
  const [eventSnap, matchesSnap] = await Promise.all([
    get(child(ref(db), `TBL_EVENTS/${id}`)),
    get(child(ref(db), `TBL_MATCHES/${id}`))
  ]);
  const ev = eventSnap.exists()? eventSnap.val() : null;
  const matchesRoot = matchesSnap.exists()? matchesSnap.val() : null;
  await render(ev, matchesRoot);
};

init();
