// Snapshot performa pemain dari event log, termasuk sesi yang masih berjalan.
// Pakai: node --no-warnings tools/snapshot.mjs [--since 09:30] [--date 2026-10-21] [--team SEMUT] [--db /var/lib/semut-rangrang/semut.db]
// Jam dibaca sebagai WIB (UTC+7). Hasil: tabel di layar + file CSV di /tmp.
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { newStats, computeSkills, labelsFor, SKILLS } from '../server/skills.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const dbFile = args.db || process.env.DB_FILE || '/var/lib/semut-rangrang/semut.db';
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const date = args.date || today;
const since = new Date(`${date}T${(args.since || '00:00').padStart(5, '0')}:00+07:00`);
const until = args.until ? new Date(`${date}T${args.until.padStart(5, '0')}:00+07:00`) : new Date();

const db = new DatabaseSync(dbFile, { readOnly: true });
const names = Object.fromEntries(db.prepare('SELECT player_code, name, team_code FROM players').all().map((r) => [r.player_code, r]));
const rows = db.prepare('SELECT * FROM events WHERE ts >= ? AND ts <= ? AND player_code IS NOT NULL ORDER BY ts').all(since.toISOString(), until.toISOString());

const P = new Map();
for (const r of rows) {
  if (args.team && r.team_code !== args.team.toUpperCase()) continue;
  const e = JSON.parse(r.payload || '{}');
  let p = P.get(r.player_code);
  if (!p) { p = { code: r.player_code, team: r.team_code, role: r.role, sessions: new Set(), s: newStats(), first: r.ts, last: r.ts }; P.set(r.player_code, p); }
  p.role = r.role || p.role;
  p.last = r.ts;
  if (r.session_id) p.sessions.add(r.session_id);
  const s = p.s;
  switch (r.type) {
    case 'data_view': s.dataViews++; break;
    case 'decision':
      s.decisions++;
      if (e.informed) s.informed++;
      if (e.aligned != null) { s.alignedSum += e.aligned; s.alignedN++; }
      if (e.what === 'rule') { if (e.aligned === 1) s.rulesGood++; else s.rulesBad++; }
      if (e.what === 'event') { if (e.grade === 'best') s.evBest++; else if (e.grade === 'ok') s.evOk++; else s.evBad++; }
      if (e.what === 'insight') { s.insightN++; if (e.aligned === 1) s.insightCorrect++; }
      break;
    case 'step_done':
      s.stepsDone++; s.stepsOnTime++;
      if (e.method === 'ai' && ['produce', 'persona_brief', 'revise', 'schedule'].includes(e.step)) s.aiGood++;
      break;
    case 'ai_replaced_gate': s.aiGate++; break;
    case 'defect_caught': s.caught++; s.checks++; break;
    case 'defect_leaked': s.leaked++; break;
    case 'review_pass': if (!e.checks) s.passNoCheck++; else s.checks += e.checks; break;
    case 'handoff':
      s.handoffs++;
      if (e.fast) s.handoffFast++;
      if (e.via === 'wa') s.waThrows++;
      break;
    case 'chat': s.chats++; break;
    default: break;
  }
}

const wib = (iso) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(11, 16);
const list = [...P.values()].map((p) => {
  const skills = computeSkills(p.s);
  return { ...p, skills, labels: labelsFor(skills, p.s), name: names[p.code]?.name || p.code };
}).sort((a, b) => (a.role || '').localeCompare(b.role || '') || a.name.localeCompare(b.name));

const head = ['Nama', 'Kode', 'Tim', 'Divisi', 'Aktif (WIB)', ...SKILLS.map((k) => k.short), 'Tangkap', 'Lolos', 'Oper', 'WA', 'AI ganti gerbang', 'Buka data', 'Label'];
const body = list.map((p) => [
  p.name, p.code, p.team, p.role || '-', `${wib(p.first)}-${wib(p.last)}`,
  ...SKILLS.map((k) => p.skills[k.id] ?? '-'),
  p.s.caught, p.s.leaked, p.s.handoffs, p.s.waThrows, p.s.aiGate, p.s.dataViews, p.labels.join(' / '),
]);

console.log(`Snapshot ${date} ${wib(since.toISOString())}–${wib(until.toISOString())} WIB · ${list.length} pemain · ${rows.length} event`);
console.log('Catatan: skor dihitung dari aktivitas sejauh ini (sesi yang masih berjalan ikut dihitung).\n');
const widths = head.map((h, i) => Math.max(String(h).length, ...body.map((r) => String(r[i]).length)));
const line = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join(' | ');
console.log(line(head));
console.log(widths.map((w) => '-'.repeat(w)).join('-|-'));
for (const r of body) console.log(line(r));

const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
const out = `/tmp/semut-snapshot-${date}-${wib(since.toISOString()).replace(':', '')}.csv`;
writeFileSync(out, csv);
console.log(`\nCSV: ${out}`);
