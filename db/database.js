const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'streamflow.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    createTables();
  }
});
function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_path TEXT,
    gdrive_api_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    }
  });
  db.run(`CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filepath TEXT NOT NULL,
    thumbnail_path TEXT,
    file_size INTEGER,
    duration REAL,
    format TEXT,
    resolution TEXT,
    bitrate INTEGER,
    fps TEXT,
    user_id TEXT,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, (err) => {
    if (err) {
      console.error('Error creating videos table:', err.message);
    }
  });
  db.run(`CREATE TABLE IF NOT EXISTS streams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    video_id TEXT,
    rtmp_url TEXT NOT NULL,
    stream_key TEXT NOT NULL,
    platform TEXT,
    platform_icon TEXT,
    bitrate INTEGER DEFAULT 2500,
    resolution TEXT,
    fps INTEGER DEFAULT 30,
    orientation TEXT DEFAULT 'horizontal',
    loop_video BOOLEAN DEFAULT 1,
    schedule_time TIMESTAMP,
    duration INTEGER,
    status TEXT DEFAULT 'offline',
    status_updated_at TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    use_advanced_settings BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
  )`, (err) => {
    if (err) {
      console.error('Error creating streams table:', err.message);
    }
  });  
  db.run(`CREATE TABLE IF NOT EXISTS stream_history (
    id TEXT PRIMARY KEY,
    stream_id TEXT,
    title TEXT NOT NULL,
    platform TEXT,
    platform_icon TEXT,
    video_id TEXT,
    video_title TEXT,
    resolution TEXT,
    bitrate INTEGER,
    fps INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER,
    use_advanced_settings BOOLEAN DEFAULT 0,
    stream_key TEXT,
    rtmp_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (stream_id) REFERENCES streams(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
  )`, (err) => {
    if (err) {
      console.error('Error creating stream_history table:', err.message);
    }
  });

  db.run(`ALTER TABLE stream_history ADD COLUMN stream_key TEXT`, (err) => {
  });
  
  db.run(`ALTER TABLE stream_history ADD COLUMN rtmp_url TEXT`, (err) => {
  });
  db.run(`CREATE TABLE IF NOT EXISTS video_analytics (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT,
    thumbnail TEXT,
    channel_name TEXT,
    upload_date TEXT,
    view_count INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    current_viewers INTEGER DEFAULT 0,
    is_live BOOLEAN DEFAULT 0,
    analytics_data TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(video_id, user_id)
  )`, (err) => {
    if (err) {
      console.error('Error creating video_analytics table:', err.message);
    } else {
      migrateVideoAnalyticsTable();
    }
  });
}

function migrateVideoAnalyticsTable() {
  const newColumns = [
    'view_count INTEGER DEFAULT 0',
    'likes INTEGER DEFAULT 0', 
    'dislikes INTEGER DEFAULT 0',
    'current_viewers INTEGER DEFAULT 0',
    'is_live BOOLEAN DEFAULT 0',
    'analytics_data TEXT',
    'last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ];

  newColumns.forEach(columnDef => {
    const columnName = columnDef.split(' ')[0];
    db.run(`ALTER TABLE video_analytics ADD COLUMN ${columnDef}`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error(`Error adding column ${columnName}:`, err.message);
      }
    });
  });
}

function checkIfUsersExist() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result.count > 0);
    });
  });
}
module.exports = {
  db,
  checkIfUsersExist,
  
  addVideoToAnalytics: (userId, videoData) => {
    return new Promise((resolve, reject) => {
      const { videoId, title, thumbnail, channelName, uploadDate, analytics, isLive } = videoData;
      const id = require('crypto').randomUUID();
      
      const analyticsJson = JSON.stringify(analytics || {});
      
      db.run(
        `INSERT OR REPLACE INTO video_analytics 
         (id, video_id, user_id, title, thumbnail, channel_name, upload_date, 
          view_count, likes, dislikes, current_viewers, is_live, analytics_data, last_updated) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          id, 
          videoId, 
          userId, 
          title, 
          thumbnail, 
          channelName, 
          uploadDate,
          analytics?.viewCount || 0,
          analytics?.likes || 0,
          analytics?.dislikes || 0,
          analytics?.currentViewers || 0,
          isLive ? 1 : 0,
          analyticsJson
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              id, 
              videoId, 
              title, 
              thumbnail, 
              channelName, 
              uploadDate, 
              analytics: analytics || {},
              isLive: isLive || false
            });
          }
        }
      );
    });
  },
    getUserAnalyticsVideos: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT video_id, title, thumbnail, channel_name, upload_date, 
                view_count, likes, dislikes, current_viewers, is_live, 
                analytics_data, added_at 
         FROM video_analytics 
         WHERE user_id = ? 
         ORDER BY added_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const videos = rows.map(row => ({
              videoId: row.video_id,
              title: row.title,
              thumbnail: row.thumbnail,
              channelName: row.channel_name,
              uploadDate: row.upload_date,
              isLive: Boolean(row.is_live),
              analytics: {
                viewCount: row.view_count || 0,
                likes: row.likes || 0,
                dislikes: row.dislikes || 0,
                currentViewers: row.current_viewers || 0,
                ...JSON.parse(row.analytics_data || '{}')
              },
              addedAt: row.added_at
            }));
            resolve(videos);
          }
        }
      );
    });
  },
  
  removeVideoFromAnalytics: (userId, videoId) => {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM video_analytics WHERE user_id = ? AND video_id = ?`,
        [userId, videoId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  },
  updateVideoAnalyticsData: (userId, videoId, videoData) => {
    return new Promise((resolve, reject) => {
      const { title, thumbnail, channelName, uploadDate, analytics, isLive } = videoData;
      const analyticsJson = JSON.stringify(analytics || {});
      
      db.run(
        `UPDATE video_analytics 
         SET title = ?, thumbnail = ?, channel_name = ?, upload_date = ?,
             view_count = ?, likes = ?, dislikes = ?, current_viewers = ?,
             is_live = ?, analytics_data = ?, last_updated = CURRENT_TIMESTAMP
         WHERE user_id = ? AND video_id = ?`,
        [
          title, 
          thumbnail, 
          channelName, 
          uploadDate,
          analytics?.viewCount || 0,
          analytics?.likes || 0,
          analytics?.dislikes || 0,
          analytics?.currentViewers || 0,
          isLive ? 1 : 0,
          analyticsJson,
          userId, 
          videoId
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  },

  getVideoAnalytics: (userId, videoId) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT video_id, title, thumbnail, channel_name, upload_date, 
                view_count, likes, dislikes, current_viewers, is_live, 
                analytics_data, added_at 
         FROM video_analytics 
         WHERE user_id = ? AND video_id = ?`,
        [userId, videoId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const video = {
              videoId: row.video_id,
              title: row.title,
              thumbnail: row.thumbnail,
              channelName: row.channel_name,
              uploadDate: row.upload_date,
              isLive: Boolean(row.is_live),
              analytics: {
                viewCount: row.view_count || 0,
                likes: row.likes || 0,
                dislikes: row.dislikes || 0,
                currentViewers: row.current_viewers || 0,
                ...JSON.parse(row.analytics_data || '{}')
              },
              addedAt: row.added_at
            };
            resolve(video);
          }
        }
      );
    });
  }
};