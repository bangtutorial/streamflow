const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { paths, getUniqueFilenameWithNumber } = require('./storage');

function extractDownloadUrl(dropboxUrl) {
  if (!dropboxUrl.includes('dropbox.com')) {
    throw new Error('Invalid Dropbox URL format');
  }

  let downloadUrl = dropboxUrl;

  if (downloadUrl.includes('?')) {
    downloadUrl = downloadUrl.replace(/dl=0/, 'dl=1');
    if (!downloadUrl.includes('dl=1')) {
      downloadUrl += '&dl=1';
    }
  } else {
    downloadUrl += '?dl=1';
  }

  downloadUrl = downloadUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com');

  return downloadUrl;
}

function extractFilename(dropboxUrl) {
  try {
    const urlPath = new URL(dropboxUrl).pathname;
    const filename = path.basename(urlPath);
    if (filename && filename !== '') {
      return decodeURIComponent(filename);
    }
  } catch (e) {}
  return null;
}

async function downloadFile(dropboxUrl, progressCallback = null) {
  try {
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const tempPath = path.join(paths.videos, tempFilename);

    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    };

    console.log(`Starting Dropbox download for URL: ${dropboxUrl}`);

    const downloadUrl = extractDownloadUrl(dropboxUrl);
    let originalFilename = extractFilename(dropboxUrl) || `dropbox_${Date.now()}.mp4`;

    console.log(`Original filename: ${originalFilename}`);
    console.log(`Download URL: ${downloadUrl}`);

    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 600000,
      maxRedirects: 10,
      headers: commonHeaders
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: Failed to download file`);
    }

    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;\n"']+)['"]?/i);
      if (filenameMatch) {
        originalFilename = decodeURIComponent(filenameMatch[1].trim());
      }
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
            id: dropboxUrl,
            filename: originalFilename,
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
            reject(new Error('Downloaded file is empty'));
            return;
          }

          if (fileSize < 1024) {
            fs.unlinkSync(tempPath);
            reject(new Error('Downloaded file is too small to be a valid video'));
            return;
          }

          if (!path.extname(originalFilename)) {
            originalFilename += '.mp4';
          }

          const uniqueFilename = getUniqueFilenameWithNumber(originalFilename, paths.videos);
          const finalPath = path.join(paths.videos, uniqueFilename);

          fs.renameSync(tempPath, finalPath);

          console.log(`Downloaded file from Dropbox: ${uniqueFilename} (${fileSize} bytes)`);
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
    console.error('Error downloading file from Dropbox:', error);

    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('File is private or access denied');
      } else if (error.response.status === 404) {
        throw new Error('File not found. Please check the Dropbox URL');
      } else if (error.response.status === 429) {
        throw new Error('Too many requests. Please wait and try again');
      } else {
        throw new Error(`Download failed with HTTP ${error.response.status}`);
      }
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Download timeout. Please try again');
    } else {
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

module.exports = {
  extractDownloadUrl,
  downloadFile
};
