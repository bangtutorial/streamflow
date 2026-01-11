const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { paths, getUniqueFilenameWithNumber } = require('./storage');

function extractFileKey(mediafireUrl) {
  let match = mediafireUrl.match(/mediafire\.com\/file\/([a-zA-Z0-9]+)/);
  if (match) return match[1];

  match = mediafireUrl.match(/mediafire\.com\/\?([a-zA-Z0-9]+)/);
  if (match) return match[1];

  match = mediafireUrl.match(/mediafire\.com\/download\/([a-zA-Z0-9]+)/);
  if (match) return match[1];

  if (/^[a-zA-Z0-9]{15}$/.test(mediafireUrl.trim())) {
    return mediafireUrl.trim();
  }

  throw new Error('Invalid Mediafire URL format');
}

async function downloadFile(fileKey, progressCallback = null) {
  try {
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const tempPath = path.join(paths.videos, tempFilename);

    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    };

    console.log(`Starting Mediafire download for file key: ${fileKey}`);

    const pageUrl = `https://www.mediafire.com/file/${fileKey}`;
    const pageResponse = await axios.get(pageUrl, {
      timeout: 30000,
      headers: commonHeaders
    });

    const html = pageResponse.data;

    const downloadMatch = html.match(/href="(https:\/\/download[^"]+mediafire\.com[^"]+)"/i) ||
                          html.match(/aria-label="Download file"\s+href="([^"]+)"/i) ||
                          html.match(/id="downloadButton"[^>]*href="([^"]+)"/i);

    if (!downloadMatch) {
      throw new Error('Could not find download link. The file might be private or deleted.');
    }

    const downloadUrl = downloadMatch[1].replace(/&amp;/g, '&');

    const filenameMatch = html.match(/class="dl-btn-label"[^>]*title="([^"]+)"/i) ||
                          html.match(/<div class="filename">([^<]+)<\/div>/i) ||
                          html.match(/<title>([^<]+)\s*-\s*MediaFire<\/title>/i);

    let originalFilename = filenameMatch ? filenameMatch[1].trim() : `mediafire_${fileKey}.mp4`;

    console.log(`Original filename: ${originalFilename}`);
    console.log(`Download URL found, starting download...`);

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
            id: fileKey,
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

          console.log(`Downloaded file from Mediafire: ${uniqueFilename} (${fileSize} bytes)`);
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
    console.error('Error downloading file from Mediafire:', error);

    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('File is private or access denied');
      } else if (error.response.status === 404) {
        throw new Error('File not found. Please check the Mediafire URL');
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
  extractFileKey,
  downloadFile
};
