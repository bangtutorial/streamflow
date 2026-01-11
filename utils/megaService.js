const fs = require('fs');
const path = require('path');
const { paths, getUniqueFilenameWithNumber } = require('./storage');

function extractFileInfo(megaUrl) {
  if (!megaUrl.includes('mega.nz') && !megaUrl.includes('mega.co.nz')) {
    throw new Error('Invalid MEGA URL format');
  }
  return megaUrl;
}

async function downloadFile(megaUrl, progressCallback = null) {
  const { File } = await import('megajs');
  
  try {
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const tempPath = path.join(paths.videos, tempFilename);

    console.log(`Starting MEGA download for URL: ${megaUrl}`);

    const file = File.fromURL(megaUrl);
    await file.loadAttributes();

    const originalFilename = file.name || `mega_${Date.now()}.mp4`;
    const totalSize = file.size || 0;

    console.log(`Original filename: ${originalFilename}`);
    console.log(`File size: ${totalSize} bytes`);

    let downloadedSize = 0;
    let lastProgress = 0;

    const downloadStream = file.download();
    const writer = fs.createWriteStream(tempPath);

    downloadStream.on('data', (chunk) => {
      downloadedSize += chunk.length;
      if (totalSize > 0 && progressCallback) {
        const progress = Math.round((downloadedSize / totalSize) * 100);
        if (progress > lastProgress && progress <= 100) {
          lastProgress = progress;
          progressCallback({
            id: megaUrl,
            filename: originalFilename,
            progress: progress
          });
        }
      }
    });

    downloadStream.pipe(writer);

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

          let finalFilename = originalFilename;
          if (!path.extname(finalFilename)) {
            finalFilename += '.mp4';
          }

          const uniqueFilename = getUniqueFilenameWithNumber(finalFilename, paths.videos);
          const finalPath = path.join(paths.videos, uniqueFilename);

          fs.renameSync(tempPath, finalPath);

          console.log(`Downloaded file from MEGA: ${uniqueFilename} (${fileSize} bytes)`);
          resolve({
            filename: uniqueFilename,
            originalFilename: finalFilename,
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

      downloadStream.on('error', (error) => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(new Error(`Error downloading file: ${error.message}`));
      });
    });
  } catch (error) {
    console.error('Error downloading file from MEGA:', error);

    if (error.message && error.message.includes('ENOENT')) {
      throw new Error('File not found or link is invalid');
    } else if (error.message && error.message.includes('EACCES')) {
      throw new Error('File is private or password protected');
    } else if (error.message && error.message.includes('ETOOMANY')) {
      throw new Error('Too many requests. Please wait and try again');
    } else {
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

module.exports = {
  extractFileInfo,
  downloadFile
};
