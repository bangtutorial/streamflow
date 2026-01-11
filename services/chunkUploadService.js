const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const CHUNK_SIZE = 50 * 1024 * 1024;
const TEMP_DIR = path.join(__dirname, '../public/uploads/temp');
const INFO_DIR = path.join(__dirname, '../public/uploads/temp/info');
const VIDEOS_DIR = path.join(__dirname, '../public/uploads/videos');

fs.ensureDirSync(TEMP_DIR);
fs.ensureDirSync(INFO_DIR);
fs.ensureDirSync(VIDEOS_DIR);

function generateFileHash(filename, fileSize, userId) {
  return crypto.createHash('md5').update(`${filename}-${fileSize}-${userId}`).digest('hex');
}

function getInfoPath(uploadId) {
  return path.join(INFO_DIR, `${uploadId}.json`);
}

function getChunkPath(uploadId, chunkIndex) {
  return path.join(TEMP_DIR, `${uploadId}_chunk_${chunkIndex}`);
}

async function findExistingUpload(filename, fileSize, userId) {
  const fileHash = generateFileHash(filename, fileSize, userId);
  const infoPath = getInfoPath(fileHash);
  if (await fs.pathExists(infoPath)) {
    const info = await fs.readJson(infoPath);
    if (info.status === 'uploading' || info.status === 'paused') {
      return info;
    }
  }
  return null;
}

async function initUpload(filename, fileSize, totalChunks, userId) {
  const existingUpload = await findExistingUpload(filename, fileSize, userId);
  if (existingUpload) {
    existingUpload.status = 'uploading';
    existingUpload.lastActivity = Date.now();
    await fs.writeJson(getInfoPath(existingUpload.uploadId), existingUpload);
    return existingUpload;
  }
  const uploadId = generateFileHash(filename, fileSize, userId);
  const info = {
    uploadId,
    filename,
    fileSize,
    totalChunks,
    uploadedChunks: [],
    userId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    status: 'uploading'
  };
  await fs.writeJson(getInfoPath(uploadId), info);
  return info;
}

async function getUploadInfo(uploadId) {
  const infoPath = getInfoPath(uploadId);
  if (await fs.pathExists(infoPath)) {
    return await fs.readJson(infoPath);
  }
  return null;
}

async function saveChunk(uploadId, chunkIndex, chunkData) {
  const info = await getUploadInfo(uploadId);
  if (!info) {
    throw new Error('Upload session not found');
  }
  if (info.uploadedChunks.includes(chunkIndex)) {
    return {
      uploadedChunks: info.uploadedChunks,
      totalChunks: info.totalChunks,
      isComplete: info.uploadedChunks.length === info.totalChunks,
      skipped: true
    };
  }
  const chunkPath = getChunkPath(uploadId, chunkIndex);
  await fs.writeFile(chunkPath, chunkData);
  info.uploadedChunks.push(chunkIndex);
  info.uploadedChunks.sort((a, b) => a - b);
  info.lastActivity = Date.now();
  await fs.writeJson(getInfoPath(uploadId), info);
  return {
    uploadedChunks: info.uploadedChunks,
    totalChunks: info.totalChunks,
    isComplete: info.uploadedChunks.length === info.totalChunks,
    skipped: false
  };
}

async function pauseUpload(uploadId) {
  const info = await getUploadInfo(uploadId);
  if (info) {
    info.status = 'paused';
    info.lastActivity = Date.now();
    await fs.writeJson(getInfoPath(uploadId), info);
  }
}

async function mergeChunks(uploadId) {
  const info = await getUploadInfo(uploadId);
  if (!info) {
    throw new Error('Upload session not found');
  }
  if (info.uploadedChunks.length !== info.totalChunks) {
    throw new Error('Not all chunks uploaded');
  }
  const ext = path.extname(info.filename);
  const basename = path.basename(info.filename, ext)
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  const finalFilename = `${basename}-${timestamp}-${random}${ext}`;
  const finalPath = path.join(VIDEOS_DIR, finalFilename);
  const writeStream = fs.createWriteStream(finalPath);
  for (let i = 0; i < info.totalChunks; i++) {
    const chunkPath = getChunkPath(uploadId, i);
    const chunkData = await fs.readFile(chunkPath);
    writeStream.write(chunkData);
  }
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    writeStream.end();
  });
  info.status = 'completed';
  info.finalFilename = finalFilename;
  await fs.writeJson(getInfoPath(uploadId), info);
  return {
    filename: finalFilename,
    filepath: `/uploads/videos/${finalFilename}`,
    fullPath: finalPath,
    originalName: info.filename,
    fileSize: info.fileSize
  };
}

async function cleanupUpload(uploadId) {
  const info = await getUploadInfo(uploadId);
  if (info) {
    for (let i = 0; i < info.totalChunks; i++) {
      const chunkPath = getChunkPath(uploadId, i);
      if (await fs.pathExists(chunkPath)) {
        await fs.remove(chunkPath);
      }
    }
    await fs.remove(getInfoPath(uploadId));
  }
}

async function cleanupOldUploads(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const files = await fs.readdir(INFO_DIR);
    const now = Date.now();
    for (const file of files) {
      if (file.endsWith('.json')) {
        const infoPath = path.join(INFO_DIR, file);
        try {
          const info = await fs.readJson(infoPath);
          const lastActivity = info.lastActivity || info.createdAt;
          if (info.status !== 'completed' && (now - lastActivity) > maxAgeMs) {
            await cleanupUpload(info.uploadId);
          }
        } catch (e) {
          await fs.remove(infoPath);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up old uploads:', error);
  }
}

setInterval(() => {
  cleanupOldUploads(24 * 60 * 60 * 1000);
}, 60 * 60 * 1000);

module.exports = {
  CHUNK_SIZE,
  initUpload,
  getUploadInfo,
  saveChunk,
  pauseUpload,
  mergeChunks,
  cleanupUpload,
  cleanupOldUploads,
  findExistingUpload
};
