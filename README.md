![logo](https://github.com/user-attachments/assets/50231124-d546-43cb-9cf4-7a06a1dad5bd)

# StreamFlow v2.0: Fresh From The Oven 🔥

StreamFlow adalah aplikasi live streaming yang memungkinkan kamu melakukan live streaming ke berbagai platform seperti YouTube, Facebook, dan platform lainnya menggunakan protokol RTMP. Aplikasi ini dapat berjalan di VPS (Virtual Private Server) dan mendukung streaming ke banyak platform secara bersamaan.

![Untitled-2](https://github.com/user-attachments/assets/3d7bb367-a1b2-43a5-839b-b6aa8dd5de90)

## ✨ Fitur Utama

- **Multi-Platform Streaming** - Streaming ke berbagai platform populer secara bersamaan
- **Video Gallery** - Kelola koleksi video dengan antarmuka yang intuitif
- **Upload Video** - Upload dari local storage atau import langsung dari Google Drive
- **Scheduled Streaming** - Jadwalkan streaming dengan pengaturan waktu yang fleksibel
- **Advanced Settings** - Kontrol penuh untuk bitrate, resolusi, FPS, dan orientasi video
- **Real-time Monitoring** - Monitor status streaming dengan dashboard real-time
- **Video Analytics** - Pantau statistik dan performa video langsung dari aplikasi
- **Responsive UI** - Antarmuka modern yang responsif di semua perangkat

## 🛠️ System Requirements

- **Node.js** v20 atau versi terbaru
- **FFmpeg** untuk video processing
- **SQLite3** (sudah termasuk dalam package)
- **VPS/Server** dengan minimal 1 Core CPU & 1GB RAM
- **Port** 7575 (dapat disesuaikan di file [.env](.env))

## ⚡ Quick Installation

Untuk instalasi otomatis, jalankan perintah berikut:

```bash
curl -o install.sh https://raw.githubusercontent.com/bangtutorial/streamflow/main/install.sh && chmod +x install.sh && ./install.sh
```

## 🔧 Manual Installation

### 1. Persiapan Server

Update sistem operasi:
```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
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

Verifikasi instalasi FFmpeg:
```bash
ffmpeg -version
```

Install Git:
```bash
sudo apt install git -y
```

### 2. Setup Project StreamFlow

Clone repository:
```bash
git clone https://github.com/bangtutorial/streamflow
```

Masuk ke direktori project:
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

Konfigurasi port (opsional):
```bash
nano .env
```

### 3. Konfigurasi Firewall

**PENTING: Buka port SSH terlebih dahulu untuk menghindari terputusnya koneksi!**

Buka port SSH (biasanya port 22):
```bash
sudo ufw allow ssh
# atau jika menggunakan port custom SSH
# sudo ufw allow [PORT_SSH_ANDA]
```

Buka port aplikasi (default: 7575):
```bash
sudo ufw allow 7575
```

Verifikasi aturan firewall sebelum mengaktifkan:
```bash
sudo ufw status verbose
```

Aktifkan firewall:
```bash
sudo ufw enable
```

Verifikasi status firewall setelah aktif:
```bash
sudo ufw status
```

### 4. Install Process Manager

Install PM2 untuk mengelola aplikasi:
```bash
sudo npm install -g pm2
```

### 5. Menjalankan Aplikasi

Jalankan aplikasi dengan PM2:
```bash
pm2 start app.js --name streamflow
```

Akses aplikasi melalui browser:
```
http://IP_SERVER:PORT
```

Contoh: `http://88.12.34.56:7575`

> [!Important]
> Setelah membuat akun pertama kali, lakukan **Sign Out** kemudian login kembali untuk sinkronisasi database.

## 🔐 Reset Password

Jika lupa password atau perlu reset akun:

```bash
cd streamflow && node reset-password.js
```

## ⏰ Pengaturan Timezone Server

Untuk memastikan scheduled streaming berjalan dengan waktu yang akurat:

### Cek timezone saat ini:
```bash
timedatectl status
```

### Lihat daftar timezone tersedia:
```bash
timedatectl list-timezones | grep Asia
```

### Set timezone ke WIB (Jakarta):
```bash
sudo timedatectl set-timezone Asia/Jakarta
```

### Restart aplikasi setelah mengubah timezone:
```bash
pm2 restart streamflow
```

## 🐳 Docker Deployment

### 1. Persiapan Environment

Buat file `.env` di root project:
```env
PORT=7575
SESSION_SECRET=your_random_secret_here
NODE_ENV=development
```

### 2. Build dan Jalankan

```bash
docker-compose up --build
```

Akses aplikasi: [http://localhost:7575](http://localhost:7575)

### 3. Data Persistence

Data akan tersimpan secara otomatis di:
- Database: `db/`
- Logs: `logs/`
- Upload files: `public/uploads/`

### 4. Reset Password (Docker)

```bash
docker-compose exec app node reset-password.js
```

## 🔫 Troubleshooting

### Permission Error
```bash
chmod -R 755 public/uploads/
```

### Port Already in Use
```bash
# Cek proses yang menggunakan port
sudo lsof -i :7575

# Kill proses jika diperlukan
sudo kill -9 <PID>
```

### Database Error
```bash
# Reset database (PERINGATAN: akan menghapus semua data)
rm db/*.db

# Restart aplikasi untuk membuat database baru
pm2 restart streamflow
```

### Docker Troubleshooting

**Tidak bisa login:**
- Pastikan `NODE_ENV=development` untuk akses HTTP
- Periksa permission folder:
  ```bash
  sudo chmod -R 777 db/ logs/ public/uploads/
  ```
- Pastikan `SESSION_SECRET` tidak berubah

**Production (HTTPS):**
- Set `NODE_ENV=production`
- Akses melalui HTTPS untuk cookie session

## 💫 Contributors

[![Contributors](https://contrib.rocks/image?repo=bangtutorial/streamflow)](https://github.com/bangtutorial/streamflow/graphs/contributors)

## 📄 License

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/bangtutorial/streamflow/blob/main/LICENSE)

---
© 2025 - [Bang Tutorial](https://youtube.com/bangtutorial)
