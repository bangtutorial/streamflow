const fs = require('fs-extra');
const path = require('path');
const ensureDirectories = () => {
  const dirs = [
    path.join(__dirname, '../public/uploads/videos'),
    path.join(__dirname, '../public/uploads/thumbnails'),
    path.join(__dirname, '../public/uploads/avatars'),
    path.join(__dirname, '../public/uploads/temp'),
    path.join(__dirname, '../public/uploads/temp/info'),
    path.join(__dirname, '../public/uploads/audio')
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

const getUniqueFilenameWithNumber = (originalFilename, targetDir) => {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  
  let finalFilename = originalFilename;
  let counter = 2;
  
  while (fs.existsSync(path.join(targetDir, finalFilename))) {
    finalFilename = `${basename} (${counter})${ext}`;
    counter++;
  }
  
  return finalFilename;
};
module.exports = {
  ensureDirectories,
  getUniqueFilename,
  getUniqueFilenameWithNumber,
  paths: {
    videos: path.join(__dirname, '../public/uploads/videos'),
    thumbnails: path.join(__dirname, '../public/uploads/thumbnails'),
    avatars: path.join(__dirname, '../public/uploads/avatars'),
    temp: path.join(__dirname, '../public/uploads/temp'),
    tempInfo: path.join(__dirname, '../public/uploads/temp/info'),
    audio: path.join(__dirname, '../public/uploads/audio')
  }
};