#!/bin/bash

# StreamFlow Simple Installer
set -e

echo "================================"
echo "   StreamFlow Installer  "
echo "================================"
echo

# Konfirmasi
read -p "Mulai instalasi? (y/n): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Instalasi dibatalkan." && exit 1

echo "🔄 Updating sistem..."
sudo apt update && sudo apt upgrade -y

echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "🎬 Installing FFmpeg dan Git..."
sudo apt install ffmpeg git -y

echo "📥 Clone repository..."
git clone https://github.com/bangtutorial/streamflow
cd streamflow

echo "⚙️ Installing dependencies..."
npm install
npm run generate-secret

echo "🕐 Setup timezone ke Asia/Jakarta..."
sudo timedatectl set-timezone Asia/Jakarta

echo "🔧 Setup firewall..."
sudo ufw allow 7575
sudo ufw --force enable

echo "🚀 Installing PM2..."
sudo npm install -g pm2

echo "▶️ Starting StreamFlow..."
pm2 start app.js --name streamflow

echo
echo "================================"
echo "✅ INSTALASI SELESAI!"
echo "================================"

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "IP_SERVER")
echo
echo "🌐 URL Akses: http://$SERVER_IP:7575"
echo
echo "📋 Langkah selanjutnya:"
echo "1. Buka URL di browser"
echo "2. Buat username & password"
echo "3. Setelah bikin akun, logout lalu login ulang agar database singkron"
echo "================================"
