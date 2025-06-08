![logo](https://github.com/user-attachments/assets/50231124-d546-43cb-9cf4-7a06a1dad5bd)

# StreamFlow v2.0: Fresh From The Oven🔥

StreamFlow is a live streaming application that allows you to stream to various platforms like YouTube, Facebook, and others using the RTMP protocol. This application can run on a VPS (Virtual Private Server) and supports streaming to multiple platforms simultaneously.

![Untitled-2](https://github.com/user-attachments/assets/3d7bb367-a1b2-43a5-839b-b6aa8dd5de90)

## 🚀 Key Features

- **Multi-Platform Streaming**: Supports streaming to various popular platforms
- **Video Gallery**: Manage video collections easily
- **Upload Video**: Upload videos from local storage or import from Google Drive
- **Scheduled Streaming**: Schedule streams for specific times
- **Advanced Settings**: Control bitrate, resolution, FPS, and orientation
- **Real-time Monitoring**: Monitor streaming status in real-time
- **Responsive UI**: Modern and responsive interface for all devices

## 📋 Requirements

- **Node.js** v16 or newer
- **FFmpeg**
- **SQLite3** (included)
- **VPS/Server** with a minimum of 1 Core & 1GB RAM
- **Port** 7575 (changeable in .env)

## 🛠️ Installation on VPS

### 1. VPS Preparation

Update system:

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

Verify Node.js installation:

```bash
node --version
npm --version
```

Install FFmpeg:

```bash
sudo apt install ffmpeg -y
```

Verify FFmpeg:
```bash
ffmpeg -version
```

Install Git:

```bash
sudo apt install git -y
```

### 2. StreamFlow Project Setup

Clone the repository to your VPS:

```bash
git clone https://github.com/bangtutorial/streamflow
```

Navigate to the project folder:

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

**Additional configuration (optional):**

The default application port is **7575**. If you need to change the port, edit the .env file (e.g., 8080, 3300, etc.):

```bash
nano .env
```

### 3. Firewall Setup

Open the port according to your .env file (default: 7575):

```bash
sudo ufw allow 7575
```

Enable firewall:

```bash
sudo ufw enable
```

Check firewall status:

```bash
sudo ufw status
```

### 4. Install Process Manager (PM2)

Install PM2:

```bash
sudo npm install -g pm2
```

### 5. How to Run StreamFlow Application

Ensure you are still in the streamflow folder, then run this command:

```bash
pm2 start app.js --name streamflow
```

Access the application at <b>SERVER_IP:PORT</b><br>
Example:

```bash
88.12.34.56:7575
```

Create a username and password. After logging into the Dashboard, Sign Out. Then restart the application with:

```bash
pm2 restart streamflow
```

## 🐳 Running with Docker

You can also run StreamFlow using Docker. This is a convenient way to get the application running without manually installing dependencies.

A pre-built image is also available on Docker Hub, which can be pulled directly.

**Pull from Docker Hub (Recommended):**
```bash
docker pull anasrudin/streamflow:latest
```

**Note:** Due to recent changes (as of November 21, 2023) to handle session management more securely and to define proper data persistence volumes in the Dockerfile, the `anasrudin/streamflow:latest` image on Docker Hub needs to be rebuilt and pushed by the maintainer. These changes ensure your data (database, uploads, etc.) is correctly saved outside the container when using the volume mount instructions. If you have pulled the image before this update, please ensure you pull the newest version once it's updated, or consider building the image locally for the latest changes. You can check the "Last pushed" date on [Docker Hub](https://hub.docker.com/r/anasrudin/streamflow/tags).

**Alternatively, Build the Docker Image Locally:**

First, build the Docker image using the provided `Dockerfile`. Make sure you have Docker installed on your system.

```bash
docker build -t streamflow .
```

**Note:** If you are rebuilding the image after recent changes (around November 21, 2023) related to session secret handling and data persistence volumes, ensure you have the latest code changes (including the updated `Dockerfile`) pulled from the repository.

**Run the Docker Container:**

Once the image is built or pulled, you can run it as a container.

```bash
docker run -d \
  -p 7575:7575 \
  -e SESSION_SECRET="your_very_strong_and_unique_secret_here" \
  -v ./streamflow_data/db:/usr/src/app/db \
  -v ./streamflow_data/uploads/videos:/usr/src/app/public/uploads/videos \
  -v ./streamflow_data/uploads/thumbnails:/usr/src/app/public/uploads/thumbnails \
  -v ./streamflow_data/uploads/avatars:/usr/src/app/public/uploads/avatars \
  -v ./streamflow_data/logs:/usr/src/app/logs \
  --name streamflow-app anasrudin/streamflow:latest
```

Explanation of the command:
- `-d`: Runs the container in detached mode (in the background).
- `-p 7575:7575`: Maps port 7575 on your host to port 7575 in the container. If you changed the port in the `.env` file, adjust the host port accordingly (e.g., `-p YOUR_HOST_PORT:CONTAINER_PORT`).
- `-e SESSION_SECRET="your_very_strong_and_unique_secret_here"`: Sets the session secret. **Important:** Replace `"your_very_strong_and_unique_secret_here"` with a long, random string. This is crucial for security. If not provided, the application will generate a temporary, less secure secret and issue a warning.
- `-v ./streamflow_data/db:/usr/src/app/db`: Mounts the `./streamflow_data/db` directory from your host to `/usr/src/app/db` in the container for database persistence.
- `-v ./streamflow_data/uploads/videos:/usr/src/app/public/uploads/videos`: Mounts video uploads.
- `-v ./streamflow_data/uploads/thumbnails:/usr/src/app/public/uploads/thumbnails`: Mounts video thumbnails.
- `-v ./streamflow_data/uploads/avatars:/usr/src/app/public/uploads/avatars`: Mounts user avatars.
- `-v ./streamflow_data/logs:/usr/src/app/logs`: Mounts application logs.
- `--name streamflow-app`: Assigns a name to your container for easier management.
- `anasrudin/streamflow:latest`: Specifies the image to use from Docker Hub. If you built it locally, you can use the local image name (e.g., `streamflow`).

Before running the command, you might want to create the directories on your host machine (e.g., `mkdir -p ./streamflow_data/db ./streamflow_data/uploads/videos ./streamflow_data/uploads/thumbnails ./streamflow_data/uploads/avatars ./streamflow_data/logs`). If you don't, Docker will create them for you, but they will be owned by `root`. Creating them beforehand allows you to manage permissions more easily.

**Important: Setting the `SESSION_SECRET`**

For security reasons, it is crucial to set a `SESSION_SECRET` environment variable when running the container in production, or even for persistent personal use. This secret is used to sign session cookies.

You can generate a strong secret using a command like:
```bash
openssl rand -hex 32
```
Use the output of this command as your `SESSION_SECRET`.

If you do not provide a `SESSION_SECRET` via the `-e` flag, the application will automatically generate a temporary secret for the current session. While this allows the application to run, it is **not secure for production** as the secret will change each time the container restarts, invalidating all previous sessions. A warning will be logged to the console in such cases.

**Data Persistence**

The `docker run` command above uses volume mounts (`-v` flags) to store application data (database, uploaded videos, thumbnails, avatars, and logs) on your host machine in the `./streamflow_data` directory (or a path you specify). This is crucial because:
- It ensures your data persists even if you stop or remove the Docker container.
- Without these volume mounts, all data, including your streams, gallery, and user settings, would be lost when the container is removed.

Make sure the host paths you specify for the volumes (e.g., `./streamflow_data/db`) exist or that Docker has permission to create them.

**Accessing the Application:**

After the container starts, you can access StreamFlow in your web browser at:

```
http://localhost:7575
```

Or, if you are running it on a VPS:

```
http://YOUR_VPS_IP:7575
```

**4. Managing the Container:**

- To view logs: `docker logs streamflow-app`
- To stop the container: `docker stop streamflow-app`
- To start a stopped container: `docker start streamflow-app`
- To remove the container (after stopping it): `docker rm streamflow-app`

**5. Uploading to Docker Hub:**

A script is provided to help you build and upload your image to Docker Hub.

```bash
./upload_to_dockerhub.sh
```
This script will prompt you for your Docker Hub username and the desired image name. It will then build the image, tag it with the version from `package.json` and as `latest`, and ask if you want to push it to Docker Hub.

## 📝 Additional Information

### Reset Password

If you forget your password or want to reset it, follow these steps:

Navigate to the application folder:

```bash
cd streamflow
```

Run the password reset command:

```bash
node reset-password.js
```

### Server Time Setup (Timezone)

To ensure scheduled streaming runs at the correct time, set the server timezone to your local timezone:

#### 1. Check Current Timezone

View active timezone:

```bash
timedatectl status
```

#### 2. View Available Timezones

Search for your timezone (example for Indonesia):

```bash
timedatectl list-timezones | grep Asia
```

Example: Set Timezone to WIB (Jakarta):

```bash
sudo timedatectl set-timezone Asia/Jakarta
```

Verify changes:

```bash
timedatectl status
```

After changing the timezone, restart the application for the changes to take effect:

```bash
pm2 restart streamflow
```

## 🪛 Troubleshooting

### Permission Error

Fix permissions for the uploads folder:

```bash
chmod -R 755 public/uploads/
```

### Port Already in Use

Check processes using the port:

```bash
sudo lsof -i :7575
```

Kill the process if necessary:

```bash
sudo kill -9 <PID>
```

### Database Error

Reset database (CAUTION: this will delete all data):

```bash
rm db/*.db
```

Restart the application to create a new database.

## License:

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/bangtutorial/streamflow/blob/main/LICENSE)

© 2025 - [Bang Tutorial](https://youtube.com/bangtutorial)
