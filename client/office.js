// Gambar kantor (canvas) + gerak pemain.
import { WORLD, WALL, ZONES, OBSTACLES, PLANTS, PLAYER_R, blocked, inZone } from '/shared/map.js';
import { ROLES } from '/shared/content.js';

const SPEED = 270;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function leaf(ctx, x, y, len, ang, fill, vein) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = vein;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(len - 4, 0);
  ctx.stroke();
  ctx.restore();
}

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const ROOM_STYLE = {
  meeting: { floor: '#E8D3A6', rug: '#9FCB7A', border: '#7DB356' },
  board: null,
  server: { floor: '#C9D5DE', rug: '#A7BCCB', border: '#6E8CA3' },
  creative: { floor: null, rug: '#BFD9F7', border: '#8EC1FF' },
  pm: { floor: null, rug: '#CFEBBB', border: '#9AD86E' },
  dist: { floor: null, rug: '#FFE9A8', border: '#FFD966' },
  bod: { floor: null, rug: '#FFD2AE', border: '#F6A15A' },
  freelance: { floor: null, rug: '#E2D6CB', border: '#C9B8A6' },
  pantry: { floor: '#F3E2C2', rug: '#F6C9A0', border: '#E3A26B' },
};

export function renderStatic() {
  const scale = 2;
  const c = document.createElement('canvas');
  c.width = WORLD.w * scale;
  c.height = WORLD.h * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  const rnd = seeded(42);

  // lantai kayu
  ctx.fillStyle = '#D9A86C';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let y = 0; y < WORLD.h; y += 28) {
    ctx.fillStyle = (y / 28) % 2 ? '#D3A064' : '#DCAD72';
    ctx.fillRect(0, y, WORLD.w, 28);
    ctx.strokeStyle = 'rgba(120, 72, 30, .22)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke();
    const off = (y / 28) % 2 ? 0 : 90;
    for (let x = off; x < WORLD.w; x += 180) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 28); ctx.stroke(); }
  }

  // ruangan / area
  for (const [id, z] of Object.entries(ZONES)) {
    const st = ROOM_STYLE[id];
    if (!st) continue;
    if (st.floor) { ctx.fillStyle = st.floor; rr(ctx, z.x, z.y, z.w, z.h, 22); ctx.fill(); }
    ctx.fillStyle = st.rug;
    rr(ctx, z.x + 14, z.y + 14, z.w - 28, z.h - 28, 26);
    ctx.fill();
    ctx.strokeStyle = st.border;
    ctx.lineWidth = 5;
    ctx.setLineDash([2, 10]);
    ctx.lineCap = 'round';
    rr(ctx, z.x + 22, z.y + 22, z.w - 44, z.h - 44, 20);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // pembatas kaca ruang meeting & server (garis tipis bambu)
  for (const id of ['meeting', 'server', 'pantry']) {
    const z = ZONES[id];
    ctx.strokeStyle = '#8A6A3E';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (id === 'pantry') { ctx.moveTo(z.x, z.y); ctx.lineTo(z.x + z.w * 0.35, z.y); ctx.moveTo(z.x + z.w * 0.7, z.y); ctx.lineTo(z.x + z.w, z.y); ctx.lineTo(z.x + z.w, z.y + z.h * 0.45); }
    else { ctx.moveTo(z.x, z.y + z.h); ctx.lineTo(z.x + z.w * 0.35, z.y + z.h); ctx.moveTo(z.x + z.w * 0.7, z.y + z.h); ctx.lineTo(z.x + z.w, z.y + z.h); }
    ctx.stroke();
  }

  // papan tugas di dinding
  const bz = ZONES.board;
  ctx.fillStyle = '#7A4A22';
  rr(ctx, bz.x + 10, WALL - 6, bz.w - 20, 70, 14); ctx.fill();
  ctx.fillStyle = '#C89A62';
  rr(ctx, bz.x + 18, WALL, bz.w - 36, 56, 10); ctx.fill();
  const notes = ['#FFF3A8', '#FFC9E3', '#BDE6FF', '#C9F2B5', '#FFD9A8'];
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = notes[i % notes.length];
    const nx = bz.x + 30 + (i % 7) * 44 + rnd() * 6;
    const ny = WALL + 6 + Math.floor(i / 7) * 24 + rnd() * 3;
    ctx.save(); ctx.translate(nx, ny); ctx.rotate((rnd() - 0.5) * 0.2); ctx.fillRect(0, 0, 30, 18); ctx.restore();
  }

  // furnitur
  for (const o of OBSTACLES) drawFurniture(ctx, o, rnd);

  // tanaman
  for (const [x, y] of PLANTS) drawPlant(ctx, x, y, rnd);

  // dinding anyaman daun
  const greens = ['#4E9A2F', '#5DB33A', '#3F8526', '#6CC244', '#468F2A'];
  ctx.fillStyle = '#2F6B1C';
  ctx.fillRect(0, 0, WORLD.w, WALL); ctx.fillRect(0, WORLD.h - WALL, WORLD.w, WALL);
  ctx.fillRect(0, 0, WALL, WORLD.h); ctx.fillRect(WORLD.w - WALL, 0, WALL, WORLD.h);
  const edge = (x0, y0, x1, y1, n) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      for (let k = 0; k < 2; k++) leaf(ctx, x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16, 34 + rnd() * 16, rnd() * Math.PI * 2, greens[Math.floor(rnd() * greens.length)], 'rgba(255,255,255,.35)');
    }
  };
  edge(0, WALL / 2, WORLD.w, WALL / 2, 60);
  edge(0, WORLD.h - WALL / 2, WORLD.w, WORLD.h - WALL / 2, 60);
  edge(WALL / 2, 0, WALL / 2, WORLD.h, 40);
  edge(WORLD.w - WALL / 2, 0, WORLD.w - WALL / 2, WORLD.h, 40);
  // lampu gantung
  for (let x = 80; x < WORLD.w - 40; x += 70) {
    ctx.fillStyle = 'rgba(255, 230, 140, .9)';
    ctx.beginPath(); ctx.arc(x, WALL + 4 + Math.sin(x) * 3, 5, 0, Math.PI * 2); ctx.fill();
  }

  // papan nama area
  for (const [id, z] of Object.entries(ZONES)) {
    if (id === 'board') continue;
    const label = z.label.toUpperCase();
    ctx.font = '800 15px "Baloo 2", sans-serif';
    const w = ctx.measureText(label).width + 26;
    const x = z.x + z.w / 2 - w / 2;
    const y = z.y + (id === 'pantry' ? z.h - 40 : 6);
    ctx.fillStyle = '#7A4A22';
    rr(ctx, x, y + 3, w, 26, 8); ctx.fill();
    ctx.fillStyle = '#B97E45';
    rr(ctx, x, y, w, 26, 8); ctx.fill();
    ctx.fillStyle = '#FFF8E7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + 14);
  }
  return { canvas: c, scale };
}

function drawPlant(ctx, x, y, rnd) {
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath(); ctx.ellipse(x, y + 14, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#C8743A';
  rr(ctx, x - 13, y - 2, 26, 18, 6); ctx.fill();
  for (let i = 0; i < 7; i++) leaf(ctx, x, y - 2, 22 + rnd() * 10, -Math.PI / 2 + (i - 3) * 0.42, i % 2 ? '#5DB33A' : '#7CCB4A', 'rgba(255,255,255,.4)');
}

function drawFurniture(ctx, o, rnd) {
  const { x, y, w, h, type } = o;
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  rr(ctx, x + 4, y + 8, w, h, 12); ctx.fill();
  if (type === 'desk' || type === 'bigDesk') {
    ctx.fillStyle = '#8A5A2E'; rr(ctx, x, y + 6, w, h, 10); ctx.fill();
    ctx.fillStyle = type === 'bigDesk' ? '#B5763C' : '#C68B4E'; rr(ctx, x, y, w, h - 4, 10); ctx.fill();
    // laptop
    ctx.fillStyle = '#5B6470'; rr(ctx, x + w / 2 - 18, y + 6, 36, 22, 4); ctx.fill();
    ctx.fillStyle = '#9FD3FF'; rr(ctx, x + w / 2 - 15, y + 8, 30, 16, 3); ctx.fill();
    // tanaman kecil & gelas
    ctx.fillStyle = '#FFF8E7'; ctx.beginPath(); ctx.arc(x + 14, y + 14, 6, 0, Math.PI * 2); ctx.fill();
    leaf(ctx, x + w - 14, y + 18, 14, -Math.PI / 2 - 0.4, '#5DB33A', 'rgba(255,255,255,.4)');
    leaf(ctx, x + w - 14, y + 18, 14, -Math.PI / 2 + 0.4, '#7CCB4A', 'rgba(255,255,255,.4)');
    // kursi
    ctx.fillStyle = '#6FAE4A'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + 14, 16, 11, 0, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'leafTable') {
    ctx.fillStyle = '#3F8526'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 6, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6CC244'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 14, y + h / 2); ctx.lineTo(x + w - 14, y + h / 2); ctx.stroke();
    for (let i = 1; i < 6; i++) { const px = x + (w / 6) * i; ctx.beginPath(); ctx.moveTo(px, y + h / 2); ctx.lineTo(px + 18, y + 12); ctx.moveTo(px, y + h / 2); ctx.lineTo(px + 18, y + h - 12); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#FFF8E7'; ctx.beginPath(); ctx.arc(x + 40 + i * 48, y + 22 + (i % 2) * 40, 6, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'rack') {
    ctx.fillStyle = '#2C3E57'; rr(ctx, x, y, w, h, 8); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#7FD8FF' : '#9BF0B0'; ctx.fillRect(x + 10, y + 8 + i * 11, w - 20, 4); }
  } else if (type === 'counter') {
    ctx.fillStyle = '#8A5A2E'; rr(ctx, x, y + 6, w, h, 10); ctx.fill();
    ctx.fillStyle = '#E9D8B4'; rr(ctx, x, y, w, h - 4, 10); ctx.fill();
    ctx.fillStyle = '#5B6470'; rr(ctx, x + 20, y + 6, 40, 30, 6); ctx.fill();
    ctx.fillStyle = '#C0392B'; ctx.beginPath(); ctx.arc(x + 40, y + 22, 6, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#FFF8E7'; ctx.beginPath(); ctx.arc(x + 100 + i * 34, y + 22, 9, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'fridge') {
    ctx.fillStyle = '#BFE3EE'; rr(ctx, x, y, w, h, 10); ctx.fill();
    ctx.fillStyle = '#9CC8D6'; ctx.fillRect(x + 6, y + h * 0.4, w - 12, 3);
  } else if (type === 'roundTable') {
    ctx.fillStyle = '#B5763C'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 5, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#D69A5C'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF8E7'; ctx.beginPath(); ctx.arc(x + w / 2 - 20, y + h / 2, 8, 0, Math.PI * 2); ctx.arc(x + w / 2 + 22, y + h / 2 - 6, 8, 0, Math.PI * 2); ctx.fill();
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export function drawAnt(ctx, x, y, o) {
  const { color = '#F27A2A', shirt = '#ffffff', dir = 'down', t = 0, moving = false, s = 1, sitting = false } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bob = moving ? Math.sin(t * 14) * 2 : Math.sin(t * 2) * 0.6;
  const swing = moving ? Math.sin(t * 14) * 5 : 0;
  const side = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  // bayangan
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(0, 2, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
  // perut (abdomen) di belakang
  ctx.fillStyle = shade(color, -18);
  ctx.beginPath(); ctx.ellipse(-side * 10, -14 + bob * 0.5, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
  // kaki
  ctx.strokeStyle = shade(color, -55);
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  if (!sitting) {
    ctx.beginPath(); ctx.moveTo(-5, -12 + bob); ctx.lineTo(-7 + swing * 0.6, 0);
    ctx.moveTo(5, -12 + bob); ctx.lineTo(7 - swing * 0.6, 0); ctx.stroke();
  }
  // badan/kemeja
  ctx.fillStyle = shirt;
  rr(ctx, -10, -30 + bob, 20, 19, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  rr(ctx, -10, -30 + bob, 20, 5, 4); ctx.fill();
  // lengan
  ctx.strokeStyle = shade(color, -30);
  ctx.beginPath(); ctx.moveTo(-10, -25 + bob); ctx.lineTo(-15, -17 + bob - swing * 0.4);
  ctx.moveTo(10, -25 + bob); ctx.lineTo(15, -17 + bob + swing * 0.4); ctx.stroke();
  // kepala
  const hy = -44 + bob;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, hy, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath(); ctx.ellipse(-5, hy - 7, 6, 4, -0.4, 0, Math.PI * 2); ctx.fill();
  // antena
  ctx.strokeStyle = shade(color, -45);
  ctx.lineWidth = 2.5;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 6, hy - 12);
    ctx.quadraticCurveTo(sx * 12, hy - 30, sx * 18 + Math.sin(t * 3 + sx) * 2, hy - 26);
    ctx.stroke();
    ctx.fillStyle = shade(color, -10);
    ctx.beginPath(); ctx.arc(sx * 18 + Math.sin(t * 3 + sx) * 2, hy - 26, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // mata
  if (dir !== 'up') {
    const ex = side * 4;
    for (const sx of [-1, 1]) {
      if (side !== 0 && sx === -side) continue;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(ex + sx * 6, hy + 1, 4.6, 5.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2B1A10';
      ctx.beginPath(); ctx.arc(ex + sx * 6 + side * 1.2, hy + 2, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + sx * 6 + side * 1.2 + 1, hy + 0.8, 1, 0, Math.PI * 2); ctx.fill();
    }
    // pipi & senyum
    ctx.fillStyle = 'rgba(255, 120, 120, .35)';
    ctx.beginPath(); ctx.arc(ex - 9, hy + 7, 3, 0, Math.PI * 2); ctx.arc(ex + 9, hy + 7, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5A2A0E';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(ex, hy + 7, 3.5, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.restore();
}

function nameTag(ctx, x, y, text, roleColor) {
  ctx.font = '800 13px Nunito, sans-serif';
  const w = ctx.measureText(text).width + 30;
  ctx.fillStyle = 'rgba(255, 248, 231, .95)';
  rr(ctx, x - w / 2, y, w, 22, 11); ctx.fill();
  ctx.fillStyle = roleColor || '#C9B8A6';
  ctx.beginPath(); ctx.arc(x - w / 2 + 12, y + 11, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4A3222';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x - w / 2 + 22, y + 11.5);
}

function bubble(ctx, x, y, text) {
  ctx.font = '800 14px Nunito, sans-serif';
  const max = 220;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > max && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  const w = Math.min(max, Math.max(...shown.map((l) => ctx.measureText(l).width))) + 24;
  const h = shown.length * 18 + 14;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#4A3222';
  ctx.lineWidth = 3;
  rr(ctx, x - w / 2, y - h, w, h, 14); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x, y + 9); ctx.lineTo(x + 6, y - 1); ctx.fill();
  ctx.fillStyle = '#4A3222';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  shown.forEach((l, i) => ctx.fillText(l, x, y - h + 16 + i * 18));
}

export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = null;
    this.keys = new Set();
    this.me = { x: 800, y: 480, dir: 'down', moving: false };
    this.others = new Map();
    this.bubbles = new Map();
    this.lastSend = 0;
    this.t = 0;
    this.active = false;
    this.sendMove = () => {};
    this.overlay = () => ({});
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { this.keys.add(k); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - (this.lastTs || ts)) / 1000);
      this.lastTs = ts;
      if (this.active) { this.update(dt); this.draw(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  ensureBg() { if (!this.bg) this.bg = renderStatic(); }

  setMe(x, y) { this.me.x = x; this.me.y = y; }

  setPositions(list, myId) {
    const seen = new Set();
    for (const [id, x, y, dir, moving] of list) {
      seen.add(id);
      if (id === myId) { if (!this.me.init) { this.me.x = x; this.me.y = y; this.me.init = true; } continue; }
      const o = this.others.get(id) || { x, y };
      Object.assign(o, { tx: x, ty: y, dir, moving: !!moving });
      this.others.set(id, o);
    }
    for (const id of [...this.others.keys()]) if (!seen.has(id)) this.others.delete(id);
  }

  say(id, text) { this.bubbles.set(id, { text, until: performance.now() + 4500 }); }

  update(dt) {
    this.t += dt;
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) dx -= 1;
    if (k.has('arrowright') || k.has('d')) dx += 1;
    if (k.has('arrowup') || k.has('w')) dy -= 1;
    if (k.has('arrowdown') || k.has('s')) dy += 1;
    if (this.joy) { dx = this.joy.x; dy = this.joy.y; }
    const len = Math.hypot(dx, dy);
    const moving = len > 0.1;
    if (moving) {
      dx /= Math.max(1, len); dy /= Math.max(1, len);
      const nx = this.me.x + dx * SPEED * dt;
      const ny = this.me.y + dy * SPEED * dt;
      if (!blocked(nx, this.me.y)) this.me.x = nx;
      if (!blocked(this.me.x, ny)) this.me.y = ny;
      this.me.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    }
    const now = performance.now();
    if ((moving || this.me.moving !== moving) && now - this.lastSend > 80) {
      this.lastSend = now;
      this.me.moving = moving;
      this.sendMove(this.me);
    }
    for (const o of this.others.values()) {
      o.x += (o.tx - o.x) * Math.min(1, dt * 12);
      o.y += (o.ty - o.y) * Math.min(1, dt * 12);
    }
  }

  draw() {
    this.ensureBg();
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = this.ctx;
    const zoom = Math.max(W / 1150, H / 760, 0.55);
    const vw = W / zoom, vh = H / zoom;
    let cx = this.me.x - vw / 2, cy = this.me.y - vh / 2;
    cx = Math.max(Math.min(cx, WORLD.w - vw), Math.min(0, (WORLD.w - vw) / 2));
    cy = Math.max(Math.min(cy, WORLD.h - vh), Math.min(0, (WORLD.h - vh) / 2));
    if (vw > WORLD.w) cx = (WORLD.w - vw) / 2;
    if (vh > WORLD.h) cy = (WORLD.h - vh) / 2;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -cx * dpr * zoom, -cy * dpr * zoom);
    ctx.fillStyle = '#2E4A22';
    ctx.fillRect(cx, cy, vw, vh);
    ctx.drawImage(this.bg.canvas, 0, 0, WORLD.w, WORLD.h);

    const ov = this.overlay();
    // sorot meja sendiri & tujuan oper
    if (ov.myZone) this.glow(ZONES[ov.myZone], 'rgba(255, 240, 160, .30)', '#FFD23F');
    if (ov.targetZone) this.glow(ZONES[ov.targetZone], 'rgba(255, 170, 110, .30)', '#F27A2A');

    // NPC freelancer
    const fz = ZONES.freelance;
    const npcBusy = ov.npcBusy || 0;
    [[fz.x + 90, fz.y + 140], [fz.x + 250, fz.y + 140]].forEach(([x, y], i) => {
      drawAnt(ctx, x, y, { color: '#D98A4E', shirt: '#C9B8A6', dir: 'up', t: this.t + i, sitting: true });
      if (npcBusy > i) bubble(ctx, x, y - 70, '…');
    });

    // semua semut, urut berdasarkan y
    const ants = [];
    for (const [id, o] of this.others) ants.push({ id, x: o.x, y: o.y, dir: o.dir, moving: o.moving, me: false });
    ants.push({ id: ov.myId, x: this.me.x, y: this.me.y, dir: this.me.dir, moving: this.me.moving, me: true });
    ants.sort((a, b) => a.y - b.y);
    for (const a of ants) {
      const info = ov.players?.[a.id] || {};
      const shirt = info.role ? ROLES[info.role].color : '#ffffff';
      if (a.me) {
        ctx.strokeStyle = 'rgba(255, 210, 63, .9)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 22, 8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      drawAnt(ctx, a.x, a.y, { color: info.color || '#F27A2A', shirt, dir: a.dir, t: this.t + (a.x % 7), moving: a.moving });
      nameTag(ctx, a.x, a.y + 8, `${info.name || '?'}${info.role ? ' · ' + (ROLES[info.role].short || ROLES[info.role].name) : ''}`, shirt);
      let top = a.y - 78;
      if (info.locked) { bubble(ctx, a.x, top, 'Zzz… izin istirahat'); top -= 50; }
      if (info.carry) { this.leafIcon(ctx, a.x, top, info.carry); top -= 34; }
      if (info.working != null) { this.ring(ctx, a.x + 24, a.y - 56, info.working, info.workingAi); }
      const b = this.bubbles.get(a.id);
      if (b && b.until > performance.now()) bubble(ctx, a.x, top, b.text);
    }

    // panah ke tujuan oper
    if (ov.targetZone) {
      const z = ZONES[ov.targetZone];
      const tx = z.x + z.w / 2, ty = z.y + z.h / 2;
      const d = Math.hypot(tx - this.me.x, ty - this.me.y);
      if (d > 140) {
        const ang = Math.atan2(ty - this.me.y, tx - this.me.x);
        const ax = this.me.x + Math.cos(ang) * 60, ay = this.me.y - 30 + Math.sin(ang) * 60;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
        ctx.fillStyle = '#F27A2A'; ctx.strokeStyle = '#5A2A0E'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }

  glow(z, fill, stroke) {
    const ctx = this.ctx;
    const pulse = 0.6 + Math.sin(this.t * 4) * 0.4;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = fill;
    rr(ctx, z.x + 8, z.y + 8, z.w - 16, z.h - 16, 24); ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }

  leafIcon(ctx, x, y, n) {
    leaf(ctx, x - 16, y, 32, -0.3, '#5DB33A', 'rgba(255,255,255,.6)');
    if (n > 1) {
      ctx.fillStyle = '#F27A2A';
      ctx.beginPath(); ctx.arc(x + 14, y - 10, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 12px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), x + 14, y - 9);
    }
  }

  ring(ctx, x, y, p, ai) {
    ctx.fillStyle = '#FFF8E7';
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ai ? '#3E8EF7' : '#367A1C';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
  }

  zone() {
    for (const [id, z] of Object.entries(ZONES)) if (inZone(z, this.me.x, this.me.y, 30)) return id;
    return null;
  }

  near(x, y, r) { return Math.hypot(x - this.me.x, y - this.me.y) < r; }
}

export { PLAYER_R };
