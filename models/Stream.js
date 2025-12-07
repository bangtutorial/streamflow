const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
class Stream {
  static create(streamData) {
    const id = uuidv4();
    const {
      title,
      video_id,
      rtmp_url,
      stream_key,
      platform,
      platform_icon,
      bitrate = 2500,
      resolution,
      fps = 30,
      orientation = 'horizontal',
      loop_video = true,
      schedule_time = null,
      end_time = null,
      duration = null,
      use_advanced_settings = false,
      status,
      user_id
    } = streamData;
    const loop_video_int = loop_video ? 1 : 0;
    const use_advanced_settings_int = use_advanced_settings ? 1 : 0;
    const final_status = status || (schedule_time ? 'scheduled' : 'offline');
    const status_updated_at = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO streams (
          id, title, video_id, rtmp_url, stream_key, platform, platform_icon,
          bitrate, resolution, fps, orientation, loop_video,
          schedule_time, end_time, duration, status, status_updated_at, use_advanced_settings, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, title, video_id, rtmp_url, stream_key, platform, platform_icon,
          bitrate, resolution, fps, orientation, loop_video_int,
          schedule_time, end_time, duration, final_status, status_updated_at, use_advanced_settings_int, user_id
        ],
        function (err) {
          if (err) {
            console.error('Error creating stream:', err.message);
            return reject(err);
          }
          resolve({ id, ...streamData, status: final_status, status_updated_at });
        }
      );
    });
  }
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM streams WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error finding stream:', err.message);
          return reject(err);
        }
        if (row) {
          row.loop_video = row.loop_video === 1;
          row.use_advanced_settings = row.use_advanced_settings === 1;
        }
        resolve(row);
      });
    });
  }
  static findAll(userId = null, filter = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT s.*, 
               v.title AS video_title, 
               v.filepath AS video_filepath,
               v.thumbnail_path AS video_thumbnail, 
               v.duration AS video_duration,
               v.resolution AS video_resolution,  
               v.bitrate AS video_bitrate,        
               v.fps AS video_fps,
               p.name AS playlist_name,
               CASE 
                 WHEN p.id IS NOT NULL THEN 'playlist'
                 WHEN v.id IS NOT NULL THEN 'video'
                 ELSE NULL
               END AS video_type
        FROM streams s
        LEFT JOIN videos v ON s.video_id = v.id
        LEFT JOIN playlists p ON s.video_id = p.id
      `;
      const params = [];
      const conditions = [];
      
      if (userId) {
        conditions.push('s.user_id = ?');
        params.push(userId);
      }
      
      if (filter) {
        if (filter === 'live') {
          conditions.push("s.status = 'live'");
        } else if (filter === 'scheduled') {
          conditions.push("s.status = 'scheduled'");
        } else if (filter === 'offline') {
          conditions.push("s.status = 'offline'");
        }
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY s.created_at DESC';
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error finding streams:', err.message);
          return reject(err);
        }
        if (rows) {
          rows.forEach(row => {
            row.loop_video = row.loop_video === 1;
            row.use_advanced_settings = row.use_advanced_settings === 1;
          });
        }
        resolve(rows || []);
      });
    });
  }
  static update(id, streamData) {
    const fields = [];
    const values = [];
    Object.entries(streamData).forEach(([key, value]) => {
      if (key === 'loop_video' && typeof value === 'boolean') {
        fields.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const query = `UPDATE streams SET ${fields.join(', ')} WHERE id = ?`;
    return new Promise((resolve, reject) => {
      db.run(query, values, function (err) {
        if (err) {
          console.error('Error updating stream:', err.message);
          return reject(err);
        }
        resolve({ id, ...streamData });
      });
    });
  }
  static delete(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM streams WHERE id = ? AND user_id = ?',
        [id, userId],
        function (err) {
          if (err) {
            console.error('Error deleting stream:', err.message);
            return reject(err);
          }
          resolve({ success: true, deleted: this.changes > 0 });
        }
      );
    });
  }
  static updateStatus(id, status, userId = null, options = {}) {
    const status_updated_at = new Date().toISOString();
    const { startTimeOverride = null, endTimeOverride = null, clearEndTime = false } = options;
    let start_time = null;
    let end_time = null;
    
    if (status === 'live') {
      start_time = startTimeOverride || new Date().toISOString();
    }
    if (endTimeOverride) {
      end_time = endTimeOverride;
    }
    
    return new Promise((resolve, reject) => {
      let query;
      let params;
      
      if (status === 'offline' && !endTimeOverride) {
        query = `UPDATE streams SET 
            status = ?, 
            status_updated_at = ?, 
            start_time = CASE WHEN ? IS NOT NULL THEN ? ELSE start_time END,
            end_time = NULL,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`;
        params = [
          status,
          status_updated_at,
          start_time,
          start_time,
          id
        ];
      } else {
        query = `UPDATE streams SET 
            status = ?, 
            status_updated_at = ?, 
            start_time = CASE WHEN ? IS NOT NULL THEN ? ELSE start_time END, 
            end_time = CASE WHEN ? IS NOT NULL THEN ? ELSE end_time END,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`;
        params = [
          status,
          status_updated_at,
          start_time,
          start_time,
          end_time,
          end_time,
          id
        ];
      }
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      db.run(query, params, function (err) {
          if (err) {
            console.error('Error updating stream status:', err.message);
            return reject(err);
          }
          resolve({
            id,
            status,
            status_updated_at,
            start_time,
            end_time,
            updated: this.changes > 0
          });
        }
      );
    });
  }
  static async getStreamWithVideo(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT s.*, 
                v.title AS video_title, 
                v.filepath AS video_filepath, 
                v.thumbnail_path AS video_thumbnail, 
                v.duration AS video_duration,
                p.name AS playlist_name,
                CASE 
                  WHEN p.id IS NOT NULL THEN 'playlist'
                  WHEN v.id IS NOT NULL THEN 'video'
                  ELSE NULL
                END AS video_type
         FROM streams s
         LEFT JOIN videos v ON s.video_id = v.id
         LEFT JOIN playlists p ON s.video_id = p.id
         WHERE s.id = ?`,
        [id],
        (err, row) => {
          if (err) {
            console.error('Error fetching stream with video:', err.message);
            return reject(err);
          }
          if (row) {
            row.loop_video = row.loop_video === 1;
            row.use_advanced_settings = row.use_advanced_settings === 1;
          }
          resolve(row);
        }
      );
    });
  }
  static findScheduledInRange(startTime, endTime) {
    return new Promise((resolve, reject) => {
      const startTimeStr = startTime.toISOString();
      const endTimeStr = endTime.toISOString();
      const query = `
        SELECT s.*, 
               v.title AS video_title, 
               v.filepath AS video_filepath,
               v.thumbnail_path AS video_thumbnail, 
               v.duration AS video_duration,
               v.resolution AS video_resolution,
               v.bitrate AS video_bitrate,
               v.fps AS video_fps  
        FROM streams s
        LEFT JOIN videos v ON s.video_id = v.id
        WHERE s.status = 'scheduled'
        AND s.schedule_time IS NOT NULL
        AND s.schedule_time >= ?
        AND s.schedule_time <= ?
      `;
      db.all(query, [startTimeStr, endTimeStr], (err, rows) => {
        if (err) {
          console.error('Error finding scheduled streams:', err.message);
          return reject(err);
        }
        if (rows) {
          rows.forEach(row => {
            row.loop_video = row.loop_video === 1;
            row.use_advanced_settings = row.use_advanced_settings === 1;
          });
        }
        resolve(rows || []);
      });
    });
  }
}
module.exports = Stream;