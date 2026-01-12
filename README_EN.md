<div align="center">

![logo](https://github.com/user-attachments/assets/83d95886-2fbb-45c7-986a-e6c4d053bc55)

## StreamFlow: Web-Based Multi-Platform Streaming

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](https://github.com/bangtutorial/streamflow/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/bangtutorial/streamflow/blob/main/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/bangtutorial/streamflow/blob/main/CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/bangtutorial/streamflow?style=social)](https://github.com/bangtutorial/streamflow/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/bangtutorial/streamflow?style=social)](https://github.com/bangtutorial/streamflow/network/members)

**StreamFlow** is a powerful and easy-to-use web-based live streaming platform. Stream to YouTube, Facebook, and other RTMP platforms simultaneously with a single application. Equipped with video management, scheduled streaming, and real-time monitoring for a professional streaming experience.

[🚀 Installation](#-quick-installation) • [📖 Documentation](#-manual-installation) • [🐳 Docker](#-docker-deployment) • [🪛 Troubleshooting](#-troubleshooting) • [💬 Community](https://github.com/bangtutorial/streamflow/discussions)

![screenshot](https://github.com/user-attachments/assets/fef1c0a5-04f6-41ae-8ea1-5eb1fff13a22)

</div>

---

## ✨ Key Features

- **Multi-Platform Streaming** - Stream to various popular platforms simultaneously.
- **Video Gallery** - Manage video collections with an intuitive interface.
- **Upload Video** - Upload from local storage or import directly from Google Drive.
- **Scheduled Streaming** - Schedule streams with flexible time settings.
- **Advanced Settings** - Full control over bitrate, resolution, FPS, and video orientation.
- **Real-time Monitoring** - Monitor stream status with a real-time dashboard.
- **Video Analytics** - Monitor video statistics and performance directly from the app.
- **Responsive UI** - Modern interface that is responsive on all devices.

## 💻 System Requirements

- **Node.js** v18 or newer
- **FFmpeg** for video processing
- **SQLite3** (included in the package)
- **VPS/Server** with at least 1 Core CPU & 1GB RAM
- **Port** 7575 (customizable in the [.env](.env) file)

## ⚡ Quick Installation

For automatic installation, run the following command:

```bash
curl -o install.sh [https://raw.githubusercontent.com/bangtutorial/streamflow/main/install.sh](https://raw.githubusercontent.com/bangtutorial/streamflow/main/install.sh) && chmod +x install.sh && ./install.sh
