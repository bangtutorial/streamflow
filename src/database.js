const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');
const bcrypt = require('bcryptjs');

// ============== BUAT TABEL DATABASE ==============
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabel stream_containers
  db.run(`
    CREATE TABLE IF NOT EXISTS stream_containers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT DEFAULT 'Streaming',
        preview_file TEXT,          -- File path untuk preview video
        stream_file TEXT,           -- File path untuk streaming video
        stream_key TEXT,            -- RTMP stream key
        stream_url TEXT DEFAULT 'rtmp://a.rtmp.youtube.com/live2',
        bitrate INTEGER DEFAULT 3000,
        resolution TEXT DEFAULT '1920:1080',
        fps INTEGER DEFAULT 30,
        loop_enabled INTEGER DEFAULT 0, -- 0 atau 1 sebagai boolean
        is_streaming INTEGER DEFAULT 0,   -- 0 atau 1 sebagai boolean
        container_order INTEGER,
        schedule_enabled INTEGER DEFAULT 0, -- 0 atau 1 sebagai boolean
        schedule_start_enabled INTEGER DEFAULT 0, -- 0 atau 1 sebagai boolean
        schedule_duration_enabled INTEGER DEFAULT 0, -- 0 atau 1 sebagai boolean
        schedule_start DATETIME,
        schedule_duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabel settings: menyimpan data pengaturan
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ============== USER MANAGEMENT ==============

// Menambahkan user baru dengan password yang di-hash.
const addUser = (username, hashedPassword, salt, callback) => {
  const query = `
    INSERT INTO users (username, password_hash, salt)
    VALUES (?, ?, ?)
  `;
  
  db.run(query, [username, hashedPassword, salt], callback);
};

// Mengambil data user berdasarkan username.
const getUser = (username, callback) => {
  const query = 'SELECT * FROM users WHERE username = ?';
  db.get(query, [username], callback);
};

// Fungsi untuk mendapatkan salt user
const getUserSalt = (username, callback) => {
  const query = 'SELECT salt FROM users WHERE username = ?';
  db.get(query, [username], (err, row) => {
    if (err) return callback(err);
    callback(null, row);
  });
};

// Fungsi untuk verifikasi user
const verifyUser = (username, hashedPassword, callback) => {
  const query = 'SELECT * FROM users WHERE username = ? AND password_hash = ?';
  db.get(query, [username, hashedPassword], (err, row) => {
    if (err) return callback(err);
    callback(null, row);
  });
};

// Memperbarui data user
const updateUser = (userId, updates, callback) => {
  let query = 'UPDATE users SET ';
  const params = [];
  const setClauses = [];

  if (updates.username) {
    setClauses.push('username = ?');
    params.push(updates.username);
  }
  if (updates.password_hash) {
    setClauses.push('password_hash = ?');
    params.push(updates.password_hash);
  }
  if (updates.salt) {
    setClauses.push('salt = ?');
    params.push(updates.salt);
  }

  if (setClauses.length === 0) {
    return callback(new Error('No fields to update'));
  }

  query += setClauses.join(', ') + ' WHERE id = ?';
  params.push(userId);

  db.run(query, params, function(err) {
    if (err) {
      console.error('Database update error:', err);
      return callback(err);
    }
    callback(null);
  });
};

// ============== STREAM CONTAINER MANAGEMENT ==============

// Menambahkan data stream container baru ke database.
const addStreamContainer = (data, callback) => {
  db.run(
    `INSERT INTO stream_containers (
      title, preview_file, stream_file, stream_key, stream_url, 
      bitrate, resolution, fps, loop_enabled, container_order, 
      is_streaming, schedule_enabled, schedule_start_enabled,
      schedule_duration_enabled, schedule_start, schedule_duration
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.preview_file,
      data.stream_file,
      data.stream_key,
      data.stream_url,
      data.bitrate,
      data.resolution,
      data.fps,
      data.loop_enabled,
      data.container_order,
      data.is_streaming,
      data.schedule_enabled || 0,
      data.schedule_start_enabled || 0,
      data.schedule_duration_enabled || 0,
      data.schedule_start || null,
      data.schedule_duration || null
    ],
    function(err) {
      if (err) {
        console.error("Error inserting stream container:", err);
        return callback(err);
      }
      callback(null, this);
    }
  );
};

// Memperbarui data stream container.
const updateStreamContainer = (id, updates, callback) => {
  let query = 'UPDATE stream_containers SET ';
  const params = [];
  const setClauses = [];

  if (updates.title) {
    setClauses.push('title = ?');
    params.push(updates.title);
  }
  if (updates.is_streaming !== undefined) {
    setClauses.push('is_streaming = ?');
    params.push(updates.is_streaming);
  }
  if (updates.stream_file) {
    setClauses.push('stream_file = ?');
    params.push(updates.stream_file);
  }
  if (updates.schedule_enabled !== undefined) {
    setClauses.push('schedule_enabled = ?');
    params.push(updates.schedule_enabled);
  }
  if (updates.schedule_start_enabled !== undefined) {
    setClauses.push('schedule_start_enabled = ?');
    params.push(updates.schedule_start_enabled);
  }
  if (updates.schedule_duration_enabled !== undefined) {
    setClauses.push('schedule_duration_enabled = ?');
    params.push(updates.schedule_duration_enabled);
  }
  if (updates.schedule_start !== undefined) {
    setClauses.push('schedule_start = ?');
    params.push(updates.schedule_start);
  }
  if (updates.schedule_duration !== undefined) {
    setClauses.push('schedule_duration = ?');
    params.push(updates.schedule_duration);
  }
  if (setClauses.length === 0) {
    return callback(new Error('No fields to update'));
  }

  query += setClauses.join(', ') + ' WHERE id = ?';
  params.push(id);

  db.run(query, params, callback);
};

// Mengambil semua data stream container.
const getStreamContainers = (callback) => {
  db.all('SELECT * FROM stream_containers', [], callback);
};

// Mengambil data stream container yang sedang aktif (streaming).
const getActiveStreamContainers = (callback) => {
  db.all('SELECT * FROM stream_containers WHERE is_streaming = 1 ORDER BY id ASC', [], callback);
};

// Mengambil stream container berdasarkan stream key.
const getStreamContainerByStreamKey = (streamKey, callback) => {
  db.get('SELECT * FROM stream_containers WHERE stream_key = ?', [streamKey], callback);
};

// Mengambil riwayat stream container (yang tidak aktif).
const getHistoryStreamContainers = (callback) => {
  db.all('SELECT * FROM stream_containers WHERE is_streaming = 0', [], callback);
};

// Menghapus stream container berdasarkan ID.
const deleteStreamContainer = (id, callback) => {
  db.run('DELETE FROM stream_containers WHERE id = ?', [id], callback);
};

// Mendapatkan jumlah total user.
const getUserCount = (callback) => {
  db.get('SELECT COUNT(*) AS count FROM users', [], (err, row) => {
    callback(err, row ? row.count : 0);
  });
};

const updatePassword = (userId, hashedPassword, salt) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users 
      SET password_hash = ?, salt = ?
      WHERE id = ?
    `;
    db.run(query, [hashedPassword, salt, userId], (err) => {
      if (err) reject(err);
      resolve();
    });
  });
};

// Menyimpan setting
const saveSetting = (key, value) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value],
      (err) => {
        if (err) reject(err);
        resolve();
      }
    );
  });
};

// Mengambil setting
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT value FROM settings WHERE key = ?',
      [key],
      (err, row) => {
        if (err) reject(err);
        resolve(row ? row.value : null);
      }
    );
  });
};

module.exports = { 
  addUser, 
  getUser, 
  getUserSalt,
  verifyUser,
  updateUser,
  updatePassword,
  addStreamContainer, 
  updateStreamContainer, 
  getStreamContainers, 
  getActiveStreamContainers, 
  getStreamContainerByStreamKey, 
  getHistoryStreamContainers, 
  deleteStreamContainer, 
  getUserCount,
  saveSetting,
  getSetting
};
