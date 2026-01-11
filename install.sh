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

# Check dan install Node.js (minimal v18)
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "✅ Node.js sudah terinstall ($(node -v)), skip..."
    else
        echo "⚠️ Node.js versi $(node -v) terlalu lama, upgrade ke v18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    echo "📦 Installing Node.js v18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check dan install FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg sudah terinstall, skip..."
else
    echo "🎬 Installing FFmpeg..."
    sudo apt install ffmpeg -y
fi

# Check dan install Git
if command -v git &> /dev/null; then
    echo "✅ Git sudah terinstall, skip..."
else
    echo "🎬 Installing Git..."
    sudo apt install git -y
fi

echo "📥 Clone repository..."
git clone https://github.com/bangtutorial/streamflow
cd streamflow

echo "⚙️ Installing dependencies..."
npm install
npm run generate-secret

echo "🕐 Setup timezone ke Asia/Jakarta..."
sudo timedatectl set-timezone Asia/Jakarta

echo "🔧 Setup firewall..."
sudo ufw allow ssh
sudo ufw allow 7575
sudo ufw --force enable

# Check dan install PM2
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 sudah terinstall, skip..."
else
    echo "🚀 Installing PM2..."
    sudo npm install -g pm2
fi

echo "▶️ Starting StreamFlow..."
pm2 start app.js --name streamflow
pm2 save

echo
echo "================================"
echo "✅ INSTALASI SELESAI!"
echo "================================"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "IP_SERVER")
echo
echo "🌐 URL Akses: http://$SERVER_IP:7575"
echo
echo "📋 Langkah selanjutnya:"
echo "1. Buka URL di browser"
echo "2. Buat username & password"
echo "3. Setelah membuat akun, lakukan Sign Out kemudian login kembali untuk sinkronisasi database"
echo "================================"
