const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { getVideoDurationInSeconds } = require('get-video-duration');
const fs = require('fs');
const path = require('path');
const { getUniqueFilename, paths } = require('./storage');
ffmpeg.setFfmpegPath(ffmpegPath);
const getVideoInfo = async (filepath) => {
  try {
    const duration = await getVideoDurationInSeconds(filepath);
    const stats = fs.statSync(filepath);
    const fileSizeInBytes = stats.size;
    return {
      duration,
      fileSize: fileSizeInBytes
    };
  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
};
const generateThumbnail = (videoPath, thumbnailName) => {
  return new Promise((resolve, reject) => {
    const thumbnailPath = path.join(paths.thumbnails, thumbnailName);
    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        folder: paths.thumbnails,
        filename: thumbnailName,
        size: '320x180'
      })
      .on('end', () => {
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        console.error('Error generating thumbnail:', err);
        reject(err);
      });
  });
};

const generateImageThumbnail = (imagePath, thumbnailName) => {
  return new Promise((resolve, reject) => {
    const thumbnailPath = path.join(paths.thumbnails, thumbnailName);
    ffmpeg(imagePath)
      .outputOptions([
        '-vf', 'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2'
      ])
      .output(thumbnailPath)
      .on('end', () => {
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        console.error('Error generating image thumbnail:', err);
        reject(err);
      })
      .run();
  });
};

module.exports = {
  getVideoInfo,
  generateThumbnail,
  generateImageThumbnail
};