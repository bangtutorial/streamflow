const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { getVideoDurationInSeconds } = require('get-video-duration');
const fs = require('fs');
const path = require('path');
const { paths } = require('./storage');
ffmpeg.setFfmpegPath(ffmpegPath);
const getVideoInfo = async (filepath) => {
  try {
    const duration = await getVideoDurationInSeconds(filepath);
    const stats = fs.statSync(filepath);
    const fileSizeInBytes = stats.size;
    
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filepath, (err, metadata) => {
        if (err) {
          console.error('Error extracting metadata:', err);
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });

    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
    const resolution = videoStream ? `${videoStream.width}x${videoStream.height}` : '';
    const bitrate = metadata.format.bit_rate ? 
      Math.round(parseInt(metadata.format.bit_rate) / 1000) : 
      null;
    
    let fps = null;
    if (videoStream && videoStream.avg_frame_rate) {
      const fpsRatio = videoStream.avg_frame_rate.split('/');
      if (fpsRatio.length === 2 && parseInt(fpsRatio[1]) !== 0) {
        fps = Math.round((parseInt(fpsRatio[0]) / parseInt(fpsRatio[1]) * 100)) / 100;
      } else {
        fps = parseInt(fpsRatio[0]) || null;
      }
    }

    let format = 'mp4';
    if (metadata.format && metadata.format.format_name) {
      const formatName = metadata.format.format_name.toLowerCase();
      if (formatName.includes('mp4')) format = 'mp4';
      else if (formatName.includes('avi')) format = 'avi'; 
      else if (formatName.includes('mov') || formatName.includes('quicktime')) format = 'mov';
      else if (formatName.includes('mkv')) format = 'mkv';
      else if (formatName.includes('webm')) format = 'webm';
      else if (formatName.includes('flv')) format = 'flv';
      else {
        const formats = formatName.split(',');
        const videoFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
        for (const f of formats) {
          const cleanFormat = f.trim();
          if (videoFormats.includes(cleanFormat)) {
            format = cleanFormat;
            break;
          }
        }
      }
    }

    return {
      duration,
      fileSize: fileSizeInBytes,
      resolution,
      bitrate,
      fps,
      format
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
        size: '854x480'
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
module.exports = {
  getVideoInfo,
  generateThumbnail
};