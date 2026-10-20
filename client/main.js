import {
  ROLES, ROLE_IDS, BRANDS, BRAND, WEEKS, STEPS, CHECKS, DEFECTS, RULES, PERSONAS, FORMATS, FORMAT_ER,
  CONCEPTS, EVENTS, BRAND_DATA, SPEEDS, AI_COST,
} from '/shared/content.js';
import { ZONES, ROLE_ZONE } from '/shared/map.js';
import { Office } from '/client/office.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#F27A2A', '#E2543A', '#F5A142', '#D94F70', '#C9622B', '#F2B035', '#8C5A3C', '#E58FD0'];
const DAY = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const STATUS_LABEL = { queued: 'Antre', waiting: 'Menunggu', working: 'Dikerjakan', carry: 'Dioper', npc: 'Freelancer', done: 'Siap tayang', late: 'Telat' };

const S = {
  ws: null, me: null, room: null, state: null, offset: 0, joined: false, lastHello: null,
  ui: { brand: 'clinic', modal: null, task: null, dataBrand: null, chatCh: 'near', insight: null, opened: {} },
  chat: [],
};

const office = new Office($('#canvas'));
office.sendMove = (m) => send('move', { x: Math.round(m.x), y: Math.round(m.y), dir: m.dir, moving: m.moving });

// ---------- utilitas ----------

const serverNow = () => Date.now() + S.offset;
const mePlayer = () => S.state?.players.find((p) => p.id === S.me);
const playerById = (id) => S.state?.players.find((p) => p.id === id);
const brandState = (id) => S.state?.brands?.find((b) => b.id === id);
const roleHasHuman = (role) => S.state?.players.some((p) => p.connected && p.role === role);
const secsLeft = () => (S.state?.phaseEndsAt ? Math.max(0, Math.ceil((S.state.phaseEndsAt - serverNow()) / 1000)) : null);
const fmtTime = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
const avatar = (p, size) => `<span class="avatar" style="background:${p.color};${size ? `width:${size}px;height:${size}px` : ''}" title="${esc(p.name)}">${esc((p.name || '?')[0].toUpperCase())}</span>`;
const roleChip = (r) => (r ? `<span class="chip"><span class="dot" style="background:${ROLES[r].color}"></span>${esc(ROLES[r].short || ROLES[r].name)}</span>` : '<span class="chip">Belum pilih divisi</span>');
const brandDot = (id) => `<span class="dot" style="background:${BRAND[id].color};border:2px solid ${BRAND[id].dark}"></span>`;

function setHTML(el, html) {
  if (el._html === html) return;
  el._html = html;
  const scroll = el.scrollTop;
  el.innerHTML = html;
  el.scrollTop = scroll;
}

function show(id) {
  for (const s of ['#title', '#lobby', '#office', '#meeting', '#report']) $(s).classList.toggle('hidden', s !== id);
  office.active = id === '#office';
  $('#chat').classList.toggle('hidden', id === '#title' || id === '#lobby');
}

function toast(text, kind = 'info') {
  const box = $('#toasts');
  if (kind === 'combo') box.querySelectorAll('.toast.combo').forEach((x) => x.remove());
  if ([...box.children].some((x) => x.textContent === text)) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => el.remove(), kind === 'combo' || kind === 'phase' ? 3000 : 4200);
}

// ---------- koneksi ----------

function connect(hello) {
  S.lastHello = hello;
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', ...hello }));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'welcome') {
      S.me = m.you;
      S.room = m.room;
      S.joined = true;
      S.lastHello = { ...hello, create: false, room: m.room };
      sessionStorage.setItem('sr_room', m.room);
      const u = new URL(location.href);
      u.searchParams.set('room', m.room);
      history.replaceState(null, '', u);
    } else if (m.t === 'state') {
      S.offset = m.now - Date.now();
      const prev = S.state?.phase;
      S.state = m;
      if (prev !== m.phase) onPhase(prev, m.phase);
      render();
    } else if (m.t === 'pos') {
      office.setPositions(m.p, S.me);
    } else if (m.t === 'toast') {
      toast(m.text, m.kind);
    } else if (m.t === 'chat') {
      S.chat.push(m);
      if (S.chat.length > 80) S.chat.shift();
      if (m.ch === 'near' && S.state?.phase === 'production') office.say(m.from, m.text);
      renderChat();
    } else if (m.t === 'error') {
      $('#joinError').textContent = m.text;
      show('#title');
      S.joined = false;
    }
  };
  ws.onclose = () => {
    if (!S.joined) return;
    toast('Koneksi putus, menyambung ulang…', 'warn');
    setTimeout(() => connect(S.lastHello), 1500);
  };
}

function send(a, data = {}) {
  if (S.ws?.readyState === 1) S.ws.send(JSON.stringify({ t: 'act', a, ...data }));
}

// ---------- title ----------

function initTitle() {
  const saved = JSON.parse(localStorage.getItem('sr_profile') || '{}');
  $('#fName').value = saved.name || '';
  $('#fCode').value = saved.code || '';
  $('#fTeam').value = saved.team || 'SEMUT';
  const roomParam = new URL(location.href).searchParams.get('room');
  if (roomParam) $('#fRoom').value = roomParam.toUpperCase();
  let color = saved.color || COLORS[0];
  const pick = $('#colorPick');
  pick.innerHTML = COLORS.map((c) => `<button type="button" aria-label="Warna ${c}" data-color="${c}" style="background:${c}" class="${c === color ? 'on' : ''}"></button>`).join('');
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    color = b.dataset.color;
    pick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#fName').addEventListener('input', () => {
    if (!$('#fCode').dataset.touched) {
      const base = $('#fName').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      $('#fCode').value = base ? `${base}-${Math.floor(Math.random() * 90 + 10)}` : '';
    }
  });
  $('#fCode').addEventListener('input', () => { $('#fCode').dataset.touched = '1'; });
  const go = (create) => {
    const name = $('#fName').value.trim();
    const code = $('#fCode').value.trim().toUpperCase();
    const team = $('#fTeam').value.trim().toUpperCase() || 'SEMUT';
    const room = $('#fRoom').value.trim().toUpperCase();
    $('#joinError').textContent = '';
    if (!name || !code) { $('#joinError').textContent = 'Isi nama dan kode pemain dulu.'; return; }
    if (!create && !room) { $('#joinError').textContent = 'Isi kode room, atau bikin room baru.'; return; }
    localStorage.setItem('sr_profile', JSON.stringify({ name, code, team, color }));
    connect({ name, playerCode: code, teamCode: team, color, create, room });
  };
  $('#joinForm').addEventListener('submit', (e) => { e.preventDefault(); go(false); });
  if (roomParam && sessionStorage.getItem('sr_room') === roomParam.toUpperCase() && saved.code) go(false);
  $('#joinForm').querySelector('[data-join="create"]').addEventListener('click', () => go(true));
}

// ---------- fase ----------

function onPhase(prev, phase) {
  closeModal();
  setChatMin(phase !== 'production');
  S.ui.task = null;
  if (phase === 'brainstorm') { S.ui.brand = 'clinic'; S.ui.opened = {}; }
  if (phase === 'report') S.ui.insight = null;
}

function render() {
  const st = S.state;
  if (!st) return;
  const ph = st.phase;
  if (ph === 'lobby') { show('#lobby'); renderLobby(); }
  else if (ph === 'brainstorm') { show('#meeting'); renderBrainstorm(); }
  else if (ph === 'production') { show('#office'); renderHud(); if (S.ui.modal) renderModal(); }
  else if (ph === 'gate4' || ph === 'results') { show('#meeting'); renderFriday(); }
  else if (ph === 'report' || ph === 'ended') { show('#report'); renderReport(); }
}

setInterval(() => {
  if (!S.state) return;
  const ph = S.state.phase;
  if (ph === 'production') { renderHud(); if (S.ui.modal) renderModal(); }
  else if (ph !== 'lobby') render();
}, 500);

// ---------- lobby ----------

function renderLobby() {
  const st = S.state;
  const me = mePlayer();
  const isHost = st.host === S.me;
  const link = `${location.origin}/?room=${st.room}`;
  const set = st.settings;
  const players = st.players.filter((p) => p.connected);
  const roleCards = ROLE_IDS.map((r) => {
    const who = players.filter((p) => p.role === r).map((p) => esc(p.name)).join(', ');
    return `<button class="role-card ${me?.role === r ? 'on' : ''}" data-a="role" data-role="${r}">
      <h3><span class="dot" style="background:${ROLES[r].color};width:16px;height:16px"></span>${ROLES[r].name}</h3>
      <p>${ROLES[r].desc}</p>
      <span class="who">${who ? 'Dipegang: ' + who : 'Kosong: dikerjakan Freelancer (NPC)'}</span>
    </button>`;
  }).join('');
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button ${isHost ? '' : 'disabled'} class="${set[key] === v ? 'on' : ''}" data-ui="setting" data-key="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
  setHTML($('#lobby'), `<div class="lobby-wrap"><div class="lobby">
    <div class="panel">
      <span class="tag tag-green">Pilih divisimu</span>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div><div class="muted" style="font-weight:800">Kode room</div><div class="room-code">${st.room}</div></div>
        <button class="btn btn-white btn-sm" data-ui="copy" data-link="${esc(link)}">Salin link undangan</button>
      </div>
      <div class="roles">${roleCards}</div>
    </div>
    <div class="panel">
      <span class="tag tag-orange">Room ${st.room}</span>
      <h3 style="font-size:20px">Semut di room (${players.length})</h3>
      <div class="plist">${players.map((p) => `<div class="prow">${avatar(p)}<span>${esc(p.name)}${p.host ? ' (host)' : ''}</span>${roleChip(p.role)}</div>`).join('')}</div>
      <h3 style="font-size:18px;margin-top:8px">Mode</h3>
      ${seg('mode', [['quick', 'Quick Run · 1 minggu'], ['full', '1 Bulan Penuh']])}
      ${set.mode === 'quick' ? `<h3 style="font-size:18px">Minggu</h3>${seg('week', [[1, 'W1 Army'], [2, 'W2 Persona'], [3, 'W3 Initiative']])}` : ''}
      <h3 style="font-size:18px">Kecepatan</h3>
      ${seg('speed', [['santai', 'Santai'], ['normal', 'Normal'], ['cepat', 'Cepat']])}
      <ul class="howto">
        <li>Jalan: WASD / panah. Interaksi: <b>E</b>. Papan tugas: <b>Tab</b>. Chat: <b>Enter</b>.</li>
        <li>Kerjakan tugas di mejamu, lalu oper "daun" ke meja divisi berikutnya.</li>
        <li>AI cepat, tapi butuh manusia di 4 Gerbang (biru).</li>
      </ul>
      <div class="actions">
        ${isHost ? `<button class="btn btn-orange" data-a="start" ${me?.role ? '' : 'disabled'}><span class="key">A</span>Mulai!</button>` : '<span class="chip">Menunggu host memulai…</span>'}
      </div>
    </div>
  </div></div>`);
}

// ---------- brainstorm ----------

function topbar(title, sub, extra = '') {
  const st = S.state;
  const left = secsLeft();
  return `<div class="topbar">
    <div class="pill" style="position:static"><span class="sun">${WEEKS[st.week]?.code || ''}</span><div><div class="clock">${title}</div><div class="muted" style="font-weight:800;font-size:13px">${sub}</div></div></div>
    <div class="pill" style="position:static;padding:5px 16px"><span class="timer">${fmtTime(left)}</span></div>
    ${roleChip(mePlayer()?.role)}
    <span style="flex:1"></span>
    ${extra}
  </div>`;
}

function readyBtn(label = 'Siap') {
  const st = S.state;
  const hs = st.players.filter((p) => p.connected && p.role);
  const n = hs.filter((p) => p.ready).length;
  const me = mePlayer();
  return `<button class="btn ${me?.ready ? 'btn-green' : 'btn-orange'}" data-a="ready">${me?.ready ? '✓ ' : ''}${label} (${n}/${hs.length})</button>`;
}

function renderBrainstorm() {
  const st = S.state;
  const w = st.week;
  const bid = S.ui.brand;
  const b = brandState(bid);
  const bd = BRAND[bid];
  const me = mePlayer();
  const opened = S.ui.opened[`${w}:${bid}`];
  const tabs = BRANDS.map((x) => {
    const bs = brandState(x.id);
    const votes = Object.values(bs.votes).reduce((s, v) => s + v.length, 0);
    return `<button class="brand-tab ${x.id === bid ? 'on' : ''}" data-ui="brand" data-brand="${x.id}">
      <b>${brandDot(x.id)}${x.name}</b>
      <span>${bs.hookBy === 'ai' ? 'Hook dipilih AI' : `${votes} vote hook`} · ${bs.rules.length} aturan</span>
    </button>`;
  }).join('');

  const dataLines = [...BRAND_DATA[bid]];
  if (w === 1) dataLines.unshift(`Akun Army dibutuhkan untuk 800 post/bulan: <b>${bd.armyNeed} akun</b>`);
  let dataExtra = '';
  if (w === 3) dataExtra = `<table class="t" style="margin-top:8px"><tr><th>Format</th><th>ER rata-rata</th></tr>${FORMATS.map((f) => `<tr><td>${f.name}</td><td>${FORMAT_ER[bid][f.id]}%</td></tr>`).join('')}</table>`;
  if (w === 2) dataLines.push('Cek profil tiap kandidat persona sebelum memilih.');
  const dataPanel = `<div class="panel"><span class="tag tag-green">Data brand</span>
    ${opened ? `<ul class="datalist">${dataLines.map((l) => `<li>${l}</li>`).join('')}</ul>${dataExtra}`
      : `<p style="margin:0 0 10px;font-weight:700">Lihat performa minggu lalu dan referensi sebelum memutuskan.</p><button class="btn btn-green btn-sm" data-ui="opendata" data-brand="${bid}">Buka data ${bd.name}</button>`}
  </div>`;

  const myVote = Object.entries(b.votes).find(([, ids]) => ids.includes(S.me))?.[0];
  const hooks = b.hooks.map((h, i) => {
    const voters = (b.votes[i] || []).map(playerById).filter(Boolean);
    const chosen = b.hookBy === 'ai' && b.chosenHook === i;
    return `<div class="hook ${String(i) === myVote ? 'mine' : ''} ${chosen ? 'chosen' : ''}">
      <q>${esc(h)}</q>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span class="voters">${voters.map((p) => avatar(p)).join('')}</span>
        ${b.hookBy === 'ai' ? (chosen ? '<span class="chip">Dipilih AI</span>' : '') : `<button class="btn btn-sm ${String(i) === myVote ? 'btn-orange' : 'btn-white'}" data-a="vote" data-brand="${bid}" data-idx="${i}">${String(i) === myVote ? 'Vote-mu' : 'Vote'}</button>`}
      </div></div>`;
  }).join('');
  const gate1 = `<div class="panel"><span class="tag tag-blue">Gerbang 1 · Pilih Ide</span>
    <div class="robot"><div class="robot-face">^_^</div><p>Aku bikin 4 ide hook dari trend & data. Tapi yang tahu maunya klien itu kalian. Vote yang paling pas!</p></div>
    <div class="hooks">${hooks}</div>
    ${b.hookBy === 'ai' ? '' : `<div class="actions"><button class="btn btn-white btn-sm" data-a="ai_pick" data-brand="${bid}">Biar AI yang pilih (−${AI_COST.hook} kredit)</button></div>`}
  </div>`;

  const rules = RULES[bid].map((r) => {
    const on = b.rules.includes(r.id);
    return `<button class="rule ${on ? 'on' : ''}" data-a="rule" data-brand="${bid}" data-id="${r.id}" data-on="${!on}"><span class="box">${on ? '✓' : ''}</span>${esc(r.text)}</button>`;
  }).join('');
  const gate2 = `<div class="panel"><span class="tag tag-blue">Gerbang 2 · Aturan Brand</span>
    <p style="margin:0;font-weight:700">Cukup bilang sekali: aturan yang dicentang dipatuhi AI di semua batch & minggu berikutnya. Hati-hati, ada aturan yang malah bikin masalah.</p>
    <div class="rules">${rules}</div></div>`;

  let plan = '';
  if (w === 1) {
    const total = st.brands.reduce((s, x) => s + x.army, 0);
    plan = `<div class="panel"><span class="tag tag-orange">W1 · Bagi 100 akun Army</span>
      <div class="alloc-row"><span style="font-weight:800">Akun untuk ${bd.name}</span>
      <span class="stepper"><button data-a="army" data-brand="${bid}" data-delta="-1" aria-label="Kurangi">−</button><b>${b.army}</b><button data-a="army" data-brand="${bid}" data-delta="1" aria-label="Tambah">+</button></span></div>
      <p class="fine">Sisa akun belum dibagi: <b>${100 - total}</b> dari 100. ${BRANDS.map((x) => `${x.name}: ${brandState(x.id).army}`).join(' · ')}</p>
      <p class="fine">Kalau nggak dibagi, sisa akun dibagi rata otomatis.</p></div>`;
  } else if (w === 2) {
    const cards = PERSONAS[bid].map((p) => {
      const on = b.persona === p.id;
      const rev = b.personaRevealed.includes(p.id);
      return `<div class="card ${on ? 'on' : ''}"><b style="font-family:'Baloo 2';font-size:17px">${esc(p.name)}</b>
        <span>${p.followers} followers</span><span class="muted">${esc(p.note)}</span>
        ${rev ? `<span class="hidden-data">${esc(p.hidden || 'Data: audiens sesuai target, engagement organik.')}</span>` : `<button class="btn btn-white btn-sm" data-a="persona_check" data-brand="${bid}" data-id="${p.id}">Cek profil (data)</button>`}
        <button class="btn btn-sm ${on ? 'btn-green' : 'btn-orange'}" data-a="persona" data-brand="${bid}" data-id="${p.id}">${on ? '✓ Terpilih' : 'Pilih'}</button></div>`;
    }).join('');
    plan = `<div class="panel"><span class="tag tag-orange">W2 · Pilih Proxy Persona</span>
      <div class="persona">${cards}</div><p class="fine">Kalau nggak ada yang dipilih, AI pilih yang followers-nya paling besar.</p></div>`;
  } else if (w === 3) {
    const used = Object.values(b.alloc).reduce((s, v) => s + v, 0);
    plan = `<div class="panel"><span class="tag tag-orange">W3 · Alokasi 200 konten inisiatif</span>
      ${FORMATS.map((f) => `<div class="alloc-row"><span style="font-weight:800">${f.name}</span><span class="stepper"><button data-a="alloc" data-brand="${bid}" data-fmt="${f.id}" data-delta="-1" aria-label="Kurangi">−</button><b>${b.alloc[f.id]}</b><button data-a="alloc" data-brand="${bid}" data-fmt="${f.id}" data-delta="1" aria-label="Tambah">+</button></span></div>`).join('')}
      <p class="fine">Sisa: <b>${200 - used}</b> dari 200. Sisa yang belum dialokasikan dibagi rata otomatis.</p></div>`;
  }

  const players = st.players.filter((p) => p.connected);
  setHTML($('#meeting'), `<div class="mtg">
    ${topbar(`Senin Brainstorm · ${WEEKS[w].name}`, WEEKS[w].goal, readyBtn('Siap'))}
    <div class="mtg-body">
      <div class="brand-tabs">${tabs}</div>
      <div class="mtg-main">
        <div class="panel" style="padding:16px 20px"><h2 style="display:flex;gap:10px;align-items:center">${brandDot(bid)}${bd.name}</h2><p class="muted" style="margin:4px 0 0;font-weight:800">${bd.trait} · Kredit AI: ${b.credits} · Trust klien: ${b.trust}</p></div>
        ${dataPanel}${gate1}${gate2}${plan}
      </div>
      <div class="side-col">
        <div class="panel"><span class="tag tag-blue">AI Assistant</span>
          <div class="robot" style="margin:0"><div class="robot-face">^_^</div><p>Manusia yang menentukan mau bikin apa dan boleh tayang atau tidak. Aku yang kerjakan sisanya. Pilih hook, pasang aturan, lalu tekan Siap.</p></div>
        </div>
        <div class="panel"><span class="tag tag-green">Tim</span>
          <div class="plist">${players.map((p) => `<div class="prow">${avatar(p)}<span style="flex:1">${esc(p.name)}</span>${p.ready ? '<span class="chip" style="background:#DDF2CF">Siap</span>' : ''}</div>`).join('')}</div>
        </div>
      </div>
    </div>
  </div>`);
}

// ---------- kantor (HUD) ----------

function clockText() {
  const st = S.state;
  const el = Math.max(0, serverNow() - st.prodStart);
  const d = Math.min(2, Math.floor(el / st.dayDur));
  const frac = Math.min(1, (el - d * st.dayDur) / st.dayDur);
  const mins = 9 * 60 + Math.floor(frac * 9 * 60);
  return { day: DAY[d + 1], time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` };
}

function myCarried() { return (S.state.tasks || []).filter((t) => t.status === 'carry' && t.holder === S.me); }
function targetFor(t) {
  const role = STEPS[t.step]?.role;
  const human = roleHasHuman(role);
  return { role, human, zone: human ? ROLE_ZONE[role] : 'freelance', label: human ? `meja ${ROLES[role].name}` : 'meja Vendor & Freelancer' };
}

function interaction() {
  const me = mePlayer();
  if (!me) return null;
  const zone = office.zone();
  for (const t of myCarried()) {
    const tg = targetFor(t);
    const mateNear = tg.human && S.state.players.some((p) => p.id !== S.me && p.connected && p.role === tg.role && (() => { const o = office.others.get(p.id); return o && office.near(o.x, o.y, 110); })());
    if (zone === tg.zone || mateNear) return { label: `Oper "${t.name}" ke ${ROLES[tg.role]?.name || 'Freelancer'}`, act: () => send('deliver', { task: t.id }) };
  }
  if (me.role && zone === ROLE_ZONE[me.role]) return { label: `Buka meja ${ROLES[me.role].name}`, act: () => openModal('desk') };
  if (zone === 'board') return { label: 'Lihat papan tugas', act: () => openModal('board') };
  if (zone === 'meeting') return { label: 'Layar data semua brand', act: () => openModal('data') };
  if (zone === 'server') return { label: 'Server AI: cek kredit', act: () => openModal('server') };
  if (zone === 'pantry') return { label: 'Istirahat di pantry: stress turun', act: null };
  if (zone && ZONES[zone].role) return { label: `Meja ${ZONES[zone].label}`, act: null };
  if (zone === 'freelance') return { label: 'Meja Vendor & Freelancer', act: null };
  return null;
}

office.overlay = () => {
  const st = S.state;
  if (!st) return {};
  const players = {};
  for (const p of st.players) players[p.id] = { name: p.name, color: p.color, role: p.role, locked: p.locked, carry: 0 };
  for (const t of st.tasks || []) {
    if (t.status === 'carry' && players[t.holder]) players[t.holder].carry++;
    const w = t.work || t.check;
    if (w && players[w.by]) { players[w.by].working = w.p; players[w.by].workingAi = t.work?.method === 'ai'; }
  }
  const me = mePlayer();
  const carried = myCarried();
  return {
    myId: S.me, players,
    myZone: me?.role && !carried.length ? ROLE_ZONE[me.role] : null,
    targetZone: carried.length ? targetFor(carried[0]).zone : null,
    npcBusy: (st.tasks || []).filter((t) => t.status === 'npc').length,
  };
};

function renderHud() {
  const st = S.state;
  const me = mePlayer();
  if (!me) return;
  const { day, time } = clockText();
  const credits = st.brands.reduce((s, b) => s + b.credits, 0);
  const tasks = st.tasks || [];
  const inbox = tasks.filter((t) => ['waiting', 'working'].includes(t.status) && STEPS[t.step]?.role === me.role);
  const carried = myCarried();
  const brandRows = st.brands.map((b) => {
    const bt = tasks.filter((t) => t.brand === b.id);
    const done = bt.filter((t) => t.status === 'done').length;
    return `<div class="brow"><div class="top"><span style="display:flex;gap:6px;align-items:center">${brandDot(b.id)}${BRAND[b.id].name}</span><span>${done}/${bt.length}</span></div>
      <div class="bar"><i style="width:${b.trust}%;background:${b.trust >= 65 ? '#367A1C' : b.trust >= 50 ? '#D99A1E' : '#D9452B'}"></i></div>
      <span class="muted" style="font-size:11px">Trust ${b.trust} · Kredit AI ${b.credits}</span></div>`;
  }).join('');
  const myTasks = [
    ...carried.map((t) => `<div class="mt" style="border-color:#F27A2A">Di tanganmu: <b>${esc(t.name)}</b><br>Oper ke ${targetFor(t).label}</div>`),
    ...(inbox.length ? [`<div class="mt">Inbox ${esc(ROLES[me.role]?.short || ROLES[me.role]?.name || '')}: <b>${inbox.length} tugas</b><br>Ke mejamu, tekan E</div>`] : []),
  ].join('') || '<div class="mt">Belum ada tugas buatmu. Bantu tim atau cek papan tugas.</div>';
  const res = [
    ['F', 'FEROMON', `${st.feromon}%`, '#367A1C'],
    ['Rp', 'BUDGET', `${st.budget} jt`, '#D99A1E'],
    ['AI', 'KREDIT AI', credits, '#3E8EF7'],
    ['S', 'STRESS-MU', `${me.stress}%`, me.stress > 75 ? '#D9452B' : '#C2511A'],
  ];
  setHTML($('#hud'), `
    <div class="pill" style="left:14px;top:14px"><span class="sun">${WEEKS[st.week].code}</span><div><div class="clock">${day} ${time}</div><div class="muted" style="font-weight:800;font-size:12px">${WEEKS[st.week].name} · Production</div></div></div>
    <div class="res">${res.map(([ic, k, v, c]) => `<div class="pill"><span class="res-ic" style="background:${c}">${ic}</span><div><div class="res-k">${k}</div><div class="res-v">${v}</div></div></div>`).join('')}
      ${st.combo >= 2 ? `<div class="pill" style="background:#FFD23F"><span class="res-ic" style="background:#B5730B">x${st.combo}</span><div><div class="res-k">COMBO</div><div class="res-v">Rantai Rangrang</div></div></div>` : ''}
    </div>
    <div class="panel side">
      <h3>Data hari ini</h3>${brandRows}
      <button class="btn btn-green btn-sm" data-ui="modal" data-m="data">Buka data lengkap</button>
      <h3 style="margin-top:4px">Tugasmu</h3><div class="mytasks">${myTasks}</div>
      <button class="btn btn-white btn-sm" data-ui="modal" data-m="board">Papan tugas (Tab)</button>
    </div>`);
  const it = interaction();
  const pr = $('#prompt');
  if (it && !S.ui.modal) {
    pr.classList.remove('hidden');
    setHTML(pr, `${it.act ? '<span class="key">E</span>' : ''}${esc(it.label)}`);
  } else pr.classList.add('hidden');
  renderEvents();
}

function renderEvents() {
  const st = S.state;
  const me = mePlayer();
  const evs = st.events || [];
  const mine = evs.find((e) => e.role === me?.role);
  let html = '';
  if (mine) {
    const def = EVENTS.find((e) => e.id === mine.def);
    const left = Math.max(0, Math.ceil((mine.expiresAt - serverNow()) / 1000));
    html = `<div class="panel dialog"><span class="tag tag-orange">Klien · ${BRAND[mine.brand].name}</span>
      <p><b>${esc(def.title)}.</b> ${esc(def.text)} <span class="muted">(${left} dtk)</span></p>
      <div class="choices">${def.choices.map((c, i) => `<button class="choice" data-a="event" data-event="${mine.uid}" data-choice="${i}">${esc(c.t)}</button>`).join('')}</div></div>`;
  } else if (evs.length) {
    html = evs.map((e) => {
      const def = EVENTS.find((x) => x.id === e.def);
      return `<div class="panel event-mini">Event untuk ${ROLES[e.role].name}: ${esc(def.title)}${roleHasHuman(e.role) ? '' : ' (Freelancer menangani)'}</div>`;
    }).join('');
  }
  setHTML($('#eventBox'), html);
}

// ---------- modal ----------

function openModal(kind) {
  S.ui.modal = kind;
  if (kind === 'data') S.ui.dataBrand = null;
  renderModal();
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  S.ui.modal = null;
  $('#modal').classList.add('hidden');
  $('#modal')._html = null;
}

function renderModal() {
  const k = S.ui.modal;
  let body = '';
  if (k === 'desk') body = deskView();
  else if (k === 'board') body = boardView();
  else if (k === 'data') body = dataView();
  else if (k === 'server') body = serverView();
  setHTML($('#modal'), `<div class="panel modal-box"><button class="btn btn-white btn-sm modal-close" data-ui="close">Tutup (Esc)</button>${body}</div>`);
}

function chainHtml(t) {
  return `<div class="chain">${t.chain.map((s, i) => `<span class="${i < t.stepIdx ? 'done' : i === t.stepIdx ? 'now' : ''} ${STEPS[s].gate ? 'g' : ''}" title="${ROLES[STEPS[s].role].name}">${STEPS[s].name}</span>`).join('<span style="background:none;padding:0">›</span>')}</div>`;
}

function progressHtml(p, label, paused, ai) {
  return `<div class="progress"><div style="display:flex;justify-content:space-between;font-weight:800;font-size:14px"><span>${label}</span><span>${Math.round(p * 100)}%</span></div>
    <div class="bar"><i style="width:${p * 100}%;background:${ai ? '#3E8EF7' : '#367A1C'}"></i></div>
    ${paused ? '<p class="error" style="margin-top:6px">Terhenti: kerja manual butuh kamu di meja.</p>' : ''}</div>`;
}

function deskView() {
  const st = S.state;
  const me = mePlayer();
  const tasks = st.tasks || [];
  const carried = myCarried();
  const inbox = tasks.filter((t) => ['waiting', 'working'].includes(t.status) && STEPS[t.step]?.role === me.role);
  const list = [...carried, ...inbox];
  if (!S.ui.task || !list.find((t) => t.id === S.ui.task)) S.ui.task = list[0]?.id || null;
  const t = tasks.find((x) => x.id === S.ui.task);
  const card = (x) => `<button class="tcard ${x.id === S.ui.task ? 'on' : ''}" data-ui="task" data-task="${x.id}">
    <span class="tname">${brandDot(x.brand)}${esc(x.name)}</span>
    <span class="tsub">${x.status === 'carry' ? 'Di tanganmu: oper!' : STEPS[x.step].name}${x.work || x.check ? ' · dikerjakan ' + esc(playerById((x.work || x.check).by)?.name || '') : ''}</span></button>`;
  const left = `<div><div class="desk-banner"><span>Meja ${esc(ROLES[me.role].name)}</span></div>
    <div class="tlist">${list.length ? list.map(card).join('') : '<p class="muted" style="font-weight:800">Inbox kosong. Tunggu oper dari divisi lain, atau bantu tim lewat chat.</p>'}</div></div>`;
  return `<h2 style="margin-bottom:12px">Meja Kerja</h2><div class="desk">${left}<div>${t ? taskDetail(t) : ''}</div></div>`;
}

function taskDetail(t) {
  const st = S.state;
  const b = brandState(t.brand);
  const step = t.step;
  const def = STEPS[step];
  const head = `<h3 style="font-size:22px;display:flex;gap:8px;align-items:center">${brandDot(t.brand)}${esc(t.name)}</h3>${chainHtml(t)}`;
  if (t.status === 'carry') {
    const tg = targetFor(t);
    return `${head}<div class="robot"><div class="robot-face">!</div><p>Langkahmu beres. Sekarang oper "daun" ini ke <b>${tg.label}</b>: jalan ke sana (ikuti panah oranye) lalu tekan <b>E</b>. Oper cepat bikin combo Rantai Rangrang.</p></div>
      <div class="actions"><button class="btn btn-orange" data-ui="close">Oke, jalan ke sana</button>
      <button class="btn btn-white" data-a="wa" data-task="${t.id}">Lempar lewat grup WA (cepat, info bisa tercecer)</button></div>`;
  }
  const busy = t.work || t.check;
  if (busy) {
    const p = t.work ? t.work.p : t.check.p;
    const label = t.check ? (CHECKS[t.check.check]?.label || 'Cek hashtag') : `${def.name} (${t.work.method === 'ai' ? 'AI' : 'manual'})`;
    return `${head}${progressHtml(p, label, t.work?.paused, t.work?.method === 'ai')}
      ${t.work?.method === 'ai' ? '<p class="fine">AI jalan sendiri di background. Kamu bebas jalan-jalan atau bantu yang lain.</p>' : ''}`;
  }
  const kind = def.kind;
  const hookText = b.hooks[b.chosenHook] ? `Hook: "${esc(b.hooks[b.chosenHook])}"` : '';
  if (kind === 'work') {
    const cost = AI_COST[step] ?? 5;
    const fixes = step === 'revise' ? `<div class="found">${t.found.filter((d) => !d.fixed && d.type !== 'hook').map((d) => `<span class="chip bad">${DEFECTS[d.type].name}</span>`).join('')}</div>` : '';
    return `${head}<p class="muted" style="font-weight:800;margin:0 0 10px">${hookText}</p>${fixes}
      <div class="opts">
        <button class="opt" data-a="work" data-task="${t.id}" data-method="manual"><b>Kerjakan manual</b><span>Lebih lama dan bikin capek, tapi hampir tanpa cacat. Harus tetap di meja.</span></button>
        <button class="opt ai" data-a="work" data-task="${t.id}" data-method="ai" ${b.credits < cost ? 'disabled' : ''}><b>Pakai AI (−${cost} kredit)</b><span>Cepat dan jalan sendiri. Bisa ada cacat tersembunyi yang harus ketahuan di review.</span></button>
      </div><p class="fine">Kredit AI ${BRAND[t.brand].name}: ${b.credits}</p>`;
  }
  if (kind === 'approve') {
    return `${head}<div class="robot"><div class="robot-face">Rp</div><p>Budget Army ${BRAND[t.brand].name}: <b>${b.army} akun</b> (kebutuhan di data: ${BRAND[t.brand].armyNeed} akun). Cek datanya dulu sebelum approve.</p></div>
      <div class="actions"><button class="btn btn-green btn-sm" data-ui="modal" data-m="data" data-brand="${t.brand}">Buka data</button></div>
      <div class="opts" style="margin-top:12px">
        <button class="opt" data-a="approve" data-task="${t.id}" data-method="manual"><b>Approve budget</b><span>Keputusan manusia.</span></button>
        <button class="opt warn" data-a="approve" data-task="${t.id}" data-method="ai"><b>Biar AI yang approve</b><span>Cepat, tapi ini keputusan soal uang.</span></button>
      </div>`;
  }
  if (kind === 'concept') {
    return `${head}<div class="robot"><div class="robot-face">?</div><p>Pilih konsep seri inisiatif untuk ${BRAND[t.brand].name}. Bandingkan dengan data performa format.</p></div>
      <div class="actions"><button class="btn btn-green btn-sm" data-ui="modal" data-m="data" data-brand="${t.brand}">Buka data format</button></div>
      <div class="opts" style="margin-top:12px">${CONCEPTS[t.brand].map((c, i) => `<button class="opt" data-a="concept" data-task="${t.id}" data-idx="${i}"><b>${esc(c.text)}</b><span>Pilih konsep ini</span></button>`).join('')}
      <button class="opt warn" data-a="concept" data-task="${t.id}" data-method="ai"><b>Biar AI yang pilih</b><span>Cepat, tapi ini Gerbang manusia.</span></button></div>`;
  }
  if (kind === 'review') {
    const checks = Object.entries(CHECKS).map(([id, c]) => {
      const done = t.checksDone.includes(id);
      const hit = done && t.found.some((d) => d.type === c.finds);
      return `<button class="opt ${done ? '' : ''}" data-a="check" data-task="${t.id}" data-check="${id}" ${done ? 'disabled' : ''}><b>${done ? (hit ? '⚠ ' : '✓ ') : ''}${c.label}</b><span>${done ? (hit ? 'Ketemu masalah!' : 'Aman') : `${c.secs} detik di meja`}</span></button>`;
    }).join('');
    const open = t.found.filter((d) => !d.fixed && d.type !== 'hook');
    return `${head}<div class="robot"><div class="robot-face">^_^</div><p>Batch beres! Volume dan durasi aman. Tapi aku <b>nggak bisa mendengar</b> dan <b>nggak punya selera</b>. Tonton sampai habis, terus bilang "gas" atau kirim revisi ya.</p></div>
      <p class="muted" style="font-weight:800;margin:0 0 8px">${hookText}</p>
      <div class="checks">${checks}</div>
      <div class="found">${t.found.map((d) => `<span class="chip ${d.fixed ? 'ok' : 'bad'}">${DEFECTS[d.type].name}${d.fixed ? ' (beres)' : ''}</span>`).join('')}</div>
      <div class="actions">
        <button class="btn btn-green" data-a="review_pass" data-task="${t.id}">Gas, lanjut</button>
        <button class="btn btn-orange" data-a="review_revise" data-task="${t.id}" ${open.length ? '' : 'disabled'}>Kirim revisi (${open.length})</button>
        <button class="btn btn-white" data-a="review_ai" data-task="${t.id}">Serahkan review ke AI (−${AI_COST.review})</button>
      </div>`;
  }
  if (kind === 'schedule') {
    if (t.sub === 'confirm') {
      return `${head}<div class="robot"><div class="robot-face">#</div><p>Jadwal udah siap. Sebelum masuk antrean tayang, mau cek hashtag brand dulu?</p></div>
        <div class="opts">
          <button class="opt" data-a="hashtag" data-task="${t.id}" ${t.hashtagChecked ? 'disabled' : ''}><b>${t.hashtagChecked ? '✓ Hashtag dicek' : 'Cek hashtag brand'}</b><span>Post tanpa hashtag nggak kebaca tools.</span></button>
          <button class="opt" data-a="finish" data-task="${t.id}"><b>Selesai, masuk antrean tayang</b><span>Lanjut ke Gerbang 4 hari Jumat.</span></button>
        </div>`;
    }
    return `${head}<div class="opts">
        <button class="opt" data-a="sched_data" data-task="${t.id}" ${t.dataTime ? 'disabled' : ''}><b>${t.dataTime ? '✓ Data jam tayang dipakai' : 'Cek data jam tayang terbaik'}</b><span>Reach naik kalau tayang di jam yang tepat.</span></button>
        <span></span>
        <button class="opt" data-a="work" data-task="${t.id}" data-method="manual"><b>Jadwalkan manual</b><span>Lebih lama, jarang lupa hashtag.</span></button>
        <button class="opt ai" data-a="work" data-task="${t.id}" data-method="ai"><b>Jadwalkan pakai AI (−${AI_COST.schedule})</b><span>Cepat. Kadang lupa hashtag kalau aturannya nggak dipasang.</span></button>
      </div>`;
  }
  return head;
}

function boardView() {
  const st = S.state;
  const cols = ['queued', 'waiting', 'working', 'carry', 'npc', 'done'];
  return `<h2 style="margin-bottom:12px">Papan Tugas · ${WEEKS[st.week].code}</h2><div class="board">${cols.map((c) => {
    const ts = (st.tasks || []).filter((t) => t.status === c);
    return `<div class="col"><h3>${STATUS_LABEL[c]} (${ts.length})</h3>${ts.map((t) => {
      const who = t.status === 'carry' ? playerById(t.holder)?.name : (t.work || t.check) ? playerById((t.work || t.check).by)?.name : '';
      const role = t.step ? ROLES[STEPS[t.step].role].short || ROLES[STEPS[t.step].role].name : '';
      return `<div class="mini" style="border-left-color:${BRAND[t.brand].color}">${esc(t.name)}<br><span class="muted">${t.step ? STEPS[t.step].name : ''}${role ? ' · ' + role : ''}${who ? ' · ' + esc(who) : ''}${t.status === 'queued' ? ' · rilis ' + DAY[t.releaseDay] : ''}</span></div>`;
    }).join('')}</div>`;
  }).join('')}</div>`;
}

function dataView() {
  const st = S.state;
  const bid = S.ui.dataBrand;
  const tabs = `<div class="tabs">${BRANDS.map((b) => `<button class="${b.id === bid ? 'on' : ''}" data-ui="databrand" data-brand="${b.id}">${brandDot(b.id)}${b.name}</button>`).join('')}</div>`;
  if (!bid) return `<h2 style="margin-bottom:12px">Layar Data</h2>${tabs}<p style="font-weight:800">Pilih brand untuk lihat datanya.</p>`;
  const b = brandState(bid);
  const bd = BRAND[bid];
  const tasks = (st.tasks || []).filter((t) => t.brand === bid);
  let extra = '';
  if (st.week === 1) extra = `<div class="card"><h3>Army</h3><p style="margin:0;font-weight:700">Akun dialokasikan: <b>${b.army}</b> · Kebutuhan untuk 800 post/bulan: <b>${bd.armyNeed}</b></p></div>`;
  if (st.week === 2) { const per = PERSONAS[bid].find((p) => p.id === b.persona); extra = `<div class="card"><h3>Persona</h3><p style="margin:0;font-weight:700">${per ? esc(per.name) + ' · ' + per.followers + ' followers' : '-'}${b.personaAuto ? ' (dipilih AI)' : ''}</p></div>`; }
  if (st.week === 3) extra = `<div class="card"><h3>Format & alokasi</h3><table class="t"><tr><th>Format</th><th>ER</th><th>Alokasi</th></tr>${FORMATS.map((f) => `<tr><td>${f.name}</td><td>${FORMAT_ER[bid][f.id]}%</td><td>${b.alloc[f.id]}</td></tr>`).join('')}</table></div>`;
  return `<h2 style="margin-bottom:12px">Layar Data</h2>${tabs}
    <div class="grid2">
      <div class="card"><h3>${brandDot(bid)}${bd.name}</h3><p style="margin:0 0 6px;font-weight:700">${bd.trait}</p>
        <table class="t"><tr><td>Trust klien</td><td><b>${b.trust}</b></td></tr><tr><td>Kredit AI</td><td><b>${b.credits}</b></td></tr>
        <tr><td>Batch selesai</td><td><b>${tasks.filter((t) => t.status === 'done').length}/${tasks.length}</b></td></tr>
        <tr><td>Aturan brand aktif</td><td><b>${b.rules.length}</b></td></tr></table></div>
      <div class="card"><h3>Insight & referensi</h3><ul class="datalist">${BRAND_DATA[bid].map((l) => `<li>${l}</li>`).join('')}</ul></div>
      ${extra}
    </div>`;
}

function serverView() {
  const st = S.state;
  return `<h2 style="margin-bottom:12px">Server Room AI</h2>
    <div class="grid2"><div class="card"><h3>Kredit AI minggu ini</h3><table class="t">${st.brands.map((b) => `<tr><td>${brandDot(b.id)} ${BRAND[b.id].name}</td><td><b>${b.credits}</b></td></tr>`).join('')}</table></div>
    <div class="card"><h3>Catatan AI Assistant</h3><ul class="datalist">
      <li>Ada 4 titik wajib manusia: pilih ide, tentukan aturan, review batch, izin tayang.</li>
      <li>Aturan brand cukup bilang sekali, aku ingat terus.</li>
      <li>Aku nggak bisa mendengar: VO harus didengar manusia.</li>
      <li>Aku kadang menulis klaim sendiri: baca ulang kalimat fakta.</li>
      <li>Wajah orang bisa kelewatan: cek video final.</li></ul></div></div>`;
}

// ---------- jumat ----------

function renderFriday() {
  const st = S.state;
  if (st.phase === 'gate4') {
    const rows = (st.tasks || []).map((t) => {
      if (t.status === 'late') return `<div class="g4row late"><span>${brandDot(t.brand)} <b>${esc(t.name)}</b></span><span class="muted" style="font-weight:800">Telat, nggak sempat tayang.</span><span></span></div>`;
      const rv = t.reviewedBy === 'human' ? `Direview manusia (${t.checksDone.length} cek)` : t.reviewedBy === 'ai' ? 'Cuma direview AI' : t.reviewedBy === 'npc' ? 'Direview Freelancer (tanpa cek)' : 'Belum direview';
      const chips = t.found.map((d) => `<span class="chip ${d.fixed ? 'ok' : 'bad'}" style="background:${d.fixed ? '#DDF2CF' : '#FFE1DA'}">${DEFECTS[d.type].name}${d.fixed ? ' ✓' : ''}</span>`).join(' ');
      return `<div class="g4row ${t.decision || ''}"><span>${brandDot(t.brand)} <b>${esc(t.name)}</b><br><span class="muted" style="font-size:13px;font-weight:800">${rv} · ${t.hashtagChecked ? 'hashtag dicek' : 'hashtag belum dicek'}</span></span>
        <span>${chips || '<span class="muted" style="font-weight:700">Tidak ada catatan cacat.</span>'}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          ${t.hashtagChecked ? '' : `<button class="btn btn-white btn-sm" data-a="hashtag" data-task="${t.id}">Cek hashtag</button>`}
          <button class="btn btn-sm ${t.decision === 'air' ? 'btn-green' : 'btn-white'}" data-a="air" data-task="${t.id}" data-ok="true">Izinkan tayang</button>
          <button class="btn btn-sm ${t.decision === 'hold' ? 'btn-orange' : 'btn-white'}" data-a="air" data-task="${t.id}" data-ok="false">Tahan</button>
        </span></div>`;
    }).join('');
    setHTML($('#meeting'), `<div class="mtg">${topbar('Jumat · Gerbang 4: Izin Tayang', 'Konten yang sudah tayang susah ditarik.')}
      <div class="panel" style="padding:26px 18px 16px"><span class="tag tag-blue">Gerbang 4</span>
        <div class="robot"><div class="robot-face">^_^</div><p>Ini antrean tayang minggu ini. Cek siapa yang review dan cacat apa yang masih terbuka. Kasih izin yang jelas sebelum aku jadwalkan.</p></div>
        <div class="gate4">${rows || '<p style="font-weight:800">Nggak ada batch yang selesai minggu ini.</p>'}</div>
        <div class="actions" style="justify-content:flex-end"><button class="btn btn-orange" data-a="go">Tayangkan & lihat hasil</button></div>
      </div></div>`);
    return;
  }
  const res = st.weekResults[st.weekResults.length - 1];
  const unitLabel = { post: 'post Army', kredibilitas: 'kredibilitas persona', konten: 'konten inisiatif' };
  const cards = BRANDS.map((bd) => {
    const r = res.brands[bd.id];
    const delta = r.trustAfter - r.trustBefore;
    return `<div class="panel rcard"><h3>${brandDot(bd.id)}${bd.name}</h3>
      <div><span class="big">+${r.output}</span> <span class="muted" style="font-weight:800">${unitLabel[r.unit]}</span></div>
      <div style="font-weight:800;font-size:14px">Tayang ${r.aired} · Ditahan ${r.held} · Telat ${r.late}</div>
      <div style="font-weight:800;font-size:14px">ER ${r.er}% · Trust ${r.trustBefore} → <span style="color:${delta >= 0 ? '#2C6A14' : '#B5301B'}">${r.trustAfter} (${delta >= 0 ? '+' : ''}${delta})</span></div>
      ${r.leaked.map((l) => `<span class="leak">Lolos tayang: ${esc(l.name)}</span>`).join('')}
    </div>`;
  }).join('');
  setHTML($('#meeting'), `<div class="mtg">${topbar(`Weekly Update · Hasil ${WEEKS[res.week].code}`, `${WEEKS[res.week].name} selesai`, readyBtn('Lanjut'))}
    <div class="results">${cards}</div>
    <div class="panel" style="padding:24px 18px 14px"><span class="tag tag-green">Tim</span>
      <p style="margin:0;font-weight:800">Feromon tim ${res.feromon}% · Combo Rantai Rangrang terakhir x${res.combo}. ${S.state.weekIdx < S.state.weeks.length - 1 ? 'Minggu depan: ' + WEEKS[S.state.weeks[S.state.weekIdx + 1]].name + '.' : 'Berikutnya: Evaluasi & Report bulanan.'}</p>
    </div></div>`);
}

// ---------- report ----------

function monthCards(month) {
  return BRANDS.map((bd) => {
    const m = month[bd.id];
    const vc = m.verdict === 'Diperpanjang' ? 'v-ok' : m.verdict === 'Hati-hati' ? 'v-warn' : 'v-bad';
    const rows = [];
    if (m.postsMonth != null) rows.push(['Army post (proyeksi bulan)', `${m.postsMonth} / 800`, Math.min(1, m.postsMonth / 800)]);
    if (m.cred != null) rows.push(['Kredibilitas persona', `${m.cred} / 70`, Math.min(1, m.cred / 70)]);
    if (m.konten != null) rows.push(['Konten inisiatif', `${m.konten} / 200`, Math.min(1, m.konten / 200)]);
    rows.push(['Trust klien', `${m.trust}`, m.trust / 100]);
    return `<div class="panel rcard"><h3>${brandDot(bd.id)}${bd.name}</h3><span class="verdict ${vc}">Retainer: ${m.verdict}</span>
      ${rows.map(([k, v, p]) => `<div class="brow"><div class="top"><span class="muted">${k}</span><span>${v}</span></div><div class="bar"><i style="width:${p * 100}%;background:${bd.dark}"></i></div></div>`).join('')}
      <span style="font-weight:800;font-size:13px">ER rata-rata ${m.er}%</span></div>`;
  }).join('');
}

function renderReport() {
  const st = S.state;
  const isHost = st.host === S.me;
  if (st.phase === 'report') {
    const q = st.insightQ;
    const answered = st.insights.some((x) => x.id === S.me);
    const wr = st.weekResults.map((r) => `<tr><td>${WEEKS[r.week].code}</td><td>${r.brands[q.brand].aired}</td><td>${r.brands[q.brand].held}</td><td>${r.brands[q.brand].late}</td><td>${r.brands[q.brand].leaked.length}</td><td>${r.brands[q.brand].er}%</td><td>${r.brands[q.brand].trustBefore}→${r.brands[q.brand].trustAfter}</td></tr>`).join('');
    const opened = S.ui.opened[`report:${q.brand}`];
    const done = st.insights.map((x) => playerById(x.id)).filter(Boolean);
    setHTML($('#report'), `<div class="mtg">
      ${topbar('Jumat W4 · Evaluasi → Report', 'AI sudah menyusun angka. Insight "what & why" tugas manusia.')}
      <div class="results">${monthCards(st.month)}</div>
      <div class="grid2">
        <div class="panel" style="padding:26px 18px 16px"><span class="tag tag-blue">Data ${BRAND[q.brand].name}</span>
          ${opened ? `<table class="t"><tr><th>Minggu</th><th>Tayang</th><th>Ditahan</th><th>Telat</th><th>Cacat lolos</th><th>ER</th><th>Trust</th></tr>${wr}</table>
            <ul class="datalist" style="margin-top:8px">${st.weekResults.flatMap((r) => r.brands[q.brand].leaked.map((l) => `<li>${WEEKS[r.week].code}: ${esc(l.name)} (${esc(l.task)})</li>`)).join('') || '<li>Tidak ada cacat yang lolos.</li>'}</ul>`
            : `<p style="font-weight:700;margin:0 0 10px">Buka data mingguan sebelum menulis insight.</p><button class="btn btn-green btn-sm" data-ui="opendata" data-brand="${q.brand}" data-scope="report">Buka data ${BRAND[q.brand].name}</button>`}
        </div>
        <div class="panel" style="padding:26px 18px 16px"><span class="tag tag-orange">Insight · What & Why</span>
          ${answered ? '<p style="font-weight:800">Insight kamu sudah terkirim. Menunggu yang lain…</p>' : `
          <p style="margin:0;font-weight:800">Brand dengan hasil paling lemah: ${brandDot(q.brand)} ${BRAND[q.brand].name}. Menurut data, kenapa?</p>
          <div class="insight-opts">${q.options.map((o, i) => `<button class="rule ${S.ui.insight === i ? 'on' : ''}" data-ui="insight" data-idx="${i}"><span class="box">${S.ui.insight === i ? '✓' : ''}</span>${esc(o.text)}</button>`).join('')}</div>
          <label>Langkah bulan depan (opsional)<textarea id="insightText" rows="2" maxlength="400"></textarea></label>
          <div class="actions"><button class="btn btn-orange" data-ui="sendinsight" ${S.ui.insight == null ? 'disabled' : ''}>Kirim insight</button></div>`}
          <p class="fine">Sudah kirim: ${done.map((p) => esc(p.name)).join(', ') || '-'}</p>
          ${isHost ? '<div class="actions"><button class="btn btn-white btn-sm" data-a="finish">Selesaikan report</button></div>' : ''}
        </div>
      </div></div>`);
    return;
  }
  const f = st.final;
  const lit = ROLE_IDS.map((r) => {
    const x = f.byRole[r];
    if (!x.human) return `<div class="card" style="padding:10px 12px"><h3 style="font-size:16px">${roleChip(r)}</h3><p class="muted" style="margin:0;font-weight:800;font-size:13px">Dikerjakan Freelancer (NPC)</p></div>`;
    const bar = (k, v) => `<div class="brow"><div class="top"><span class="muted">${k}</span><span>${v ?? '-'}</span></div><div class="bar"><i style="width:${v ?? 0}%;background:${(v ?? 0) >= 70 ? '#367A1C' : '#D99A1E'}"></i></div></div>`;
    return `<div class="card" style="padding:10px 12px"><h3 style="font-size:16px">${roleChip(r)}</h3>${bar('AI Literacy', x.ai)}${bar('Data Literacy', x.data)}</div>`;
  }).join('');
  const ti = f.teamInsight && f.insightQ ? f.insightQ.options[f.teamInsight.choice]?.text : null;
  setHTML($('#report'), `<div class="mtg">
    <div style="text-align:center"><div class="headline">${st.weeks.length > 1 ? 'Bulan Selesai!' : 'Minggu Selesai!'}</div></div>
    <div style="display:flex;justify-content:center"><div class="panel" style="padding:14px 30px;text-align:center"><div class="muted" style="font-weight:800">SKOR KOLONI</div><div class="grade">${f.grade}</div></div></div>
    <div class="results">${monthCards(f.month)}</div>
    <div class="grid2">
      <div class="panel" style="padding:26px 18px 16px"><span class="tag tag-green">AI & Data Literacy per divisi</span><div class="grid2">${lit}</div>
        <p class="fine">Langkah yang dikerjakan Vendor & Freelancer: ${f.byRole.npc.steps}</p></div>
      <div class="panel" style="padding:26px 18px 16px"><span class="tag tag-orange">Insight tim</span>
        <p style="font-weight:800;margin:0">${ti ? esc(ti) : 'Belum ada insight yang dikirim.'}</p>
        ${f.teamInsight?.text ? `<p style="font-weight:700">"${esc(f.teamInsight.text)}"</p>` : ''}
        <div class="actions">${isHost ? '<button class="btn btn-orange" data-a="restart">Main lagi</button>' : '<span class="chip">Menunggu host…</span>'}</div>
      </div>
    </div></div>`);
}

// ---------- chat ----------

function setChatMin(min) {
  $('#chat').classList.toggle('min', min);
  $('#chat').querySelector('[data-chatmin]').textContent = min ? 'Chat' : '–';
  S.ui.chatMinUser = min;
}

function renderChat() {
  const log = $('#chatLog');
  log.innerHTML = S.chat.slice(-40).map((m) => `<div class="${m.ch}"><b>${m.ch === 'wa' ? '[WA] ' : ''}${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

$('#chat').addEventListener('click', (e) => {
  if (e.target.closest('[data-chatmin]')) { setChatMin(!$('#chat').classList.contains('min')); return; }
  if ($('#chat').classList.contains('min')) setChatMin(false);
  const b = e.target.closest('[data-chat]');
  if (!b) return;
  S.ui.chatCh = b.dataset.chat;
  $('#chat').querySelectorAll('[data-chat]').forEach((x) => x.classList.toggle('on', x === b));
});
$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#chatInput').value.trim();
  if (text) send('chat', { ch: S.ui.chatCh, text });
  $('#chatInput').value = '';
  $('#chatInput').blur();
});

// ---------- input ----------

function parseVal(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

document.addEventListener('click', (e) => {
  const ui = e.target.closest('[data-ui]');
  if (ui) {
    const d = ui.dataset;
    if (d.ui === 'close') closeModal();
    else if (d.ui === 'modal') { openModal(d.m); if (d.brand) { S.ui.dataBrand = d.brand; send('data', { key: d.brand }); renderModal(); } }
    else if (d.ui === 'task') { S.ui.task = d.task; renderModal(); }
    else if (d.ui === 'databrand') { S.ui.dataBrand = d.brand; send('data', { key: d.brand }); renderModal(); }
    else if (d.ui === 'brand') { S.ui.brand = d.brand; render(); }
    else if (d.ui === 'opendata') {
      const key = d.scope === 'report' ? `report:${d.brand}` : `${S.state.week}:${d.brand}`;
      S.ui.opened[key] = true;
      send('data', { key: d.brand });
      render();
    } else if (d.ui === 'setting') {
      const s = { ...S.state.settings, [d.key]: parseVal(d.val) };
      send('settings', s);
    } else if (d.ui === 'copy') {
      navigator.clipboard?.writeText(d.link).then(() => toast('Link undangan disalin!', 'good'), () => toast(d.link));
    } else if (d.ui === 'insight') { S.ui.insight = Number(d.idx); render(); }
    else if (d.ui === 'sendinsight') send('insight', { choice: S.ui.insight, text: $('#insightText')?.value || '' });
    return;
  }
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const msg = {};
  for (const [k, v] of Object.entries(el.dataset)) if (k !== 'a') msg[k] = parseVal(v);
  send(el.dataset.a, msg);
});

$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

window.addEventListener('keydown', (e) => {
  const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
  if (e.key === 'Escape') { if (S.ui.modal) closeModal(); if (typing) e.target.blur(); return; }
  if (typing || !S.state) return;
  if (e.key === 'Enter' && S.state.phase !== 'lobby') { e.preventDefault(); setChatMin(false); $('#chatInput').focus(); return; }
  if (S.state.phase !== 'production') return;
  if (e.key === 'Tab') { e.preventDefault(); if (S.ui.modal === 'board') closeModal(); else openModal('board'); return; }
  if (e.key.toLowerCase() === 'e') {
    if (S.ui.modal) { closeModal(); return; }
    const it = interaction();
    if (it?.act) it.act();
  }
});

function initTouch() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const pad = document.createElement('div');
  pad.className = 'joy';
  pad.innerHTML = '<div class="joy-knob"></div>';
  const eBtn = document.createElement('button');
  eBtn.className = 'joy-e btn btn-orange';
  eBtn.textContent = 'E';
  eBtn.setAttribute('aria-label', 'Interaksi');
  $('#office').append(pad, eBtn);
  const knob = pad.firstChild;
  let id = null;
  const move = (t) => {
    const r = pad.getBoundingClientRect();
    let x = (t.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (t.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    office.joy = { x, y };
    knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
  };
  pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(id); move(e); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = () => { id = null; office.joy = null; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  eBtn.addEventListener('click', () => {
    if (S.ui.modal) return closeModal();
    const it = interaction();
    if (it?.act) it.act();
  });
}

initTitle();
initTouch();

if (new URL(location.href).searchParams.has('dev')) window.__sr = { send, S, office };
