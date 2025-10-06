const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { paths, getUniqueFilename } = require('./storage');

function extractFileId(driveUrl) {
  let match = driveUrl.match(/\/file\/d\/([^\/]+)/);
  if (match) return match[1];

  match = driveUrl.match(/\?id=([^&]+)/);
  if (match) return match[1];

  match = driveUrl.match(/\/d\/([^\/]+)/);
  if (match) return match[1];

  if (/^[a-zA-Z0-9_-]{25,}$/.test(driveUrl.trim())) {
    return driveUrl.trim();
  }

  throw new Error('Invalid Google Drive URL format');
}

async function downloadFile(fileId, progressCallback = null) {
  try {
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempPath = path.join(paths.videos, tempFilename);
    
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    let downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Attempting download from: ${downloadUrl}`);
        
        const headResponse = await axios.head(downloadUrl, {
          timeout: 30000,
          maxRedirects: 10,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        const contentType = headResponse.headers['content-type'] || '';
        console.log(`Content-Type: ${contentType}`);
        
        if (contentType.includes('text/html')) {
          console.log('Received HTML response, trying alternative download method...');
          downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;
          
          if (retryCount === 1) {
            downloadUrl = `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`;
          }
          
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error('File appears to be private or requires additional authentication. Please ensure the file is publicly accessible.');
          }
          continue;
        }
        
        response = await axios({
          method: 'GET',
          url: downloadUrl,
          responseType: 'stream',
          timeout: 600000,
          maxRedirects: 10,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        break;
      } catch (error) {
        retryCount++;
        console.log(`Download attempt ${retryCount} failed:`, error.message);
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
          downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to download file`);
    }
    
    const responseContentType = response.headers['content-type'] || '';
    if (responseContentType.includes('text/html')) {
      throw new Error('Received HTML page instead of video file. The file might be private or require additional permissions.');
    }

    const totalSize = parseInt(response.headers['content-length'] || '0');
    let downloadedSize = 0;
    let lastProgress = 0;

    const writer = fs.createWriteStream(tempPath);

    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      
      if (totalSize > 0 && progressCallback) {
        const progress = Math.round((downloadedSize / totalSize) * 100);
        if (progress > lastProgress && progress <= 100) {
          lastProgress = progress;
          progressCallback({
            id: fileId,
            filename: 'Google Drive File',
            progress: progress
          });
        }
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        try {
          if (!fs.existsSync(tempPath)) {
            reject(new Error('Downloaded file not found'));
            return;
          }

          const stats = fs.statSync(tempPath);
          const fileSize = stats.size;

          if (fileSize === 0) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded file is empty. The file might be private, not accessible, or the link is invalid.'));
            return;
          }

          if (fileSize < 1024) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded file is too small to be a valid video. Please check if the Google Drive link is correct and the file is publicly accessible.'));
            return;
          }

          const buffer = Buffer.alloc(512);
          const fd = fs.openSync(tempPath, 'r');
          fs.readSync(fd, buffer, 0, 512, 0);
          fs.closeSync(fd);
          
          const fileHeader = buffer.toString('utf8', 0, 100).toLowerCase();
          
          if (fileHeader.includes('<!doctype html') || fileHeader.includes('<html') || fileHeader.includes('<head>')) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded content is an HTML page, not a video file. The file might be private, require authentication, or the sharing settings are incorrect.'));
            return;
          }
          
          const validVideoHeaders = [
            [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
            [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70],
            [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
            [0x1A, 0x45, 0xDF, 0xA3],
            [0x00, 0x00, 0x01, 0xBA],
            [0x00, 0x00, 0x01, 0xB3],
            [0x46, 0x4C, 0x56, 0x01]
          ];
          
          let isValidVideo = false;
          for (const header of validVideoHeaders) {
            let matches = true;
            for (let i = 0; i < header.length && i < buffer.length; i++) {
              if (buffer[i] !== header[i]) {
                matches = false;
                break;
              }
            }
            if (matches) {
              isValidVideo = true;
              break;
            }
          }
          
          if (!isValidVideo && !buffer.includes(Buffer.from('ftyp'))) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded file does not appear to be a valid video format. Please ensure the Google Drive link points to a video file and is publicly accessible.'));
            return;
          }

          const originalFilename = `gdrive_${fileId}.mp4`;
          const uniqueFilename = getUniqueFilename(originalFilename);
          const finalPath = path.join(paths.videos, uniqueFilename);
          
          fs.renameSync(tempPath, finalPath);
          
          console.log(`Downloaded file from Google Drive: ${uniqueFilename} (${fileSize} bytes)`);
          resolve({
            filename: uniqueFilename,
            originalFilename: originalFilename,
            localFilePath: finalPath,
            mimeType: 'video/mp4',
            fileSize: fileSize
          });
        } catch (error) {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          reject(new Error(`Error processing downloaded file: ${error.message}`));
        }
      });

      writer.on('error', (error) => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(new Error(`Error writing file: ${error.message}`));
      });

      response.data.on('error', (error) => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(new Error(`Error downloading file: ${error.message}`));
      });
    });
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('File is private or sharing is disabled. Please make sure the file is publicly accessible and try again.');
      } else if (error.response.status === 404) {
        throw new Error('File not found. Please check the Google Drive URL and ensure the file exists.');
      } else if (error.response.status === 429) {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      } else if (error.response.status >= 500) {
        throw new Error('Google Drive server error. Please try again later.');
      } else {
        throw new Error(`Download failed with HTTP ${error.response.status}. Please try again or check if the file is accessible.`);
      }
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Download timeout. The file might be too large or your connection is slow. Please try again.');
    } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      throw new Error('Connection was reset. Please check your internet connection and try again.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Download was interrupted. Please try again.');
    } else {
      throw new Error(`Download failed: ${error.message}. Please try again or check your internet connection.`);
    }
  }
}

module.exports = {
  extractFileId,
  downloadFile
};
