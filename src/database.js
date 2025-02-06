const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');
const bcrypt = require('bcryptjs');

// ============== BUAT TABEL DATABASE ==============
db.serialize(() => {
  // Tabel users: menyimpan data user dan password hash-nya
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  // Tabel stream_containers: menyimpan data streaming dan informasi terkait
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ============== USER MANAGEMENT ==============

// Menambahkan user baru dengan password yang di-hash.
const addUser = (username, password, callback) => {
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return callback(err);
    db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash],
      callback
    );
  });
};

// Mengambil data user berdasarkan username.
const getUser = (username, callback) => {
  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    (err, user) => {
      callback(err, user);
    }
  );
};

// Memperbarui data user.
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

  if (setClauses.length === 0) {
    return callback(new Error('No fields to update'));
  }

  query += setClauses.join(', ') + ' WHERE id = ?';
  params.push(userId);

  db.run(query, params, function (err) {
    callback(err, this);
  });
};

// ============== STREAM CONTAINER MANAGEMENT ==============

// Menambahkan data stream container baru ke database.
const addStreamContainer = (data, callback) => {
  db.run(
    'INSERT INTO stream_containers (title, preview_file, stream_file, stream_key, stream_url, bitrate, resolution, fps, loop_enabled, container_order, is_streaming) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      data.is_streaming
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

module.exports = { 
  addUser, 
  getUser, 
  updateUser, 
  addStreamContainer, 
  updateStreamContainer, 
  getStreamContainers, 
  getActiveStreamContainers, 
  getStreamContainerByStreamKey, 
  getHistoryStreamContainers, 
  deleteStreamContainer, 
  getUserCount 
};
