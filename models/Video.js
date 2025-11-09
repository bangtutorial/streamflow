const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { db } = require('../db/database');
class Video {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO videos (
          id, title, filepath, thumbnail_path, file_size, 
          duration, format, resolution, bitrate, fps, user_id, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.title, data.filepath, data.thumbnail_path, data.file_size,
          data.duration, data.format, data.resolution, data.bitrate, data.fps, data.user_id,
          now, now
        ],
        function (err) {
          if (err) {
            console.error('Error creating video:', err.message);
            return reject(err);
          }
          resolve({ id, ...data, created_at: now, updated_at: now });
        }
      );
    });
  }
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM videos WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error finding video:', err.message);
          return reject(err);
        }
        resolve(row);
      });
    });
  }
  static findAll(userId = null) {
    return new Promise((resolve, reject) => {
      const query = userId ?
        'SELECT * FROM videos WHERE user_id = ? ORDER BY upload_date DESC' :
        'SELECT * FROM videos ORDER BY upload_date DESC';
      const params = userId ? [userId] : [];
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error finding videos:', err.message);
          return reject(err);
        }
        resolve(rows || []);
      });
    });
  }
  static update(id, videoData) {
    // Whitelist of allowed fields to prevent SQL injection
    const allowedFields = [
      'title', 'filepath', 'thumbnail_path', 'file_size', 'duration',
      'format', 'resolution', 'bitrate', 'fps'
    ];
    const fields = [];
    const values = [];

    Object.entries(videoData).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return Promise.reject(new Error('No valid fields to update'));
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const query = `UPDATE videos SET ${fields.join(', ')} WHERE id = ?`;
    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          console.error('Error updating video:', err.message);
          return reject(err);
        }
        resolve({ id, ...videoData });
      });
    });
  }
  static delete(id) {
    return new Promise((resolve, reject) => {
      Video.findById(id)
        .then(async video => {
          if (!video) {
            return reject(new Error('Video not found'));
          }
          db.run('DELETE FROM videos WHERE id = ?', [id], async function (err) {
            if (err) {
              console.error('Error deleting video from database:', err.message);
              return reject(err);
            }
            // Use async file operations to prevent blocking
            if (video.filepath) {
              // Prevent path traversal by ensuring path stays within public directory
              const publicDir = path.join(process.cwd(), 'public');
              const relativeVideoPath = video.filepath.startsWith('/') ? video.filepath.substring(1) : video.filepath;
              const fullPath = path.resolve(publicDir, relativeVideoPath);

              // Security check: ensure resolved path is within public directory
              if (!fullPath.startsWith(publicDir)) {
                console.error('Path traversal attempt detected:', fullPath);
              } else {
                try {
                  await fs.promises.unlink(fullPath);
                } catch (fileErr) {
                  if (fileErr.code !== 'ENOENT') {  // Ignore "file not found" errors
                    console.error('Error deleting video file:', fileErr);
                  }
                }
              }
            }
            if (video.thumbnail_path) {
              // Prevent path traversal for thumbnails
              const publicDir = path.join(process.cwd(), 'public');
              const relativeThumbnailPath = video.thumbnail_path.startsWith('/') ? video.thumbnail_path.substring(1) : video.thumbnail_path;
              const thumbnailPath = path.resolve(publicDir, relativeThumbnailPath);

              // Security check: ensure resolved path is within public directory
              if (!thumbnailPath.startsWith(publicDir)) {
                console.error('Path traversal attempt detected:', thumbnailPath);
              } else {
                try {
                  await fs.promises.unlink(thumbnailPath);
                } catch (thumbErr) {
                  if (thumbErr.code !== 'ENOENT') {  // Ignore "file not found" errors
                    console.error('Error deleting thumbnail:', thumbErr);
                  }
                }
              }
            }
            resolve({ success: true, id });
          });
        })
        .catch(err => reject(err));
    });
  }
}
module.exports = Video;