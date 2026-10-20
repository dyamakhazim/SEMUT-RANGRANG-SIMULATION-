// Simulasi satu room: lobby → (brainstorm → production → gate4 → results) × minggu → report → ended.
import {
  ROLES, ROLE_IDS, BRANDS, BRAND, WEEKS, CHAINS, STEPS, DEFECTS, CHECKS, RULES, HOOKS, PERSONAS,
  FORMATS, FORMAT_ER, CONCEPTS, EVENTS, SPEEDS, TIMING, CREDITS_PER_WEEK, AI_COST,
} from '../shared/content.js';
import { ZONES, ROLE_ZONE, SPAWN, inZone } from '../shared/map.js';
import { newStats, computeSkills, labelsFor } from './skills.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const ARMY_RATE = Object.fromEntries(BRANDS.map((b) => [b.id, 200 / b.armyNeed]));
const HOOK_ER = { good: 1.2, kaku: -0.8, risky: 0.2 };

const CAUSES = {
  leak: 'Cacat AI lolos ke tayang karena review kurang teliti',
  late: 'Ada batch yang telat dan nggak sempat tayang',
  army: 'Pembagian akun Army nggak sesuai kebutuhan di data',
  persona: 'Persona yang dipilih nggak cocok dengan target audiens',
  alloc: 'Alokasi konten inisiatif nggak ngikutin data format terbaik',
  hook: 'Hook yang dipilih kaku atau berisiko',
  events: 'Event klien ditangani dengan buruk atau dibiarkan',
  fine: 'Eksekusi sudah sesuai data, tinggal dipertahankan',
};

export class Game {
  constructor({ code, teamCode, db, send }) {
    this.code = code;
    this.teamCode = teamCode;
    this.db = db;
    this.send = send; // send(playerId | null, msg)
    this.players = new Map();
    this.hostId = null;
    this.phase = 'lobby';
    this.settings = { mode: 'quick', week: 1, speed: 'normal' };
    this.dirty = true;
    this.posDirty = true;
    this.lastBroadcast = 0;
    this.taskSeq = 0;
    this.eventSeq = 0;
    this.emptySince = null;
  }

  get f() { return SPEEDS[this.settings.speed]?.f ?? 1; }
  get week() { return this.weeks ? this.weeks[this.weekIdx] : null; }

  // ---------- pemain ----------

  join({ playerCode, name, color }) {
    let p = this.players.get(playerCode);
    if (p) {
      if (p.connected) return { error: 'Kode pemain ini sedang dipakai di room ini.' };
      p.connected = true;
      p.name = name || p.name;
      p.color = color || p.color;
    } else {
      if (this.players.size >= 12) return { error: 'Room penuh (maks 12 semut).' };
      p = {
        id: playerCode, playerCode, name: name || playerCode, color: color || '#F27A2A', role: null,
        x: SPAWN.x + rand(-40, 40), y: SPAWN.y + rand(-30, 30), dir: 'down', moving: false,
        connected: true, stress: 0, lockedUntil: 0, ready: false, dataSeen: {}, stats: newStats(), chatTimes: [],
      };
      this.players.set(playerCode, p);
    }
    if (!this.hostId || !this.players.get(this.hostId)?.connected) this.hostId = p.id;
    this.emptySince = null;
    this.posDirty = true;
    this.db?.upsertPlayer({ ...p, teamCode: this.teamCode });
    this.dirty = true;
    return { player: p };
  }

  leave(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
    if (this.phase === 'lobby') this.players.delete(id);
    if (this.hostId === id) {
      const next = [...this.players.values()].find((x) => x.connected);
      this.hostId = next ? next.id : null;
    }
    if (![...this.players.values()].some((x) => x.connected)) this.emptySince = Date.now();
    this.dirty = true;
  }

  humans(role) {
    return [...this.players.values()].filter((p) => p.connected && p.role && (!role || p.role === role));
  }

  roleHasHuman(role) { return this.humans(role).length > 0; }

  toast(text, kind = 'info', to = null) { this.send(to, { t: 'toast', text, kind }); }

  log(p, type, payload = {}) {
    this.db?.logEvent({
      session: this.sessionId, team: this.teamCode, player: p?.playerCode ?? null, role: p?.role ?? null,
      week: this.week, day: this.day ?? null, type, payload,
    });
  }

  markData(p, key) {
    p.dataSeen[key] = Date.now();
    p.stats.dataViews++;
    this.log(p, 'data_view', { key, phase: this.phase });
  }

  informed(p, key) {
    const t = p.dataSeen[key];
    return !!t && t >= (this.phaseStartedAt ?? 0);
  }

  decision(p, key, aligned, extra = {}) {
    const inf = this.informed(p, key);
    p.stats.decisions++;
    if (inf) p.stats.informed++;
    if (aligned != null) { p.stats.alignedSum += aligned; p.stats.alignedN++; }
    this.log(p, 'decision', { key, informed: inf, aligned, ...extra });
  }

  // ---------- pesan dari client ----------

  handle(id, m) {
    const p = this.players.get(id);
    if (!p) return;
    const a = m.a;

    if (a === 'move') {
      if (typeof m.x === 'number' && typeof m.y === 'number') {
        p.x = clamp(m.x, 0, 1600); p.y = clamp(m.y, 0, 1000); p.dir = m.dir || p.dir; p.moving = !!m.moving;
        this.posDirty = true;
      }
      return;
    }
    if (a === 'chat') return this.chat(p, m);
    if (a === 'data') { this.markData(p, String(m.key || 'all')); return; }

    if (this.phase === 'lobby') return this.lobbyAction(p, m);
    if (Date.now() < p.lockedUntil && a !== 'ready') {
      this.toast('Kamu lagi izin istirahat sebentar. Jalan ke pantry dulu ya.', 'warn', p.id);
      return;
    }
    if (this.phase === 'brainstorm') return this.brainstormAction(p, m);
    if (this.phase === 'production') return this.productionAction(p, m);
    if (this.phase === 'gate4') return this.gate4Action(p, m);
    if (this.phase === 'results') { if (a === 'ready') { p.ready = true; this.dirty = true; } return; }
    if (this.phase === 'report') return this.reportAction(p, m);
    if (this.phase === 'ended' && a === 'restart' && p.id === this.hostId) this.restart();
  }

  chat(p, m) {
    const text = String(m.text || '').trim().slice(0, 200);
    if (!text) return;
    const now = Date.now();
    p.chatTimes = p.chatTimes.filter((t) => now - t < 10000);
    p.chatTimes.push(now);
    p.stats.chats++;
    if (p.chatTimes.length > 4) {
      p.stats.spam++;
      this.feromon = clamp((this.feromon ?? 60) - 1, 0, 100);
      this.dirty = true;
    }
    const ch = m.ch === 'wa' ? 'wa' : 'near';
    const msg = { t: 'chat', ch, from: p.id, name: p.name, role: p.role, text, at: now };
    if (ch === 'wa' || this.phase !== 'production') {
      this.send(null, msg);
    } else {
      for (const q of this.players.values()) {
        if (q.connected && Math.hypot(q.x - p.x, q.y - p.y) < 280) this.send(q.id, msg);
      }
    }
    this.log(p, 'chat', { ch, len: text.length });
  }

  lobbyAction(p, m) {
    if (m.a === 'role' && (ROLE_IDS.includes(m.role) || m.role === null)) {
      p.role = m.role;
      this.db?.upsertPlayer({ ...p, teamCode: this.teamCode });
    } else if (m.a === 'settings' && p.id === this.hostId) {
      if (m.mode === 'quick' || m.mode === 'full') this.settings.mode = m.mode;
      if ([1, 2, 3].includes(m.week)) this.settings.week = m.week;
      if (SPEEDS[m.speed]) this.settings.speed = m.speed;
    } else if (m.a === 'start' && p.id === this.hostId) {
      if (!this.humans().length) return this.toast('Pilih divisi dulu sebelum mulai.', 'warn', p.id);
      this.start();
    }
    this.dirty = true;
  }

  // ---------- alur run ----------

  start() {
    this.sessionId = `s_${Date.now().toString(36)}_${this.code}`;
    this.weeks = this.settings.mode === 'full' ? [1, 2, 3] : [this.settings.week];
    this.weekIdx = 0;
    this.feromon = 60;
    this.budget = 20;
    this.combo = 0;
    this.tasks = [];
    this.events = [];
    this.usedEvents = new Set();
    this.weekResults = [];
    this.allTasks = [];
    this.brands = {};
    for (const b of BRANDS) {
      this.brands[b.id] = {
        id: b.id, trust: 70, rules: new Set(), persona: null, personaAuto: false, personaRevealed: new Set(),
        alloc: { carousel: 0, video: 0, meme: 0, threads: 0 }, credits: CREDITS_PER_WEEK,
        metrics: { posts: 0, cred: 40, konten: 0, erSum: 0, erN: 0 }, hookLog: {}, causes: {},
        armyCount: 0,
      };
    }
    for (const p of this.players.values()) {
      p.stats = newStats();
      p.stress = 0;
      p.lockedUntil = 0;
      p.dataSeen = {};
    }
    this.db?.createSession(this.sessionId, this.teamCode, this.code, this.settings.mode, this.weeks);
    this.log(null, 'session_start', { mode: this.settings.mode, weeks: this.weeks, speed: this.settings.speed, players: this.humans().map((p) => [p.playerCode, p.role]) });
    this.startBrainstorm();
  }

  setPhase(phase, seconds) {
    this.phase = phase;
    this.phaseStartedAt = Date.now();
    this.phaseEndsAt = seconds ? Date.now() + seconds * this.f * 1000 : null;
    for (const p of this.players.values()) p.ready = false;
    this.dirty = true;
  }

  startBrainstorm() {
    this.day = 0;
    for (const b of Object.values(this.brands)) {
      const pool = HOOKS[b.id];
      const good = shuffle(pool.filter((h) => h.q === 'good')).slice(0, 2);
      const kaku = pick(pool.filter((h) => h.q === 'kaku'));
      const risky = pick(pool.filter((h) => h.q === 'risky'));
      b.hookOptions = shuffle([...good, kaku, risky]);
      b.votes = new Map();
      b.chosenHook = null;
      b.hookBy = null;
      b.credits = CREDITS_PER_WEEK;
      b.concept = null;
    }
    this.setPhase('brainstorm', TIMING.brainstorm);
    this.toast(`${WEEKS[this.week].code} · ${WEEKS[this.week].name}: Senin brainstorm dimulai!`, 'phase');
  }

  brainstormAction(p, m) {
    const b = this.brands[m.brand];
    const a = m.a;
    if (a === 'ready') { p.ready = !p.ready; this.dirty = true; return; }
    if (!b) return;
    if (a === 'vote' && b.hookBy !== 'ai') {
      const opt = b.hookOptions[m.idx];
      if (!opt) return;
      b.votes.set(p.id, m.idx);
      this.decision(p, b.id, opt.q === 'good' ? 1 : 0, { what: 'hook_vote', q: opt.q });
    } else if (a === 'ai_pick' && b.hookBy !== 'ai') {
      if (b.credits < AI_COST.hook) return this.toast('Kredit AI brand ini habis.', 'warn', p.id);
      b.credits -= AI_COST.hook;
      const idx = Math.floor(Math.random() * b.hookOptions.length);
      b.chosenHook = idx;
      b.hookBy = 'ai';
      b.votes.clear();
      p.stats.aiGate++;
      this.log(p, 'ai_replaced_gate', { gate: 1, brand: b.id, q: b.hookOptions[idx].q });
      this.toast(`${p.name} menyerahkan pilihan hook ${BRAND[b.id].name} ke AI.`, 'info');
    } else if (a === 'rule') {
      const rule = RULES[b.id].find((r) => r.id === m.id);
      if (!rule) return;
      const on = !!m.on;
      if (on === b.rules.has(rule.id)) return;
      if (on) b.rules.add(rule.id); else b.rules.delete(rule.id);
      if (on && rule.good) p.stats.rulesGood++;
      else if (on && !rule.good) p.stats.rulesBad++;
      else if (!on && !rule.good) p.stats.rulesGood++;
      else p.stats.rulesBad += 0.5;
      const aligned = (on && rule.good) || (!on && !rule.good) ? 1 : 0;
      this.decision(p, b.id, aligned, { what: 'rule', rule: rule.id, on });
    } else if (a === 'army' && this.week === 1) {
      const total = Object.values(this.brands).reduce((s, x) => s + (x.armyCount || 0), 0);
      const delta = m.delta > 0 ? 5 : -5;
      if (delta > 0 && total >= 100) return;
      if (delta < 0 && b.armyCount <= 0) return;
      const before = Math.abs(b.armyCount - BRAND[b.id].armyNeed);
      b.armyCount += delta;
      const after = Math.abs(b.armyCount - BRAND[b.id].armyNeed);
      this.decision(p, b.id, after < before ? 1 : 0, { what: 'army', delta });
    } else if (a === 'persona_check' && this.week === 2) {
      b.personaRevealed.add(m.id);
      this.markData(p, b.id);
    } else if (a === 'persona' && this.week === 2) {
      const per = PERSONAS[b.id].find((x) => x.id === m.id);
      if (!per) return;
      b.persona = per.id;
      b.personaAuto = false;
      this.decision(p, b.id, per.fit >= 0.8 ? 1 : per.fit >= 0.5 ? 0.5 : 0, { what: 'persona', id: per.id });
    } else if (a === 'alloc' && this.week === 3) {
      const fmt = FORMATS.find((x) => x.id === m.fmt);
      if (!fmt) return;
      const used = Object.values(b.alloc).reduce((s, v) => s + v, 0);
      const delta = m.delta > 0 ? 10 : -10;
      if (delta > 0 && used >= 200) return;
      if (delta < 0 && b.alloc[fmt.id] <= 0) return;
      b.alloc[fmt.id] += delta;
      const ers = FORMAT_ER[b.id];
      const mean = Object.values(ers).reduce((s, v) => s + v, 0) / 4;
      const good = (delta > 0 && ers[fmt.id] >= mean) || (delta < 0 && ers[fmt.id] < mean);
      this.decision(p, b.id, good ? 1 : 0, { what: 'alloc', fmt: fmt.id, delta });
    }
    this.dirty = true;
  }

  endBrainstorm() {
    const humans = this.humans();
    for (const b of Object.values(this.brands)) {
      if (b.hookBy !== 'ai') {
        const counts = new Map();
        for (const idx of b.votes.values()) counts.set(idx, (counts.get(idx) || 0) + 1);
        if (counts.size) {
          b.chosenHook = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
          b.hookBy = 'team';
        } else {
          b.chosenHook = Math.floor(Math.random() * b.hookOptions.length);
          b.hookBy = 'ai';
          for (const p of humans) p.stats.gateSkips++;
          this.log(null, 'gate_skip', { gate: 1, brand: b.id });
        }
      }
      b.hookLog[this.week] = b.hookOptions[b.chosenHook];
      if (this.week === 1) {
        b.armyAuto = false;
      }
      if (this.week === 2 && !b.persona) {
        b.persona = 'b';
        b.personaAuto = true;
        this.log(null, 'gate_skip', { gate: 'persona', brand: b.id });
      }
      if (this.week === 3) {
        const used = Object.values(b.alloc).reduce((s, v) => s + v, 0);
        if (used < 200) {
          const left = 200 - used;
          FORMATS.forEach((fm, i) => { b.alloc[fm.id] += Math.floor(left / 4) + (i < (left % 4) ? 1 : 0); });
          b.allocAuto = used === 0;
        }
      }
    }
    if (this.week === 1) {
      const all = Object.values(this.brands);
      const total = all.reduce((s, x) => s + x.armyCount, 0);
      if (total < 100) {
        const left = 100 - total;
        all.forEach((x, i) => { x.armyCount += Math.floor(left / 4) + (i < left % 4 ? 1 : 0); });
        if (total === 0) all.forEach((x) => { x.armyAuto = true; });
      }
    }
    // dua batch per brand, dirilis Selasa dan Rabu
    this.allTasks.push(...this.tasks);
    this.tasks = [];
    for (const b of BRANDS) {
      for (let i = 0; i < 2; i++) {
        this.tasks.push({
          id: `t${++this.taskSeq}`, brand: b.id, week: this.week, n: i + 1,
          name: `${WEEKS[this.week].name} ${b.name} #${i + 1}`,
          chain: [...CHAINS[this.week]], stepIdx: 0, status: 'queued', releaseDay: i + 1,
          defects: [], checksDone: [], reviewedBy: null, reviewerId: null, schedulerId: null,
          hashtagChecked: false, dataTime: false, conceptGood: null, sub: null, history: [],
          work: null, check: null, holder: null, decision: null,
        });
      }
    }
    this.log(null, 'brainstorm_end', {
      brands: Object.values(this.brands).map((b) => ({ id: b.id, hook: b.hookLog[this.week].q, hookBy: b.hookBy, rules: [...b.rules], army: b.armyCount, persona: b.persona, alloc: b.alloc })),
    });
    this.startProduction();
  }

  startProduction() {
    this.dayDur = TIMING.day * this.f * 1000;
    this.setPhase('production', TIMING.day * 3);
    this.prodStart = Date.now();
    this.day = 1;
    this.eventsThisWeek = 0;
    this.nextEventAt = Date.now() + rand(0.25, 0.45) * this.dayDur;
    this.autoAdvanceAt = null;
    for (const t of this.tasks) if (t.releaseDay === 1) this.enterStep(t);
    this.toast('Selasa: produksi dimulai! Cek meja divisimu.', 'phase');
  }

  stepOf(t) { return t.chain[t.stepIdx]; }
  roleOf(t) { return STEPS[this.stepOf(t)].role; }

  enterStep(t) {
    const role = this.roleOf(t);
    t.sub = this.stepOf(t) === 'schedule' ? 'start' : null;
    if (this.roleHasHuman(role)) {
      t.status = 'waiting';
      t.waitingSince = Date.now();
    } else {
      t.status = 'npc';
      t.npcEndsAt = Date.now() + TIMING.npc * this.f * 1000;
    }
    this.dirty = true;
  }

  isOnTime() { return this.phase === 'production'; }

  productionAction(p, m) {
    const a = m.a;
    if (a === 'event') return this.resolveEvent(p, m);
    const t = this.tasks.find((x) => x.id === m.task);
    if (!t) return;
    const step = this.stepOf(t);
    const def = STEPS[step];
    const atDesk = p.role && inZone(ZONES[ROLE_ZONE[p.role]], p.x, p.y, 40);
    const mine = def && p.role === def.role;

    if (a === 'deliver') return this.deliver(p, t, false);
    if (a === 'wa') return this.deliver(p, t, true);
    if (!mine || !['waiting'].includes(t.status)) {
      if (!mine) this.toast(`Tugas ini bagian ${ROLES[def.role].name}.`, 'warn', p.id);
      return;
    }
    if (!atDesk) return this.toast('Kerjakan di meja divisimu ya (dekati meja lalu tekan E).', 'warn', p.id);
    const b = this.brands[t.brand];

    if (a === 'work' && def.kind === 'work') {
      const ai = m.method === 'ai';
      if (ai) {
        const cost = AI_COST[step] ?? 5;
        if (b.credits < cost) return this.toast('Kredit AI brand ini habis. Kerjakan manual.', 'warn', p.id);
        b.credits -= cost;
      }
      const secs = step === 'revise' ? (ai ? 1.5 : TIMING.revise) : (ai ? TIMING.ai : TIMING.manual);
      t.status = 'working';
      t.work = { by: p.id, method: ai ? 'ai' : 'manual', total: secs * this.f, done: 0 };
      this.log(p, 'step_start', { task: t.id, step, method: t.work.method });
    } else if (a === 'approve' && def.kind === 'approve') {
      if (m.method === 'ai') {
        p.stats.aiGate++;
        this.log(p, 'ai_replaced_gate', { gate: 'budget', task: t.id });
        this.completeStep(t, p, 'ai');
      } else {
        this.decision(p, t.brand, null, { what: 'approve_budget' });
        t.status = 'working';
        t.work = { by: p.id, method: 'manual', total: 2 * this.f, done: 0 };
      }
    } else if (a === 'concept' && def.kind === 'concept') {
      if (m.method === 'ai') {
        p.stats.aiGate++;
        t.conceptGood = Math.random() < 0.5;
        this.log(p, 'ai_replaced_gate', { gate: 'concept', task: t.id, good: t.conceptGood });
        this.completeStep(t, p, 'ai');
      } else {
        const c = CONCEPTS[t.brand][m.idx];
        if (!c) return;
        t.conceptGood = c.good;
        this.decision(p, t.brand, c.good ? 1 : 0, { what: 'concept', good: c.good });
        t.status = 'working';
        t.work = { by: p.id, method: 'manual', total: 2 * this.f, done: 0 };
      }
    } else if (def.kind === 'review') {
      if (a === 'check' && CHECKS[m.check]) {
        if (t.checksDone.includes(m.check)) return;
        t.status = 'working';
        t.check = { by: p.id, check: m.check, total: CHECKS[m.check].secs * this.f, done: 0 };
      } else if (a === 'review_ai') {
        if (b.credits < AI_COST.review) return this.toast('Kredit AI habis.', 'warn', p.id);
        b.credits -= AI_COST.review;
        p.stats.aiGate++;
        const rep = t.defects.find((d) => d.type === 'repeat' && !d.found);
        if (rep) rep.found = true;
        t.reviewedBy = 'ai';
        t.reviewerId = p.id;
        this.log(p, 'ai_replaced_gate', { gate: 3, task: t.id });
        this.toast('AI cuma bisa cek hal teknis. Dia nggak bisa mendengar atau menilai selera.', 'info', p.id);
        this.completeStep(t, p, 'ai');
      } else if (a === 'review_pass') {
        t.reviewedBy = 'human';
        t.reviewerId = p.id;
        if (!t.checksDone.length) p.stats.passNoCheck++;
        this.log(p, 'review_pass', { task: t.id, checks: t.checksDone.length });
        this.completeStep(t, p, 'manual');
      } else if (a === 'review_revise') {
        const open = t.defects.filter((d) => d.found && !d.fixed);
        if (!open.length) return this.toast('Belum ada cacat yang ketemu untuk direvisi.', 'warn', p.id);
        t.chain.splice(t.stepIdx + 1, 0, 'revise', 'review');
        t.checksDone = [];
        this.log(p, 'review_revise', { task: t.id, defects: open.map((d) => d.type) });
        this.completeStep(t, p, 'manual');
      }
    } else if (def.kind === 'schedule') {
      if (a === 'sched_data' && !t.dataTime) {
        this.markData(p, t.brand);
        t.dataTime = true;
        this.toast('Data jam tayang terbaik dipakai: reach naik.', 'good', p.id);
      } else if (a === 'work' && t.sub === 'start') {
        const ai = m.method === 'ai';
        if (ai) {
          if (b.credits < AI_COST.schedule) return this.toast('Kredit AI habis.', 'warn', p.id);
          b.credits -= AI_COST.schedule;
        }
        t.status = 'working';
        t.work = { by: p.id, method: ai ? 'ai' : 'manual', total: (ai ? TIMING.ai : TIMING.manual * 0.6) * this.f, done: 0 };
      } else if (a === 'hashtag' && t.sub === 'confirm' && !t.hashtagChecked) {
        t.status = 'working';
        t.check = { by: p.id, check: 'hashtag', total: 1.5 * this.f, done: 0 };
      } else if (a === 'finish' && t.sub === 'confirm') {
        t.schedulerId = p.id;
        this.completeStep(t, p, t.schedMethod || 'manual');
      }
    }
    this.dirty = true;
  }

  completeWork(t) {
    const w = t.work;
    t.work = null;
    const p = this.players.get(w.by);
    const step = this.stepOf(t);
    const b = this.brands[t.brand];
    if (step === 'produce') this.genDefects(t, w.method);
    if (step === 'revise') {
      for (const d of t.defects) if (d.found) d.fixed = true;
    }
    if (step === 'schedule') {
      t.schedMethod = w.method;
      const covered = RULES[t.brand].some((r) => r.good && r.covers === 'hashtag' && b.rules.has(r.id));
      const prob = w.method === 'ai' ? (covered ? 0.06 : 0.35) : 0.05;
      if (Math.random() < prob) t.defects.push({ type: 'hashtag', found: false, fixed: false });
      if (p && w.method === 'ai') p.stats.aiGood++;
      t.sub = 'confirm';
      t.status = 'waiting';
      this.dirty = true;
      return;
    }
    this.completeStep(t, p, w.method);
  }

  completeCheck(t) {
    const c = t.check;
    t.check = null;
    t.status = 'waiting';
    const p = this.players.get(c.by);
    if (c.check === 'hashtag') {
      t.hashtagChecked = true;
      const d = t.defects.find((x) => x.type === 'hashtag' && !x.fixed);
      if (d) {
        d.found = true; d.fixed = true;
        if (p) p.stats.caught++;
        this.log(p, 'defect_caught', { task: t.id, type: 'hashtag' });
        this.toast('Ketemu! Post tanpa hashtag brand, langsung dibetulkan.', 'good', c.by);
      } else this.toast('Hashtag aman semua.', 'info', c.by);
      if (p) p.stats.checks++;
      this.dirty = true;
      return;
    }
    t.checksDone.push(c.check);
    if (p) p.stats.checks++;
    const type = CHECKS[c.check].finds;
    const d = t.defects.find((x) => x.type === type && !x.found);
    if (d) {
      d.found = true;
      if (p) p.stats.caught++;
      this.log(p, 'defect_caught', { task: t.id, type });
      this.toast(`Ketemu! ${DEFECTS[type].name}. Kirim revisi biar dibetulkan.`, 'good', c.by);
    } else {
      this.toast(`${CHECKS[c.check].label}: aman.`, 'info', c.by);
    }
    this.dirty = true;
  }

  genDefects(t, method) {
    const b = this.brands[t.brand];
    const hook = b.hookLog[this.week];
    const base = method === 'manual' ? 0.04 : method === 'npc' ? 0.24 : 0.22;
    const ruleEffect = method === 'npc' ? 0.6 : 0.35;
    for (const type of ['vo', 'claim', 'face', 'repeat']) {
      let prob = base * (BRAND[t.brand].bias[type] ?? 1);
      for (const r of RULES[t.brand]) {
        if (!b.rules.has(r.id)) continue;
        if (r.good && r.covers === type) prob *= ruleEffect;
        if (!r.good && r.adds === type) prob += 0.25;
      }
      if (type === 'claim' && hook?.q === 'risky') prob += 0.35;
      if (Math.random() < Math.min(prob, 0.9)) t.defects.push({ type, found: false, fixed: false });
    }
    const toneRule = RULES[t.brand].some((r) => !r.good && r.adds === 'hook' && b.rules.has(r.id));
    if (hook?.q === 'kaku' || toneRule) t.defects.push({ type: 'hook', found: true, fixed: false, unfixable: true });
    if (t.infoLost) t.defects.push({ type: pick(['claim', 'hashtag']), found: false, fixed: false });
  }

  completeStep(t, p, method) {
    const step = this.stepOf(t);
    t.history.push({ step, by: p?.id ?? 'npc', method, at: Date.now() });
    if (p) {
      p.stats.stepsDone++;
      if (this.isOnTime()) p.stats.stepsOnTime++;
      if (method === 'ai' && STEPS[step].ai) p.stats.aiGood++;
      this.log(p, 'step_done', { task: t.id, step, method });
    }
    this.advance(t, p);
  }

  advance(t, p) {
    t.stepIdx++;
    t.work = null;
    t.check = null;
    t.sub = null;
    if (t.stepIdx >= t.chain.length) {
      t.status = 'done';
      t.holder = null;
      this.toast(`${t.name} siap tayang!`, 'good');
      this.dirty = true;
      return;
    }
    const role = this.roleOf(t);
    if (p && p.role === role) {
      this.enterStep(t);
    } else if (p) {
      t.status = 'carry';
      t.holder = p.id;
      t.carryAt = Date.now();
      const target = this.roleHasHuman(role) ? `meja ${ROLES[role].name}` : 'meja Vendor & Freelancer';
      this.toast(`Oper "${t.name}" ke ${target}, lalu tekan E. Atau lempar lewat grup WA.`, 'info', p.id);
    } else {
      this.enterStep(t);
    }
    this.dirty = true;
  }

  deliver(p, t, viaWa) {
    if (t.status !== 'carry' || t.holder !== p.id) return;
    const role = this.roleOf(t);
    const human = this.roleHasHuman(role);
    if (!viaWa) {
      const zone = human ? ZONES[ROLE_ZONE[role]] : ZONES.freelance;
      const nearDesk = inZone(zone, p.x, p.y, 40);
      const nearMate = human && this.humans(role).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 110);
      if (!nearDesk && !nearMate) {
        return this.toast(`Belum sampai. Jalan ke ${human ? 'meja ' + ROLES[role].name : 'meja Vendor & Freelancer'} dulu.`, 'warn', p.id);
      }
    }
    const delay = (Date.now() - t.carryAt) / 1000;
    const fast = delay < 18 * Math.max(this.f, 0.5);
    p.stats.handoffs++;
    if (viaWa) {
      p.stats.waThrows++;
      this.feromon = clamp(this.feromon - 3, 0, 100);
      this.combo = 0;
      if (Math.random() < 0.35) t.infoLost = true;
      if (Math.random() < 0.35 && this.stepOf(t) !== 'produce') t.defects.push({ type: pick(['claim', 'hashtag']), found: false, fixed: false });
      this.toast(`${p.name} melempar "${t.name}" lewat grup WA. Info bisa tercecer.`, 'warn');
    } else {
      if (fast) {
        p.stats.handoffFast++;
        this.combo++;
        this.feromon = clamp(this.feromon + 3, 0, 100);
        if (this.combo >= 3) this.toast(`RANTAI RANGRANG x${this.combo}! Oper daun makin lancar.`, 'combo');
        else this.toast(`${p.name} mengoper "${t.name}". Mantap!`, 'good');
      } else {
        this.combo = 0;
        this.feromon = clamp(this.feromon + 1, 0, 100);
        this.toast(`${p.name} mengoper "${t.name}".`, 'info');
      }
    }
    this.log(p, 'handoff', { task: t.id, to_role: human ? role : 'freelance', via: viaWa ? 'wa' : 'walk', delay: Math.round(delay), fast: !viaWa && fast });
    t.holder = null;
    this.enterStep(t);
  }

  npcStep(t) {
    const step = this.stepOf(t);
    const b = this.brands[t.brand];
    if (step === 'produce') this.genDefects(t, 'npc');
    if (step === 'revise') for (const d of t.defects) if (d.found) d.fixed = true;
    if (step === 'review') { t.reviewedBy = 'npc'; t.reviewerId = null; }
    if (step === 'schedule') {
      const covered = RULES[t.brand].some((r) => r.good && r.covers === 'hashtag' && b.rules.has(r.id));
      if (Math.random() < (covered ? 0.08 : 0.25)) t.defects.push({ type: 'hashtag', found: false, fixed: false });
    }
    if (step === 'concept') t.conceptGood = Math.random() < 0.5;
    t.history.push({ step, by: 'npc', method: 'npc', at: Date.now() });
    this.advance(t, null);
  }

  // ---------- event kantor ----------

  spawnEvent() {
    const avail = EVENTS.filter((e) => !this.usedEvents.has(e.id));
    if (!avail.length) return;
    const withHuman = avail.filter((e) => this.roleHasHuman(e.role));
    const def = pick(withHuman.length && Math.random() < 0.8 ? withHuman : avail);
    this.usedEvents.add(def.id);
    const ev = {
      uid: `e${++this.eventSeq}`, def: def.id, role: def.role, brand: def.brand || pick(BRANDS).id,
      expiresAt: Date.now() + Math.max(TIMING.eventTTL * this.f, 12) * 1000,
      npcAt: this.roleHasHuman(def.role) ? null : Date.now() + 6000 * Math.max(this.f, 0.3),
    };
    this.events.push(ev);
    this.eventsThisWeek++;
    this.toast(`Event: ${def.title} (${ROLES[def.role].name})`, 'event');
    this.dirty = true;
  }

  applyFx(ev, fx, p) {
    const b = this.brands[ev.brand];
    if (fx.trust) b.trust = clamp(b.trust + fx.trust, 0, 100);
    if (fx.feromon) this.feromon = clamp(this.feromon + fx.feromon, 0, 100);
    if (fx.budget) this.budget = Math.max(0, this.budget + fx.budget);
    if (fx.credits) b.credits = Math.max(0, b.credits + fx.credits);
    if (fx.stress && p) p.stress = clamp(p.stress + fx.stress, 0, 100);
  }

  resolveEvent(p, m) {
    const ev = this.events.find((e) => e.uid === m.event);
    if (!ev) return;
    const def = EVENTS.find((e) => e.id === ev.def);
    if (p.role !== ev.role) return this.toast(`Event ini bagian ${ROLES[ev.role].name}.`, 'warn', p.id);
    const ch = def.choices[m.choice];
    if (!ch) return;
    this.applyFx(ev, ch.fx, p);
    if (ch.grade === 'best') p.stats.evBest++; else if (ch.grade === 'ok') p.stats.evOk++; else p.stats.evBad++;
    this.decision(p, ev.brand, ch.grade === 'best' ? 1 : ch.grade === 'ok' ? 0.5 : 0, { what: 'event', event: def.id, grade: ch.grade });
    this.log(p, 'event_choice', { event: def.id, grade: ch.grade, brand: ev.brand });
    this.brands[ev.brand].causes.events = (this.brands[ev.brand].causes.events || 0) + (ch.grade === 'bad' ? 2 : 0);
    this.events = this.events.filter((e) => e !== ev);
    this.toast(`${p.name} menangani "${def.title}": ${ch.t}`, ch.grade === 'bad' ? 'warn' : 'info');
    this.dirty = true;
  }

  // ---------- tick ----------

  tick(dt) {
    const now = Date.now();
    if (this.phase === 'brainstorm') {
      const hs = this.humans();
      if (now >= this.phaseEndsAt || (hs.length && hs.every((p) => p.ready))) this.endBrainstorm();
    } else if (this.phase === 'production') {
      this.tickProduction(now, dt);
    } else if (this.phase === 'gate4') {
      if (now >= this.phaseEndsAt) this.resolveWeek();
    } else if (this.phase === 'results') {
      const hs = this.humans();
      if (now >= this.phaseEndsAt || (hs.length && hs.every((p) => p.ready))) this.nextWeek();
    } else if (this.phase === 'report') {
      const hs = this.humans();
      if (now >= this.phaseEndsAt || (hs.length && hs.every((p) => this.insights.has(p.id)))) this.endGame();
    }
    // stress & pantry
    if (this.phase === 'production') {
      for (const p of this.players.values()) {
        if (!p.connected) continue;
        const before = p.stress;
        if (inZone(ZONES.pantry, p.x, p.y)) p.stress = Math.max(0, p.stress - 12 * dt);
        if (p.stress >= 100 && now >= p.lockedUntil) {
          p.lockedUntil = now + 10000 * Math.max(this.f, 0.4);
          p.stress = 55;
          this.toast(`${p.name} kecapekan dan izin istirahat sebentar.`, 'warn');
        }
        if (Math.round(before) !== Math.round(p.stress)) this.dirty = true;
      }
    }
  }

  tickProduction(now, dt) {
    const d = Math.min(3, Math.floor((now - this.prodStart) / this.dayDur) + 1);
    if (d !== this.day) {
      this.day = d;
      for (const t of this.tasks) if (t.releaseDay === d && t.status === 'queued') this.enterStep(t);
      this.toast(`${DAY_NAMES[d]} dimulai.`, 'phase');
      this.dirty = true;
    }
    for (const t of this.tasks) {
      if (t.work) {
        const w = t.work;
        const p = this.players.get(w.by);
        const present = p && p.connected && inZone(ZONES[ROLE_ZONE[p.role]] ?? ZONES.freelance, p.x, p.y, 40);
        if (w.method === 'ai' || present) {
          w.done += dt;
          w.paused = false;
          if (p && w.method === 'manual') p.stress = clamp(p.stress + 3.2 * dt / Math.max(this.f, 0.3), 0, 100);
          if (p && w.method === 'ai') p.stress = clamp(p.stress + 0.4 * dt / Math.max(this.f, 0.3), 0, 100);
        } else if (!w.paused) { w.paused = true; this.dirty = true; }
        if (w.done >= w.total) this.completeWork(t);
        this.dirty = true;
      } else if (t.check) {
        const c = t.check;
        const p = this.players.get(c.by);
        const present = p && p.connected && inZone(ZONES[ROLE_ZONE[p.role]], p.x, p.y, 40);
        if (present) { c.done += dt; if (p) p.stress = clamp(p.stress + 1.5 * dt / Math.max(this.f, 0.3), 0, 100); }
        if (c.done >= c.total) this.completeCheck(t);
        this.dirty = true;
      } else if (t.status === 'npc' && now >= t.npcEndsAt) {
        this.npcStep(t);
      } else if (t.status === 'waiting' && !this.roleHasHuman(this.roleOf(t))) {
        t.status = 'npc';
        t.npcEndsAt = now + TIMING.npc * this.f * 1000;
        this.dirty = true;
      } else if (t.status === 'carry') {
        const h = this.players.get(t.holder);
        if (!h || (!h.connected && now - (h.disconnectedAt || now) > 15000)) {
          t.holder = null;
          this.enterStep(t);
        }
      }
    }
    // event
    if (now >= this.nextEventAt && this.events.length < 2 && this.eventsThisWeek < 4) {
      this.spawnEvent();
      this.nextEventAt = now + rand(0.4, 0.7) * this.dayDur;
    }
    for (const ev of [...this.events]) {
      const def = EVENTS.find((e) => e.id === ev.def);
      if (ev.npcAt && now >= ev.npcAt) {
        const ch = def.choices.find((c) => c.grade === 'ok');
        this.applyFx(ev, ch.fx, null);
        this.events = this.events.filter((e) => e !== ev);
        this.toast(`Freelancer menangani "${def.title}": ${ch.t}`, 'info');
        this.dirty = true;
      } else if (now >= ev.expiresAt) {
        const ch = def.choices.find((c) => c.grade === 'bad');
        this.applyFx(ev, ch.fx, null);
        for (const p of this.humans(ev.role)) p.stats.evExpired++;
        this.brands[ev.brand].causes.events = (this.brands[ev.brand].causes.events || 0) + 2;
        this.log(null, 'event_expired', { event: def.id, brand: ev.brand });
        this.events = this.events.filter((e) => e !== ev);
        this.toast(`"${def.title}" dibiarkan terlalu lama. Klien kecewa.`, 'warn');
        this.dirty = true;
      }
    }
    const released = this.tasks.every((t) => t.status !== 'queued');
    if (released && this.tasks.every((t) => t.status === 'done')) {
      if (!this.autoAdvanceAt) {
        this.autoAdvanceAt = now + 2500;
        this.toast('Semua batch siap tayang! Lanjut ke Jumat.', 'good');
      }
    }
    if (now >= this.phaseEndsAt || (this.autoAdvanceAt && now >= this.autoAdvanceAt)) this.endProduction();
  }

  endProduction() {
    for (const t of this.tasks) {
      if (t.status === 'done') continue;
      const role = t.status === 'queued' ? null : this.roleOf(t);
      if (t.status === 'carry' && t.holder) this.players.get(t.holder).stats.missed++;
      else if (t.work && t.work.by) this.players.get(t.work.by)?.stats && this.players.get(t.work.by).stats.missed++;
      else if (role) for (const p of this.humans(role)) p.stats.missed++;
      t.status = 'late';
      t.work = null;
      t.check = null;
      this.brands[t.brand].causes.late = (this.brands[t.brand].causes.late || 0) + 3;
      this.log(null, 'task_late', { task: t.id, brand: t.brand, stuckAt: role });
    }
    this.events = [];
    this.day = 4;
    this.setPhase('gate4', TIMING.gate4);
    this.toast('Jumat: Gerbang 4, izin tayang & Weekly Update.', 'phase');
  }

  gate4Action(p, m) {
    const t = this.tasks.find((x) => x.id === m.task);
    if (m.a === 'go') { this.resolveWeek(p); return; }
    if (m.a === 'ready') { p.ready = !p.ready; this.dirty = true; return; }
    if (!t || t.status !== 'done') return;
    if (m.a === 'air') {
      t.decision = m.ok ? 'air' : 'hold';
      t.decidedBy = p.id;
      const risky = t.reviewedBy !== 'human' || t.defects.some((d) => d.found && !d.fixed && !d.unfixable);
      this.decision(p, t.brand, m.ok ? (risky ? 0 : 1) : (risky ? 1 : 0.5), { what: 'gate4', task: t.id, ok: !!m.ok, risky });
    } else if (m.a === 'hashtag' && !t.hashtagChecked) {
      t.hashtagChecked = true;
      p.stats.checks++;
      const d = t.defects.find((x) => x.type === 'hashtag' && !x.fixed);
      if (d) {
        d.found = true; d.fixed = true; p.stats.caught++;
        this.log(p, 'defect_caught', { task: t.id, type: 'hashtag', at: 'gate4' });
        this.toast('Ketemu! Hashtag brand ketinggalan, dibetulkan.', 'good', p.id);
      } else this.toast('Hashtag aman.', 'info', p.id);
    }
    this.dirty = true;
  }

  resolveWeek() {
    if (this.phase !== 'gate4') return;
    const w = this.week;
    const res = { week: w, brands: {} };
    for (const t of this.tasks) {
      if (t.status === 'done' && !t.decision) {
        t.decision = 'air';
        this.log(null, 'gate_skip', { gate: 4, task: t.id });
        for (const p of this.humans()) if (p.role === 'pm' || p.role === 'bod') p.stats.gateSkips += 0.5;
      }
    }
    for (const bdef of BRANDS) {
      const b = this.brands[bdef.id];
      const before = b.trust;
      const tasks = this.tasks.filter((t) => t.brand === bdef.id);
      const r = { aired: 0, held: 0, late: 0, leaked: [], output: 0, er: 0, unit: WEEKS[w].unit };
      let erSum = 0;
      let erN = 0;
      const hook = b.hookLog[w];
      for (const t of tasks) {
        if (t.status === 'late') { r.late++; b.trust = clamp(b.trust - 4, 0, 100); continue; }
        if (t.decision === 'hold') { r.held++; b.trust = clamp(b.trust - 1, 0, 100); continue; }
        r.aired++;
        b.trust = clamp(b.trust + 2, 0, 100);
        const leaks = t.defects.filter((d) => !d.fixed);
        for (const d of leaks) {
          const mult = d.type === 'claim' ? (bdef.claimMult || 1) : 1;
          b.trust = clamp(b.trust + DEFECTS[d.type].trust * mult, 0, 100);
          r.leaked.push({ type: d.type, name: DEFECTS[d.type].name, task: t.name });
          let resp = null;
          if (d.type === 'hashtag') resp = t.schedulerId;
          else if (d.type !== 'hook') resp = t.reviewerId;
          const rp = resp && this.players.get(resp);
          if (rp) rp.stats.leaked++;
          this.log(rp || null, 'defect_leaked', { task: t.id, type: d.type, brand: bdef.id, reviewedBy: t.reviewedBy, by: resp || 'npc' });
        }
        if (leaks.filter((d) => d.type !== 'hook').length) b.causes.leak = (b.causes.leak || 0) + leaks.length * 2;
        const q = Math.max(0.3, 1 - 0.15 * leaks.length);
        let er = bdef.baseER + (HOOK_ER[hook?.q] ?? 0) + (t.dataTime ? 0.4 : 0) - 0.3 * leaks.length;
        if (w === 1) {
          const hashLeak = leaks.some((d) => d.type === 'hashtag');
          const posts = Math.round((b.armyCount * ARMY_RATE[bdef.id]) / 2 * q * (hashLeak ? 0.7 : 1));
          r.output += Math.min(posts, 130);
        } else if (w === 2) {
          const per = PERSONAS[bdef.id].find((x) => x.id === b.persona);
          r.output += Math.round(25 * (per?.fit ?? 0.3) * q);
        } else if (w === 3) {
          r.output += Math.round(100 * q);
          const ers = FORMAT_ER[bdef.id];
          const max = Math.max(...Object.values(ers));
          const score = FORMATS.reduce((s, fm) => s + b.alloc[fm.id] * ers[fm.id], 0) / (200 * max);
          er += (score - 0.7) * 3 + (t.conceptGood ? 0.6 : -0.3);
          b.allocScore = score;
        }
        erSum += er;
        erN++;
      }
      if (hook?.q !== 'good') b.causes.hook = (b.causes.hook || 0) + 2;
      if (w === 1) {
        const off = Math.abs(b.armyCount - bdef.armyNeed);
        if (off >= 10) b.causes.army = (b.causes.army || 0) + off / 5;
        b.metrics.posts = r.output;
      } else if (w === 2) {
        const per = PERSONAS[bdef.id].find((x) => x.id === b.persona);
        if ((per?.fit ?? 0) < 0.6) b.causes.persona = (b.causes.persona || 0) + 4;
        b.metrics.cred = clamp(40 + r.output, 0, 100);
      } else if (w === 3) {
        if ((b.allocScore ?? 1) < 0.8) b.causes.alloc = (b.causes.alloc || 0) + 3;
        b.metrics.konten = r.output;
      }
      r.er = erN ? Math.round((erSum / erN) * 10) / 10 : 0;
      if (erN) { b.metrics.erSum += r.er; b.metrics.erN++; }
      r.trustBefore = before;
      r.trustAfter = b.trust;
      res.brands[bdef.id] = r;
    }
    res.combo = this.combo;
    res.feromon = this.feromon;
    this.weekResults.push(res);
    this.log(null, 'week_result', res);
    this.setPhase('results', TIMING.results);
  }

  nextWeek() {
    this.weekIdx++;
    if (this.weekIdx < this.weeks.length) this.startBrainstorm();
    else this.startReport();
  }

  monthSummary() {
    const out = {};
    for (const bdef of BRANDS) {
      const b = this.brands[bdef.id];
      const parts = [];
      const m = { trust: b.trust };
      if (this.weeks.includes(1)) { m.postsMonth = b.metrics.posts * 4; parts.push(Math.min(1, m.postsMonth / 800)); }
      if (this.weeks.includes(2)) { m.cred = b.metrics.cred; parts.push(Math.min(1, m.cred / 70)); }
      if (this.weeks.includes(3)) { m.konten = b.metrics.konten; parts.push(Math.min(1, m.konten / 200)); }
      m.er = b.metrics.erN ? Math.round((b.metrics.erSum / b.metrics.erN) * 10) / 10 : 0;
      m.ach = parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : 0;
      m.verdict = b.trust >= 65 && m.ach >= 0.7 ? 'Diperpanjang' : b.trust >= 50 ? 'Hati-hati' : 'Putus kontrak';
      m.score = 0.5 * (b.trust / 100) + 0.5 * m.ach;
      out[bdef.id] = m;
    }
    return out;
  }

  startReport() {
    this.month = this.monthSummary();
    const weakest = BRANDS.map((b) => b.id).sort((x, y) => this.month[x].score - this.month[y].score)[0];
    const causes = this.brands[weakest].causes;
    const ranked = Object.entries(causes).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    const correct = ranked.length && ranked[0][1] >= 2 ? ranked[0][0] : 'fine';
    const wrongPool = Object.keys(CAUSES).filter((k) => k !== correct && !(causes[k] > 0));
    const opts = shuffle([correct, ...shuffle(wrongPool).slice(0, 3)]);
    this.insightQ = { brand: weakest, options: opts.map((k) => ({ key: k, text: CAUSES[k] })), correct };
    this.insights = new Map();
    this.setPhase('report', TIMING.report);
    this.toast('Jumat W4: Evaluasi → Report. Tulis insight "what & why"!', 'phase');
  }

  reportAction(p, m) {
    if (m.a === 'insight') {
      const opt = this.insightQ.options[m.choice];
      if (!opt || this.insights.has(p.id)) return;
      const correct = opt.key === this.insightQ.correct;
      this.insights.set(p.id, { choice: m.choice, correct, text: String(m.text || '').slice(0, 400) });
      p.stats.insightN++;
      if (correct) p.stats.insightCorrect++;
      this.decision(p, this.insightQ.brand, correct ? 1 : 0, { what: 'insight', key: opt.key });
      this.log(p, 'insight_written', { brand: this.insightQ.brand, key: opt.key, correct, len: (m.text || '').length });
      this.dirty = true;
    } else if (m.a === 'finish' && p.id === this.hostId) {
      this.endGame();
    }
  }

  endGame() {
    if (this.phase === 'ended') return;
    const month = this.month || this.monthSummary();
    const avg = Object.values(month).reduce((s, m) => s + m.score, 0) / BRANDS.length;
    const grade = avg >= 0.85 ? 'A' : avg >= 0.78 ? 'A-' : avg >= 0.72 ? 'B+' : avg >= 0.64 ? 'B' : avg >= 0.55 ? 'C' : 'D';
    const perPlayer = [];
    for (const p of this.players.values()) {
      if (!p.role) continue;
      const skills = computeSkills(p.stats);
      const labels = labelsFor(skills, p.stats);
      perPlayer.push({ id: p.id, role: p.role, skills, labels });
      this.db?.saveScore(this.sessionId, p, this.teamCode, skills, p.stats, labels);
    }
    const byRole = {};
    for (const r of ROLE_IDS) {
      const ps = perPlayer.filter((x) => x.role === r);
      const avgOf = (k) => {
        const vs = ps.map((x) => x.skills[k]).filter((v) => v != null);
        return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) : null;
      };
      byRole[r] = ps.length ? { ai: avgOf('ai'), data: avgOf('data'), human: true } : { human: false };
    }
    const npcSteps = this.allTaskHistory().filter((h) => h.by === 'npc').length;
    byRole.npc = { steps: npcSteps };
    let teamInsight = null;
    const bodAns = [...this.insights?.entries() ?? []].find(([id]) => this.players.get(id)?.role === 'bod');
    if (bodAns) teamInsight = bodAns[1];
    else if (this.insights?.size) teamInsight = [...this.insights.values()][0];
    this.final = { grade, avg: Math.round(avg * 100), month, byRole, teamInsight, insightQ: this.insightQ };
    this.db?.endSession(this.sessionId, { grade, month, weeks: this.weekResults });
    this.log(null, 'session_end', { grade });
    this.setPhase('ended', null);
  }

  allTaskHistory() {
    return (this.allTasks || []).concat(this.tasks || []).flatMap((t) => t.history);
  }

  restart() {
    this.phase = 'lobby';
    this.tasks = [];
    this.events = [];
    this.final = null;
    this.month = null;
    this.weekResults = [];
    for (const p of this.players.values()) { p.ready = false; p.stats = newStats(); }
    for (const [id, p] of this.players) if (!p.connected) this.players.delete(id);
    this.dirty = true;
  }

  // ---------- serialisasi ----------

  publicState() {
    const now = Date.now();
    const players = [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color, role: p.role, connected: p.connected, ready: p.ready,
      stress: Math.round(p.stress), locked: now < p.lockedUntil, host: p.id === this.hostId,
    }));
    const s = {
      t: 'state', now, room: this.code, team: this.teamCode, phase: this.phase, settings: this.settings,
      phaseEndsAt: this.phaseEndsAt, players, host: this.hostId,
    };
    if (this.phase === 'lobby') return s;
    Object.assign(s, {
      weeks: this.weeks, weekIdx: this.weekIdx, week: this.week, day: this.day,
      prodStart: this.prodStart, dayDur: this.dayDur, feromon: Math.round(this.feromon), budget: this.budget, combo: this.combo,
    });
    s.brands = Object.values(this.brands).map((b) => {
      const votes = {};
      for (const [pid, idx] of b.votes || []) (votes[idx] = votes[idx] || []).push(pid);
      return {
        id: b.id, trust: Math.round(b.trust), credits: b.credits, rules: [...b.rules],
        hooks: (b.hookOptions || []).map((h) => h.text), votes, chosenHook: b.chosenHook, hookBy: b.hookBy,
        army: b.armyCount, persona: b.persona, personaAuto: b.personaAuto, personaRevealed: [...b.personaRevealed],
        alloc: b.alloc, metrics: b.metrics,
      };
    });
    s.tasks = (this.tasks || []).map((t) => ({
      id: t.id, brand: t.brand, name: t.name, week: t.week, chain: t.chain, stepIdx: t.stepIdx,
      step: t.chain[t.stepIdx] ?? null, status: t.status, holder: t.holder, sub: t.sub,
      work: t.work ? { by: t.work.by, method: t.work.method, p: Math.min(1, t.work.done / t.work.total), paused: !!t.work.paused } : null,
      check: t.check ? { by: t.check.by, check: t.check.check, p: Math.min(1, t.check.done / t.check.total) } : null,
      found: t.defects.filter((d) => d.found).map((d) => ({ type: d.type, fixed: d.fixed })),
      checksDone: t.checksDone, reviewedBy: t.reviewedBy, hashtagChecked: t.hashtagChecked, dataTime: t.dataTime,
      decision: t.decision, releaseDay: t.releaseDay, history: t.history.map((h) => ({ step: h.step, by: h.by, method: h.method })),
    }));
    s.events = (this.events || []).map((e) => ({ uid: e.uid, def: e.def, role: e.role, brand: e.brand, expiresAt: e.expiresAt }));
    if (this.phase === 'results' || this.phase === 'report' || this.phase === 'ended') s.weekResults = this.weekResults;
    if (this.phase === 'report' || this.phase === 'ended') {
      s.month = this.month;
      s.insightQ = this.insightQ && { brand: this.insightQ.brand, options: this.insightQ.options };
      s.insights = [...(this.insights || new Map()).entries()].map(([id, v]) => ({ id, choice: v.choice }));
    }
    if (this.phase === 'ended') s.final = this.final;
    return s;
  }

  positions() {
    return [...this.players.values()].filter((p) => p.connected).map((p) => [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.moving ? 1 : 0]);
  }
}
