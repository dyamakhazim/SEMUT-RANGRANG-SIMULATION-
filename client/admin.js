import { ROLES } from '/shared/content.js';

const root = document.querySelector('#root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let code = sessionStorage.getItem('sr_admin') || '';

async function api(path) {
  const r = await fetch(`${path}${path.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Gagal memuat');
  return j;
}

function radar(skills, values, color, size = 220) {
  const n = skills.length;
  const c = size / 2;
  const R = size / 2 - 40;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v];
  };
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${skills.map((_, i) => pt(i, f).join(',')).join(' ')}" fill="none" stroke="#E9D8B4" stroke-width="1.5"/>`).join('');
  const axes = skills.map((_, i) => `<line x1="${c}" y1="${c}" x2="${pt(i, 1)[0]}" y2="${pt(i, 1)[1]}" stroke="#E9D8B4" stroke-width="1.5"/>`).join('');
  const poly = skills.map((s, i) => pt(i, (values[s.id] ?? 0) / 100).join(',')).join(' ');
  const labels = skills.map((s, i) => {
    const [x, y] = pt(i, 1.2);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10.5" font-weight="800" fill="#7A5C3E">${esc(s.short)} ${values[s.id] ?? '-'}</text>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar skill">${rings}${axes}<polygon points="${poly}" fill="${color}55" stroke="${color}" stroke-width="2.5"/>${labels}</svg>`;
}

function spark(trend, key) {
  const vs = trend.map((t) => t.skills[key]).filter((v) => v != null);
  if (vs.length < 2) return '';
  const w = 80, h = 22;
  const pts = vs.map((v, i) => `${(i / (vs.length - 1)) * w},${h - (v / 100) * h}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#3E8EF7" stroke-width="2"/></svg>`;
}

function loginView(err = '') {
  root.innerHTML = `<div class="head"><h1>Dashboard BOD</h1></div>
    <form class="panel login" id="f"><span class="tag tag-green">Masuk</span>
      <label>Kode admin<input id="code" type="password" required></label>
      <button class="btn btn-orange">Buka dashboard</button><p class="error">${esc(err)}</p></form>`;
  document.querySelector('#f').addEventListener('submit', (e) => {
    e.preventDefault();
    code = document.querySelector('#code').value.trim();
    sessionStorage.setItem('sr_admin', code);
    load();
  });
}

async function load(team) {
  try {
    const { teams } = await api('/api/admin/teams');
    if (!teams.length) {
      root.innerHTML = '<div class="head"><h1>Dashboard BOD</h1></div><div class="panel login"><p style="font-weight:800">Belum ada data. Main dulu minimal satu sesi.</p></div>';
      return;
    }
    const sel = team || teams[0].team_code;
    const rep = await api(`/api/admin/team/${encodeURIComponent(sel)}`);
    render(teams, rep);
  } catch (e) {
    loginView(e.message);
  }
}

function render(teams, rep) {
  const S = rep.skills;
  const roleCards = Object.entries(rep.roles).map(([r, x]) => `<div class="panel rolecard">
      <h3>${esc(ROLES[r].name)}</h3><span class="muted" style="font-weight:800;font-size:13px">${x.players} pemain</span>
      ${radar(S, x.skills, ROLES[r].color === '#FFD966' ? '#C99A0E' : ROLES[r].color, 200)}</div>`).join('');
  const gaps = [];
  for (const [r, x] of Object.entries(rep.roles)) {
    for (const s of S) if (x.skills[s.id] != null && x.skills[s.id] < 60) gaps.push(`${ROLES[r].name} masih lemah di ${s.name} (${x.skills[s.id]})`);
  }
  const players = rep.players.filter((p) => p.sessions).sort((a, b) => (a.role || '').localeCompare(b.role || ''));
  const pcards = players.map((p) => `<div class="panel pcard">
      <div class="top"><span class="avatar" style="background:${esc(p.color)}">${esc(p.name[0] || '?')}</span>
        <div style="flex:1"><b style="font-family:'Baloo 2';font-size:19px">${esc(p.name)}</b><div class="muted" style="font-weight:800;font-size:12px">${esc(p.code)} · ${esc(ROLES[p.role]?.name || '-')} · ${p.sessions} sesi</div></div></div>
      <div class="labels">${p.labels.map((l) => `<span class="chip">${esc(l)}</span>`).join('')}</div>
      ${S.map((s) => `<div class="skill"><span>${s.name}</span><div class="bar"><i style="width:${p.skills[s.id] ?? 0}%;background:${(p.skills[s.id] ?? 0) >= 70 ? '#367A1C' : (p.skills[s.id] ?? 0) >= 50 ? '#D99A1E' : '#D9452B'}"></i></div><span>${p.skills[s.id] ?? '-'}</span></div>`).join('')}
      <div class="muted" style="font-size:12px;font-weight:800">Tren AI ${spark(p.trend, 'ai')} Data ${spark(p.trend, 'data')}</div>
      <div class="muted" style="font-size:12px;font-weight:700">Cacat ditangkap ${p.totals.caught || 0} · lolos ${p.totals.leaked || 0} · oper ${p.totals.handoffs || 0} (WA ${p.totals.waThrows || 0}) · AI gantikan gerbang ${p.totals.aiGate || 0}</div>
    </div>`).join('');
  const names = Object.fromEntries(rep.players.map((p) => [p.code, p.name]));
  const hand = rep.handoffs.sort((a, b) => b.n - a.n).map((h) => `<tr><td>${esc(names[h.from] || h.from)}</td><td>${esc(ROLES[h.fromRole]?.name || '-')}</td><td>${esc(h.to === 'freelance' ? 'Freelancer' : ROLES[h.to]?.name || h.to)}</td><td>${h.n}</td><td>${h.fast}</td><td>${h.wa}</td></tr>`).join('');
  const leaks = rep.leaks.slice(0, 30).map((l) => `<tr><td>${esc(names[l.player] || (l.by === 'npc' ? 'Freelancer' : '-'))}</td><td>${esc(ROLES[l.role]?.name || '-')}</td><td>${esc(l.type)}</td><td>${esc(l.brand)}</td><td>${esc(l.by || '')}</td><td>${new Date(l.ts).toLocaleString('id-ID')}</td></tr>`).join('');
  const sessions = rep.sessions.slice().reverse().map((s) => `<tr><td>${new Date(s.started).toLocaleString('id-ID')}</td><td>${s.mode === 'full' ? '1 bulan' : 'Quick'} (${s.weeks.map((w) => 'W' + w).join(', ')})</td><td><b>${esc(s.grade || '-')}</b></td></tr>`).join('');
  root.innerHTML = `<div class="head"><h1>Profil Skill Tim</h1>
      <select id="team" aria-label="Pilih tim">${teams.map((t) => `<option ${t.team_code === rep.team ? 'selected' : ''}>${esc(t.team_code)}</option>`).join('')}</select>
      <span class="chip">${rep.sessions.length} sesi selesai</span><span style="flex:1"></span>
      <button class="btn btn-white btn-sm" id="out">Keluar</button></div>
    <div class="rolegrid">${roleCards}</div>
    <div class="panel" style="padding:24px 18px 14px"><span class="tag tag-orange">Gap tim</span>
      ${gaps.length ? gaps.map((g) => `<div class="gap">${esc(g)}</div>`).join('<div style="height:6px"></div>') : '<p style="font-weight:800;margin:0">Belum ada gap di bawah 60.</p>'}</div>
    <h2>Per orang</h2><div class="players">${pcards || '<p>Belum ada skor.</p>'}</div>
    <div class="grid2">
      <div class="panel" style="padding:24px 18px 14px"><span class="tag tag-green">Peta oper tugas</span>
        <table class="t"><tr><th>Dari</th><th>Divisi</th><th>Ke</th><th>Total</th><th>Cepat</th><th>Via WA</th></tr>${hand || '<tr><td colspan="6">-</td></tr>'}</table></div>
      <div class="panel" style="padding:24px 18px 14px"><span class="tag tag-blue">Riwayat sesi</span>
        <table class="t"><tr><th>Waktu</th><th>Mode</th><th>Skor</th></tr>${sessions || '<tr><td colspan="3">-</td></tr>'}</table></div>
    </div>
    <div class="panel" style="padding:24px 18px 14px"><span class="tag tag-orange">Cacat AI yang lolos ke tayang</span>
      <table class="t"><tr><th>Yang meloloskan</th><th>Divisi</th><th>Cacat</th><th>Brand</th><th>Review oleh</th><th>Waktu</th></tr>${leaks || '<tr><td colspan="6">Belum ada.</td></tr>'}</table></div>`;
  document.querySelector('#team').addEventListener('change', (e) => load(e.target.value));
  document.querySelector('#out').addEventListener('click', () => { sessionStorage.removeItem('sr_admin'); code = ''; loginView(); });
}

if (code) load(); else loginView();
