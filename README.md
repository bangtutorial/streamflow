![logo](https://github.com/user-attachments/assets/50231124-d546-43cb-9cf4-7a06a1dad5bd)

# StreamFlow v2.0: Fresh From The Oven🔥

StreamFlow adalah aplikasi live streaming yang memungkinkan kamu untuk melakukan live streaming ke berbagai platform seperti YouTube, Facebook, dan platform lainnya menggunakan protokol RTMP. Aplikasi ini bisa berjalan di VPS (Virtual Private Server) dan mendukung streaming ke banyak platform sekaligus.

![Untitled-2](https://github.com/user-attachments/assets/3d7bb367-a1b2-43a5-839b-b6aa8dd5de90)

## 🚀 Fitur Utama

- **Multi-Platform Streaming**: Mendukung streaming ke berbagai platform populer
- **Video Gallery**: Kelola koleksi video dengan mudah
- **Upload Video**: Upload video dari local atau import dari Google Drive
- **Scheduled Streaming**: Jadwalkan streaming dengan waktu tertentu
- **Advanced Settings**: Kontrol bitrate, resolution, FPS, dan orientasi
- **Real-time Monitoring**: Monitor status streaming secara real-time
- **Responsive UI**: Tampilan modern yang responsive di semua device

## 📋 Requirements

- **Node.js** v16 atau lebih baru
- **FFmpeg**
- **SQLite3** (sudah termasuk)
- **VPS/Server** dengan minimal 1Core & 1GB RAM
- **Port** 7575 (dapat diubah di [.env](.env))

## 🛠️ Instalasi di VPS

### 1. Persiapan VPS

Update sistem:

```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs
```

Verifikasi instalasi Node.js:

```bash
node --version
npm --version
```

Install FFmpeg:

```bash
sudo apt install ffmpeg -y
```

Verifikasi FFmpeg:
```bash
ffmpeg -version
```

Install Git:

```bash
sudo apt install git -y
```

### 2. Setup Projek StreamFlow

Clone repository ke VPS:

```bash
git clone https://github.com/bangtutorial/streamflow
```

Masuk ke folder project:

```bash
cd streamflow
```

Install dependencies:

```bash
npm install
```

Generate session secret:

```bash
npm run generate-secret
```

**Konfigurasi tambahan (opsional):**

Port default aplikasi adalah **7575**. Jika perlu ubah port, edit file [.env](.env) (contoh: 8080, 3300, dll):

```bash
nano .env
```

### 3. Setup Firewall

Buka port sesuai dengan yang ada di .env (default: 7575):

```bash
sudo ufw allow 7575
```

Aktifkan firewall:

```bash
sudo ufw enable
```

Cek status firewall:

```bash
sudo ufw status
```

### 4. Install Process Manager (PM2)

Install PM2:

```bash
sudo npm install -g pm2
```

### 5. Cara Jalankan Aplikasi StreamFlow

Pastikan kamu masih berada di folder **streamflow**, jalankan perintah ini:

```bash
pm2 start app.js --name streamflow
```

Akses aplikasi di <b>IP_SERVER:PORT</b><br>
Contoh:

```bash
88.12.34.56:7575
```

Buat username dan password. Setelah masuk Dashboard, **Sign Out**. Lalu restart aplikasi dengan:

```bash
pm2 restart streamflow
```

## 📝 Informasi Tambahan

### Reset Password

Jika kamu lupa password atau ingin reset password, bisa ikutin cara berikut:

Masuk ke folder aplikasi:

```bash
cd streamflow
```

Jalankan perintah reset password:

```bash
node reset-password.js
```

### Setup Waktu Server (Timezone)

Untuk memastikan scheduled streaming berjalan dengan waktu yang tepat, atur timezone server sesuai zona waktu kamu:

#### 1. Cek Timezone Saat Ini

Lihat timezone aktif:

```bash
timedatectl status
```

#### 2. Lihat Daftar Timezone Yang Tersedia

Cari timezone Indonesia:

```bash
timedatectl list-timezones | grep Asia
```

Contoh set Timezone ke WIB (Jakarta):

```bash
sudo timedatectl set-timezone Asia/Jakarta
```

Verifikasi perubahan:

```bash
timedatectl status
```

Setelah mengubah timezone, restart aplikasi agar perubahan timezone berlaku:

```bash
pm2 restart streamflow
```

## 🪛 Troubleshooting

### Permission Error

Fix permission untuk folder uploads:

```bash
chmod -R 755 public/uploads/
```

### Port Already in Use

Cek process yang menggunakan port:

```bash
sudo lsof -i :7575
```

Kill process jika perlu:

```bash
sudo kill -9 <PID>
```

### Database Error

Reset database (HATI-HATI: akan menghapus semua data):

```bash
rm db/*.db
```

Restart aplikasi untuk create database baru.

## 🚢 Deploy & Run with Docker

### 1. Persiapan .env
Buat file `.env` di root project (jika belum ada), minimal berisi:

```
PORT=7575
SESSION_SECRET=isi_random_yang_tetap
NODE_ENV=development
```

- **SESSION_SECRET**: Gunakan string acak, dan JANGAN diubah-ubah setiap restart.
- **NODE_ENV=development**: Untuk development/testing (agar cookie session tidak butuh https).

### 2. Build & Jalankan dengan Docker Compose

```bash
docker-compose up --build
```

Akses aplikasi di: [http://localhost:7575](http://localhost:7575)

### 3. Volume Persistence
- Data database, logs, dan file upload akan otomatis tersimpan di folder `db/`, `logs/`, dan `public/uploads/` di host.

### 4. Reset Password (dalam container)
Jika lupa password admin:
```bash
docker-compose exec app node reset-password.js
```

### 5. Troubleshooting
- **Tidak bisa login?**
  - Pastikan cookie session muncul di browser setelah login.
  - Pastikan `.env` berisi `NODE_ENV=development` jika akses via http.
  - Pastikan permission folder `db/`, `logs/`, dan `public/uploads/` sudah benar:
    ```bash
    sudo chmod -R 777 db/ logs/ public/uploads/
    ```
  - Pastikan file `.env` dan SESSION_SECRET tidak berubah-ubah.
- **Production (https):**
  - Ubah `NODE_ENV=production` dan akses via https agar cookie session tetap dikirim.

## Lisensi:

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/bangtutorial/streamflow/blob/main/LICENSE)

© 2025 - [Bang Tutorial](https://youtube.com/bangtutorial)
