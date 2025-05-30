const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { paths, getUniqueFilename } = require('./storage');

function createDriveService(apiKey) {
  return google.drive({
    version: 'v3',
    auth: apiKey
  });
}

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

async function downloadFile(apiKey, fileId, progressCallback = null) {
  const drive = createDriveService(apiKey);

  try {

    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType,size'
    });

    if (!fileMetadata.data.mimeType.includes('video')) {
      throw new Error('The selected file is not a video');
    }

    const originalFilename = fileMetadata.data.name;
    const ext = path.extname(originalFilename) || '.mp4';
    const uniqueFilename = getUniqueFilename(originalFilename);
    const localFilePath = path.join(paths.videos, uniqueFilename);
    const dest = fs.createWriteStream(localFilePath);
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media'
      },
      { responseType: 'stream' }
    );

    const fileSize = parseInt(fileMetadata.data.size, 10);
    let downloaded = 0;

    return new Promise((resolve, reject) => {
      response.data
        .on('data', chunk => {
          downloaded += chunk.length;
          if (progressCallback) {
            const progress = Math.round((downloaded / fileSize) * 100);
            progressCallback({
              id: fileId,
              filename: originalFilename,
              progress: progress
            });
          }
        })
        .on('end', () => {
          console.log(`Downloaded file ${originalFilename} from Google Drive`);
          resolve({
            filename: uniqueFilename,
            originalFilename: originalFilename,
            localFilePath: localFilePath,
            mimeType: fileMetadata.data.mimeType,
            fileSize: fileSize
          });
        })
        .on('error', err => {
          fs.unlinkSync(localFilePath);
          reject(err);
        })
        .pipe(dest);
    });
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    throw error;
  }
}

module.exports = {
  createDriveService,
  extractFileId,
  downloadFile
};