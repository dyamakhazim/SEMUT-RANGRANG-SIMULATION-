// Server: file statis + WebSocket room + API dashboard BOD.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game } from './game.js';
import { openDb } from './db.js';
import { SKILLS, aggregate, labelsFor } from './skills.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const ADMIN_CODE = process.env.ADMIN_CODE || 'RANGRANG-BOD';
const db = openDb(process.env.DB_FILE || join(ROOT, 'data', 'semut.db'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
};

const rooms = new Map(); // code -> { game, sockets: Map<playerId, ws> }

function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do c = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  while (rooms.has(c));
  return c;
}

function createRoom(teamCode) {
  const code = roomCode();
  const room = { sockets: new Map() };
  room.game = new Game({
    code, teamCode, db,
    send(to, msg) {
      const data = JSON.stringify(msg);
      if (to) { const ws = room.sockets.get(to); if (ws?.readyState === 1) ws.send(data); return; }
      for (const ws of room.sockets.values()) if (ws.readyState === 1) ws.send(data);
    },
  });
  rooms.set(code, room);
  return room;
}

const clean = (s, n) => String(s ?? '').trim().slice(0, n);
const codeClean = (s) => clean(s, 20).toUpperCase().replace(/[^A-Z0-9-]/g, '');

// ---------- HTTP ----------

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function teamReport(team) {
  const players = db.teamPlayers(team);
  const scores = db.teamScores(team);
  const sessions = db.teamSessions(team);
  const handoffs = db.teamHandoffs(team);
  const leaks = db.teamLeaks(team);
  const byPlayer = players.map((p) => {
    const ss = scores.filter((s) => s.player_code === p.player_code);
    const agg = aggregate(ss);
    const last = ss[ss.length - 1];
    return {
      code: p.player_code, name: p.name, color: p.color, role: last?.role || p.last_role,
      sessions: ss.length, skills: agg,
      trend: ss.map((s) => ({ ts: s.ts, skills: s.skills, role: s.role })),
      labels: last ? labelsFor(last.skills, last.stats) : [],
      lastSeen: p.last_seen,
      totals: ss.reduce((acc, s) => {
        for (const k of ['caught', 'leaked', 'handoffs', 'waThrows', 'aiGate', 'aiGood', 'dataViews']) acc[k] = (acc[k] || 0) + (s.stats[k] || 0);
        return acc;
      }, {}),
    };
  });
  const roles = {};
  for (const r of ['bod', 'pm', 'dist', 'creative']) {
    const ps = byPlayer.filter((p) => p.role === r && p.sessions);
    const avg = {};
    for (const k of SKILLS.map((x) => x.id)) {
      const vs = ps.map((p) => p.skills[k]).filter((v) => v != null);
      avg[k] = vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
    }
    roles[r] = { players: ps.length, skills: avg };
  }
  const matrix = {};
  for (const h of handoffs) {
    const key = `${h.player_code}→${h.payload.to_role}`;
    matrix[key] = matrix[key] || { from: h.player_code, fromRole: h.role, to: h.payload.to_role, n: 0, fast: 0, wa: 0 };
    matrix[key].n++;
    if (h.payload.fast) matrix[key].fast++;
    if (h.payload.via === 'wa') matrix[key].wa++;
  }
  return {
    team, skills: SKILLS, players: byPlayer, roles, handoffs: Object.values(matrix),
    leaks: leaks.map((l) => ({ player: l.player_code, role: l.role, type: l.payload.type, brand: l.payload.brand, by: l.payload.reviewedBy, ts: l.ts })),
    sessions: sessions.map((s) => ({ id: s.id, mode: s.mode, weeks: s.weeks, started: s.started_at, ended: s.ended_at, grade: s.result?.grade })),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/admin/')) {
      if (url.searchParams.get('code') !== ADMIN_CODE) return json(res, 401, { error: 'Kode admin salah.' });
      if (url.pathname === '/api/admin/teams') return json(res, 200, { teams: db.teams() });
      const m = url.pathname.match(/^\/api\/admin\/team\/([A-Z0-9-]+)$/);
      if (m) return json(res, 200, teamReport(m[1]));
      return json(res, 404, { error: 'not found' });
    }
    if (url.pathname === '/health') return json(res, 200, { ok: true, rooms: rooms.size });
    let path = url.pathname === '/' ? '/client/index.html' : url.pathname === '/admin' ? '/client/admin.html' : url.pathname;
    if (!path.startsWith('/client/') && !path.startsWith('/shared/')) path = '/client' + path;
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const st = await stat(file).catch(() => null);
    if (!st?.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(await readFile(file));
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end();
  }
});

// ---------- WebSocket ----------

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws) => {
  let room = null;
  let pid = null;
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!room) {
      if (m.t !== 'hello') return;
      const playerCode = codeClean(m.playerCode);
      const teamCode = codeClean(m.teamCode) || 'SEMUT';
      if (!playerCode) return ws.send(JSON.stringify({ t: 'error', text: 'Isi kode pemain dulu.' }));
      let r;
      if (m.create) r = createRoom(teamCode);
      else {
        r = rooms.get(codeClean(m.room));
        if (!r) return ws.send(JSON.stringify({ t: 'error', text: 'Room nggak ketemu. Cek lagi kodenya.' }));
      }
      const out = r.game.join({ playerCode, name: clean(m.name, 24), color: clean(m.color, 9) });
      if (out.error) return ws.send(JSON.stringify({ t: 'error', text: out.error }));
      room = r;
      pid = out.player.id;
      room.sockets.set(pid, ws);
      ws.send(JSON.stringify({ t: 'welcome', you: pid, room: room.game.code, team: room.game.teamCode }));
      ws.send(JSON.stringify(room.game.publicState()));
      return;
    }
    if (m.t === 'act') room.game.handle(pid, m);
  });
  ws.on('close', () => {
    if (room && pid && room.sockets.get(pid) === ws) {
      room.sockets.delete(pid);
      room.game.leave(pid);
    }
  });
});

// ---------- loop ----------

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - last) / 1000;
  last = now;
  for (const [code, room] of rooms) {
    const g = room.game;
    try { g.tick(dt); } catch (e) { console.error('tick', code, e); }
    if (g.posDirty) {
      g.posDirty = false;
      g.send(null, { t: 'pos', p: g.positions() });
    }
    if (g.dirty && now - g.lastBroadcast > 150) {
      g.dirty = false;
      g.lastBroadcast = now;
      g.send(null, g.publicState());
    }
    if (g.emptySince && now - g.emptySince > 10 * 60 * 1000) rooms.delete(code);
  }
}, 100);

server.listen(PORT, () => console.log(`Semut Rangrang jalan di http://localhost:${PORT}  (dashboard BOD: /admin)`));
