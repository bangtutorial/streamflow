const fs = require('fs-extra');
const path = require('path');
const ensureDirectories = () => {
  const dirs = [
    path.join(__dirname, '../public/uploads/videos'),
    path.join(__dirname, '../public/uploads/thumbnails')
  ];
  dirs.forEach(dir => {
    fs.ensureDirSync(dir);
  });
};
const getUniqueFilename = (originalFilename) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext)
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
  return `${basename}-${timestamp}-${random}${ext}`;
};
module.exports = {
  ensureDirectories,
  getUniqueFilename,
  paths: {
    videos: path.join(__dirname, '../public/uploads/videos'),
    thumbnails: path.join(__dirname, '../public/uploads/thumbnails'),
  }
};