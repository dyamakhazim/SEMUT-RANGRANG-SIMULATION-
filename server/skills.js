// Perhitungan 6 skill dan label karakter dari statistik satu sesi.

export const SKILLS = [
  { id: 'ai', name: 'AI Literacy', short: 'AI' },
  { id: 'data', name: 'Data Literacy', short: 'Data' },
  { id: 'detail', name: 'Ketelitian', short: 'Teliti' },
  { id: 'collab', name: 'Kolaborasi', short: 'Kolaborasi' },
  { id: 'time', name: 'Manajemen Waktu', short: 'Waktu' },
  { id: 'client', name: 'Client Handling', short: 'Klien' },
];

export function newStats() {
  return {
    aiGood: 0, aiGate: 0, gateSkips: 0, rulesGood: 0, rulesBad: 0,
    dataViews: 0, decisions: 0, informed: 0, alignedSum: 0, alignedN: 0, insightN: 0, insightCorrect: 0,
    caught: 0, leaked: 0, checks: 0, passNoCheck: 0,
    handoffs: 0, handoffFast: 0, waThrows: 0, chats: 0, spam: 0,
    stepsDone: 0, stepsOnTime: 0, missed: 0,
    evBest: 0, evOk: 0, evBad: 0, evExpired: 0,
  };
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

export function computeSkills(s) {
  const r = {};

  const aiPos = s.aiGood + s.rulesGood * 1.5;
  const aiNeg = s.aiGate * 3 + s.rulesBad * 2 + s.gateSkips;
  r.ai = aiPos + aiNeg > 0 ? clamp((100 * (aiPos + 0.5)) / (aiPos + aiNeg + 1)) : null;

  const parts = [];
  if (s.decisions > 0) parts.push([s.informed / s.decisions, 0.4]);
  if (s.alignedN > 0) parts.push([s.alignedSum / s.alignedN, 0.4]);
  if (s.insightN > 0) parts.push([s.insightCorrect / s.insightN, 0.2]);
  r.data = parts.length ? clamp((100 * parts.reduce((a, [v, w]) => a + v * w, 0)) / parts.reduce((a, [, w]) => a + w, 0)) : null;

  const good = s.caught * 2 + s.checks * 0.5;
  const bad = s.leaked * 2 + s.passNoCheck * 2;
  r.detail = good + bad > 0 ? clamp((100 * (good + 0.5)) / (good + bad + 1)) : null;

  const slow = s.handoffs - s.handoffFast;
  const collabActivity = s.handoffs + s.chats + s.waThrows;
  r.collab = collabActivity > 0
    ? clamp(45 + s.handoffFast * 7 + slow * 3 + Math.min(s.chats, 12) * 1.5 - s.waThrows * 5 - s.spam * 3)
    : null;

  r.time = s.stepsDone + s.missed > 0 ? clamp((100 * (s.stepsOnTime + 0.5)) / (s.stepsDone + s.missed * 1.5 + 0.5)) : null;

  const ev = s.evBest + s.evOk + s.evBad + s.evExpired;
  r.client = ev > 0 ? clamp((100 * (s.evBest + 0.5 * s.evOk)) / ev) : null;

  return r;
}

export function labelsFor(skills, s) {
  const out = [];
  if (skills.detail != null && skills.detail >= 80 && s.caught >= 2) out.push('Si Teliti');
  if (s.leaked >= 3 || s.aiGate >= 3 || s.passNoCheck >= 3) out.push('Si Gas Terus');
  if (s.handoffs >= 5 && (skills.collab ?? 0) >= 75) out.push('Si Penghubung');
  if (skills.data != null && skills.data >= 80 && s.decisions >= 4) out.push('Si Data-Driven');
  if (s.evBest + s.evOk + s.evBad >= 3 && (skills.client ?? 0) >= 70) out.push('Si Pemadam Kebakaran');
  if (s.handoffs <= 1 && s.waThrows >= 2) out.push('Si Solo Player');
  if (!out.length) out.push('Semut Pekerja');
  return out;
}

// Rata-rata skill lintas sesi (sesi terbaru diberi bobot lebih besar).
export function aggregate(sessions) {
  const acc = {};
  sessions.forEach((sess, i) => {
    const w = 1 + i * 0.5;
    for (const k of SKILLS.map((x) => x.id)) {
      const v = sess.skills[k];
      if (v == null) continue;
      acc[k] = acc[k] || { sum: 0, w: 0 };
      acc[k].sum += v * w;
      acc[k].w += w;
    }
  });
  const out = {};
  for (const k of SKILLS.map((x) => x.id)) out[k] = acc[k] ? Math.round(acc[k].sum / acc[k].w) : null;
  return out;
}
