#!/bin/bash
set -e

echo "================================"
echo "   StreamFlow Quick Installer  "
echo "================================"
echo

read -p "Mulai instalasi? (y/n): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Instalasi dibatalkan." && exit 1

# ─────────────────────────────────────────
# 1. Update sistem
# ─────────────────────────────────────────
echo "🔄 Updating sistem..."
sudo apt update && sudo apt upgrade -y

# ─────────────────────────────────────────
# 2. Install NVM
# ─────────────────────────────────────────
echo "📦 Installing nvm (Node Version Manager)..."
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/refs/heads/master/install.sh | bash

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Pastikan nvm tersedia di .bashrc
grep -q 'NVM_DIR' ~/.bashrc || cat >> ~/.bashrc << 'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF

# ─────────────────────────────────────────
# 3. Install Node.js LTS
# ─────────────────────────────────────────
echo "📦 Installing Node.js LTS terbaru..."
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'
echo "✅ Node.js $(node -v) berhasil diinstall"

# ─────────────────────────────────────────
# 4. Install pnpm
# ─────────────────────────────────────────
echo "📦 Installing pnpm..."
npm install -g pnpm

export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
mkdir -p "$PNPM_HOME"

# Pastikan pnpm tersedia di .bashrc
grep -q 'PNPM_HOME' ~/.bashrc || cat >> ~/.bashrc << 'EOF'
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
EOF

echo "✅ pnpm $(pnpm -v) berhasil diinstall"

# ─────────────────────────────────────────
# 5. Install build tools (wajib untuk native modules)
# ─────────────────────────────────────────
echo "🔨 Installing build tools (python3, make, g++)..."
sudo apt install -y python3 make g++ build-essential

# ─────────────────────────────────────────
# 6. Install FFmpeg
# ─────────────────────────────────────────
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg sudah terinstall, skip..."
else
    echo "🎬 Installing FFmpeg..."
    sudo apt install ffmpeg -y
fi

# ─────────────────────────────────────────
# 7. Install Git
# ─────────────────────────────────────────
if command -v git &> /dev/null; then
    echo "✅ Git sudah terinstall, skip..."
else
    echo "🔧 Installing Git..."
    sudo apt install git -y
fi

# ─────────────────────────────────────────
# 8. Clone repository
# ─────────────────────────────────────────
echo "📥 Clone repository..."
if [ -d "$HOME/streamflow" ]; then
    echo "⚠️  Folder streamflow sudah ada, melakukan pull terbaru..."
    cd "$HOME/streamflow"
    git pull
else
    git clone https://github.com/bangtutorial/streamflow "$HOME/streamflow"
    cd "$HOME/streamflow"
fi

# ─────────────────────────────────────────
# 9. Install dependencies & build native modules
# ─────────────────────────────────────────
echo "⚙️ Installing dependencies..."
pnpm install

echo "🔨 Approving & building native modules (sqlite3, bcrypt, ffmpeg)..."
# Buat file .pnpmfile.cjs untuk allow semua build scripts secara otomatis
cat > "$HOME/streamflow/.pnpmfile.cjs" << 'PNPMEOF'
function readPackage(pkg, context) {
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
PNPMEOF

# Approve semua build scripts yang dibutuhkan
pnpm approve-builds --all 2>/dev/null || true

# Reinstall dengan build scripts diizinkan
pnpm install --ignore-scripts=false

# Pastikan sqlite3 native binary terkompilasi
echo "🔨 Rebuilding sqlite3 native binary..."
cd "$HOME/streamflow/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3" 2>/dev/null && \
    npm run install --build-from-source 2>/dev/null || \
    node-pre-gyp install --fallback-to-build 2>/dev/null || true
cd "$HOME/streamflow"

# Pastikan bcrypt native binary terkompilasi
echo "🔨 Rebuilding bcrypt native binary..."
cd "$HOME/streamflow/node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt" 2>/dev/null && \
    npm run install --build-from-source 2>/dev/null || true
cd "$HOME/streamflow"

pnpm run generate-secret

# ─────────────────────────────────────────
# 10. Setup timezone
# ─────────────────────────────────────────
echo "🕐 Setup timezone ke Asia/Jakarta..."
sudo timedatectl set-timezone Asia/Jakarta

# ─────────────────────────────────────────
# 11. Setup firewall
# ─────────────────────────────────────────
echo "🔧 Setup firewall..."
sudo ufw allow ssh
sudo ufw allow 7575
sudo ufw --force enable

# ─────────────────────────────────────────
# 12. Install PM2
# ─────────────────────────────────────────

# Reload PATH secara lengkap sebelum cek & install PM2
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$NVM_DIR/versions/node/$(nvm current)/bin:$PATH"
hash -r

if command -v pm2 &> /dev/null; then
    echo "✅ PM2 sudah terinstall, skip..."
else
    echo "🚀 Installing PM2..."
    pnpm add -g pm2

    # Reload PATH lagi setelah install agar pm2 langsung bisa dipakai
    export PATH="$PNPM_HOME:$NVM_DIR/versions/node/$(nvm current)/bin:$PATH"
    hash -r
fi

# Verifikasi pm2 tersedia
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 gagal ditemukan setelah instalasi. Coba jalankan manual:"
    echo "   export PATH=\"$PNPM_HOME:\$PATH\" && pm2 --version"
    exit 1
fi

echo "✅ PM2 $(pm2 --version) berhasil disiapkan"

# ─────────────────────────────────────────
# 13. Start StreamFlow via PM2
# ─────────────────────────────────────────
echo "▶️ Starting StreamFlow..."
cd "$HOME/streamflow"

# Jika sudah ada proses streamflow sebelumnya, delete dulu
pm2 describe streamflow &> /dev/null && pm2 delete streamflow || true

pm2 start app.js --name streamflow
pm2 save

# ─────────────────────────────────────────
# 14. Setup PM2 startup (auto-start on reboot)
# ─────────────────────────────────────────
echo "🔁 Setup PM2 startup on boot..."
PM2_STARTUP_CMD=$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>&1 | grep "sudo env" | head -1)
if [ -n "$PM2_STARTUP_CMD" ]; then
    eval "sudo $PM2_STARTUP_CMD" || true
else
    pm2 startup 2>&1 | tail -1 | sudo bash || true
fi
pm2 save

# ─────────────────────────────────────────
# 15. Selesai
# ─────────────────────────────────────────
echo
echo "================================"
echo "✅ INSTALASI SELESAI!"
echo "================================"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo "IP_SERVER")

echo
echo "🌐 URL Akses: http://$SERVER_IP:7575"
echo "📦 Node.js: $(node -v)"
echo "📦 pnpm: $(pnpm -v)"
echo "📦 PM2: $(pm2 --version)"
echo
echo "📋 Langkah selanjutnya:"
echo "1. Buka URL di browser"
echo "2. Buat username & password"
echo "3. Setelah membuat akun, lakukan Sign Out kemudian login kembali untuk sinkronisasi database"
echo "================================"
echo
echo "💡 Tip: Untuk cek status app kapan saja, jalankan:"
echo "   source ~/.bashrc && pm2 status"
echo "================================"
