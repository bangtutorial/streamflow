# YouTube OAuth Integration Setup

Panduan setup **YouTube Integration** di StreamFlow agar bisa intregasi channel via YouTube Data API v3.

## 📋 Daftar Isi

- [Kenapa Butuh Setup Khusus?](#-kenapa-butuh-setup-khusus)
- [Pilih Metode Setup](#-pilih-metode-setup)
- [Metode 1: Cloudflare Tunnel (Rekomendasi)](#-metode-1-cloudflare-tunnel-rekomendasi)
- [Metode 2: SSH Port Forwarding](#-metode-2-ssh-port-forwarding)
- [Metode 3: Domain + HTTPS (Production)](#-metode-3-domain--https-production)
- [Konfigurasi Google Cloud Console](#-konfigurasi-google-cloud-console)
- [Konek di StreamFlow](#-konek-di-streamflow)
- [Setelah OAuth Sukses](#-setelah-oauth-sukses)
- [Troubleshooting](#-troubleshooting)

---

## 🤔 Kenapa Butuh Setup Khusus?

Google OAuth 2.0 **menolak redirect URI dengan IP + HTTP**. Hanya menerima:

- ✅ `https://domain.com/...` (HTTPS dengan domain)
- ✅ `http://localhost:*/...` (localhost, special exception)
- ❌ `http://55.354.345.435/...` (IP publik dengan HTTP — **DITOLAK**)

Kalau VPS kamu diakses via IP publik (`http://IP:7575`), YouTube Integration **tidak akan jalan** sampai kamu pakai salah satu metode di bawah.

---

## 🎯 Pilih Metode Setup

| Metode | Setup Time | Biaya | Permanen? | Cocok untuk |
|---|---|---|---|---|
| **Cloudflare Tunnel** | ~5 menit | Gratis | Ya (named tunnel) | Semua user, rekomendasi utama |
| **SSH Port Forwarding** | ~1 menit | Gratis | Tidak | Setup OAuth sekali, lalu lupa |
| **Domain + nginx + HTTPS** | ~15-30 menit | Butuh domain ($) | Ya | Production, public-facing |

---

## 🚀 Metode 1: Cloudflare Tunnel (Rekomendasi)

Expose aplikasi via HTTPS gratis tanpa butuh domain atau konfigurasi firewall/DNS.

### Step 1 — Install cloudflared di VPS

```bash
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

Verifikasi:
```bash
cloudflared --version
```

### Step 2 — Jalankan Quick Tunnel

```bash
cloudflared tunnel --url http://localhost:7575
```

Cari di output baris seperti ini:
```
Your quick Tunnel has been created! Visit it at:
https://color-campbell-min-cuisine.trycloudflare.com
```

**URL itu** adalah alamat publik HTTPS kamu. Tes di browser — harus muncul halaman StreamFlow.

> **ℹ️ Warning yang bisa diabaikan**
> - `Cannot determine default configuration path` → normal untuk quick tunnel
> - `ICMP proxy feature is disabled` → cuma untuk WARP, tidak relevan untuk HTTP tunneling

### Step 3 — Biar Tunnel Tetap Hidup (tmux)

Kalau kamu Ctrl+C atau SSH disconnect, tunnel mati. Pakai `tmux` supaya tetap hidup:

```bash
# Install tmux
sudo apt install -y tmux

# Buat session "cf"
tmux new -s cf

# Di dalam tmux, jalankan:
cloudflared tunnel --url http://localhost:7575

# Detach: tekan Ctrl+B lalu D
# Re-attach: tmux attach -t cf
# Stop tunnel: masuk session, Ctrl+C
```

Sekarang SSH bisa disconnect, tunnel tetap hidup.

### Step 4 (Opsional) — Named Tunnel untuk URL Permanen

Quick tunnel URL **berubah setiap restart cloudflared**. Kalau ingin URL permanen (misal `streamflow.yourdomain.com`):

1. Login ke [Cloudflare Dashboard](https://dash.cloudflare.com) (gratis)
2. Add your domain ke Cloudflare (ubah nameserver domain ke Cloudflare)
3. Di VPS:
   ```bash
   cloudflared tunnel login                          # browser OAuth
   cloudflared tunnel create streamflow              # buat tunnel named
   cloudflared tunnel route dns streamflow streamflow.yourdomain.com
   ```
4. Buat config `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: streamflow
   credentials-file: /root/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: streamflow.yourdomain.com
       service: http://localhost:7575
     - service: http_status:404
   ```
5. Install sebagai systemd service:
   ```bash
   sudo cloudflared service install
   sudo systemctl enable --now cloudflared
   ```

URL `https://streamflow.yourdomain.com` sekarang permanen, auto-start on boot, dan monitored.

---

## 🔑 Metode 2: SSH Port Forwarding

Cara paling cepat untuk setup OAuth **sekali pakai**. Cocok kalau kamu cuma mau setup YouTube integration lalu akses aplikasi via IP normal.

### Di PowerShell PC kamu (Windows 10+ punya `ssh` built-in):

```powershell
ssh -L 7575:localhost:7575 root@<IP_VPS_KAMU>
```

Biarkan SSH session terbuka. Buka browser di PC:
```
http://localhost:7575
```

Aplikasi akan detect host = `localhost:7575` dan generate redirect URI `http://localhost:7575/auth/youtube/callback` yang diterima Google.

Setelah OAuth selesai dan token tersimpan di database, **tunnel SSH bisa ditutup**. Aplikasi tetap bisa diakses normal via IP publik.

---

## 🌐 Metode 3: Domain + HTTPS (Production)

Paling profesional, tapi butuh:
- Domain sendiri (contoh dari Namecheap / Cloudflare / Niagahoster)
- DNS A record ke IP VPS
- nginx + Let's Encrypt SSL

### Ringkasan langkah:

```bash
# Install nginx + certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Buat nginx reverse proxy config (tulis file /etc/nginx/sites-available/streamflow)
sudo tee /etc/nginx/sites-available/streamflow > /dev/null <<'EOF'
server {
    listen 80;
    server_name streamflow.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:7575;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    client_max_body_size 10G;
    proxy_read_timeout 1800s;
}
EOF

sudo ln -s /etc/nginx/sites-available/streamflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Setup SSL (otomatis konfig nginx + auto-renew)
sudo certbot --nginx -d streamflow.yourdomain.com

# Tutup port 7575 ke public, biarkan 80 + 443 saja
sudo ufw deny 7575
sudo ufw allow 'Nginx Full'
```

Akses final: `https://streamflow.yourdomain.com`.

---

## ⚙️ Konfigurasi Google Cloud Console

Setelah salah satu metode di atas aktif (URL HTTPS / localhost), lanjut setup OAuth Client di Google Cloud.

### Step 1 — Buat / Pilih Project

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru atau pilih project existing

### Step 2 — Enable YouTube Data API v3

1. Navigation menu → **APIs & Services** → **Library**
2. Search: **YouTube Data API v3**
3. Klik **Enable**

### Step 3 — Buat OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. Pilih **External** → Create
3. Isi:
   - App name: `StreamFlow`
   - User support email: email kamu
   - Developer contact: email kamu
4. **Scopes** → Add: `youtube`, `youtube.force-ssl`, `youtube.readonly`
5. **Test users** → Add email Google kamu (**wajib**, karena app status masih "Testing")
6. Save

### Step 4 — Buat OAuth Client ID

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: `StreamFlow Web Client`
4. **Authorized JavaScript origins** → Add URI:
   - `https://your-tunnel-url.trycloudflare.com` atau
   - `http://localhost:7575` atau
   - `https://streamflow.yourdomain.com`
5. **Authorized redirect URIs** → Add URI:
   - `https://your-tunnel-url.trycloudflare.com/auth/youtube/callback` atau
   - `http://localhost:7575/auth/youtube/callback` atau
   - `https://streamflow.yourdomain.com/auth/youtube/callback`
6. **CREATE** → Copy **Client ID** + **Client Secret**

> ⏳ **Tunggu ~5 menit** sebelum test. Google butuh waktu propagasi config OAuth.

---

## 🔗 Konek di StreamFlow

1. Login ke StreamFlow via URL HTTPS yang kamu set (tunnel / localhost / domain)
2. Menu **Settings** → tab **YouTube Integration**
3. Cek **Authorized Redirect URI** di UI — pastikan sesuai dengan yang kamu daftarkan di Google Cloud
4. Paste **Client ID** dan **Client Secret** dari Google Cloud
5. Klik **Connect YouTube**
6. Browser redirect ke Google consent screen → pilih akun → **Allow**
7. Redirect kembali ke StreamFlow → muncul channel terkoneksi

---

## ✅ Setelah OAuth Sukses

Token akses dan refresh token tersimpan di database (tabel `youtube_channels`). Selanjutnya:

- ✅ Kamu bisa **matikan tunnel/SSH** dan akses app via IP publik normal
- ✅ Fitur YouTube (create broadcast, update stream, dll) tetap jalan
- ✅ Refresh token **tidak butuh redirect URI** lagi

### Kapan perlu re-setup OAuth?

- Refresh token di-**revoke** dari [Google Account permissions](https://myaccount.google.com/permissions)
- Refresh token **tidak digunakan selama 6 bulan** (Google policy)
- Client ID / Secret di Google Cloud **diganti**

Kalau re-auth dibutuhkan, cukup jalankan tunnel lagi (quick tunnel pun cukup — redirect URI di Google Cloud bisa diupdate).

---

## 🛠️ Troubleshooting

### Error: `redirect_uri_mismatch`

Redirect URI yang dikirim StreamFlow tidak cocok dengan yang terdaftar di Google Cloud.

**Cek**:
1. Buka StreamFlow Settings → YouTube Integration
2. Lihat kolom **Authorized Redirect URI** di UI — ini yang dikirim aplikasi
3. Di Google Cloud → OAuth Client → **Authorized redirect URIs** → pastikan **persis sama** (termasuk http/https, port, trailing slash)

**Penyebab umum**:
- URL berubah setelah restart quick tunnel (kalau pakai Cloudflare quick tunnel, URL random)
- Lupa tambah protocol `https://`
- Port beda (misal `:7575` vs tanpa port)

### Error: `Access blocked: This app's request is invalid` (Error 400)

App OAuth masih status "Testing" dan email kamu belum di-register sebagai test user.

**Fix**: Google Cloud Console → OAuth consent screen → Test users → Add email.

### Error: `Akses diblokir: Error Otorisasi`

Sama seperti di atas. OAuth consent screen belum di-configure atau scope belum di-approve.

**Fix**: Tambah scope `youtube`, `youtube.force-ssl`, `youtube.readonly` di OAuth consent screen.

### Cloudflared tunnel URL tidak bisa diakses

1. Cek StreamFlow jalan: `pm2 status` → harus `online`
2. Cek port 7575 aktif di localhost: `curl http://localhost:7575` di VPS → harus dapat HTML
3. Cek tunnel: di terminal cloudflared harus ada baris `Registered tunnel connection`
4. Refresh browser setelah 5-10 detik (edge warmup)

### Tunnel mati setelah tutup SSH

Pakai `tmux` (Step 3 Metode 1). Quick tunnel tidak bisa di-`systemd`, harus named tunnel untuk itu.

---

## 📚 Referensi

- [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Google OAuth 2.0 docs](https://developers.google.com/identity/protocols/oauth2)
- [YouTube Data API v3 docs](https://developers.google.com/youtube/v3)
- [Let's Encrypt certbot](https://certbot.eff.org/)
