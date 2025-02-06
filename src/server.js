const os = require('os');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const he = require('he');
const path = require('path');
const database = require('./database');
const EventSource = require('eventsource');

const app = express();

// ================== KONFIGURASI UTAMA ==================

// Fungsi untuk menghasilkan session secret secara acak
const generateSessionSecret = () => crypto.randomBytes(32).toString('hex');

// Pastikan direktori uploadsTemp ada
const uploadsTempDir = path.join(__dirname, 'uploadsTemp');
if (!fs.existsSync(uploadsTempDir)) {
  fs.mkdirSync(uploadsTempDir, { recursive: true });
}
const uploadVideo = multer({ dest: uploadsTempDir });

// Konfigurasi Multer untuk upload avatar
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/img');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => cb(null, 'avatar.jpg')
});
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg') cb(null, true);
    else cb(new Error('Hanya file JPG/JPEG yang diperbolehkan'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Setup middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, 'uploads')));
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: generateSessionSecret(),
  resave: true,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== ROUTING DASAR ==================

// Gunakan fungsi handleRootRoute untuk halaman utama dan login
app.get('/', async (req, res) => handleRootRoute(req, res));
app.get('/login', async (req, res) => handleRootRoute(req, res));

async function handleRootRoute(req, res) {
  // Dapatkan jumlah user dari database
  const userCount = await new Promise((resolve, reject) => {
    database.getUserCount((err, count) => {
      if (err) {
        console.error("Error getting user count:", err);
        return res.status(500).send("Internal Server Error");
      }
      resolve(count);
    });
  });

  // Jika sudah ada user, arahkan ke dashboard jika sudah login, atau tampilkan halaman login
  // Jika belum ada user, arahkan ke halaman setup
  if (userCount > 0) {
    if (req.session.user) {
      return res.redirect('/dashboard');
    } else {
      return res.sendFile(path.join(__dirname, '../public/login.html'));
    }
  } else {
    return res.redirect('/setup');
  }
}

// ================== AUTENTIKASI ==================

// Middleware untuk melindungi halaman HTML dan API
const requireAuthHTML = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};
const requireAuthAPI = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// API untuk mendapatkan username dari sesi
app.get('/api/user', requireAuthAPI, (req, res) => {
  res.json({ username: req.session.user.username });
});

// ================== ROUTING UTAMA ==================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/history', requireAuthHTML, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/history.html'));
});

app.get('/api/history', requireAuthAPI, (req, res) => {
  database.getHistoryStreamContainers((err, rows) => {
    if (err) return sendError(res, err.message);
    res.json(rows);
  });
});

app.delete('/delete-history/:id', requireAuthAPI, (req, res) => {
  const containerId = req.params.id;
  database.deleteStreamContainer(containerId, (err) => {
    if (err) return sendError(res, err.message);
    res.json({ message: 'History streaming berhasil dihapus' });
  });
});

// ================== MANAJEMEN USER ==================

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  database.getUser(username, (err, user) => {
    if (err) return sendError(res, 'Error fetching user from database');
    if (!user) return sendError(res, 'Username/password salah');
    bcrypt.compare(password, user.password_hash, (err, result) => {
      if (err) return sendError(res, 'Error comparing passwords');
      if (!result) return sendError(res, 'Username/password salah');
      req.session.user = { id: user.id, username: user.username };
      res.json({ success: true });
    });
  });
});
app.get('/check-auth', (req, res) => res.json({ authenticated: !!req.session.user }));
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Gagal logout' });
    res.redirect('/login');
  });
});

// ================== DASHBOARD ==================

app.get('/dashboard', requireAuthHTML, (req, res) => {
  const pathToIndex = path.join(__dirname, '../views/index.html');
  fs.readFile(pathToIndex, 'utf8', (err, htmlContent) => {
    if (err) return handleServerError(res, err);
    const username = he.escape(req.session.user.username);
    // Sisipkan script untuk menampilkan username di halaman dashboard
    const modifiedHtml = htmlContent.replace('</body>', `
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          try {
            document.querySelector('input[name="username"]').value = '${username}';
          } catch (error) {
            console.error('Error setting username:', error);
          }
        });
      </script>
      </body>
    `);
    res.send(modifiedHtml);
  });
});

// ================== PENGATURAN USER ==================

app.post('/update-settings', requireAuthAPI, (req, res) => {
  uploadAvatar.single('avatar')(req, res, async (err) => {
    try {
      if (err) throw new Error(err.message);
      const userId = req.session.user.id;
      const { username, password, confirm_password } = req.body;
      const updates = {};
      const errors = [];
      if (username?.trim()) {
        if (username.trim().length < 3) errors.push('Username minimal 3 karakter');
        else updates.username = username.trim();
      }
      if (password || confirm_password) {
        if (password !== confirm_password) errors.push('Password tidak sama');
        else if (password) updates.password_hash = await bcrypt.hash(password, 10);
      }
      if (errors.length > 0) throw new Error(errors.join(', '));
      if (Object.keys(updates).length > 0) {
        await new Promise((resolve, reject) => 
          database.updateUser(userId, updates, (err) => err ? reject(err) : resolve())
        );
        if (updates.username) {
          req.session.user.username = updates.username;
          req.session.save();
        }
      }
      res.json({ success: true, message: 'Pengaturan berhasil diperbarui', timestamp: Date.now() });
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(400).json({ success: false, message: error.message, type: 'error' });
    }
  });
});

// ================== MANAJEMEN VIDEO ==================

app.post('/upload-video', uploadVideo.single('video'), (req, res) => {
  if (!req.file) return sendError(res, 'Tidak ada file yang diupload');

  const uploadsDir = path.join(__dirname, 'uploads');
  const newFilePath = path.join(uploadsDir, req.file.originalname);

  // Jika file dengan nama yang sama sudah ada, hapus file lama terlebih dahulu
  if (fs.existsSync(newFilePath)) {
    fs.unlink(newFilePath, (err) => {
      if (err) {
        console.error('Error deleting existing file:', err);
        return sendError(res, 'Gagal menghapus file yang sudah ada');
      }
      saveNewFile();
    });
  } else {
    saveNewFile();
  }

  function saveNewFile() {
    fs.rename(req.file.path, newFilePath, (err) => {
      if (err) {
        console.error('Error moving uploaded file:', err);
        return sendError(res, 'Gagal mengupload video');
      }
      res.json({ message: 'Upload berhasil', filePath: newFilePath });
    });
  }
});

app.post('/delete-video', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return sendError(res, 'File path diperlukan');
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return sendError(res, 'Gagal menghapus file');
    }
    res.json({ message: 'File berhasil dihapus' });
  });
});

app.get('/video/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  fs.stat(filePath, (err, stat) => {
    if (err) {
      if (err.code === 'ENOENT') return res.status(404).send('File not found');
      else return res.status(500).send('File system error');
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size
    });
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

// ================== STREAMING ==================

const streams = {};

app.post('/start-stream', uploadVideo.single('video'), async (req, res) => {
  const { rtmp_url, stream_key, bitrate, fps, resolution, loop, title } = req.body;

  if (!req.file) return sendError(res, 'Video tidak ditemukan');
  if (!title) return sendError(res, 'Judul belum diisi');

  const originalExt = path.extname(req.file.originalname).toLowerCase();
  if (originalExt === '') return sendError(res, 'Ekstensi file video tidak ditemukan.');

  const newFileName = `${generateRandomFileName()}${originalExt}`;
  const uploadsDir = path.join(__dirname, 'uploads');

  // Pastikan direktori uploads ada
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const newFilePath = path.join(uploadsDir, newFileName);

  try {
    // Pindahkan file dari direktori sementara ke direktori tujuan
    fs.renameSync(req.file.path, newFilePath);

    const fullRtmpUrl = `${rtmp_url}/${stream_key}`;
    console.log('Starting stream:', { rtmp_url, bitrate, fps, resolution, title });

    const command = ffmpeg(newFilePath)
      .inputFormat('mp4')
      .inputOptions(['-re', ...(loop === 'true' ? ['-stream_loop -1'] : [])])
      .outputOptions([
        `-r ${fps || 30}`,
        '-threads 2',
        '-x264-params "nal-hrd=cbr"',
        '-c:v libx264',
        '-preset veryfast',
        '-tune zerolatency',
        `-b:v ${bitrate}k`,
        `-maxrate ${bitrate}k`,
        `-bufsize ${bitrate * 2}k`,
        '-pix_fmt yuv420p',
        '-g 60',
        `-vf scale=${resolution}`,
        '-c:a aac',
        '-b:a 128k',
        '-ar 44100',
        '-f flv'
      ]);

    let responseSent = false;
    let containerId;

    try {
      const containerData = {
        title: title,
        preview_file: req.file.originalname,
        stream_file: newFileName,
        stream_key: stream_key,
        stream_url: rtmp_url,
        bitrate: parseInt(bitrate, 10),
        resolution: resolution,
        fps: parseInt(fps, 10),
        loop_enabled: loop ? 1 : 0,
        container_order: Date.now(),
        is_streaming: 1
      };

      const result = await new Promise((resolve, reject) => {
        database.addStreamContainer(containerData, (err, data) => {
          if (err) {
            reject(new Error(`Database error: ${err.message}`));
            return;
          }
          resolve(data);
        });
      });
      containerId = result.lastID;

      if (!result) throw new Error("Gagal menyimpan data ke database");

      streams[stream_key] = {
        process: command,
        startTime: Date.now(),
        containerId: containerId,
        videoPath: newFilePath
      };

      command
        .output(`${rtmp_url}/${stream_key}`)
        .on('end', () => {
          console.log('Streaming selesai:', stream_key);
          delete streams[stream_key];
          database.updateStreamContainer(containerId, { is_streaming: 0 }, (err) => {
            if (err) console.error('Error updating database:', err);
            deleteFile(newFilePath);
          });
        })
        .on('error', (err) => {
          console.error('Stream error:', err);
          delete streams[stream_key];
          deleteFile(newFilePath);
          if (!responseSent) {
            sendError(res, 'Error during streaming', 500);
            responseSent = true;
          }
        })
        .run();

      // Berikan respons setelah beberapa detik agar proses streaming dapat berjalan
      setTimeout(() => {
        if (!responseSent) {
          res.json({ message: 'Streaming dimulai', stream_key, containerId: containerId });
          responseSent = true;
        }
      }, 5000);
    } catch (error) {
      console.error('Error starting stream:', error);
      if (!responseSent) {
        sendError(res, `Failed to start stream: ${error.message}`);
        responseSent = true;
      }
    }
  } catch (error) {
    console.error('Error processing video:', error);
    sendError(res, `Error processing video: ${error.message}`);
  }
});

app.post('/stop-stream', async (req, res) => {
  const { stream_key } = req.body;

  if (streams[stream_key]) {
    try {
      const { containerId, videoPath } = streams[stream_key];
      const startTime = Date.now();

      // Hentikan proses streaming (FFmpeg)
      streams[stream_key].process.kill('SIGTERM');
      delete streams[stream_key];

      // Update status stream di database dan hapus file video
      try {
        await new Promise((resolve, reject) => {
          database.updateStreamContainer(containerId, { is_streaming: 0 }, (err) => {
            if (err) {
              return reject(new Error('Gagal memperbarui status stream di database:' + err.message));
            }
            deleteFile(videoPath);
            resolve();
          });
        });
        res.json({ message: 'Streaming dihentikan' });
      } catch (dbError) {
        sendError(res, `Gagal menghentikan streaming: ${dbError.message}`);
      }
    } catch (error) {
      sendError(res, 'Gagal menghentikan stream');
    }
  } else {
    sendError(res, 'Stream tidak ditemukan', 404);
  }
});

app.get('/stream-containers', requireAuthAPI, (req, res) => {
  database.getStreamContainers((err, rows) => {
    if (err) return sendError(res, err.message);
    res.json(rows);
  });
});

app.get('/active-stream-containers', requireAuthAPI, (req, res) => {
  database.getActiveStreamContainers((err, rows) => {
    if (err) return sendError(res, err.message);
    res.json(rows);
  });
});

// Endpoint untuk status streaming menggunakan Server-Sent Events (SSE)
app.get('/stream-status/:streamKey', (req, res) => {
  const streamKey = req.params.streamKey;
  if (!streams[streamKey]) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify({ is_streaming: false })}\n\n`);
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const intervalId = setInterval(() => {
    res.write(`data: ${JSON.stringify({ is_streaming: true })}\n\n`);
    if (!streams[streamKey]) {
      clearInterval(intervalId);
      res.end();
    }
  }, 5000);

  res.on('close', () => {
    clearInterval(intervalId);
    if (streams[streamKey]) {
      database.updateStreamContainer(streams[streamKey].containerId, { is_streaming: 0 }, (err) => {
        if (err) console.error('Error updating stream container status to 0 on close:', err);
      });
    }
  });
});

// ================== SETUP AKUN ==================

app.get('/setup', async (req, res) => {
  const userCount = await new Promise((resolve, reject) => {
    database.getUserCount((err, count) => {
      if (err) reject(err);
      resolve(count);
    });
  });
  if (userCount > 0) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '../public/setup.html'));
});

app.post('/setup', uploadAvatar.single('avatar'), async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  if (password !== confirmPassword) return sendError(res, 'Password dan konfirmasi password tidak sama');
  try {
    await new Promise((resolve, reject) => {
      database.addUser(username, password, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
    // Set session user dan simpan sesi
    req.session.user = { username: username };
    req.session.save();
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Setup akun error:', error);
    sendError(res, error.message || 'Gagal membuat akun');
  }
});

// ================== HELPER FUNCTIONS ==================

const sendError = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const handleServerError = (res, err) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
};

const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
  });
};

const generateRandomFileName = () => crypto.randomBytes(16).toString('hex');
const ifaces = os.networkInterfaces();
let ipAddress = 'localhost';
for (const iface of Object.values(ifaces)) {
  for (const alias of iface) {
    if (alias.family === 'IPv4' && !alias.internal) {
      ipAddress = alias.address;
      break;
    }
  }
  if (ipAddress !== 'localhost') break;
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`\x1b[32mStreamFlow berjalan\x1b[0m\nAkses aplikasi di \x1b[34mhttp://${ipAddress}:${PORT}\x1b[0m`));

