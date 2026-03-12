const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');

class MediaFolder {
  static create({ name, user_id }) {
    const id = uuidv4();
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO media_folders (id, name, user_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, name, user_id, now, now],
        function(err) {
          if (err) {
            console.error('Error creating media folder:', err.message);
            return reject(err);
          }
          resolve({ id, name, user_id, created_at: now, updated_at: now });
        }
      );
    });
  }

  static findById(id, userId = null) {
    return new Promise((resolve, reject) => {
      const query = userId
        ? 'SELECT * FROM media_folders WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM media_folders WHERE id = ?';
      const params = userId ? [id, userId] : [id];
      db.get(query, params, (err, row) => {
        if (err) {
          console.error('Error finding media folder:', err.message);
          return reject(err);
        }
        resolve(row || null);
      });
    });
  }

  static findAllByUser(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT mf.*,
                (SELECT COUNT(*) FROM videos v WHERE v.folder_id = mf.id) AS item_count
         FROM media_folders mf
         WHERE mf.user_id = ?
         ORDER BY LOWER(mf.name) ASC`,
        [userId],
        (err, rows) => {
          if (err) {
            console.error('Error finding media folders:', err.message);
            return reject(err);
          }
          resolve(rows || []);
        }
      );
    });
  }

  static findByName(userId, name) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM media_folders WHERE user_id = ? AND LOWER(name) = LOWER(?)',
        [userId, name],
        (err, row) => {
          if (err) {
            console.error('Error finding media folder by name:', err.message);
            return reject(err);
          }
          resolve(row || null);
        }
      );
    });
  }

  static update(id, userId, data) {
    const fields = [];
    const values = [];

    Object.entries(data).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    fields.push('updated_at = ?');
    values.push(new Date().toISOString(), id, userId);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE media_folders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        values,
        function(err) {
          if (err) {
            console.error('Error updating media folder:', err.message);
            return reject(err);
          }
          resolve({ id, ...data });
        }
      );
    });
  }

  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM media_folders WHERE id = ? AND user_id = ?',
        [id, userId],
        function(err) {
          if (err) {
            console.error('Error deleting media folder:', err.message);
            return reject(err);
          }
          resolve({ success: true, id });
        }
      );
    });
  }
}

module.exports = MediaFolder;
