const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

class Rotation {
  static create(rotationData) {
    const id = uuidv4();
    const {
      user_id,
      name,
      gap_minutes = 10,
      is_loop = true,
      status = 'inactive',
      start_time = null,
      end_time = null,
      repeat_mode = 'daily',
      youtube_channel_id = null
    } = rotationData;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO stream_rotations (id, user_id, name, gap_minutes, is_loop, status, start_time, end_time, repeat_mode, youtube_channel_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, user_id, name, gap_minutes, is_loop ? 1 : 0, status, start_time, end_time, repeat_mode, youtube_channel_id],
        function(err) {
          if (err) {
            console.error('Error creating rotation:', err.message);
            return reject(err);
          }
          resolve({ id, ...rotationData });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM stream_rotations WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error finding rotation:', err.message);
          return reject(err);
        }
        if (row) {
          row.is_loop = row.is_loop === 1;
        }
        resolve(row);
      });
    });
  }

  static findByIdWithItems(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT r.*, yc.channel_name as youtube_channel_name, yc.channel_thumbnail as youtube_channel_thumbnail, yc.subscriber_count as youtube_subscriber_count
         FROM stream_rotations r
         LEFT JOIN youtube_channels yc ON r.youtube_channel_id = yc.id
         WHERE r.id = ?`,
        [id],
        (err, rotation) => {
          if (err) {
            console.error('Error finding rotation:', err.message);
            return reject(err);
          }
          if (!rotation) {
            return resolve(null);
          }
          rotation.is_loop = rotation.is_loop === 1;

          db.all(
            `SELECT ri.*, v.title as video_title, v.filepath as video_filepath, 
                    v.thumbnail_path as video_thumbnail, v.duration as video_duration
             FROM rotation_items ri
             LEFT JOIN videos v ON ri.video_id = v.id
             WHERE ri.rotation_id = ?
             ORDER BY ri.order_index ASC`,
            [id],
            (err, items) => {
              if (err) {
                console.error('Error finding rotation items:', err.message);
                return reject(err);
              }
              rotation.items = items || [];
              resolve(rotation);
            }
          );
        }
      );
    });
  }

  static findAll(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT r.*, 
                (SELECT COUNT(*) FROM rotation_items WHERE rotation_id = r.id) as item_count,
                (SELECT COALESCE(ri.thumbnail_path, v.thumbnail_path) FROM rotation_items ri 
                 LEFT JOIN videos v ON ri.video_id = v.id 
                 WHERE ri.rotation_id = r.id 
                 ORDER BY ri.order_index ASC LIMIT 1) as first_thumbnail,
                yc.channel_name as youtube_channel_name,
                yc.channel_thumbnail as youtube_channel_thumbnail,
                yc.channel_id as youtube_channel_external_id
         FROM stream_rotations r
         LEFT JOIN youtube_channels yc ON r.youtube_channel_id = yc.id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.error('Error finding rotations:', err.message);
            return reject(err);
          }
          if (rows) {
            rows.forEach(row => {
              row.is_loop = row.is_loop === 1;
            });
          }
          resolve(rows || []);
        }
      );
    });
  }

  static update(id, rotationData) {
    const fields = [];
    const values = [];

    Object.entries(rotationData).forEach(([key, value]) => {
      if (key === 'is_loop' && typeof value === 'boolean') {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE stream_rotations SET ${fields.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.run(query, values, function(err) {
        if (err) {
          console.error('Error updating rotation:', err.message);
          return reject(err);
        }
        resolve({ id, ...rotationData });
      });
    });
  }

  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM rotation_items WHERE rotation_id = ?',
        [id],
        function(err) {
          if (err) {
            console.error('Error deleting rotation items:', err.message);
            return reject(err);
          }

          db.run(
            'DELETE FROM stream_rotations WHERE id = ? AND user_id = ?',
            [id, userId],
            function(err) {
              if (err) {
                console.error('Error deleting rotation:', err.message);
                return reject(err);
              }
              resolve({ success: true, deleted: this.changes > 0 });
            }
          );
        }
      );
    });
  }

  static addItem(itemData) {
    const id = uuidv4();
    const {
      rotation_id,
      order_index,
      video_id,
      title,
      description = '',
      tags = '',
      thumbnail_path = null,
      original_thumbnail_path = null,
      privacy = 'unlisted',
      category = '22'
    } = itemData;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO rotation_items (id, rotation_id, order_index, video_id, title, description, tags, thumbnail_path, original_thumbnail_path, privacy, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, rotation_id, order_index, video_id, title, description, tags, thumbnail_path, original_thumbnail_path, privacy, category],
        function(err) {
          if (err) {
            console.error('Error adding rotation item:', err.message);
            return reject(err);
          }
          resolve({ id, ...itemData });
        }
      );
    });
  }

  static updateItem(itemId, itemData) {
    const fields = [];
    const values = [];

    Object.entries(itemData).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    values.push(itemId);

    const query = `UPDATE rotation_items SET ${fields.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      db.run(query, values, function(err) {
        if (err) {
          console.error('Error updating rotation item:', err.message);
          return reject(err);
        }
        resolve({ id: itemId, ...itemData });
      });
    });
  }

  static deleteItem(itemId) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM rotation_items WHERE id = ?', [itemId], function(err) {
        if (err) {
          console.error('Error deleting rotation item:', err.message);
          return reject(err);
        }
        resolve({ success: true, deleted: this.changes > 0 });
      });
    });
  }

  static getNextItem(rotationId, currentIndex) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT ri.*, v.filepath as video_filepath, v.thumbnail_path as video_thumbnail
         FROM rotation_items ri
         LEFT JOIN videos v ON ri.video_id = v.id
         WHERE ri.rotation_id = ? AND ri.order_index > ?
         ORDER BY ri.order_index ASC
         LIMIT 1`,
        [rotationId, currentIndex],
        (err, row) => {
          if (err) {
            console.error('Error getting next rotation item:', err.message);
            return reject(err);
          }
          resolve(row);
        }
      );
    });
  }

  static getFirstItem(rotationId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT ri.*, v.filepath as video_filepath, v.thumbnail_path as video_thumbnail
         FROM rotation_items ri
         LEFT JOIN videos v ON ri.video_id = v.id
         WHERE ri.rotation_id = ?
         ORDER BY ri.order_index ASC
         LIMIT 1`,
        [rotationId],
        (err, row) => {
          if (err) {
            console.error('Error getting first rotation item:', err.message);
            return reject(err);
          }
          resolve(row);
        }
      );
    });
  }

  static findActiveRotations() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT r.*, 
                (SELECT COUNT(*) FROM rotation_items WHERE rotation_id = r.id) as item_count
         FROM stream_rotations r
         WHERE r.status = 'active'`,
        [],
        (err, rows) => {
          if (err) {
            console.error('Error finding active rotations:', err.message);
            return reject(err);
          }
          if (rows) {
            rows.forEach(row => {
              row.is_loop = row.is_loop === 1;
            });
          }
          resolve(rows || []);
        }
      );
    });
  }

  static getItemsByRotationId(rotationId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ri.*, v.title as video_title, v.filepath as video_filepath, 
                v.thumbnail_path as video_thumbnail, v.duration as video_duration
         FROM rotation_items ri
         LEFT JOIN videos v ON ri.video_id = v.id
         WHERE ri.rotation_id = ?
         ORDER BY ri.order_index ASC`,
        [rotationId],
        (err, rows) => {
          if (err) {
            console.error('Error getting rotation items:', err.message);
            return reject(err);
          }
          resolve(rows || []);
        }
      );
    });
  }
}

module.exports = Rotation;
