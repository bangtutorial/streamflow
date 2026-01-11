const { db } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class YoutubeChannel {
  static findAll(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM youtube_channels WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM youtube_channels WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  static findByChannelId(userId, channelId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM youtube_channels WHERE user_id = ? AND channel_id = ?',
        [userId, channelId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  static findDefault(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM youtube_channels WHERE user_id = ? AND is_default = 1',
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  static async create(data) {
    const id = uuidv4();
    const channels = await this.findAll(data.user_id);
    const isDefault = channels.length === 0 ? 1 : 0;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO youtube_channels (id, user_id, channel_id, channel_name, channel_thumbnail, subscriber_count, access_token, refresh_token, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.user_id,
          data.channel_id,
          data.channel_name,
          data.channel_thumbnail,
          data.subscriber_count || '0',
          data.access_token,
          data.refresh_token,
          isDefault
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ id, ...data, is_default: isDefault });
        }
      );
    });
  }

  static update(id, data) {
    const fields = [];
    const values = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE youtube_channels SET ${fields.join(', ')} WHERE id = ?`,
        values,
        function (err) {
          if (err) return reject(err);
          resolve({ id, ...data });
        }
      );
    });
  }

  static async setDefault(userId, channelId) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(
          'UPDATE youtube_channels SET is_default = 0 WHERE user_id = ?',
          [userId],
          (err) => {
            if (err) return reject(err);
          }
        );
        db.run(
          'UPDATE youtube_channels SET is_default = 1 WHERE id = ? AND user_id = ?',
          [channelId, userId],
          function (err) {
            if (err) return reject(err);
            resolve({ success: true });
          }
        );
      });
    });
  }

  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM youtube_channels WHERE id = ? AND user_id = ?',
        [id, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes > 0 });
        }
      );
    });
  }

  static deleteAll(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM youtube_channels WHERE user_id = ?',
        [userId],
        function (err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes });
        }
      );
    });
  }

  static count(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM youtube_channels WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.count : 0);
        }
      );
    });
  }
}

module.exports = YoutubeChannel;
