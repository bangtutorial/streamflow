# StreamFlow: Aplikasi Live Streaming Multi-Window

StreamFlow adalah aplikasi live streaming yang memungkinkan kamu untuk melakukan siaran langsung ke berbagai platform seperti YouTube, Facebook, dan lainnya menggunakan protokol RTMP. Aplikasi ini berjalan di lingkungan VPS (Virtual Private Server) dan mendukung streaming ke banyak platform sekaligus dengan fitur multi-window. StreamFlow juga dilengkapi dengan fitur login dan history streaming untuk melacak aktivitasmu.

## Fitur Utama:

* **Multi-Window Streaming:** Bisa melakukan siaran ke beberapa platform sekaligus dalam satu aplikasi.
* **Dukungan Banyak Platform:** Bisa streaming ke YouTube, Facebook, dan platform lain yang mendukung RTMP.
* **Login Page:** Ada fitur login supaya hanya pemilik akun yang bisa akses aplikasi.
* **Riwayat Streaming:** Semua aktivitas streaming tersimpan, jadi bisa dilihat kembali kapan saja.

## Cara Instalasi:

**Sebelum mulai:** Pastikan server / VPS kamu sudah terinstall Node.js, npm, dan FFmpeg sebelum meng-clone repositori ini.

1. **Install Node.js dan npm melalui NodeSource PPA:**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo apt-get install -y npm
   ```
   Cek apakah instalasi berhasil:
   ```bash
   node -v
   npm -v
   ```

2. **Install FFmpeg:**

   ```bash
   sudo apt-get update
   sudo apt-get install -y ffmpeg
   ```
   Cek apakah instalasi berhasil:
   ```bash
   ffmpeg -version
   ```

3. **Clone Repositori:**
   ```bash
   git clone https://github.com/bangtutorial/StreamFlow/
   cd streamflow
   ```

4. **Install Dependensi:**
   Jalankan `npm install` untuk menginstal semua modul Node.js yang dibutuhkan seperti Express.js, SQLite3, bcryptjs, dan lainnya.

   ```bash
   npm install
   ```

5. **Jalankan Aplikasi:**
   ```bash
   npm start
   ```
   Untuk mode development dengan auto-reload, gunakan:
   ```bash
   npm run dev
   ```

6. **Konfigurasi:**
    * Pastikan kamu sudah mengatur URL RTMP yang sesuai untuk setiap platform yang ingin digunakan. Konfigurasi ini bisa dilakukan langsung melalui tampilan aplikasi.
    * Silahkan dapatkan Stream Key dari platform streaming yang kamu gunakan.

## Informasi Tambahan:

* Aplikasi ini menggunakan Express.js sebagai backend, SQLite sebagai database, dan FFmpeg untuk encoding serta streaming.
* Antarmuka pengguna dibuat dengan HTML, CSS, dan JavaScript, serta menggunakan Tailwind CSS untuk styling.
* Aplikasi ini dirancang untuk berjalan di server dengan Node.js, bukan di browser lokal.

## Changelog:

### Version 1.0 - Feb 06, 2025
- **Added:**
  * Added: Halaman setup akun
  * Added: Halaman login
  * Added: Halaman history
  * Added: Pengaturan akun

- **Fixed:**
  * Fixed: Streaming hilang jika dibuka di browser berbeda
  * Fixed: Streaming berhenti sendiri

- **Improvement:**
  * Improvement: Pembaruan tampilan aplikasi

### Version 1.0 Beta - Jan 22, 2025
- Aplikasi dirilis (untuk internal)

## Kontribusi:

Jika teman-teman punya ide atau perbaikan koding aplikasi ini, silakan buat pull request 🤝

## Lisensi:

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/bangtutorial/streamflow/LICENSE)

Hak Cipta © 2025 - [Bang Tutorial](https://youtube.com/bangtutorial)

Aplikasi ini disediakan "SEBAGAIMANA ADANYA", tanpa jaminan apa pun, baik tersurat maupun tersirat, termasuk tetapi tidak terbatas pada jaminan kelayakan untuk diperdagangkan, kesesuaian untuk tujuan tertentu, dan non-pelanggaran. Dalam keadaan apa pun, penulis atau pemegang hak cipta tidak bertanggung jawab atas klaim, kerusakan, atau kewajiban lainnya.

## Kontak:

Jika ada pertanyaan, silahkan hubungi info.bangtutorial@gmail.com.