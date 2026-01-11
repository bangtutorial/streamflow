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
      user_id,
      youtube_broadcast_id = null,
      youtube_stream_id = null,
      youtube_description = null,
      youtube_privacy = null,
      youtube_category = null,
      youtube_tags = null,
      youtube_thumbnail = null,
      youtube_channel_id = null,
      is_youtube_api = false
    } = streamData;
    const loop_video_int = loop_video ? 1 : 0;
    const use_advanced_settings_int = use_advanced_settings ? 1 : 0;
    const is_youtube_api_int = is_youtube_api ? 1 : 0;
    const final_status = status || (schedule_time ? 'scheduled' : 'offline');
    const status_updated_at = new Date().toISOString();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO streams (
          id, title, video_id, rtmp_url, stream_key, platform, platform_icon,
          bitrate, resolution, fps, orientation, loop_video,
          schedule_time, end_time, duration, status, status_updated_at, use_advanced_settings, user_id,
          youtube_broadcast_id, youtube_stream_id, youtube_description, youtube_privacy, youtube_category, youtube_tags, youtube_thumbnail, youtube_channel_id, is_youtube_api
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, title, video_id, rtmp_url, stream_key, platform, platform_icon,
          bitrate, resolution, fps, orientation, loop_video_int,
          schedule_time, end_time, duration, final_status, status_updated_at, use_advanced_settings_int, user_id,
          youtube_broadcast_id, youtube_stream_id, youtube_description, youtube_privacy, youtube_category, youtube_tags, youtube_thumbnail, youtube_channel_id, is_youtube_api_int
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
          row.is_youtube_api = row.is_youtube_api === 1;
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
               END AS video_type,
               yc.channel_name AS youtube_channel_name,
               yc.channel_thumbnail AS youtube_channel_thumbnail,
               yc.channel_id AS youtube_channel_external_id
        FROM streams s
        LEFT JOIN videos v ON s.video_id = v.id
        LEFT JOIN playlists p ON s.video_id = p.id
        LEFT JOIN youtube_channels yc ON s.youtube_channel_id = yc.id
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
      
      query += ` ORDER BY 
        CASE s.status 
          WHEN 'live' THEN 1 
          WHEN 'scheduled' THEN 2 
          WHEN 'offline' THEN 3 
          ELSE 4 
        END,
        s.created_at DESC`;
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error finding streams:', err.message);
          return reject(err);
        }
        if (rows) {
          rows.forEach(row => {
            row.loop_video = row.loop_video === 1;
            row.use_advanced_settings = row.use_advanced_settings === 1;
            row.is_youtube_api = row.is_youtube_api === 1;
          });
        }
        resolve(rows || []);
      });
    });
  }
  static findAllPaginated(userId = null, options = {}) {
    const { page = 1, limit = 10, filter = null, search = '' } = options;
    const offset = (page - 1) * limit;
    return new Promise((resolve, reject) => {
      let baseQuery = `
        FROM streams s
        LEFT JOIN videos v ON s.video_id = v.id
        LEFT JOIN playlists p ON s.video_id = p.id
        LEFT JOIN youtube_channels yc ON s.youtube_channel_id = yc.id
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
      if (search) {
        conditions.push('s.title LIKE ?');
        params.push(`%${search}%`);
      }
      if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ');
      }
      const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;
      db.get(countQuery, params, (err, countRow) => {
        if (err) {
          console.error('Error counting streams:', err.message);
          return reject(err);
        }
        const totalCount = countRow.count;
        const totalPages = Math.ceil(totalCount / limit);
        const selectQuery = `
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
                 END AS video_type,
                 yc.channel_name AS youtube_channel_name,
                 yc.channel_thumbnail AS youtube_channel_thumbnail,
                 yc.channel_id AS youtube_channel_external_id
          ${baseQuery}
          ORDER BY 
            CASE s.status 
              WHEN 'live' THEN 1 
              WHEN 'scheduled' THEN 2 
              WHEN 'offline' THEN 3 
              ELSE 4 
            END,
            s.created_at DESC
          LIMIT ? OFFSET ?
        `;
        db.all(selectQuery, [...params, limit, offset], (err, rows) => {
          if (err) {
            console.error('Error finding streams:', err.message);
            return reject(err);
          }
          if (rows) {
            rows.forEach(row => {
              row.loop_video = row.loop_video === 1;
              row.use_advanced_settings = row.use_advanced_settings === 1;
              row.is_youtube_api = row.is_youtube_api === 1;
            });
          }
          resolve({
            streams: rows || [],
            pagination: {
              page,
              limit,
              totalCount,
              totalPages
            }
          });
        });
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
    const { startTimeOverride = null, preserveEndTime = false } = options;
    
    return new Promise((resolve, reject) => {
      let query;
      let params;
      
      if (status === 'live') {
        const start_time = startTimeOverride || new Date().toISOString();
        query = `UPDATE streams SET 
            status = ?, 
            status_updated_at = ?, 
            start_time = ?,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`;
        params = [status, status_updated_at, start_time, id];
      } else if (status === 'offline') {
        if (preserveEndTime) {
          query = `UPDATE streams SET 
              status = ?, 
              status_updated_at = ?,
              schedule_time = NULL,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`;
          params = [status, status_updated_at, id];
        } else {
          query = `UPDATE streams SET 
              status = ?, 
              status_updated_at = ?,
              schedule_time = NULL,
              end_time = NULL,
              start_time = NULL,
              updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`;
          params = [status, status_updated_at, id];
        }
      } else {
        query = `UPDATE streams SET 
            status = ?, 
            status_updated_at = ?,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`;
        params = [status, status_updated_at, id];
      }
      
      if (userId) {
        query = query.replace(' WHERE id = ?', ' WHERE id = ? AND user_id = ?');
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
            updated: this.changes > 0
          });
        }
      );
    });
  }
  
  static updateStartTime(id, startTime) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE streams SET start_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [startTime, id],
        function (err) {
          if (err) {
            console.error('Error updating start time:', err.message);
            return reject(err);
          }
          resolve({ id, start_time: startTime, updated: this.changes > 0 });
        }
      );
    });
  }
  
  static clearScheduleFields(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE streams SET 
          schedule_time = NULL, 
          end_time = NULL, 
          start_time = NULL,
          updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [id],
        function (err) {
          if (err) {
            console.error('Error clearing schedule fields:', err.message);
            return reject(err);
          }
          resolve({ id, updated: this.changes > 0 });
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
                END AS video_type,
                yc.channel_name AS youtube_channel_name,
                yc.channel_thumbnail AS youtube_channel_thumbnail,
                yc.channel_id AS youtube_channel_external_id,
                yc.subscriber_count AS youtube_subscriber_count
         FROM streams s
         LEFT JOIN videos v ON s.video_id = v.id
         LEFT JOIN playlists p ON s.video_id = p.id
         LEFT JOIN youtube_channels yc ON s.youtube_channel_id = yc.id
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
            row.is_youtube_api = row.is_youtube_api === 1;
          }
          resolve(row);
        }
      );
    });
  }
  static findScheduledInRange(startTime, endTime) {
    return new Promise((resolve, reject) => {
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
        AND s.schedule_time <= ?
      `;
      db.all(query, [endTimeStr], (err, rows) => {
        if (err) {
          console.error('Error finding scheduled streams:', err.message);
          return reject(err);
        }
        if (rows) {
          rows.forEach(row => {
            row.loop_video = row.loop_video === 1;
            row.use_advanced_settings = row.use_advanced_settings === 1;
            row.is_youtube_api = row.is_youtube_api === 1;
          });
        }
        resolve(rows || []);
      });
    });
  }
  static isStreamKeyInUse(streamKey, userId, excludeId = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT COUNT(*) as count FROM streams WHERE stream_key = ? AND user_id = ? AND stream_key != ""';
      const params = [streamKey, userId];
      
      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }
      
      db.get(query, params, (err, row) => {
        if (err) {
          console.error('Error checking stream key:', err.message);
          return reject(err);
        }
        resolve(row.count > 0);
      });
    });
  }
}
module.exports = Stream;