const { db } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Playlist {
  static findAll(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT p.*, 
         COUNT(pv.id) as video_count,
         (SELECT GROUP_CONCAT(v2.thumbnail_path)
          FROM playlist_videos pv2
          JOIN videos v2 ON pv2.video_id = v2.id
          WHERE pv2.playlist_id = p.id
          ORDER BY pv2.position ASC) as thumbnails
         FROM playlists p 
         LEFT JOIN playlist_videos pv ON p.id = pv.playlist_id 
         LEFT JOIN videos v ON pv.video_id = v.id
         WHERE p.user_id = ? 
         GROUP BY p.id
         ORDER BY p.updated_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            return reject(err);
          }
          resolve(rows);
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM playlists WHERE id = ?', [id], (err, row) => {
        if (err) {
          return reject(err);
        }
        resolve(row);
      });
    });
  }

  static findByIdWithVideos(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM playlists WHERE id = ?', [id], (err, playlist) => {
        if (err) {
          return reject(err);
        }
        if (!playlist) {
          return resolve(null);
        }

        db.all(
          `SELECT v.*, pv.position 
           FROM playlist_videos pv 
           JOIN videos v ON pv.video_id = v.id 
           WHERE pv.playlist_id = ? 
           ORDER BY pv.position ASC`,
          [id],
          (err, videos) => {
            if (err) {
              return reject(err);
            }
            playlist.videos = videos;
            resolve(playlist);
          }
        );
      });
    });
  }

  static create(playlistData) {
    const playlistId = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO playlists (id, name, description, is_shuffle, user_id) VALUES (?, ?, ?, ?, ?)',
        [playlistId, playlistData.name, playlistData.description || null, playlistData.is_shuffle || 0, playlistData.user_id],
        function (err) {
          if (err) {
            return reject(err);
          }
          resolve({ id: playlistId, ...playlistData });
        }
      );
    });
  }

  static update(id, playlistData) {
    const fields = [];
    const values = [];
    
    Object.entries(playlistData).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'user_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`;
    
    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          return reject(err);
        }
        resolve({ id, ...playlistData });
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM playlists WHERE id = ?', [id], function (err) {
        if (err) {
          return reject(err);
        }
        resolve({ deleted: this.changes > 0 });
      });
    });
  }

  static addVideo(playlistId, videoId, position) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO playlist_videos (id, playlist_id, video_id, position) VALUES (?, ?, ?, ?)',
        [id, playlistId, videoId, position],
        function (err) {
          if (err) {
            return reject(err);
          }
          resolve({ id, playlist_id: playlistId, video_id: videoId, position });
        }
      );
    });
  }

  static removeVideo(playlistId, videoId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?',
        [playlistId, videoId],
        function (err) {
          if (err) {
            return reject(err);
          }
          resolve({ deleted: this.changes > 0 });
        }
      );
    });
  }

  static updateVideoPositions(playlistId, videoPositions) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let completed = 0;
        let hasError = false;

        videoPositions.forEach(({ videoId, position }) => {
          db.run(
            'UPDATE playlist_videos SET position = ? WHERE playlist_id = ? AND video_id = ?',
            [position, playlistId, videoId],
            function (err) {
              if (err && !hasError) {
                hasError = true;
                db.run('ROLLBACK');
                return reject(err);
              }
              
              completed++;
              if (completed === videoPositions.length && !hasError) {
                db.run('COMMIT', (err) => {
                  if (err) {
                    return reject(err);
                  }
                  resolve({ updated: true });
                });
              }
            }
          );
        });
      });
    });
  }

  static getNextPosition(playlistId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT MAX(position) as max_position FROM playlist_videos WHERE playlist_id = ?',
        [playlistId],
        (err, row) => {
          if (err) {
            return reject(err);
          }
          resolve((row.max_position || 0) + 1);
        }
      );
    });
  }
}

module.exports = Playlist;