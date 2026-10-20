// Konten game: peran, brand, minggu, aturan, hook, persona, event.
// Dipakai server (simulasi) dan client (tampilan).

export const ROLE_IDS = ['bod', 'pm', 'dist', 'creative'];

export const ROLES = {
  bod: { id: 'bod', name: 'BOD', color: '#F6A15A', desc: 'Arah strategi, approve budget, pilih konsep, tulis insight report.' },
  pm: { id: 'pm', name: 'Project Management', short: 'Project Mgmt', color: '#9AD86E', desc: 'Review batch (Gerbang 3), urus klien, izin tayang.' },
  dist: { id: 'dist', name: 'Distribution', color: '#FFD966', desc: 'Army, Proxy Persona, KOL. Jadwal tayang & hashtag.' },
  creative: { id: 'creative', name: 'Creative', color: '#8EC1FF', desc: 'Hook, script, caption, visual, video.' },
};

export const BRANDS = [
  { id: 'clinic', name: 'Beauty · Clinic', color: '#F3A8DF', dark: '#B3418F', trait: 'Approval berlapis. Fakta treatment harus akurat.', bias: { claim: 1.4, vo: 1, face: 0.6, repeat: 0.6 }, baseER: 3.6, armyNeed: 20 },
  { id: 'skincare', name: 'Beauty · Skincare', color: '#9AD86E', dark: '#367A1C', trait: 'Cepat, banyak trend & meme.', bias: { claim: 0.9, vo: 0.8, face: 0.5, repeat: 1.3 }, baseER: 4.0, armyNeed: 15 },
  { id: 'finance', name: 'Finance', color: '#8EC1FF', dark: '#1F5BB5', trait: 'Regulasi ketat. Klaim salah = penalti x3.', bias: { claim: 1.8, vo: 0.6, face: 0.4, repeat: 0.6 }, baseER: 3.2, armyNeed: 45, claimMult: 3 },
  { id: 'property', name: 'Property', color: '#FFD966', dark: '#A87708', trait: 'Banyak video tur unit.', bias: { claim: 1, vo: 1.4, face: 1.6, repeat: 1.5 }, baseER: 3.4, armyNeed: 20 },
];
export const BRAND = Object.fromEntries(BRANDS.map((b) => [b.id, b]));

export const WEEKS = {
  1: { code: 'W1', name: 'Army', goal: 'Bangun pasukan 100 akun. Target 800 post per brand per bulan.', unit: 'post' },
  2: { code: 'W2', name: 'Persona', goal: 'Rawat proxy persona selama sebulan. Jaga kredibilitasnya.', unit: 'kredibilitas' },
  3: { code: 'W3', name: 'Initiative', goal: '200 konten inisiatif per brand untuk optimasi performa.', unit: 'konten' },
};

// Rantai kerja per minggu: tiap langkah dikerjakan satu divisi.
export const CHAINS = {
  1: ['budget', 'produce', 'review', 'schedule'],
  2: ['persona_brief', 'produce', 'review', 'schedule'],
  3: ['concept', 'produce', 'review', 'schedule'],
};

export const STEPS = {
  budget: { role: 'bod', name: 'Approve budget Army', kind: 'approve', gate: true },
  concept: { role: 'bod', name: 'Pilih konsep inisiatif', kind: 'concept', gate: true },
  persona_brief: { role: 'dist', name: 'Brief proxy persona', kind: 'work', ai: true },
  produce: { role: 'creative', name: 'Produksi batch konten', kind: 'work', ai: true },
  review: { role: 'pm', name: 'Review batch (Gerbang 3)', kind: 'review', gate: true },
  revise: { role: 'creative', name: 'Revisi batch', kind: 'work', ai: true },
  schedule: { role: 'dist', name: 'Jadwal & distribusi', kind: 'schedule', ai: true },
};

export const DEFECTS = {
  vo: { name: 'VO salah ucap', trust: -6 },
  claim: { name: 'Klaim karangan AI', trust: -7 },
  face: { name: 'Wajah orang ter-capture', trust: -9 },
  repeat: { name: 'Visual berulang', trust: -3 },
  hashtag: { name: 'Post tanpa hashtag brand', trust: -4 },
  hook: { name: 'Hook kaku', trust: -2 },
};

export const CHECKS = {
  listen_vo: { label: 'Dengarkan VO', finds: 'vo', secs: 2.5 },
  read_claims: { label: 'Baca ulang klaim fakta', finds: 'claim', secs: 2.5 },
  check_faces: { label: 'Cek wajah di video final', finds: 'face', secs: 2.5 },
  watch_full: { label: 'Tonton sampai habis', finds: 'repeat', secs: 3 },
};

// Aturan brand (Gerbang 2). good = melindungi dari cacat, bad = malah menambah risiko.
export const RULES = {
  clinic: [
    { id: 'c1', text: 'Klaim treatment hanya dari materi resmi klinik', good: true, covers: 'claim' },
    { id: 'c2', text: 'Cek pengucapan nama treatment di VO', good: true, covers: 'vo' },
    { id: 'c3', text: 'Wajib mention akun klinik & hashtag brand', good: true, covers: 'hashtag' },
    { id: 'c4', text: 'Boleh janji hasil instan biar menarik', good: false, adds: 'claim' },
    { id: 'c5', text: 'Pakai bahasa lo/gue biar akrab', good: false, adds: 'hook' },
  ],
  skincare: [
    { id: 's1', text: 'Meme trend maksimal 1 minggu sejak viral', good: true, covers: 'repeat' },
    { id: 's2', text: 'Sebut kandungan sesuai label produk', good: true, covers: 'claim' },
    { id: 's3', text: 'Hashtag brand di setiap post', good: true, covers: 'hashtag' },
    { id: 's4', text: 'Repost meme yang sama ke semua akun', good: false, adds: 'repeat' },
    { id: 's5', text: 'Klaim "paling ampuh se-Indonesia"', good: false, adds: 'claim' },
  ],
  finance: [
    { id: 'f1', text: 'Tidak menyebut angka bunga tanpa sumber resmi', good: true, covers: 'claim' },
    { id: 'f2', text: 'Wajib disclaimer "terdaftar & diawasi"', good: true, covers: 'claim' },
    { id: 'f3', text: 'Hashtag brand di setiap post', good: true, covers: 'hashtag' },
    { id: 'f4', text: 'Sebut "bunga 0% selamanya" biar menarik', good: false, adds: 'claim' },
    { id: 'f5', text: 'Pakai bahasa formal kaku biar terpercaya', good: false, adds: 'hook' },
  ],
  property: [
    { id: 'p1', text: 'Drone maksimal 1 shot per video', good: true, covers: 'repeat' },
    { id: 'p2', text: 'Fakta hanya dari papan denah unit', good: true, covers: 'claim' },
    { id: 'p3', text: 'Blur wajah orang yang tidak dikenal', good: true, covers: 'face' },
    { id: 'p4', text: 'Sebut harga & jarak ke tol', good: false, adds: 'claim' },
    { id: 'p5', text: 'Pakai footage unit yang sama biar konsisten', good: false, adds: 'repeat' },
  ],
};

// Hook usulan AI (Gerbang 1). q: good | kaku | risky
export const HOOKS = {
  clinic: [
    { text: 'Kulit kusam habis Ramadan? Ini 3 langkah dari dokter kami', q: 'good' },
    { text: 'Aku coba skin booster 30 hari, ini hasil jujurnya', q: 'good' },
    { text: 'Rahasia glowing yang jarang dibahas dokter kulit', q: 'good' },
    { text: 'Klinik kecantikan terpercaya untuk kebutuhan kulit Anda', q: 'kaku' },
    { text: 'Solusi perawatan kulit premium dan profesional', q: 'kaku' },
    { text: 'Dijamin bebas flek dalam 1x treatment!', q: 'risky' },
  ],
  skincare: [
    { text: 'POV: skincare kamu numpuk tapi muka tetap kusam', q: 'good' },
    { text: 'Tes 7 hari: cuma ganti satu step ini', q: 'good' },
    { text: 'Tanggal tua tapi kulit tetap glowing, caranya gini', q: 'good' },
    { text: 'Produk perawatan kulit berkualitas untuk Anda', q: 'kaku' },
    { text: 'Inovasi skincare terbaik masa kini', q: 'kaku' },
    { text: 'Jerawat hilang total dalam semalam!', q: 'risky' },
  ],
  finance: [
    { text: 'Gaji UMR tapi bisa nabung DP? Ini hitungan realistisnya', q: 'good' },
    { text: '3 tanda kamu butuh dana darurat, bukan pinjaman', q: 'good' },
    { text: 'Tanggal tua tapi tetap tenang, rahasianya di sini', q: 'good' },
    { text: 'Solusi finansial terpercaya untuk masa depan Anda', q: 'kaku' },
    { text: 'Layanan keuangan inovatif dan aman', q: 'kaku' },
    { text: 'Pinjam sekarang, bunga 0% selamanya!', q: 'risky' },
  ],
  property: [
    { text: 'Tur unit 24 meter: muat apa aja sih?', q: 'good' },
    { text: 'Jalan sore keliling taman kawasan, vibes-nya gini', q: 'good' },
    { text: 'Dari unit ke kuliner cuma jalan kaki', q: 'good' },
    { text: 'Hunian modern dengan fasilitas lengkap untuk keluarga', q: 'kaku' },
    { text: 'Investasi properti terbaik di lokasi strategis', q: 'kaku' },
    { text: 'Harga naik 50% tahun depan, buruan!', q: 'risky' },
  ],
};

// Petunjuk data untuk tiap brand (dibuka lewat tombol "Buka data").
export const BRAND_DATA = {
  clinic: ['Konten testimoni & edukasi dokter: ER 5,2%', 'Konten iklan formal: ER 1,9%', 'Komentar negatif muncul di post yang menjanjikan hasil instan'],
  skincare: ['Format POV & tes 7 hari: ER 5,8%', 'Post produk formal: ER 2,1%', 'Meme yang direpost >1 minggu: ER turun 40%'],
  finance: ['Konten angka nyata (hitung gaji): ER 5,1%', 'Konten tagline formal: ER 2,3%', 'Sentimen negatif kompetitor karena klaim bunga berlebihan'],
  property: ['Tur unit & jalan-jalan kawasan: ER 4,6%', 'Video brosur formal: ER 1,8%', 'Video dengan footage berulang: retensi turun 35%'],
};

// W1: kebutuhan akun Army per brand (pembagian 100 akun yang ideal).
// W2: kandidat persona.
export const PERSONAS = {
  clinic: [
    { id: 'a', name: 'Mbak Rani · ibu muda', followers: '12rb', fit: 0.9, note: 'Rutin bahas perawatan kulit setelah melahirkan.' },
    { id: 'b', name: 'Kak Juno · beauty enthusiast', followers: '48rb', fit: 0.3, note: 'Followers besar.', hidden: 'Data: 60% followers dari luar negeri, engagement bot.' },
    { id: 'c', name: 'Dinda · mahasiswi', followers: '6rb', fit: 0.6, note: 'Sering review skincare murah.' },
  ],
  skincare: [
    { id: 'a', name: 'Tiara · karyawan muda', followers: '9rb', fit: 0.85, note: 'Konten "rutinitas pagi 5 menit".' },
    { id: 'b', name: 'Bang Oki · komedian', followers: '80rb', fit: 0.35, note: 'Followers paling besar.', hidden: 'Data: audiens 85% laki-laki 25–40 tahun, tidak cocok target.' },
    { id: 'c', name: 'Sasa · makeup artist', followers: '15rb', fit: 0.6, note: 'Review produk makeup.' },
  ],
  finance: [
    { id: 'a', name: 'Mas Dimas · perencana keuangan', followers: '20rb', fit: 0.9, note: 'Bahas anggaran gaji UMR.' },
    { id: 'b', name: 'Cici Lala · crazy rich wannabe', followers: '65rb', fit: 0.25, note: 'Sering pamer gaya hidup.', hidden: 'Data: banyak komentar "flexing", sentimen negatif 40%.' },
    { id: 'c', name: 'Raka · fresh graduate', followers: '7rb', fit: 0.6, note: 'Cerita gaji pertama.' },
  ],
  property: [
    { id: 'a', name: 'Pak Andre · keluarga muda', followers: '11rb', fit: 0.85, note: 'Cerita cari rumah pertama.' },
    { id: 'b', name: 'Kevin · travel vlogger', followers: '70rb', fit: 0.3, note: 'Video sinematik bagus.', hidden: 'Data: domisili luar negeri, belum pernah bahas hunian.' },
    { id: 'c', name: 'Nisa · arsitek interior', followers: '14rb', fit: 0.65, note: 'Tips menata unit kecil.' },
  ],
};

// W3: performa format per brand (ER %). Alokasi 200 konten idealnya ke format terbaik.
export const FORMATS = [
  { id: 'carousel', name: 'Carousel edukasi' },
  { id: 'video', name: 'Video pendek' },
  { id: 'meme', name: 'Meme trend' },
  { id: 'threads', name: 'Threads diskusi' },
];
export const FORMAT_ER = {
  clinic: { carousel: 5.0, video: 4.2, meme: 2.0, threads: 2.6 },
  skincare: { carousel: 3.0, video: 5.6, meme: 4.8, threads: 2.2 },
  finance: { carousel: 5.2, video: 3.0, meme: 2.4, threads: 4.4 },
  property: { carousel: 2.8, video: 5.0, meme: 1.6, threads: 2.0 },
};

// W3: dua konsep inisiatif per brand. Konsep yang benar = sesuai data format terbaik.
export const CONCEPTS = {
  clinic: [{ text: 'Seri carousel "Tanya Dokter" tiap minggu', good: true }, { text: 'Seri meme "kulit kusam vibes"', good: false }],
  skincare: [{ text: 'Seri video pendek "Tes 7 Hari"', good: true }, { text: 'Seri Threads panjang soal kandungan', good: false }],
  finance: [{ text: 'Seri carousel "Hitung Gaji Bareng"', good: true }, { text: 'Seri video sinematik motivasi', good: false }],
  property: [{ text: 'Seri video "Tur Unit 60 Detik"', good: true }, { text: 'Seri carousel brosur harga', good: false }],
};

// Event kantor. grade: best | ok | bad. fx: efek ke trust/feromon/budget/kredit/stress.
export const EVENTS = [
  {
    id: 'layered_approval', role: 'pm', brand: 'clinic', title: 'Approval berlapis',
    text: 'PIC Beauty Clinic udah approve, tapi bosnya belum. Approval L2 ketahan nih.',
    choices: [
      { t: 'Minta PIC jadwalkan 15 menit dengan bosnya, kirim ringkasan', grade: 'best', fx: { trust: 4, stress: 2 } },
      { t: 'Geser timeline, kabari tim', grade: 'ok', fx: { trust: 0 } },
      { t: 'Tayangin aja, toh PIC udah approve', grade: 'bad', fx: { trust: -10 } },
    ],
  },
  {
    id: 'slow_pic', role: 'pm', brand: null, title: 'PIC lama balas',
    text: 'PIC klien belum balas 2 hari, padahal butuh approval konten minggu ini.',
    choices: [
      { t: 'Rangkum semua pertanyaan jadi 1 pesan + tenggat yang jelas', grade: 'best', fx: { trust: 3 } },
      { t: 'Tunggu aja sampai dia balas', grade: 'ok', fx: { trust: -1 } },
      { t: 'Follow up tiap jam sampai dibalas', grade: 'bad', fx: { trust: -5, feromon: -2 } },
    ],
  },
  {
    id: 'talent_mismatch', role: 'dist', brand: 'skincare', title: 'Talent nggak cocok kategori',
    text: 'Talent untuk kategori "Ramadan Core" ternyata non-muslim. Kontennya jadi kurang pas.',
    choices: [
      { t: 'Cek data profil talent, pindahkan ke kategori umum', grade: 'best', fx: { trust: 3 }, data: true },
      { t: 'Ganti talent baru (biaya tambahan)', grade: 'ok', fx: { budget: -2 } },
      { t: 'Tetap jalan, nggak ada yang sadar', grade: 'bad', fx: { trust: -8 } },
    ],
  },
  {
    id: 'hashtag_missing', role: 'dist', brand: null, title: 'Hashtag ketinggalan',
    text: '12 post Army nggak pakai hashtag brand, jadi nggak kebaca di tools monitoring.',
    choices: [
      { t: 'Edit caption sekarang + pasang aturan hashtag di SOP', grade: 'best', fx: { trust: 2 } },
      { t: 'Hapus postnya', grade: 'ok', fx: { trust: -1 } },
      { t: 'Biarin aja, nanti juga ketutup post lain', grade: 'bad', fx: { trust: -5 } },
    ],
  },
  {
    id: 'revision_after_final', role: 'creative', brand: null, title: 'Revisi setelah final',
    text: 'Klien minta revisi padahal kontennya udah final approve kemarin.',
    choices: [
      { t: 'Cek notulen approval, nego jadi revisi minor', grade: 'best', fx: { trust: 2 }, data: true },
      { t: 'Turutin semua revisinya', grade: 'ok', fx: { credits: -10, stress: 8 } },
      { t: 'Tolak mentah-mentah', grade: 'bad', fx: { trust: -7 } },
    ],
  },
  {
    id: 'footage_out', role: 'creative', brand: 'property', title: 'Footage habis',
    text: 'Stok footage unit habis. AI mulai pakai klip yang sama berulang-ulang.',
    choices: [
      { t: 'Minta Vendor shooting footage baru', grade: 'best', fx: { budget: -3, trust: 2 } },
      { t: 'Pakai foto unit + latar blur dulu', grade: 'ok', fx: {} },
      { t: 'Biarin AI pakai klip yang ada', grade: 'bad', fx: { trust: -4 } },
    ],
  },
  {
    id: 'budget_lock', role: 'bod', brand: null, title: 'Kunci budget',
    text: 'Budget kampanye harus dikunci hari ini. Ada satu item homeless media yang mahal banget.',
    choices: [
      { t: 'Bandingkan data reach, ganti ke media yang lebih efisien', grade: 'best', fx: { budget: 2 }, data: true },
      { t: 'Tetap ambil, nama besar', grade: 'ok', fx: { budget: -4 } },
      { t: 'Potong budget Army buat nutupin', grade: 'bad', fx: { trust: -5 } },
    ],
  },
  {
    id: 'competitor_sentiment', role: 'bod', brand: 'finance', title: 'Kompetitor kena serang',
    text: 'Akun kompetitor diserbu komentar negatif karena klaim berlebihan.',
    choices: [
      { t: 'Jadikan learning: perketat aturan klaim kita', grade: 'best', fx: { trust: 3 }, data: true },
      { t: 'Cuekin aja', grade: 'ok', fx: {} },
      { t: 'Serang balik pakai Army', grade: 'bad', fx: { trust: -9 } },
    ],
  },
  {
    id: 'new_member', role: 'pm', brand: null, title: 'Anggota baru',
    text: 'Ada anggota baru gabung hari ini. Dia bingung mulai dari mana.',
    choices: [
      { t: 'Onboarding 15 menit + kasih SOP & board', grade: 'best', fx: { feromon: 6 } },
      { t: 'Langsung kasih kerjaan aja', grade: 'ok', fx: { feromon: -1 } },
      { t: 'Suruh baca chat grup 3 bulan ke belakang', grade: 'bad', fx: { feromon: -6 } },
    ],
  },
  {
    id: 'too_many_groups', role: 'bod', brand: null, title: 'Kebanyakan grup',
    text: 'Satu project punya 7 grup WA. Info penting tercecer di mana-mana.',
    choices: [
      { t: 'Rapikan jadi 1 grup + 1 board tugas', grade: 'best', fx: { feromon: 8 } },
      { t: 'Biarin, udah biasa', grade: 'ok', fx: { feromon: -2 } },
      { t: 'Bikin grup baru buat koordinasi grup-grup', grade: 'bad', fx: { feromon: -8 } },
    ],
  },
];

export const SPEEDS = {
  santai: { label: 'Santai', f: 1.5 },
  normal: { label: 'Normal', f: 1 },
  cepat: { label: 'Cepat', f: 0.65 },
  test: { label: 'Test', f: 0.12 },
};

// Durasi dasar (detik nyata, dikali faktor speed).
export const TIMING = {
  brainstorm: 150,
  day: 100,
  gate4: 90,
  results: 60,
  report: 150,
  manual: 8,
  ai: 2,
  npc: 10,
  revise: 4,
  eventTTL: 30,
};

export const CREDITS_PER_WEEK = 60;
export const AI_COST = { produce: 10, persona_brief: 5, revise: 5, schedule: 5, review: 5, concept: 5, budget: 5, hook: 5 };
