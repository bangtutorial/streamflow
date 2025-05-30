const multer = require('multer');
const path = require('path');
const { getUniqueFilename, paths } = require('../utils/storage');
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paths.videos);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = getUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  }
});
const videoFilter = (req, file, cb) => {
  const allowedFormats = ['video/mp4', 'video/avi', 'video/quicktime'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.mp4', '.avi', '.mov'];
  if (allowedFormats.includes(file.mimetype) || allowedExts.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Only .mp4, .avi, and .mov formats are allowed'), false);
  }
};
const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter
});
module.exports = {
  uploadVideo
};