#!/bin/bash
set -e
echo "================================"
echo "   StreamFlow Quick Installer  "
echo "================================"
echo
read -p "Mulai instalasi? (y/n): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Instalasi dibatalkan." && exit 1
echo "🔄 Updating sistem..."
sudo apt update && sudo apt upgrade -y
echo "📦 Installing nvm (Node Version Manager)..."
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
echo "📦 Installing Node.js LTS terbaru..."
nvm install --lts
nvm use --lts
nvm alias default 'lts/*'
echo "✅ Node.js $(node -v) berhasil diinstall"
echo "📦 Installing pnpm..."
export SHELL="/bin/bash"
npm install -g pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
mkdir -p "$PNPM_HOME"
echo "✅ pnpm $(pnpm -v) berhasil diinstall"
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg sudah terinstall, skip..."
else
    echo "🎬 Installing FFmpeg..."
    sudo apt install ffmpeg -y
fi
if command -v git &> /dev/null; then
    echo "✅ Git sudah terinstall, skip..."
else
    echo "🔧 Installing Git..."
    sudo apt install git -y
fi
echo "📥 Clone repository..."
git clone https://github.com/bangtutorial/streamflow
cd streamflow
echo "⚙️ Installing dependencies..."
pnpm install
pnpm run generate-secret
echo "🕐 Setup timezone ke Asia/Jakarta..."
sudo timedatectl set-timezone Asia/Jakarta
echo "🔧 Setup firewall..."
sudo ufw allow ssh
sudo ufw allow 7575
sudo ufw --force enable
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 sudah terinstall, skip..."
else
    echo "🚀 Installing PM2..."
    pnpm add -g pm2
fi
export PATH="$NVM_DIR/versions/node/$(nvm current)/bin:$PATH"
echo "▶️ Starting StreamFlow..."
pm2 start app.js --name streamflow
pm2 save
pm2 startup | tail -1 | bash || true
echo
echo "================================"
echo "✅ INSTALASI SELESAI!"
echo "================================"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "IP_SERVER")
echo
echo "🌐 URL Akses: http://$SERVER_IP:7575"
echo "📦 Node.js: $(node -v)"
echo "📦 pnpm: $(pnpm -v)"
echo
echo "📋 Langkah selanjutnya:"
echo "1. Buka URL di browser"
echo "2. Buat username & password"
echo "3. Setelah membuat akun, lakukan Sign Out kemudian login kembali untuk sinkronisasi database"
echo "================================"
