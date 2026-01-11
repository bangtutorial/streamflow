const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { paths, getUniqueFilenameWithNumber } = require('./storage');

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

async function getFileMetadata(fileId) {
  try {
    const metadataUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const response = await axios.get(metadataUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = response.data;
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                       html.match(/<title>([^<]+)\s*-\s*Google Drive<\/title>/i) ||
                       html.match(/"title":"([^"]+)"/);
    
    if (titleMatch && titleMatch[1]) {
      let filename = titleMatch[1].trim();
      filename = filename.replace(/\s*-\s*Google Drive$/, '');
      return filename;
    }
    return null;
  } catch (error) {
    console.log('Could not fetch file metadata:', error.message);
    return null;
  }
}

function cleanupStream(response) {
  if (response && response.data) {
    try {
      if (typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
      response.data.removeAllListeners();
    } catch (e) {}
  }
}

function cleanupTempFile(tempPath) {
  try {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  } catch (e) {}
}

function extractCookies(response) {
  if (response.headers['set-cookie']) {
    const cookieArray = response.headers['set-cookie'];
    return cookieArray.map(c => c.split(';')[0]).join('; ');
  }
  return '';
}

function parseConfirmationPage(html, fileId) {
  const urls = [];
  
  const formActionMatch = html.match(/action="([^"]+)"/);
  if (formActionMatch) {
    let formAction = formActionMatch[1].replace(/&amp;/g, '&');
    if (formAction.startsWith('/')) {
      formAction = 'https://drive.google.com' + formAction;
    }
    
    const hiddenInputs = html.match(/<input[^>]+type="hidden"[^>]*>/gi) || [];
    const params = new URLSearchParams();
    
    for (const input of hiddenInputs) {
      const nameMatch = input.match(/name="([^"]+)"/);
      const valueMatch = input.match(/value="([^"]*)"/);
      if (nameMatch) {
        params.append(nameMatch[1], valueMatch ? valueMatch[1] : '');
      }
    }
    
    const paramStr = params.toString();
    if (paramStr) {
      urls.push(formAction + (formAction.includes('?') ? '&' : '?') + paramStr);
    }
  }
  
  const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/);
  const uuidMatch = html.match(/uuid=([0-9a-f-]+)/i);
  
  let baseUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  if (confirmMatch) baseUrl += `&confirm=${confirmMatch[1]}`;
  if (uuidMatch) baseUrl += `&uuid=${uuidMatch[1]}`;
  urls.push(baseUrl);
  
  urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`);
  urls.push(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`);
  
  return urls;
}

async function tryDownloadFromUrl(url, cookies, commonHeaders) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 600000,
    maxRedirects: 10,
    headers: { 
      ...commonHeaders, 
      Cookie: cookies,
      Referer: 'https://drive.google.com/'
    },
    validateStatus: (status) => status < 500
  });
  
  const contentType = response.headers['content-type'] || '';
  const isVideo = !contentType.includes('text/html') && 
                  (contentType.includes('video') || 
                   contentType.includes('octet-stream') ||
                   contentType.includes('application/'));
  
  return { response, isVideo, contentType };
}

async function downloadFile(fileId, progressCallback = null) {
  const tempFilename = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const tempPath = path.join(paths.videos, tempFilename);
  let response = null;
  let writer = null;
  
  const cleanup = () => {
    cleanupStream(response);
    if (writer) {
      try {
        writer.removeAllListeners();
        if (!writer.destroyed) writer.destroy();
      } catch (e) {}
    }
    cleanupTempFile(tempPath);
  };
  
  try {
    let cookies = '';
    let originalFilename = null;
    
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    };
    
    console.log(`Starting download for file ID: ${fileId}`);
    
    originalFilename = await getFileMetadata(fileId);
    console.log(`Original filename from metadata: ${originalFilename}`);
    
    const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    console.log(`Initial request: ${initialUrl}`);
    
    const initialResponse = await axios.get(initialUrl, {
      timeout: 30000,
      maxRedirects: 5,
      headers: commonHeaders,
      validateStatus: (status) => status < 500
    });
    
    cookies = extractCookies(initialResponse);
    if (cookies) console.log('Cookies obtained');
    
    const initialContentType = initialResponse.headers['content-type'] || '';
    const isInitialHtml = initialContentType.includes('text/html');
    
    let downloadUrls = [];
    
    if (isInitialHtml) {
      console.log('Confirmation page detected, parsing download URLs...');
      const html = typeof initialResponse.data === 'string' ? initialResponse.data : '';
      downloadUrls = parseConfirmationPage(html, fileId);
    } else {
      downloadUrls = [initialUrl];
    }
    
    downloadUrls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
    downloadUrls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`);
    
    let downloadSuccess = false;
    
    for (const url of downloadUrls) {
      if (downloadSuccess) break;
      
      try {
        console.log(`Trying download URL...`);
        const result = await tryDownloadFromUrl(url, cookies, commonHeaders);
        
        if (result.isVideo) {
          response = result.response;
          downloadSuccess = true;
          console.log(`Download started, content-type: ${result.contentType}`);
        } else {
          cleanupStream(result.response);
          
          if (result.response.status === 200) {
            const chunks = [];
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                result.response.data.destroy();
                resolve();
              }, 5000);
              
              result.response.data.on('data', chunk => {
                chunks.push(chunk);
                if (Buffer.concat(chunks).length > 10000) {
                  clearTimeout(timeout);
                  result.response.data.destroy();
                  resolve();
                }
              });
              result.response.data.on('end', () => {
                clearTimeout(timeout);
                resolve();
              });
              result.response.data.on('error', () => {
                clearTimeout(timeout);
                resolve();
              });
            });
            
            const htmlContent = Buffer.concat(chunks).toString('utf8');
            if (htmlContent.includes('confirm=') || htmlContent.includes('action=')) {
              const newUrls = parseConfirmationPage(htmlContent, fileId);
              for (const newUrl of newUrls) {
                if (!downloadUrls.includes(newUrl)) {
                  downloadUrls.push(newUrl);
                }
              }
            }
          }
        }
      } catch (urlError) {
        console.log(`URL failed: ${urlError.message}`);
      }
    }
    
    if (!downloadSuccess || !response) {
      throw new Error('Could not download file from Google Drive. The file might be private, too large, or require special permissions. Please try downloading manually and uploading.');
    }

    if (response.status !== 200) {
      cleanup();
      if (response.status === 403) {
        throw new Error('Access denied. The file might be private or sharing is disabled.');
      } else if (response.status === 404) {
        throw new Error('File not found. Please check the Google Drive URL.');
      } else if (response.status === 429) {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      }
      throw new Error(`Download failed with HTTP ${response.status}`);
    }

    const totalSize = parseInt(response.headers['content-length'] || '0');
    let downloadedSize = 0;
    let lastProgress = 0;

    writer = fs.createWriteStream(tempPath);

    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
      
      if (totalSize > 0 && progressCallback) {
        const progress = Math.round((downloadedSize / totalSize) * 100);
        if (progress > lastProgress && progress <= 100) {
          lastProgress = progress;
          try {
            progressCallback({
              id: fileId,
              filename: originalFilename || 'Google Drive File',
              progress: progress
            });
          } catch (e) {}
        }
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const safeReject = (error) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(error);
      };
      
      const safeResolve = (result) => {
        if (resolved) return;
        resolved = true;
        cleanupStream(response);
        resolve(result);
      };
      
      writer.on('finish', () => {
        try {
          if (!fs.existsSync(tempPath)) {
            safeReject(new Error('Downloaded file not found'));
            return;
          }

          const stats = fs.statSync(tempPath);
          const fileSize = stats.size;

          if (fileSize === 0) {
            safeReject(new Error('Downloaded file is empty. The file might be private or the link is invalid.'));
            return;
          }

          if (fileSize < 1024) {
            safeReject(new Error('Downloaded file is too small. Please check if the Google Drive link is correct.'));
            return;
          }

          const buffer = Buffer.alloc(512);
          const fd = fs.openSync(tempPath, 'r');
          fs.readSync(fd, buffer, 0, 512, 0);
          fs.closeSync(fd);
          
          const fileHeader = buffer.toString('utf8', 0, 100).toLowerCase();
          
          if (fileHeader.includes('<!doctype html') || fileHeader.includes('<html') || fileHeader.includes('<head>')) {
            safeReject(new Error('Downloaded content is HTML, not a video. The file might be private or require authentication.'));
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
            safeReject(new Error('Downloaded file is not a valid video format.'));
            return;
          }

          let finalOriginalFilename = originalFilename || `gdrive_${fileId}.mp4`;
          if (!path.extname(finalOriginalFilename)) {
            finalOriginalFilename += '.mp4';
          }
          
          const uniqueFilename = getUniqueFilenameWithNumber(finalOriginalFilename, paths.videos);
          const finalPath = path.join(paths.videos, uniqueFilename);
          
          fs.renameSync(tempPath, finalPath);
          
          console.log(`Downloaded file from Google Drive: ${uniqueFilename} (${fileSize} bytes)`);
          safeResolve({
            filename: uniqueFilename,
            originalFilename: finalOriginalFilename,
            localFilePath: finalPath,
            mimeType: 'video/mp4',
            fileSize: fileSize
          });
        } catch (error) {
          safeReject(new Error(`Error processing downloaded file: ${error.message}`));
        }
      });

      writer.on('error', (error) => {
        safeReject(new Error(`Error writing file: ${error.message}`));
      });

      response.data.on('error', (error) => {
        safeReject(new Error(`Error downloading file: ${error.message}`));
      });
    });
  } catch (error) {
    cleanup();
    console.error('Error downloading file from Google Drive:', error.message);
    
    if (error.response) {
      if (error.response.status === 403) {
        throw new Error('File is private or sharing is disabled. Please make sure the file is publicly accessible.');
      } else if (error.response.status === 404) {
        throw new Error('File not found. Please check the Google Drive URL.');
      } else if (error.response.status === 429) {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      } else if (error.response.status >= 500) {
        throw new Error('Google Drive server error. Please try again later.');
      }
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Network connection failed. Please check your internet connection.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Download timeout. Please try again.');
    } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      throw new Error('Connection was reset. Please try again.');
    }
    
    throw new Error(error.message || 'Download failed. Please try again.');
  }
}

module.exports = {
  extractFileId,
  downloadFile
};
