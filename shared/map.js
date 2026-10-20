// Layout kantor. Dipakai server (cek zona) dan client (gambar & tabrakan).

export const WORLD = { w: 1600, h: 1000 };
export const WALL = 40;
export const SPAWN = { x: 800, y: 480 };
export const PLAYER_R = 16;

export const ZONES = {
  meeting: { x: 60, y: 60, w: 400, h: 260, label: 'Ruang Meeting', hint: 'Layar data semua brand' },
  board: { x: 560, y: 50, w: 360, h: 130, label: 'Papan Tugas', hint: 'Lihat semua tugas' },
  server: { x: 1180, y: 60, w: 360, h: 260, label: 'Server Room AI', hint: 'Cek kredit AI' },
  creative: { x: 520, y: 230, w: 300, h: 210, label: 'Creative', role: 'creative' },
  pm: { x: 880, y: 230, w: 260, h: 210, label: 'Project Management', role: 'pm' },
  dist: { x: 520, y: 540, w: 300, h: 210, label: 'Distribution', role: 'dist' },
  bod: { x: 880, y: 540, w: 260, h: 210, label: 'BOD', role: 'bod' },
  freelance: { x: 1200, y: 540, w: 340, h: 210, label: 'Vendor & Freelancer', hint: 'Oper tugas ke freelancer' },
  pantry: { x: 60, y: 620, w: 400, h: 320, label: 'Pantry', hint: 'Istirahat, stress turun' },
};

export const ROLE_ZONE = { creative: 'creative', pm: 'pm', dist: 'dist', bod: 'bod' };

// Furnitur yang bisa ditabrak. type dipakai client untuk menggambar.
export const OBSTACLES = [
  { x: 150, y: 150, w: 220, h: 84, type: 'leafTable' },
  { x: 1240, y: 76, w: 110, h: 56, type: 'rack' },
  { x: 1400, y: 76, w: 110, h: 56, type: 'rack' },
  { x: 550, y: 275, w: 100, h: 44, type: 'desk' },
  { x: 690, y: 275, w: 100, h: 44, type: 'desk' },
  { x: 550, y: 365, w: 100, h: 44, type: 'desk' },
  { x: 690, y: 365, w: 100, h: 44, type: 'desk' },
  { x: 905, y: 285, w: 92, h: 44, type: 'desk' },
  { x: 1025, y: 285, w: 92, h: 44, type: 'desk' },
  { x: 965, y: 370, w: 92, h: 44, type: 'desk' },
  { x: 550, y: 585, w: 100, h: 44, type: 'desk' },
  { x: 690, y: 585, w: 100, h: 44, type: 'desk' },
  { x: 550, y: 675, w: 100, h: 44, type: 'desk' },
  { x: 690, y: 675, w: 100, h: 44, type: 'desk' },
  { x: 930, y: 610, w: 160, h: 58, type: 'bigDesk' },
  { x: 1240, y: 595, w: 100, h: 44, type: 'desk' },
  { x: 1400, y: 595, w: 100, h: 44, type: 'desk' },
  { x: 80, y: 646, w: 250, h: 50, type: 'counter' },
  { x: 370, y: 640, w: 64, h: 76, type: 'fridge' },
  { x: 190, y: 800, w: 130, h: 74, type: 'roundTable' },
];

export const PLANTS = [
  [70, 340], [470, 70], [530, 470], [850, 470], [1160, 470], [1550, 340], [1550, 940], [480, 940], [860, 940], [1170, 260], [70, 560],
];

export function inZone(zone, x, y, pad = 0) {
  return x >= zone.x - pad && x <= zone.x + zone.w + pad && y >= zone.y - pad && y <= zone.y + zone.h + pad;
}

export function zoneAt(x, y, pad = 0) {
  for (const [id, z] of Object.entries(ZONES)) if (inZone(z, x, y, pad)) return id;
  return null;
}

export function blocked(x, y, r = PLAYER_R) {
  if (x < WALL + r || y < WALL + r || x > WORLD.w - WALL - r || y > WORLD.h - WALL - r) return true;
  for (const o of OBSTACLES) {
    const cx = Math.max(o.x, Math.min(x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(y, o.y + o.h));
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}
