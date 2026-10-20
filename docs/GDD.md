# Semut Rangrang: Office Life — Game Design Document

Versi 0.1 · 20 Oktober 2026

Mockup visual: https://claude.ai/artifact/X3jXUmrWm3WANiDmru4nMu

---

## 1. Ringkasan

Game simulasi kehidupan kantor agency yang dimainkan bareng secara real-time di browser. Tiap pemain jadi satu semut rangrang di satu divisi, lalu menjalankan 4 brand selama 1 bulan (4 loop mingguan). Di setiap meja ada **AI Assistant**: cepat, tapi butuh manusia di titik-titik penting.

Metafora intinya: semut rangrang membangun sarang dengan menarik dan menjahit daun bersama-sama, dan tidak ada satu semut pun yang bisa melakukannya sendirian. Di game ini, setiap konten adalah "daun" yang hanya jadi kalau beberapa divisi menyambung jadi satu rantai.

Gaya visual: cozy 3D ala game Nintendo (referensi: Animal Crossing). Karakter semut rangrang chibi, kantor dari anyaman daun di pohon mangga, UI berbentuk dialog box bulat, menu dengan kursor, dan tombol A/X/Y.

## 2. Tiga hal inti

### 2.1 Objective

**Untuk pemain:** bertahan satu bulan dan mempertahankan retainer 4 brand dengan memenuhi target mingguan (lihat bagian 4).

**Untuk perusahaan:**
- Tiap divisi paham kapan memakai AI, kapan wajib turun tangan sendiri, dan cara membaca data untuk mengambil keputusan.
- BOD mendapat gambaran sejauh mana karakter dan skill tim berkembang (bagian 9).

### 2.2 Mekanisme

Ritme mingguan (Senin brainstorm, Selasa–Kamis produksi, Jumat distribusi), kerja berantai antar divisi, AI Assistant dengan cacat tersembunyi yang dijaga 4 Gerbang Manusia, data di setiap keputusan, dan event kantor dari drama nyata. Detail di bagian 5–8.

### 2.3 Final result

- **Untuk pemain:** layar report akhir bulan berisi status retainer per brand, skor koloni, dan skor AI & Data Literacy per divisi.
- **Untuk BOD (back end):** dashboard Profil Skill Tim berisi radar skill per orang dan divisi, label karakter, tren antar sesi, peta kolaborasi, dan gap tim.

## 3. Struktur perusahaan (peran yang bisa dimainkan)

| Peran | Tanggung jawab di game | Pemakaian AI utama |
|---|---|---|
| **BOD** | Pilih arah strategi, kunci ide, tulis insight "what & why" di report, approve budget besar | AI menarik trend dan data; manusia memutuskan arah |
| **Project Management** | Timeline, budget, SOW, kredit AI, komunikasi dengan klien, izin tayang | AI menghitung biaya kredit dan memantau deadline |
| **Distribution** | Army, Proxy Persona, KOL: rekrut, jadwal, distribusi, comment seeding, cek hashtag | AI menjadwalkan post Army, membuat shortlist talent, dan draft seeding |
| **Creative** | Semua hal soal konten: hook, script, caption, visual, video | AI membuat hook, caption 3 platform, dan clipper batch video |

**Sub (NPC yang bisa disewa):**
- **Vendor**: produksi besar (shooting, footage baru). Mahal, butuh waktu tunggu, hasilnya andal.
- **Freelancer**: mengisi divisi kosong atau membantu saat volume tinggi. Kualitasnya bervariasi dan perlu dibrief dengan jelas.

**Prinsip:** semua peran harus mengerti data. Setiap peran punya panel data dan ikut dinilai pada skill Data Literacy.

Kalau sebuah divisi tidak ada pemainnya, divisi itu dijalankan Freelancer NPC dengan kualitas standar.

## 4. Struktur run: 1 bulan = 4 loop

### 4.1 Empat brand (per segmen, tanpa nama asli)

| Brand | Sifat klien | Event khas |
|---|---|---|
| Beauty · Clinic | Premium, approval berlapis | PIC approve tapi bos klien belum; fakta treatment harus akurat |
| Beauty · Skincare | Cepat, banyak trend dan meme | Kampanye musiman, talent tidak cocok kategori kampanye |
| Finance | Regulasi ketat | Klaim salah kena penalti x3 |
| Property | Banyak video tur unit | Footage habis, wajah orang ter-capture, fakta hanya dari papan denah |

### 4.2 Empat minggu

| Minggu | Fokus | Target per brand | Mekanik |
|---|---|---|---|
| W1 | **Army** | 100 akun (Rp15rb/akun/bulan), **800 post per bulan** | Resource management: rekrut akun, bagi ke brand, rotasi akun yang kena flag spam |
| W2 | **Persona** | Proxy persona dirawat selama 1 bulan | Nurturing: meter Kredibilitas dan Konsistensi per persona |
| W3 | **Initiative** | **200 konten inisiatif** untuk mengoptimalkan performa brand | Alokasi 200 konten ke format (carousel, video, meme, Threads) berdasarkan data; high risk, high reward |
| W4 | **Evaluasi → Report** | Report per brand | AI menyusun data W1–W3, manusia menulis insight "what & why"; skor menentukan retainer bulan depan |

### 4.3 Ritme harian dalam seminggu

| Hari | Fase | Lokasi | Gerbang manusia |
|---|---|---|---|
| Senin | Brainstorm + Referensi/Learning | Ruang Meeting | Gerbang 1 (pilih ide), Gerbang 2 (aturan brand) |
| Selasa–Kamis | Production → Review | Meja masing-masing | Gerbang 3 (review batch) |
| Jumat | Distribute + Weekly Update | Ruang Meeting | Gerbang 4 (izin tayang) |

Waktu game: 1 hari kerja ≈ 5 menit nyata, jadi 1 minggu ≈ 25 menit dan 1 bulan penuh ≈ 1,5–2 jam. **Quick Run** (1 minggu saja) tersedia untuk sesi singkat.

## 5. Mekanik kerja tim

### 5.1 Oper daun (handoff)
Setiap tugas punya rantai peran. Contohnya konten KOL: Distribution (cari talent) → Project Management (SOW dan budget) → Creative (brief dan konten) → Distribution (tayang dan tracking). Pemain berjalan ke meja rekan dan menekan **A** untuk mengoper.

- Handoff cepat dan lengkap → combo **Rantai Rangrang** (kualitas naik, revisi berkurang).
- Info kurang (misal brief tanpa aturan, post tanpa hashtag) → daun lepas, tugas mundur satu tahap.

### 5.2 Feromon tim
Meter kekompakan tim. Naik dari handoff yang lancar, saling bantu, dan pesan yang berguna. Turun dari spam chat, tugas yang ditahan terlalu lama, dan informasi yang tercecer di terlalu banyak grup.

### 5.3 Komunikasi
- **Chat dekat**: hanya terdengar dalam radius tertentu di peta.
- **Grup WA in-game**: untuk semua pemain, tapi dibatasi token feromon (spam akan mengurangi Feromon).
- **Kanal klien**: pesan klien NPC (feedback, revisi, approval).

### 5.4 Resource
Budget, Kredit AI (per brand per minggu), Feromon tim, Client Trust per brand, dan Stress per semut (stress penuh berujung izin atau sakit).

## 6. AI dalam produksi

Diadaptasi dari dokumen internal *Workflow Video Clipper: Manusia vs AI*. Prinsipnya: manusia yang menentukan mau bikin apa dan boleh tayang atau tidak, AI yang mengerjakan sisanya.

### 6.1 Alur 10 tahap

| # | Tahap | Pelaku |
|---|---|---|
| 1 | Brief dan bahan mentah | Manusia |
| 2 | Pilih ide dan hook | **Gerbang 1** |
| 3 | Tentukan aturan brand | **Gerbang 2** |
| 4 | Pilih footage dan aset | AI |
| 5 | Rapikan aset | AI |
| 6 | Edit dan render batch | AI |
| 7 | Review batch (tiap 8–10 konten) | **Gerbang 3** |
| 8 | Caption 3 platform | AI |
| 9 | Izin tayang | **Gerbang 4** |
| 10 | Jadwal dan distribusi | AI |

AI tidak bisa melompati gerbang. Kalau review di tahap 7 menemukan masalah, konten kembali ke tahap 6.

### 6.2 Papan Aturan Brand ("cukup bilang sekali")
Aturan yang dipasang di Gerbang 2 (misal "drone maksimal 1 shot", "tanpa harga", "tanpa lo/gue") otomatis dipatuhi AI di semua batch berikutnya. Pemain yang rajin mengisi aturan di awal menghemat banyak revisi.

### 6.3 Cacat tersembunyi
Setiap output AI punya peluang membawa cacat yang tidak terlihat sampai pemain melakukan aksi cek yang tepat.

| Cacat | Ketahuan lewat aksi | Kalau lolos ke tayang |
|---|---|---|
| VO salah ucap | Dengarkan VO | Client Trust turun |
| Hook kaku | Voting tim di Gerbang 1 | Engagement turun |
| Wajah orang ter-capture | Cek wajah di video final | Krisis, Client Trust turun banyak |
| Klaim karangan AI | Baca ulang klaim fakta | Penalti x3 di Finance |
| Footage berulang | Minta footage baru (Vendor) | Engagement turun |
| Connector/izin belum aktif | PM memberi izin | Produksi tertunda |

Peluang cacat turun kalau Papan Aturan Brand lengkap.

### 6.4 Ekonomi AI
Kerja manual lambat tapi aman. Kerja pakai AI cepat, makan kredit, dan butuh review. Strategi terbaik adalah AI ditambah review di gerbang yang tepat.

## 7. Data di setiap keputusan

- **Panel "Data hari ini"** di kantor: progres post, engagement rate, sentimen, dan post tanpa hashtag.
- **Data + Referensi** di brainstorm: performa format minggu lalu, trend, dan sentimen kompetitor.
- **Alokasi 200 konten inisiatif** (W3): hasilnya lebih baik kalau alokasi mengikuti data performa format.
- **Report W4**: AI menyusun angka, manusia wajib menulis insight "what & why" (ANABEL). Insight dinilai dari relevansinya dengan data.

## 8. Event kantor

Diambil dari pola nyata di grup kerja, lalu difiksikan:

- PIC klien approve, tapi bos klien belum
- PIC klien lama membalas
- Revisi masuk setelah final approve
- Talent tidak cocok dengan kategori kampanye
- Post lupa pakai hashtag brand, tidak terbaca di tools
- Budget harus dikunci, item mahal dibuang
- SOW belum masuk, talent belum ada kontak
- Koneksi meeting online error saat Weekly Update
- Anggota baru bergabung, perlu onboarding
- Terlalu banyak grup chat, Feromon turun
- Sentimen negatif di akun kompetitor (peluang atau jebakan)

## 9. Back end: Profil Skill Tim

### 9.1 Identitas tanpa login
- Pemain memasukkan **kode pemain** sederhana (misal `ARUNI-7`) dan **kode tim**. Tidak ada akun atau password.
- Kode pemain disimpan di browser supaya tidak perlu diketik ulang.
- Progres orang yang sama terhubung antar sesi lewat kode pemain.
- Layar masuk menampilkan satu baris netral: *"Progres kamu disimpan pakai kode pemain."*

### 9.2 Event log
Setiap aksi pemain disimpan sebagai event:

```json
{
  "session_id": "s_2026-10-21_01",
  "team_code": "SEMUT",
  "player_code": "ARUNI-7",
  "role": "creative",
  "week": 3,
  "day": "rabu",
  "game_time": "13:10",
  "type": "gate_check",
  "payload": { "gate": 3, "action": "listen_vo", "defect_found": "vo_mispronounce", "brand": "property" },
  "ts": "2026-10-21T08:12:44Z"
}
```

Tipe event utama: `handoff`, `chat_message`, `ai_use`, `gate_check`, `gate_skip`, `defect_caught`, `defect_leaked`, `data_view`, `decision`, `rule_added`, `vote`, `event_choice`, `insight_written`, `task_done`, `deadline_missed`.

### 9.3 Enam skill

| Skill | Diukur dari |
|---|---|
| **AI Literacy** | AI dipakai di tahap yang cocok, bukan untuk mengganti gerbang; efisiensi kredit; aturan brand yang ditulis |
| **Data Literacy** | Data dibuka sebelum keputusan; keputusan selaras data; kualitas insight "what & why" |
| **Ketelitian** | Rasio cacat tertangkap dibanding cacat lolos ke tayang |
| **Kolaborasi** | Jumlah dan kecepatan handoff, membantu tugas orang lain, rasio pesan berguna dibanding spam |
| **Manajemen waktu** | Deadline terpenuhi, lama tugas tertahan di meja sendiri |
| **Client handling** | Pilihan saat event klien dan dampaknya ke Client Trust |

Skor tiap skill 0–100, dihitung per sesi lalu dirata-rata bergerak (moving average) antar sesi.

### 9.4 Label karakter
Diturunkan dari pola perilaku, misalnya:

| Label | Pola |
|---|---|
| Si Teliti | Ketelitian tinggi, sering melakukan aksi cek |
| Si Gas Terus | Sering skip review, kecepatan tinggi, banyak cacat lolos |
| Si Penghubung | Pusat handoff di peta kolaborasi |
| Si Data-Driven | Data Literacy tinggi, keputusan selalu didahului data |
| Si Pemadam Kebakaran | Paling sering menangani event klien |
| Si Solo Player | Jarang handoff, menahan tugas lama |

### 9.5 Dashboard BOD
Diakses lewat kode admin terpisah (bukan dari dalam game).

- Radar chart 6 skill per orang dan per divisi
- Tren skill antar sesi
- Peta kolaborasi: siapa paling sering mengoper ke siapa, siapa yang jadi bottleneck
- Gap tim, misalnya "Distribution masih lemah di Data Literacy"
- Riwayat cacat AI yang lolos per divisi

## 10. Layar utama

Mockup: https://claude.ai/artifact/X3jXUmrWm3WANiDmru4nMu

1. **Title Screen**: logo, menu utama, kolom nama dan kode room.
2. **Kantor**: peta kantor isometrik, name tag per divisi, panel data, dialog event, tombol aksi.
3. **Meja Kerja + AI Assistant**: alur 10 tahap, robot AI, aksi review di Gerbang 3, Papan Aturan Brand.
4. **Ruang Meeting (Senin)**: kartu ide hologram dari AI, voting dengan papan, panel data dan referensi.
5. **Report Jumat W4**: trofi per brand, status retainer, AI & Data Literacy per divisi.

Gambar di mockup adalah concept art (target tampilan). Aset game final dibuat ulang dengan gaya yang sama.

## 11. Teknis

| Bagian | Pilihan |
|---|---|
| Frontend | React + TypeScript + Vite; Phaser 3 untuk peta kantor |
| Multiplayer | Colyseus (Node): room dengan kode, sinkronisasi state otomatis |
| Identitas | Kode pemain + kode tim, disimpan di localStorage |
| Penyimpanan event dan skill | PostgreSQL (misal Supabase); tabel `players`, `sessions`, `events`, `skill_snapshots` |
| Konten | File JSON: brand, event, kartu cacat AI, aturan, peran |
| AI di dalam game | Fase 1: disimulasikan dari tabel kartu (tanpa biaya API). Fase 2 (opsional): Claude API untuk hook, caption, dan feedback klien |
| Hosting | Frontend di Vercel/Netlify, server Colyseus di Fly.io/Railway |

## 12. Roadmap

| Fase | Isi |
|---|---|
| M0 | GDD (dokumen ini) dan file data JSON |
| M1 | Kantor multiplayer: masuk dengan kode room dan kode pemain, jalan-jalan, chat, papan tugas bersama |
| M2 | Satu loop mingguan untuk 1 brand, 4 Gerbang Manusia, AI Assistant simulasi, event log |
| M3 | 4 brand, W1–W4, event kantor, report, skor |
| M4 | Dashboard BOD (skill, label karakter, peta kolaborasi), polish art, playtest |
| M5 | Opsional: integrasi Claude API |

## 13. Catatan konten
- Nama karakter di game diisi sendiri oleh pemain. Nama brand memakai segmen, bukan nama klien asli.
- Event dan dialog terinspirasi dari pola kerja nyata, tetapi ditulis ulang tanpa nomor telepon, nama klien, atau tautan internal.

## 14. Status implementasi (v1)

Sudah bisa dimainkan (lihat README). Yang sudah jalan:

- Title, lobby dengan kode room dan link undangan, pilih divisi, mode Quick Run atau 1 bulan, tiga kecepatan
- Brainstorm Senin: data brand, vote hook (Gerbang 1), aturan brand (Gerbang 2), rencana minggu W1/W2/W3
- Kantor real-time: jalan-jalan, meja per divisi, oper tugas (jalan kaki atau lempar via grup WA), combo Rantai Rangrang, Feromon, stress dan pantry, event klien, chat dekat dan grup WA
- AI Assistant dengan cacat tersembunyi, review 4 cek di Gerbang 3, revisi, Gerbang 4 hari Jumat
- Weekly Update, Evaluasi → Report dengan insight "what & why", skor koloni
- Event log, 6 skill, label karakter, dashboard BOD

Penyesuaian dari rancangan:
- Struktur divisi mengikuti BOD, Project Management, Distribution, Creative. Vendor dan Freelancer jadi NPC yang mengerjakan langkah divisi kosong (lebih lambat dan lebih sering meloloskan cacat).
- AI di dalam game masih disimulasikan dari tabel (fase 1). Belum memanggil API AI sungguhan.
- Penyimpanan memakai SQLite bawaan Node, bukan PostgreSQL, supaya cukup satu server.

## 15. Pertanyaan terbuka
- Siapa saja yang memegang kode admin dashboard BOD?
- Berapa lama data event disimpan?
- Durasi sesi yang paling realistis untuk tim: Quick Run 25 menit atau run penuh 1,5–2 jam?
