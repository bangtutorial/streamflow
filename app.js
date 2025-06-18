require('dotenv').config();
require('./services/logger.js');
const express = require('express');
const axios = require('axios');
const path = require('path');
const engine = require('ejs-mate');
const os = require('os');
const multer = require('multer');
const fs = require('fs');
const csrf = require('csrf');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('./models/User');
const { checkIfUsersExist } = require('./db/database');
const systemMonitor = require('./services/systemMonitor');
const { uploadVideo } = require('./middleware/uploadMiddleware');
const { ensureDirectories, paths } = require('./utils/storage');
const { getVideoInfo, generateThumbnail } = require('./utils/videoProcessor');
const Video = require('./models/Video');
const VideoAnalytics = require('./utils/videoAnalytics');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const streamingService = require('./services/streamingService');
const schedulerService = require('./services/schedulerService');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
process.on('unhandledRejection', (reason, promise) => {
  console.error('-----------------------------------');
  console.error('UNHANDLED REJECTION AT:', promise);
  console.error('REASON:', reason);
  console.error('-----------------------------------');
});
process.on('uncaughtException', (error) => {
  console.error('-----------------------------------');
  console.error('UNCAUGHT EXCEPTION:', error);
  console.error('-----------------------------------');
});
const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT || 7575;
const tokens = new csrf();
ensureDirectories();
ensureDirectories();
app.locals.helpers = {
  getUsername: function (req) {
    if (req.session && req.session.username) {
      return req.session.username;
    }
    return 'User';
  },
  getAvatar: function (req) {
    if (req.session && req.session.userId) {
      const avatarPath = req.session.avatar_path;
      if (avatarPath) {
        return `<img src="${avatarPath}" alt="${req.session.username || 'User'}'s Profile" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/default-avatar.jpg';">`;
      }
    }
    return '<img src="/images/default-avatar.jpg" alt="Default Profile" class="w-full h-full object-cover">';
  },
  getPlatformIcon: function (platform) {
    switch (platform) {
      case 'YouTube': return 'youtube';
      case 'Facebook': return 'facebook';
      case 'Twitch': return 'twitch';
      case 'TikTok': return 'tiktok';
      case 'Shopee Live': return 'shopping-bag';
      default: return 'broadcast';
    }
  },
  getPlatformColor: function (platform) {
    switch (platform) {
      case 'YouTube': return 'red-500';
      case 'Facebook': return 'blue-500';
      case 'Twitch': return 'purple-500';
      case 'TikTok': return 'gray-100';
      case 'Shopee Live': return 'orange-500';
      default: return 'gray-400';
    }
  },
  formatDateTime: function (isoString) {
    if (!isoString) return '--';
    
    const utcDate = new Date(isoString);
    
    return utcDate.toLocaleString('en-US', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },
  formatDuration: function (seconds) {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  }
};
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './db/',
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.session.username = user.username;
        req.session.avatar_path = user.avatar_path;
        if (user.email) req.session.email = user.email;
        res.locals.user = {
          id: user.id,
          username: user.username,
          avatar_path: user.avatar_path,
          email: user.email
        };
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }
  res.locals.req = req;
  next();
});
app.use(function (req, res, next) {
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = uuidv4();
  }
  res.locals.csrfToken = tokens.create(req.session.csrfSecret);
  next();
});
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', function (req, res, next) {
  res.header('Cache-Control', 'no-cache');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './public/uploads/avatars';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, 'avatar-' + uniqueSuffix + '.' + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public', 'uploads', 'videos'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    let fileName = `video-${uniqueSuffix}${ext}`;
    let fullPath = path.join(__dirname, 'public', 'uploads', 'videos', fileName);
    let counter = 1;
    while (fs.existsSync(fullPath)) {
      fileName = `video-${uniqueSuffix}-${counter}${ext}`;
      fullPath = path.join(__dirname, 'public', 'uploads', 'videos', fileName);
      counter++;
    }
    cb(null, fileName);
  }
});
const videoUpload = multer({
  storage: videoStorage,
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.match(/^video\/(mp4|avi|quicktime)$/)) {
      return cb(new Error('Only MP4, AVI, and MOV video files are allowed!'), false);
    }
    cb(null, true);
  }
});
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};
app.use('/uploads', function (req, res, next) {
  res.header('Cache-Control', 'no-cache');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});
app.use('/uploads/avatars', (req, res, next) => {
  const file = path.join(__dirname, 'public', 'uploads', 'avatars', path.basename(req.path));
  if (fs.existsSync(file)) {
    const ext = path.extname(file).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    res.header('Content-Type', contentType);
    res.header('Cache-Control', 'max-age=60, must-revalidate');
    fs.createReadStream(file).pipe(res);
  } else {
    next();
  }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('login', {
      title: 'Login',
      error: 'Too many login attempts. Please try again in 15 minutes.'
    });
  },
  requestWasSuccessful: (request, response) => {
    return response.statusCode < 400;
  }
});
const loginDelayMiddleware = async (req, res, next) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  next();
};
app.get('/login', async (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  try {
    const usersExist = await checkIfUsersExist();
    if (!usersExist) {
      return res.redirect('/setup-account');
    }
    res.render('login', {
      title: 'Login',
      error: null
    });
  } catch (error) {
    console.error('Error checking for users:', error);
    res.render('login', {
      title: 'Login',
      error: 'System error. Please try again.'
    });
  }
});
app.post('/login', loginDelayMiddleware, loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findByUsername(username);
    if (!user) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password'
      });
    }
    const passwordMatch = await User.verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.render('login', {
        title: 'Login',
        error: 'Invalid username or password'
      });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', {
      title: 'Login',
      error: 'An error occurred during login. Please try again.'
    });
  }
});
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});
app.get('/setup-account', async (req, res) => {
  try {
    const usersExist = await checkIfUsersExist();
    if (usersExist && !req.session.userId) {
      return res.redirect('/login');
    }
    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.username) {
        return res.redirect('/dashboard');
      }
    }
    res.render('setup-account', {
      title: 'Complete Your Account',
      user: req.session.userId ? await User.findById(req.session.userId) : {},
      error: null
    });
  } catch (error) {
    console.error('Setup account error:', error);
    res.redirect('/login');
  }
});
app.post('/setup-account', upload.single('avatar'), [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.render('setup-account', {
        title: 'Complete Your Account',
        user: { username: req.body.username || '' },
        error: errors.array()[0].msg
      });
    }
    const existingUsername = await User.findByUsername(req.body.username);
    if (existingUsername) {
      return res.render('setup-account', {
        title: 'Complete Your Account',
        user: { email: req.body.email || '' },
        error: 'Username is already taken'
      });
    }
    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;
    const usersExist = await checkIfUsersExist();
    if (!usersExist) {
      try {
        const userId = uuidv4();
        await User.create({
          id: userId,
          username: req.body.username,
          password: req.body.password,
          avatar_path: avatarPath,
        });
        req.session.userId = userId;
        req.session.username = req.body.username;
        if (avatarPath) {
          req.session.avatar_path = avatarPath;
        }
        return res.redirect('/dashboard');
      } catch (error) {
        console.error('User creation error:', error);
        return res.render('setup-account', {
          title: 'Complete Your Account',
          user: {},
          error: 'Failed to create user. Please try again.'
        });
      }
    } else {
      await User.update(req.session.userId, {
        username: req.body.username,
        password: req.body.password,
        avatar_path: avatarPath,
      });
      req.session.username = req.body.username;
      if (avatarPath) {
        req.session.avatar_path = avatarPath;
      }
      res.redirect('/dashboard');
    }
  } catch (error) {
    console.error('Account setup error:', error);
    res.render('setup-account', {
      title: 'Complete Your Account',
      user: { email: req.body.email || '' },
      error: 'An error occurred. Please try again.'
    });
  }
});
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});
app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render('dashboard', {
      title: 'Dashboard',
      active: 'dashboard',
      user: user
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/login');
  }
});
app.get('/gallery', isAuthenticated, async (req, res) => {
  try {
    const videos = await Video.findAll(req.session.userId);
    res.render('gallery', {
      title: 'Video Gallery',
      active: 'gallery',
      user: await User.findById(req.session.userId),
      videos: videos
    });
  } catch (error) {
    console.error('Gallery error:', error);
    res.redirect('/dashboard');
  }
});
app.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: user
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.redirect('/login');
  }
});
app.get('/history', isAuthenticated, async (req, res) => {
  try {
    const db = require('./db/database').db;
    const history = await new Promise((resolve, reject) => {
      db.all(
        `SELECT h.*, v.thumbnail_path 
         FROM stream_history h 
         LEFT JOIN videos v ON h.video_id = v.id 
         WHERE h.user_id = ? 
         ORDER BY h.start_time DESC`,
        [req.session.userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    res.render('history', {
      active: 'history',
      title: 'Stream History',
      history: history,
      helpers: app.locals.helpers
    });
  } catch (error) {
    console.error('Error fetching stream history:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load stream history',
      error: error
    });
  }
});
app.get('/analytics', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const videos = await getUserAnalyticsVideos(req.session.userId);
    res.render('analytics', {
      title: 'Video Analytics',
      active: 'analytics',
      user: user,
      videos: videos
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.redirect('/dashboard');
  }
});
app.get('/logs', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render('logs', {
      title: 'System Logs',
      active: 'logs',
      user: user
    });
  } catch (error) {
    console.error('Logs error:', error);
    res.redirect('/dashboard');
  }
});
app.get('/updates', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render('updates', {
      title: 'Updates',
      active: 'updates',
      user: user
    });
  } catch (error) {
    console.error('Updates error:', error);
    res.redirect('/dashboard');
  }
});
app.delete('/api/history/:id', isAuthenticated, async (req, res) => {
  try {
    const db = require('./db/database').db;
    const historyId = req.params.id;
    const history = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM stream_history WHERE id = ? AND user_id = ?',
        [historyId, req.session.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    if (!history) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found or not authorized'
      });
    }
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM stream_history WHERE id = ?',
        [historyId],
        function (err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });
    res.json({ success: true, message: 'History entry deleted' });
  } catch (error) {
    console.error('Error deleting history entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete history entry'
    });
  }
});
app.post('/api/history/reuse/:id', isAuthenticated, async (req, res) => {
  try {
    const db = require('./db/database').db;
    const historyId = req.params.id;
    
    const history = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM stream_history WHERE id = ? AND user_id = ?',
        [historyId, req.session.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!history) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found or not authorized'
      });
    }
    
    if (!history.stream_key || !history.rtmp_url) {
      return res.status(400).json({
        success: false,
        error: 'Stream key and RTMP URL not available for this history entry'
      });
    }
    
    const Stream = require('./models/Stream');
    const { v4: uuidv4 } = require('uuid');
    
    const newStreamData = {
      id: uuidv4(),
      title: history.title,
      video_id: history.video_id,
      rtmp_url: history.rtmp_url,
      stream_key: history.stream_key,
      platform: history.platform,
      platform_icon: history.platform_icon,
      bitrate: history.bitrate || 2500,
      resolution: history.resolution,
      fps: history.fps || 30,
      orientation: 'horizontal',
      loop_video: true,
      use_advanced_settings: history.use_advanced_settings || false,
      status: 'offline',
      user_id: req.session.userId
    };
    
    const newStream = await Stream.create(newStreamData);
    
    res.json({ 
      success: true, 
      message: 'Stream configuration reused successfully',
      streamId: newStream.id
    });
  } catch (error) {
    console.error('Error reusing history entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reuse stream configuration'
    });
  }
});

const videoAnalytics = new VideoAnalytics();

app.post('/api/analytics/add-video', isAuthenticated, [
  body('url').notEmpty().withMessage('URL is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const videoId = videoAnalytics.extractVideoId(req.body.url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL format'
      });
    }

    const analytics = await videoAnalytics.getVideoAnalytics(videoId);
    if (!analytics.status) {
      return res.status(400).json({
        success: false,
        error: analytics.error
      });
    }

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error adding video to analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add video to analytics'
    });
  }
});

app.get('/api/analytics/video/:videoId', isAuthenticated, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const analytics = await videoAnalytics.getVideoAnalytics(videoId);
    
    if (!analytics.status) {
      return res.status(400).json({
        success: false,
        error: analytics.error
      });
    }

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching video analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video analytics'
    });
  }
});

const { addVideoToAnalytics, getUserAnalyticsVideos, removeVideoFromAnalytics, updateVideoAnalyticsData } = require('./db/database');

app.post('/api/analytics/add-video-db', isAuthenticated, [
  body('url').notEmpty().withMessage('URL is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }

    const videoId = videoAnalytics.extractVideoId(req.body.url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL format'
      });
    }

    const analytics = await videoAnalytics.getVideoAnalytics(videoId);
    if (!analytics.status) {
      return res.status(400).json({
        success: false,
        error: analytics.error
      });
    }

    const savedVideo = await addVideoToAnalytics(req.session.userId, {
      videoId: analytics.videoId,
      title: analytics.title,
      thumbnail: analytics.thumbnail,
      channelName: analytics.channelName,
      uploadDate: analytics.uploadDate,
      analytics: analytics.analytics,
      isLive: analytics.isLive
    });

    res.json({
      success: true,
      data: analytics,
      saved: savedVideo
    });
  } catch (error) {
    console.error('Error adding video to analytics database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add video to analytics database'
    });
  }
});

app.get('/api/analytics/videos', isAuthenticated, async (req, res) => {
  try {
    const videos = await getUserAnalyticsVideos(req.session.userId);
    res.json({
      success: true,
      data: videos
    });
  } catch (error) {
    console.error('Error fetching analytics videos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics videos'
    });
  }
});

app.delete('/api/analytics/video/:videoId', isAuthenticated, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const removed = await removeVideoFromAnalytics(req.session.userId, videoId);
    
    if (removed) {
      res.json({
        success: true,
        message: 'Video removed from analytics'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Video not found in analytics'
      });
    }
  } catch (error) {
    console.error('Error removing video from analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove video from analytics'
    });
  }
});

app.get('/api/analytics/video-db/:videoId', isAuthenticated, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    
    const analytics = await videoAnalytics.getVideoAnalytics(videoId);
    if (!analytics.status) {
      return res.status(400).json({
        success: false,
        error: analytics.error
      });
    }

    const updated = await updateVideoAnalyticsData(req.session.userId, videoId, {
      title: analytics.title,
      thumbnail: analytics.thumbnail,
      channelName: analytics.channelName,
      uploadDate: analytics.uploadDate,
      analytics: analytics.analytics,
      isLive: analytics.isLive
    });

    if (updated) {
      res.json({
        success: true,
        data: analytics
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Video not found in database'
      });
    }
  } catch (error) {
    console.error('Error refreshing video analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh video analytics'
    });
  }
});

app.get('/api/system-stats', isAuthenticated, async (req, res) => {
  try {
    const stats = await systemMonitor.getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  Object.keys(interfaces).forEach((ifname) => {
    interfaces[ifname].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    });
  });
  return addresses.length > 0 ? addresses : ['localhost'];
}
app.post('/settings/profile', isAuthenticated, upload.single('avatar'), [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('settings', {
        title: 'Settings',
        active: 'settings',
        user: await User.findById(req.session.userId),
        error: errors.array()[0].msg,
        activeTab: 'profile'
      });
    }
    const currentUser = await User.findById(req.session.userId);
    if (req.body.username !== currentUser.username) {
      const existingUser = await User.findByUsername(req.body.username);
      if (existingUser) {
        return res.render('settings', {
          title: 'Settings',
          active: 'settings',
          user: currentUser,
          error: 'Username is already taken',
          activeTab: 'profile'
        });
      }
    }
    const updateData = {
      username: req.body.username
    };
    if (req.file) {
      updateData.avatar_path = `/uploads/avatars/${req.file.filename}`;
    }
    await User.update(req.session.userId, updateData);
    req.session.username = updateData.username;
    if (updateData.avatar_path) {
      req.session.avatar_path = updateData.avatar_path;
    }
    return res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      success: 'Profile updated successfully!',
      activeTab: 'profile'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      error: 'An error occurred while updating your profile',
      activeTab: 'profile'
    });
  }
});
app.post('/settings/password', isAuthenticated, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('settings', {
        title: 'Settings',
        active: 'settings',
        user: await User.findById(req.session.userId),
        error: errors.array()[0].msg,
        activeTab: 'security'
      });
    }
    const user = await User.findById(req.session.userId);
    const passwordMatch = await User.verifyPassword(req.body.currentPassword, user.password);
    if (!passwordMatch) {
      return res.render('settings', {
        title: 'Settings',
        active: 'settings',
        user: user,
        error: 'Current password is incorrect',
        activeTab: 'security'
      });
    }
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    await User.update(req.session.userId, { password: hashedPassword });
    return res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      success: 'Password changed successfully',
      activeTab: 'security'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: await User.findById(req.session.userId),
      error: 'An error occurred while changing your password',
      activeTab: 'security'
    });
  }
});
app.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }
    res.render('settings', {
      title: 'Settings',
      active: 'settings',
      user: user
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.redirect('/dashboard');
  }
});

app.post('/upload/video', isAuthenticated, uploadVideo.single('video'), async (req, res) => {
  try {
    console.log('Upload request received:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    const { filename, originalname, path: videoPath, size } = req.file;
    const timestamp = Date.now();
    const thumbnailName = `thumb-video-${timestamp}.jpg`;
    const videoInfo = await getVideoInfo(videoPath);
    const thumbnailRelativePath = await generateThumbnail(videoPath, thumbnailName)
      .then(() => `/uploads/thumbnails/${thumbnailName}`)
      .catch(() => null);
    
    const videoData = {
      title: path.basename(originalname, path.extname(originalname)),
      original_filename: originalname,
      filepath: `/uploads/videos/${filename}`,
      thumbnail_path: thumbnailRelativePath,
      file_size: size,
      duration: videoInfo.duration,
      format: videoInfo.format,
      resolution: videoInfo.resolution,
      bitrate: videoInfo.bitrate,
      fps: videoInfo.fps,
      user_id: req.session.userId
    };
    const video = await Video.create(videoData);
    res.json({
      success: true,
      video: {
        id: video.id,
        title: video.title,
        filepath: video.filepath,
        thumbnail_path: video.thumbnail_path,
        duration: video.duration,
        file_size: video.file_size,
        format: video.format
      }
    });
  } catch (error) {
    console.error('Upload error details:', error);
    res.status(500).json({ 
      error: 'Failed to upload video',
      details: error.message 
    });
  }
});
app.post('/api/videos/upload', isAuthenticated, videoUpload.single('video'), async (req, res) => {
  try {
    console.log('Upload request received:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    let title = path.parse(req.file.originalname).name;
    const filePath = `/uploads/videos/${req.file.filename}`;
    const fullFilePath = path.join(__dirname, 'public', filePath);
    const fileSize = req.file.size;
    
    const videoInfo = await getVideoInfo(fullFilePath);
    
    const timestamp = Date.now();
    const thumbnailFilename = `thumb-video-${timestamp}.jpg`;
    const thumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
    
    ffmpeg(fullFilePath)
      .screenshots({
        timestamps: ['10%'],
        filename: thumbnailFilename,
        folder: path.join(__dirname, 'public', 'uploads', 'thumbnails'),
        size: '854x480'
      })
      .on('end', async () => {
        try {
          const videoData = {
            title,
            filepath: filePath,
            thumbnail_path: thumbnailPath,
            file_size: fileSize,
            duration: videoInfo.duration,
            format: videoInfo.format,
            resolution: videoInfo.resolution,
            bitrate: videoInfo.bitrate,
            fps: videoInfo.fps,
            user_id: req.session.userId
          };
          const video = await Video.create(videoData);
          res.json({
            success: true,
            message: 'Video uploaded successfully',
            video
          });
        } catch (dbError) {
          console.error('Database error:', dbError);
          res.status(500).json({ 
            error: 'Failed to save video to database',
            details: dbError.message 
          });
        }
      })
      .on('error', (err) => {
        console.error('Error creating thumbnail:', err);
        res.status(500).json({ 
          error: 'Failed to create thumbnail',
          details: err.message 
        });
      });
  } catch (error) {
    console.error('Upload error details:', error);
    res.status(500).json({ 
      error: 'Failed to upload video',
      details: error.message 
    });
  }
});
app.get('/api/videos', isAuthenticated, async (req, res) => {
  try {
    const videos = await Video.findAll(req.session.userId);
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch videos' });
  }
});
app.delete('/api/videos/:id', isAuthenticated, async (req, res) => {
  try {
    const videoId = req.params.id;
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }
    if (video.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const videoPath = path.join(__dirname, 'public', video.filepath);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (video.thumbnail_path) {
      const thumbnailPath = path.join(__dirname, 'public', video.thumbnail_path);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    await Video.delete(videoId, req.session.userId);
    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, error: 'Failed to delete video' });
  }
});
app.post('/api/videos/:id/rename', isAuthenticated, [
  body('title').trim().isLength({ min: 1 }).withMessage('Title cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (video.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'You don\'t have permission to rename this video' });
    }
    await Video.update(req.params.id, { title: req.body.title });
    res.json({ success: true, message: 'Video renamed successfully' });
  } catch (error) {
    console.error('Error renaming video:', error);
    res.status(500).json({ error: 'Failed to rename video' });
  }
});
app.get('/stream/:videoId', isAuthenticated, async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).send('Video not found');
    }
    if (video.user_id !== req.session.userId) {
      return res.status(403).send('You do not have permission to access this video');
    }
    const videoPath = path.join(__dirname, 'public', video.filepath);
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).send('Error streaming video');
  }
});

app.post('/api/videos/import-drive-direct', isAuthenticated, [
  body('driveUrl').notEmpty().withMessage('Google Drive URL is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    
    const { driveUrl } = req.body;
    const jobId = uuidv4();
    
    processGoogleDriveDirectImport(jobId, driveUrl, req.session.userId)
      .catch(err => console.error('Direct drive import failed:', err));
    
    return res.json({
      success: true,
      message: 'Video import started (Direct Download)',
      jobId: jobId
    });
  } catch (error) {
    console.error('Error importing from Google Drive (direct):', error);
    res.status(500).json({ success: false, error: 'Failed to import video' });
  }
});

app.get('/api/videos/import-status/:jobId', isAuthenticated, async (req, res) => {
  const jobId = req.params.jobId;
  if (!importJobs[jobId]) {
    return res.status(404).json({ success: false, error: 'Import job not found' });
  }
  return res.json({
    success: true,
    status: importJobs[jobId]
  });
});

app.post('/api/videos/import-cancel/:jobId', isAuthenticated, async (req, res) => {
  const jobId = req.params.jobId;
  
  try {
    if (!importJobs[jobId]) {
      return res.status(404).json({ success: false, error: 'Import job not found' });
    }
    
    importJobs[jobId] = {
      ...importJobs[jobId],
      status: 'cancelled',
      message: 'Import cancelled by user'
    };
    
    setTimeout(() => {
      delete importJobs[jobId];
    }, 30000);
    
    return res.json({
      success: true,
      message: 'Import cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling import:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel import' });
  }
});

const importJobs = {};

async function processGoogleDriveDirectImport(jobId, driveUrl, userId) {
  const { GDriveDownloader } = require('./utils/googleDriveDownloader');
  const { getVideoInfo, generateThumbnail } = require('./utils/videoProcessor');
  const path = require('path');
  const fs = require('fs');
  
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  importJobs[jobId] = {
    status: 'downloading',
    progress: 0,
    message: 'Starting direct download...'
  };
  
  try {
    const downloader = new GDriveDownloader();
    
    const fileId = downloader.extractFileId(driveUrl);
    if (!fileId) {
      throw new Error('Cannot extract File ID from Google Drive URL');
    }
    
    const uploadsDir = paths.videos;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const tempFileName = `gdrive_${fileId}_${Date.now()}.tmp`;
    const outputPath = path.join(uploadsDir, tempFileName);
    
    const progressCallback = (progress) => {
      if (importJobs[jobId] && importJobs[jobId].status === 'cancelled') {
        throw new Error('Import dibatalkan oleh pengguna');
      }
      
      const downloadProgress = Math.min(80, Math.round(progress.percentage * 0.8)); 
      const filename = progress.fileName || 'Unknown file';
      importJobs[jobId] = {
        status: 'downloading',
        progress: downloadProgress,
        message: `${progress.percentage}% (${formatBytes(progress.downloaded)}/${formatBytes(progress.total)})`,
        filename: filename
      };
    };
    
    const localFilePath = await downloader.downloadFile(driveUrl, outputPath, progressCallback);
    
    if (importJobs[jobId] && importJobs[jobId].status === 'cancelled') {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      return;
    }
    
    const stats = fs.statSync(localFilePath);
    const originalFilename = downloader.fileName || `gdrive_${fileId}.mp4`;
    const finalFilename = `${fileId}_${Date.now()}_${originalFilename}`;
    const finalPath = path.join(uploadsDir, finalFilename);
    
    fs.renameSync(localFilePath, finalPath);
    
    const result = {
      localFilePath: finalPath,
      filename: finalFilename,
      originalFilename: originalFilename,
      fileSize: stats.size
    };
    
    importJobs[jobId] = {
      status: 'processing',
      progress: 90,
      message: 'Processing video...'
    };
    
    if (importJobs[jobId] && importJobs[jobId].status === 'cancelled') {
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      return;
    }
    
    const videoInfo = await getVideoInfo(result.localFilePath);
    
    const timestamp = Date.now();
    const thumbnailName = `thumb-video-${timestamp}.jpg`;
    const thumbnailRelativePath = await generateThumbnail(result.localFilePath, thumbnailName)
      .then(() => `/uploads/thumbnails/${thumbnailName}`)
      .catch(() => null);
    
    const videoData = {
      title: path.basename(result.originalFilename, path.extname(result.originalFilename)),
      filepath: `/uploads/videos/${result.filename}`,
      thumbnail_path: thumbnailRelativePath,
      file_size: result.fileSize,
      duration: videoInfo.duration,
      format: videoInfo.format,
      resolution: videoInfo.resolution,
      bitrate: videoInfo.bitrate,
      fps: videoInfo.fps,
      user_id: userId
    };
    
    const video = await Video.create(videoData);
    
    importJobs[jobId] = {
      status: 'complete',
      progress: 100,
      message: 'Video imported successfully (Direct Download)',
      videoId: video.id
    };
    
    setTimeout(() => {
      delete importJobs[jobId];
    }, 5 * 60 * 1000);
    
  } catch (error) {
    console.error('Error processing Google Drive direct import:', error);
    importJobs[jobId] = {
      status: 'failed',
      progress: 0,
      message: error.message || 'Failed to import video (Direct Download)'
    };
    setTimeout(() => {
      delete importJobs[jobId];
    }, 5 * 60 * 1000);
  }
}

app.get('/api/stream/videos', isAuthenticated, async (req, res) => {
  try {
    const videos = await Video.findAll(req.session.userId);
    const formattedVideos = videos.map(video => {
      const duration = video.duration ? Math.floor(video.duration) : 0;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      return {
        id: video.id,
        name: video.title,
        thumbnail: video.thumbnail_path,
        resolution: video.resolution || '1280x720',
        duration: formattedDuration,
        url: `/stream/${video.id}`
      };
    });
    res.json(formattedVideos);
  } catch (error) {
    console.error('Error fetching videos for stream:', error);
    res.status(500).json({ error: 'Failed to load videos' });
  }
});
const Stream = require('./models/Stream');
require('process');
app.get('/api/streams', isAuthenticated, async (req, res) => {
  try {
    const filter = req.query.filter;
    const streams = await Stream.findAll(req.session.userId, filter);
    res.json({ success: true, streams });
  } catch (error) {
    console.error('Error fetching streams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch streams' });
  }
});
app.post('/api/streams', isAuthenticated, [
  body('streamTitle').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('rtmpUrl').trim().isLength({ min: 1 }).withMessage('RTMP URL is required'),
  body('streamKey').trim().isLength({ min: 1 }).withMessage('Stream key is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const isInUse = await Stream.isStreamKeyInUse(req.body.streamKey, req.session.userId);
    if (isInUse) {
      return res.status(400).json({
        success: false,
        error: 'This stream key is already in use. Please use a different key.'
      });
    }
    let platform = 'Custom';
    let platform_icon = 'ti-broadcast';
    if (req.body.rtmpUrl.includes('youtube.com')) {
      platform = 'YouTube';
      platform_icon = 'ti-brand-youtube';
    } else if (req.body.rtmpUrl.includes('facebook.com')) {
      platform = 'Facebook';
      platform_icon = 'ti-brand-facebook';
    } else if (req.body.rtmpUrl.includes('twitch.tv')) {
      platform = 'Twitch';
      platform_icon = 'ti-brand-twitch';
    } else if (req.body.rtmpUrl.includes('tiktok.com')) {
      platform = 'TikTok';
      platform_icon = 'ti-brand-tiktok';
    } else if (req.body.rtmpUrl.includes('shopee.io')) {
      platform = 'Shopee Live';
      platform_icon = 'ti-brand-shopee';
    }
    const streamData = {
      title: req.body.streamTitle,
      video_id: req.body.videoId || null,
      rtmp_url: req.body.rtmpUrl,
      stream_key: req.body.streamKey,
      platform,
      platform_icon,
      bitrate: parseInt(req.body.bitrate) || 2500,
      resolution: req.body.resolution || '1280x720',
      fps: parseInt(req.body.fps) || 30,
      orientation: req.body.orientation || 'horizontal',
      loop_video: req.body.loopVideo === 'true' || req.body.loopVideo === true,
      use_advanced_settings: req.body.useAdvancedSettings === 'true' || req.body.useAdvancedSettings === true,
      user_id: req.session.userId
    };
    if (req.body.scheduleTime) {
      const scheduleDate = new Date(req.body.scheduleTime);
      
      const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`[CREATE STREAM] Server timezone: ${serverTimezone}`);
      console.log(`[CREATE STREAM] Input time: ${req.body.scheduleTime}`);
      console.log(`[CREATE STREAM] Parsed time: ${scheduleDate.toISOString()}`);
      console.log(`[CREATE STREAM] Local display: ${scheduleDate.toLocaleString('en-US', { timeZone: serverTimezone })}`);
      
      streamData.schedule_time = scheduleDate.toISOString();
    }
    if (req.body.duration) {
      streamData.duration = parseInt(req.body.duration);
    }
    streamData.status = req.body.scheduleTime ? 'scheduled' : 'offline';
    const stream = await Stream.create(streamData);
    res.json({ success: true, stream });
  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({ success: false, error: 'Failed to create stream' });
  }
});
app.get('/api/streams/:id', isAuthenticated, async (req, res) => {
  try {
    const stream = await Stream.getStreamWithVideo(req.params.id);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this stream' });
    }
    res.json({ success: true, stream });
  } catch (error) {
    console.error('Error fetching stream:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stream' });
  }
});
app.put('/api/streams/:id', isAuthenticated, async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this stream' });
    }
    const updateData = {};
    if (req.body.streamTitle) updateData.title = req.body.streamTitle;
    if (req.body.videoId) updateData.video_id = req.body.videoId;
    if (req.body.rtmpUrl) {
      updateData.rtmp_url = req.body.rtmpUrl;
      
      let platform = 'Custom';
      let platform_icon = 'ti-broadcast';
      if (req.body.rtmpUrl.includes('youtube.com')) {
        platform = 'YouTube';
        platform_icon = 'ti-brand-youtube';
      } else if (req.body.rtmpUrl.includes('facebook.com')) {
        platform = 'Facebook';
        platform_icon = 'ti-brand-facebook';
      } else if (req.body.rtmpUrl.includes('twitch.tv')) {
        platform = 'Twitch';
        platform_icon = 'ti-brand-twitch';
      } else if (req.body.rtmpUrl.includes('tiktok.com')) {
        platform = 'TikTok';
        platform_icon = 'ti-brand-tiktok';
      } else if (req.body.rtmpUrl.includes('shopee.io')) {
        platform = 'Shopee Live';
        platform_icon = 'ti-brand-shopee';
      }
      
      updateData.platform = platform;
      updateData.platform_icon = platform_icon;
    }
    if (req.body.streamKey) updateData.stream_key = req.body.streamKey;
    if (req.body.bitrate) updateData.bitrate = parseInt(req.body.bitrate);
    if (req.body.resolution) updateData.resolution = req.body.resolution;
    if (req.body.fps) updateData.fps = parseInt(req.body.fps);
    if (req.body.orientation) updateData.orientation = req.body.orientation;
    if (req.body.loopVideo !== undefined) {
      updateData.loop_video = req.body.loopVideo === 'true' || req.body.loopVideo === true;
    }
    if (req.body.useAdvancedSettings !== undefined) {
      updateData.use_advanced_settings = req.body.useAdvancedSettings === 'true' || req.body.useAdvancedSettings === true;
    }
    if (req.body.scheduleTime) {
      const scheduleDate = new Date(req.body.scheduleTime);
      
      const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`[UPDATE STREAM] Server timezone: ${serverTimezone}`);
      console.log(`[UPDATE STREAM] Input time: ${req.body.scheduleTime}`);
      console.log(`[UPDATE STREAM] Parsed time: ${scheduleDate.toISOString()}`);
      console.log(`[UPDATE STREAM] Local display: ${scheduleDate.toLocaleString('en-US', { timeZone: serverTimezone })}`);
      
      updateData.schedule_time = scheduleDate.toISOString();
      updateData.status = 'scheduled';
    } else if ('scheduleTime' in req.body && !req.body.scheduleTime) {
      updateData.schedule_time = null;
      updateData.status = 'offline';
    }
    
    const updatedStream = await Stream.update(req.params.id, updateData);
    res.json({ success: true, stream: updatedStream });
  } catch (error) {
    console.error('Error updating stream:', error);
    res.status(500).json({ success: false, error: 'Failed to update stream' });
  }
});
app.delete('/api/streams/:id', isAuthenticated, async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this stream' });
    }
    await Stream.delete(req.params.id, req.session.userId);
    res.json({ success: true, message: 'Stream deleted successfully' });
  } catch (error) {
    console.error('Error deleting stream:', error);
    res.status(500).json({ success: false, error: 'Failed to delete stream' });
  }
});
app.post('/api/streams/:id/status', isAuthenticated, [
  body('status').isIn(['live', 'offline', 'scheduled']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const newStatus = req.body.status;
    if (newStatus === 'live') {
      if (stream.status === 'live') {
        return res.json({
          success: false,
          error: 'Stream is already live',
          stream
        });
      }
      if (!stream.video_id) {
        return res.json({
          success: false,
          error: 'No video attached to this stream',
          stream
        });
      }
      const result = await streamingService.startStream(streamId);
      if (result.success) {
        const updatedStream = await Stream.getStreamWithVideo(streamId);
        return res.json({
          success: true,
          stream: updatedStream,
          isAdvancedMode: result.isAdvancedMode
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to start stream'
        });
      }
    } else if (newStatus === 'offline') {
      if (stream.status === 'live') {
        const result = await streamingService.stopStream(streamId);
        if (!result.success) {
          console.warn('Failed to stop FFmpeg process:', result.error);
        }
        await Stream.update(streamId, {
          schedule_time: null
        });
        console.log(`Reset schedule_time for stopped stream ${streamId}`);
      } else if (stream.status === 'scheduled') {
        await Stream.update(streamId, {
          schedule_time: null,
          status: 'offline'
        });
        console.log(`Scheduled stream ${streamId} was cancelled`);
      }
      const result = await Stream.updateStatus(streamId, 'offline', req.session.userId);
      if (!result.updated) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found or not updated'
        });
      }
      return res.json({ success: true, stream: result });
    } else {
      const result = await Stream.updateStatus(streamId, newStatus, req.session.userId);
      if (!result.updated) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found or not updated'
        });
      }
      return res.json({ success: true, stream: result });
    }
  } catch (error) {
    console.error('Error updating stream status:', error);
    res.status(500).json({ success: false, error: 'Failed to update stream status' });
  }
});
app.get('/api/streams/check-key', isAuthenticated, async (req, res) => {
  try {
    const streamKey = req.query.key;
    const excludeId = req.query.excludeId || null;
    if (!streamKey) {
      return res.status(400).json({
        success: false,
        error: 'Stream key is required'
      });
    }
    const isInUse = await Stream.isStreamKeyInUse(streamKey, req.session.userId, excludeId);
    res.json({
      success: true,
      isInUse: isInUse,
      message: isInUse ? 'Stream key is already in use' : 'Stream key is available'
    });
  } catch (error) {
    console.error('Error checking stream key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check stream key'
    });
  }
});
app.get('/api/streams/:id/logs', isAuthenticated, async (req, res) => {
  try {
    const streamId = req.params.id;
    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    if (stream.user_id !== req.session.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const logs = streamingService.getStreamLogs(streamId);
    const isActive = streamingService.isStreamActive(streamId);
    res.json({
      success: true,
      logs,
      isActive,
      stream
    });
  } catch (error) {
    console.error('Error fetching stream logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stream logs' });
  }
});
app.get('/api/server-time', (req, res) => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedTime = `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
  res.json({
    serverTime: now.toISOString(),
    formattedTime: formattedTime
  });
});

app.get('/api/server-info', async (req, res) => {
  try {
    const response = await axios.get('https://ipinfo.io/json');
    const data = response.data;
    
    let location = 'Unknown';
    if (data.city && data.region && data.country) {
      location = `${data.city}, ${data.region}, ${data.country}`;
    } else if (data.city && data.country) {
      location = `${data.city}, ${data.country}`;
    } else if (data.country) {
      location = data.country;
    }
    
    res.json({
      ip: data.ip || 'Unknown',
      location: location,
      timezone: data.timezone || 'Unknown',
      city: data.city || 'Unknown',
      region: data.region || 'Unknown',
      country: data.country || 'Unknown'
    });
  } catch (error) {
    console.error('Error fetching server info from ipinfo.io:', error);
    res.status(500).json({
      error: 'Failed to fetch server information',
      ip: 'Failed to load',
      location: 'Failed to load',
      timezone: 'Failed to load'
    });
  }
});

app.listen(port, '0.0.0.0', async () => {
  const ipAddresses = getLocalIpAddresses();
  console.log(`StreamFlow running at:`);
  if (ipAddresses && ipAddresses.length > 0) {
    ipAddresses.forEach(ip => {
      console.log(`  http://${ip}:${port}`);
    });
  } else {
    console.log(`  http://localhost:${port}`);
  }
  try {
    const streams = await Stream.findAll(null, 'live');
    if (streams && streams.length > 0) {
      console.log(`Resetting ${streams.length} live streams to offline state...`);
      for (const stream of streams) {
        await Stream.updateStatus(stream.id, 'offline');
      }
    }
  } catch (error) {
    console.error('Error resetting stream statuses:', error);
  }
  schedulerService.init(streamingService);
  try {
    await streamingService.syncStreamStatuses();
  } catch (error) {
    console.error('Failed to sync stream statuses:', error);
  }
});

app.get('/api/github/commits', isAuthenticated, async (req, res) => {
  try {
    const https = require('https');
    
    const options = {
      hostname: 'api.github.com',
      path: '/repos/bangtutorial/streamflow/commits?per_page=3',
      method: 'GET',
      headers: {
        'User-Agent': 'StreamFlow-App'
      }
    };

    const githubReq = https.request(options, (githubRes) => {
      let data = '';
      
      githubRes.on('data', (chunk) => {
        data += chunk;
      });
      
      githubRes.on('end', () => {
        try {
          const commits = JSON.parse(data);
          
          if (githubRes.statusCode !== 200) {
            return res.status(500).json({ 
              success: false, 
              error: 'Failed to fetch commits from GitHub' 
            });
          }
          
          const formattedCommits = commits.map(commit => ({
            id: commit.sha.substring(0, 7),
            message: commit.commit.message.split('\n')[0],
            author: commit.commit.author.name,
            date: commit.commit.author.date,
            url: commit.html_url
          }));
          
          res.json({
            success: true,
            commits: formattedCommits
          });
        } catch (parseError) {
          console.error('Error parsing GitHub response:', parseError);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to parse GitHub response' 
          });
        }
      });
    });
    
    githubReq.on('error', (error) => {
      console.error('GitHub API request error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to connect to GitHub API' 
      });
    });
    
    githubReq.end();
  } catch (error) {
    console.error('Error fetching GitHub commits:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

app.get('/api/logs', isAuthenticated, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
    
    if (!fs.existsSync(logFilePath)) {
      return res.json({
        success: true,
        logs: []
      });
    }
    
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim() !== '');
    
    const logs = logLines.slice(-1000).map(line => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \[(\w+)\] (.+)$/);
      if (match) {
        const message = match[3];
        let category = 'general';
        
        if (message.includes('[STREAM START]') || message.includes('STREAM START')) {
          category = 'stream-start';
        } else if (message.includes('[STREAM STOP]') || message.includes('STREAM STOP')) {
          category = 'stream-stop';
        } else if (message.includes('[STREAM ERROR]') || message.includes('STREAM ERROR')) {
          category = 'stream-error';
        } else if (message.includes('[FFMPEG]') || message.includes('ffmpeg')) {
          category = 'ffmpeg';
        } else if (message.includes('[UPLOAD]') || message.includes('upload')) {
          category = 'upload';
        } else if (message.includes('[DOWNLOAD]') || message.includes('download')) {
          category = 'download';
        } else if (message.includes('[ANALYTICS]') || message.includes('analytics')) {
          category = 'analytics';
        } else if (message.includes('[AUTH]') || message.includes('authentication') || message.includes('login')) {
          category = 'auth';
        } else if (message.includes('[API]') || message.includes('/api/')) {
          category = 'api';
        } else if (message.includes('ERROR') || message.includes('Error') || message.includes('error')) {
          category = 'error';
        }
        
        return {
          timestamp: match[1],
          level: match[2].toLowerCase(),
          message: message,
          category: category
        };
      }
      return {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: line,
        category: 'general'
      };
    }).reverse();
    
    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error('Error reading logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read logs'
    });
  }
});

app.delete('/api/logs', isAuthenticated, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
    
    if (fs.existsSync(logFilePath)) {
      fs.writeFileSync(logFilePath, '', 'utf8');
      console.log('Log file cleared by user');
    }
    
    res.json({
      success: true,
      message: 'Logs cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs'
    });
  }
});