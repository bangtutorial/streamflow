const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
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
    const driveUrl = `https://drive.google.com/uc?id=${fileId}`;
    
    const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempPath = path.join(paths.videos, tempFilename);
    
    return new Promise((resolve, reject) => {
      const gdownProcess = spawn('python', ['-m', 'gdown', driveUrl, '-O', tempPath, '--fuzzy'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let lastProgress = 0;

      gdownProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        const output = data.toString();
        
        const progressMatch = output.match(/(\d+)%/);
        if (progressMatch && progressCallback) {
          const progress = parseInt(progressMatch[1]);
          if (progress > lastProgress) {
            lastProgress = progress;
            progressCallback({
              id: fileId,
              filename: 'Google Drive File',
              progress: progress
            });
          }
        }
      });

      gdownProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gdownProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempPath)) {
          try {
            const stats = fs.statSync(tempPath);
            const fileSize = stats.size;
            
            const originalFilename = `gdrive_${fileId}.mp4`;
            const uniqueFilename = getUniqueFilename(originalFilename);
            const finalPath = path.join(paths.videos, uniqueFilename);
            
            fs.renameSync(tempPath, finalPath);
            
            console.log(`Downloaded file from Google Drive: ${uniqueFilename}`);
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
        } else {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          
          let errorMessage = 'Failed to download file from Google Drive';
          if (stderr.includes('Permission denied') || stderr.includes('Forbidden')) {
            errorMessage = 'File is private or sharing is disabled. Please make sure the file is publicly accessible.';
          } else if (stderr.includes('Not found')) {
            errorMessage = 'File not found. Please check the Google Drive URL.';
          } else if (stderr) {
            errorMessage = `Download failed: ${stderr}`;
          }
          
          reject(new Error(errorMessage));
        }
      });

      gdownProcess.on('error', (error) => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        reject(new Error(`Failed to start download process: ${error.message}`));
      });
    });
  } catch (error) {
    console.error('Error downloading file from Google Drive:', error);
    throw error;
  }
}

module.exports = {
  extractFileId,
  downloadFile
};