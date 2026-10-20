// Penyimpanan pemain, sesi, event log, dan skor skill (SQLite bawaan Node).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS players (
      player_code TEXT PRIMARY KEY, team_code TEXT, name TEXT, color TEXT, last_role TEXT,
      first_seen TEXT, last_seen TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, team_code TEXT, room_code TEXT, mode TEXT, weeks TEXT,
      started_at TEXT, ended_at TEXT, result TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, team_code TEXT, player_code TEXT,
      role TEXT, week INTEGER, day INTEGER, type TEXT, payload TEXT, ts TEXT
    );
    CREATE INDEX IF NOT EXISTS events_session ON events(session_id);
    CREATE TABLE IF NOT EXISTS scores (
      session_id TEXT, player_code TEXT, team_code TEXT, role TEXT,
      skills TEXT, stats TEXT, labels TEXT, ts TEXT,
      PRIMARY KEY (session_id, player_code)
    );
  `);

  const q = {
    upsertPlayer: db.prepare(`INSERT INTO players (player_code, team_code, name, color, last_role, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player_code) DO UPDATE SET team_code = excluded.team_code, name = excluded.name,
        color = excluded.color, last_role = COALESCE(excluded.last_role, players.last_role), last_seen = excluded.last_seen`),
    createSession: db.prepare('INSERT INTO sessions (id, team_code, room_code, mode, weeks, started_at) VALUES (?, ?, ?, ?, ?, ?)'),
    endSession: db.prepare('UPDATE sessions SET ended_at = ?, result = ? WHERE id = ?'),
    logEvent: db.prepare('INSERT INTO events (session_id, team_code, player_code, role, week, day, type, payload, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    saveScore: db.prepare(`INSERT OR REPLACE INTO scores (session_id, player_code, team_code, role, skills, stats, labels, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    teams: db.prepare(`SELECT team_code, COUNT(DISTINCT player_code) AS players,
      (SELECT COUNT(*) FROM sessions s WHERE s.team_code = p.team_code AND s.ended_at IS NOT NULL) AS sessions
      FROM players p GROUP BY team_code ORDER BY team_code`),
    teamPlayers: db.prepare('SELECT * FROM players WHERE team_code = ? ORDER BY name'),
    teamScores: db.prepare('SELECT * FROM scores WHERE team_code = ? ORDER BY ts'),
    teamSessions: db.prepare('SELECT * FROM sessions WHERE team_code = ? AND ended_at IS NOT NULL ORDER BY started_at'),
    teamHandoffs: db.prepare(`SELECT player_code, role, payload FROM events WHERE team_code = ? AND type = 'handoff'`),
    teamLeaks: db.prepare(`SELECT player_code, role, payload, ts FROM events WHERE team_code = ? AND type = 'defect_leaked' ORDER BY ts DESC LIMIT 200`),
  };

  const now = () => new Date().toISOString();

  return {
    upsertPlayer(p) {
      q.upsertPlayer.run(p.playerCode, p.teamCode, p.name, p.color, p.role ?? null, now(), now());
    },
    createSession(id, teamCode, roomCode, mode, weeks) {
      q.createSession.run(id, teamCode, roomCode, mode, JSON.stringify(weeks), now());
    },
    endSession(id, result) {
      q.endSession.run(now(), JSON.stringify(result), id);
    },
    logEvent(e) {
      q.logEvent.run(e.session ?? null, e.team ?? null, e.player ?? null, e.role ?? null, e.week ?? null, e.day ?? null, e.type, JSON.stringify(e.payload ?? {}), now());
    },
    saveScore(sessionId, p, teamCode, skills, stats, labels) {
      q.saveScore.run(sessionId, p.playerCode, teamCode, p.role ?? null, JSON.stringify(skills), JSON.stringify(stats), JSON.stringify(labels), now());
    },
    teams: () => q.teams.all(),
    teamPlayers: (t) => q.teamPlayers.all(t),
    teamScores: (t) => q.teamScores.all(t).map((r) => ({ ...r, skills: JSON.parse(r.skills), stats: JSON.parse(r.stats), labels: JSON.parse(r.labels) })),
    teamSessions: (t) => q.teamSessions.all(t).map((r) => ({ ...r, weeks: JSON.parse(r.weeks), result: r.result ? JSON.parse(r.result) : null })),
    teamHandoffs: (t) => q.teamHandoffs.all(t).map((r) => ({ ...r, payload: JSON.parse(r.payload) })),
    teamLeaks: (t) => q.teamLeaks.all(t).map((r) => ({ ...r, payload: JSON.parse(r.payload) })),
  };
}
