// Simulasi headless: 4 bot (satu per divisi) main 1 bulan penuh langsung lewat kelas Game.
import { Game } from '../server/game.js';
import { openDb } from '../server/db.js';
import { ZONES, ROLE_ZONE } from '../shared/map.js';
import { computeSkills } from '../server/skills.js';
import assert from 'node:assert/strict';

const db = openDb(':memory:');
const toasts = [];
const g = new Game({ code: 'TEST', teamCode: 'SIM', db, send: (to, m) => { if (m.t === 'toast') toasts.push(m.text); } });
const roles = ['bod', 'pm', 'dist', 'creative'];
for (const r of roles) {
  g.join({ playerCode: `BOT-${r.toUpperCase()}`, name: r, color: '#F27A2A' });
  g.handle(`BOT-${r.toUpperCase()}`, { a: 'role', role: r });
}
const host = 'BOT-BOD';
g.handle(host, { a: 'settings', mode: 'full', speed: 'test' });
g.handle(host, { a: 'start' });
assert.equal(g.phase, 'brainstorm');

const center = (z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
const goto = (id, zoneId) => { const c = center(ZONES[zoneId]); g.handle(id, { a: 'move', x: c.x, y: c.y }); };
for (const r of roles) goto(`BOT-${r.toUpperCase()}`, ROLE_ZONE[r]);

let t = Date.now();
const step = () => { const now = Date.now(); g.tick((now - t) / 1000); t = now; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function brainstormBot() {
  for (const b of Object.values(g.brands)) {
    g.handle('BOT-BOD', { a: 'data', key: b.id });
    g.handle('BOT-BOD', { a: 'vote', brand: b.id, idx: 0 });
    g.handle('BOT-PM', { a: 'vote', brand: b.id, idx: 0 });
    g.handle('BOT-CREATIVE', { a: 'rule', brand: b.id, id: (g.brands[b.id] && b.id[0]) + '1', on: true });
    if (g.week === 1) for (let i = 0; i < 5; i++) g.handle('BOT-DIST', { a: 'army', brand: b.id, delta: 1 });
    if (g.week === 2) g.handle('BOT-DIST', { a: 'persona', brand: b.id, id: 'a' });
    if (g.week === 3) for (let i = 0; i < 20; i++) g.handle('BOT-BOD', { a: 'alloc', brand: b.id, fmt: 'video', delta: 1 });
  }
  for (const r of roles) g.handle(`BOT-${r.toUpperCase()}`, { a: 'ready' });
}

function productionBot() {
  for (const task of g.tasks) {
    const stepName = task.chain[task.stepIdx];
    if (task.status === 'carry') {
      const holder = task.holder;
      const nextRole = { budget: 'bod', concept: 'bod', persona_brief: 'dist', produce: 'creative', review: 'pm', revise: 'creative', schedule: 'dist' }[stepName];
      goto(holder, ROLE_ZONE[nextRole]);
      g.handle(holder, { a: 'deliver', task: task.id });
      const h = g.players.get(holder);
      goto(holder, ROLE_ZONE[h.role]);
      continue;
    }
    if (task.status !== 'waiting') continue;
    const id = { budget: 'BOT-BOD', concept: 'BOT-BOD', persona_brief: 'BOT-DIST', produce: 'BOT-CREATIVE', review: 'BOT-PM', revise: 'BOT-CREATIVE', schedule: 'BOT-DIST' }[stepName];
    if (stepName === 'budget') g.handle(id, { a: 'approve', task: task.id, method: 'manual' });
    else if (stepName === 'concept') g.handle(id, { a: 'concept', task: task.id, idx: 0 });
    else if (stepName === 'produce' || stepName === 'persona_brief' || stepName === 'revise') g.handle(id, { a: 'work', task: task.id, method: 'ai' });
    else if (stepName === 'review') {
      const next = ['listen_vo', 'read_claims', 'check_faces', 'watch_full'].find((c) => !task.checksDone.includes(c));
      if (next) g.handle(id, { a: 'check', task: task.id, check: next });
      else if (task.defects.some((d) => d.found && !d.fixed && !d.unfixable)) g.handle(id, { a: 'review_revise', task: task.id });
      else g.handle(id, { a: 'review_pass', task: task.id });
    } else if (stepName === 'schedule') {
      if (task.sub === 'start') { g.handle(id, { a: 'sched_data', task: task.id }); g.handle(id, { a: 'work', task: task.id, method: 'ai' }); }
      else if (task.sub === 'confirm' && !task.hashtagChecked) g.handle(id, { a: 'hashtag', task: task.id });
      else if (task.sub === 'confirm') g.handle(id, { a: 'finish', task: task.id });
    }
  }
  for (const ev of g.events) {
    const id = `BOT-${ev.role.toUpperCase()}`;
    g.handle(id, { a: 'event', event: ev.uid, choice: 0 });
  }
}

const phases = [];
const deadline = Date.now() + 120000;
while (g.phase !== 'ended' && Date.now() < deadline) {
  if (phases[phases.length - 1] !== g.phase) phases.push(g.phase);
  if (g.phase === 'brainstorm') brainstormBot();
  if (g.phase === 'production') productionBot();
  if (g.phase === 'gate4') {
    for (const task of g.tasks.filter((x) => x.status === 'done')) g.handle('BOT-PM', { a: 'air', task: task.id, ok: true });
    g.handle('BOT-PM', { a: 'go' });
  }
  if (g.phase === 'results') for (const r of roles) g.handle(`BOT-${r.toUpperCase()}`, { a: 'ready' });
  if (g.phase === 'report') {
    for (const r of roles) g.handle(`BOT-${r.toUpperCase()}`, { a: 'insight', choice: 0, text: 'test' });
  }
  step();
  JSON.stringify(g.publicState());
  await sleep(20);
}

console.log('phases:', phases.join(' → '));
assert.equal(g.phase, 'ended', 'game should reach ended');
console.log('week results:');
for (const r of g.weekResults) {
  console.log(` W${r.week}:`, Object.entries(r.brands).map(([b, x]) => `${b} aired=${x.aired} late=${x.late} out=${x.output} er=${x.er} trust=${x.trustBefore}->${x.trustAfter} leaks=${x.leaked.length}`).join(' | '));
}
console.log('final grade:', g.final.grade, 'month:', JSON.stringify(g.final.month));
for (const p of g.players.values()) console.log(p.id, JSON.stringify(computeSkills(p.stats)));
const lates = g.weekResults.flatMap((r) => Object.values(r.brands)).reduce((s, x) => s + x.late, 0);
assert.ok(lates <= 4, `too many late tasks: ${lates}`);
console.log('OK');
process.exit(0);
