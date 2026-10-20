# Semut Rangrang: Office Life

Game simulasi kantor agency, multiplayer di browser tanpa login. Tiap pemain jadi satu semut di satu divisi (BOD, Project Management, Distribution, Creative) dan menjalankan 4 brand (Beauty Clinic, Beauty Skincare, Finance, Property) bersama AI Assistant.

- Game Design Document: [docs/GDD.md](docs/GDD.md)
- Mockup visual: https://claude.ai/artifact/X3jXUmrWm3WANiDmru4nMu

## Cara main

1. Buka game, isi **nama**, **kode pemain** (misal `ARUNI-7`), dan **kode tim** (misal `SEMUT`).
2. Satu orang klik **Bikin room baru**, lalu bagikan link undangan atau kode room ke tim.
3. Di lobby, tiap orang pilih divisi. Divisi yang kosong dikerjakan Freelancer (NPC).
4. Host pilih mode (**Quick Run** 1 minggu atau **1 Bulan Penuh**) dan kecepatan, lalu klik **Mulai!**

Satu minggu berjalan seperti ini:

| Hari | Yang dilakukan |
|---|---|
| Senin | Brainstorm bareng: buka data brand, vote hook (Gerbang 1), pasang aturan brand (Gerbang 2), lalu rencana minggu: bagi 100 akun Army (W1), pilih proxy persona (W2), atau alokasikan 200 konten inisiatif (W3) |
| Selasa–Kamis | Kerja di kantor: jalan ke mejamu, kerjakan tugas (manual atau pakai AI), lalu oper "daun" ke meja divisi berikutnya. Review batch di Gerbang 3 untuk menangkap cacat AI. Tangani event klien |
| Jumat | Gerbang 4: izin tayang. Lalu Weekly Update dengan hasil per brand |

Setelah minggu terakhir: **Evaluasi → Report**. Semua pemain menulis insight "what & why" dari data, lalu keluar skor koloni dan AI & Data Literacy per divisi.

**Kontrol:** WASD/panah untuk jalan, **E** untuk interaksi, **Tab** untuk papan tugas, **Enter** untuk chat, **Esc** untuk menutup panel. Di HP muncul joystick dan tombol E.

## Dashboard BOD

Buka `/admin` dan masukkan kode admin (env `ADMIN_CODE`, default `RANGRANG-BOD`; **ganti ini sebelum dipakai**). Isinya:

- Radar 6 skill per divisi: AI Literacy, Data Literacy, Ketelitian, Kolaborasi, Manajemen Waktu, Client Handling
- Kartu per orang: skor skill (rata-rata antar sesi), label karakter, tren AI & Data
- Gap tim (skill di bawah 60), peta oper tugas, riwayat sesi, cacat AI yang lolos ke tayang

Data pemain dilacak lewat kode pemain, jadi minta tiap orang selalu pakai kode yang sama.

## Menjalankan

Butuh Node.js 22.5 atau lebih baru.

```bash
npm install
npm start          # http://localhost:8080
npm test           # simulasi 1 bulan penuh dengan 4 bot
```

Untuk main bareng dalam satu WiFi kantor, jalankan `npm start` di satu laptop, lalu yang lain buka `http://<IP-laptop-itu>:8080`.

### VPS sendiri (Ubuntu + nginx)

Di VPS, dari folder repo hasil clone:

```bash
sudo bash deploy/setup.sh sarang.semut.cloud email@kamu.com
```

Skrip ini memasang Node.js 22, menjalankan game sebagai service systemd di port 3100 (ubah dengan `PORT=xxxx sudo -E bash ...`), membuat konfigurasi nginx (termasuk WebSocket), dan memasang sertifikat HTTPS Let's Encrypt. Kode admin dibuat acak dan disimpan di `/etc/semut-rangrang.env`. Database ada di `/var/lib/semut-rangrang/`.

Untuk update: `git pull` lalu jalankan skrip yang sama lagi. Kode admin dan database tetap.

Log: `journalctl -u semut-rangrang -f`

### Online

Game ini satu server Node (WebSocket + SQLite), jadi butuh hosting yang menjalankan proses Node terus-menerus, bukan hosting statis.

- **Render:** hubungkan repo ini, Render akan membaca `render.yaml` (layanan web + disk 1 GB untuk database). Kode admin dibuat otomatis; lihat di tab Environment.
- **Railway / Fly.io / VPS:** pakai `Dockerfile`. Pasang volume ke `/data` supaya database skill tidak hilang saat restart.

Variabel lingkungan: `PORT` (default 8080), `DB_FILE` (default `data/semut.db`), `ADMIN_CODE`.

## Struktur

```
server/   index.js (HTTP + WebSocket + API admin), game.js (simulasi), skills.js, db.js
shared/   content.js (brand, aturan, hook, event, persona), map.js (layout kantor)
client/   index.html, main.js (UI), office.js (kantor canvas), admin.html/js, assets/
test/     sim.mjs
```
