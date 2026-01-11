class ChunkedUploader {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 50 * 1024 * 1024;
    this.userId = options.userId || '';
    this.onProgress = options.onProgress || (() => {});
    this.onSuccess = options.onSuccess || (() => {});
    this.onError = options.onError || (() => {});
    this.uploads = new Map();
  }

  async uploadFile(file, fileIndex = 0) {
    const storageKey = `chunked_${file.name}_${file.size}_${file.lastModified}`;
    let uploadId = localStorage.getItem(storageKey);
    let offset = 0;
    
    try {
      if (uploadId) {
        const resumeResponse = await fetch(`/api/chunked/${uploadId}`, {
          method: 'HEAD',
          credentials: 'include'
        });
        
        if (resumeResponse.ok) {
          offset = parseInt(resumeResponse.headers.get('Upload-Offset') || '0', 10);
        } else {
          localStorage.removeItem(storageKey);
          uploadId = null;
        }
      }
      
      if (!uploadId) {
        const createResponse = await fetch('/api/chunked/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            filename: file.name,
            filesize: file.size,
            filetype: file.type
          })
        });
        
        const createData = await createResponse.json();
        if (!createData.success) {
          throw new Error(createData.error || 'Failed to create upload');
        }
        
        uploadId = createData.uploadId;
        localStorage.setItem(storageKey, uploadId);
      }
      
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + this.chunkSize);
        const chunkBuffer = await chunk.arrayBuffer();
        
        const response = await fetch(`/api/chunked/${uploadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/offset+octet-stream',
            'Upload-Offset': offset.toString()
          },
          credentials: 'include',
          body: chunkBuffer
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Chunk upload failed');
        }
        
        offset = data.offset || (offset + chunkBuffer.byteLength);
        
        const percentage = Math.round((offset / file.size) * 100);
        this.onProgress(percentage, offset, file.size, file, fileIndex);
        
        if (data.complete) {
          localStorage.removeItem(storageKey);
          this.onSuccess(file, fileIndex);
          return { success: true, file };
        }
      }
      
      localStorage.removeItem(storageKey);
      this.onSuccess(file, fileIndex);
      return { success: true, file };
      
    } catch (error) {
      console.error('Upload error:', error);
      this.onError(error, file, fileIndex);
      throw error;
    }
  }

  async uploadFiles(files) {
    const results = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.uploadFile(files[i], i);
        results.push(result);
      } catch (error) {
        results.push({ success: false, file: files[i], error });
      }
    }
    return results;
  }
}

window.ChunkedUploader = ChunkedUploader;
