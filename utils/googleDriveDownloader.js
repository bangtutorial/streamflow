const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

class GDriveDownloader {
    constructor() {
        this.cookies = '';
        this.downloadedBytes = 0;
        this.totalBytes = 0;
        this.fileName = '';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }    logProgress() {
        if (this.totalBytes > 0) {
            const percentage = (this.downloadedBytes / this.totalBytes * 100).toFixed(1);
            console.log(`${percentage}% [${this.formatBytes(this.downloadedBytes)}/${this.formatBytes(this.totalBytes)}]`);
        }
    }isGoogleDrive(url) {
        return url.includes('drive.google.com') || 
               url.includes('drive.usercontent.google.com') ||
               url.includes('/file/d/') ||
               url.includes('id=') && url.includes('export=download');
    }

    extractFileId(url) {
        const patterns = [
            /\/file\/d\/([a-zA-Z0-9_-]+)/,
            /[?&]id=([a-zA-Z0-9_-]+)/,
            /\/open\?id=([a-zA-Z0-9_-]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0',
                    ...options.headers
                }
            };

            if (this.cookies) {
                requestOptions.headers['Cookie'] = this.cookies;
            }            const req = https.request(requestOptions, (res) => {
                if (res.headers['set-cookie']) {
                    this.cookies = res.headers['set-cookie'].join('; ');
                }

                resolve(res);
            });req.on('error', reject);
            req.setTimeout(60000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async downloadFile(url, outputPath = null, progressCallback = null) {
        this.downloadedBytes = 0;
        this.totalBytes = 0;
        this.progressCallback = progressCallback;
        
        if (!this.isGoogleDrive(url)) {
            throw new Error('Only Google Drive URLs are supported');
        }
        
        return this.downloadGoogleDrive(url, outputPath);
    }

    async downloadGoogleDrive(url, outputPath = null) {
        const fileId = this.extractFileId(url);
        if (!fileId) {
            throw new Error('Cannot extract File ID from Google Drive URL');
        }

        console.log(`File ID: ${fileId}`);        if (!outputPath) {
            this.fileName = `gdrive_${fileId}.bin`;
            outputPath = path.join('.', this.fileName);
        } else {
            this.fileName = path.basename(outputPath);
        }

        const downloadDir = path.dirname(outputPath);
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }        try {
            let downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
            let response = await this.makeRequest(downloadUrl);
            
            if (response.statusCode >= 300 && response.statusCode < 400) {
                downloadUrl = response.headers.location;
                response = await this.makeRequest(downloadUrl);
            }
            
            if (response.headers['content-type']?.includes('text/html')) {
                downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${Date.now()}`;
                response = await this.makeRequest(downloadUrl);
            }

            return this.processDownload(response, outputPath, url);

        } catch (error) {
            console.error('Error in Google Drive download process:', error.message);
            throw error;
        }
    }    
    
    processDownload(response, outputPath, originalUrl) {
        return new Promise((resolve, reject) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`HTTP Error: ${response.statusCode} - ${response.statusMessage}`));
            }            this.totalBytes = parseInt(response.headers['content-length'] || '0');
            
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition && contentDisposition.includes('filename=')) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    const headerFileName = match[1].replace(/['"]/g, '');
                    if (headerFileName && headerFileName !== 'unknown') {
                        this.fileName = headerFileName;
                        outputPath = path.join(path.dirname(outputPath), headerFileName);
                    }
                }
            }

            console.log(`File: ${this.fileName}`);
            console.log(`Size: ${this.formatBytes(this.totalBytes)}`);

            const fileStream = fs.createWriteStream(outputPath);
            let isHtmlResponse = false;
            let receivedData = Buffer.alloc(0);            
            response.on('data', (chunk) => {
                this.downloadedBytes += chunk.length;
                
                if (this.progressCallback && this.totalBytes > 0) {
                    const percentage = Math.round((this.downloadedBytes / this.totalBytes) * 100);
                    this.progressCallback({
                        downloaded: this.downloadedBytes,
                        total: this.totalBytes,
                        percentage: percentage,
                        fileName: this.fileName
                    });
                }
                
                if (this.isGoogleDrive(originalUrl) && receivedData.length < 1000) {
                    receivedData = Buffer.concat([receivedData, chunk]);
                    const content = receivedData.toString('utf8', 0, Math.min(receivedData.length, 1000));
                    
                    if (content.toLowerCase().includes('<html') || 
                        content.toLowerCase().includes('<!doctype html') ||
                        content.toLowerCase().includes('too many users') ||
                        content.toLowerCase().includes('download quota')) {
                        isHtmlResponse = true;
                        fileStream.destroy();
                        
                        const debugPath = path.join(path.dirname(outputPath), 'gdrive_error.html');
                        fs.writeFileSync(debugPath, receivedData);
                        
                        console.log('\nGoogle Drive Error Response:');
                        if (content.includes('too many users')) {
                            console.log('Too many users have viewed or downloaded this file');
                            console.log('Try again in a few hours');
                        } else if (content.includes('download quota')) {
                            console.log('Download quota exceeded');
                            console.log('File is too popular');
                        } else {
                            console.log('Response is HTML, not binary file');
                            console.log('File might be private or require special access');
                        }
                        console.log(`Debug file saved: ${debugPath}`);
                        
                        fs.unlink(outputPath, () => {});
                        return reject(new Error('Google Drive error: Received HTML instead of file'));
                    }
                }
                
                if (!isHtmlResponse) {
                    fileStream.write(chunk);
                }
            });            
            response.on('end', () => {
                if (isHtmlResponse) return;
                
                fileStream.end();
                
                console.log('Download completed!');
                console.log(`File: ${this.fileName}`);
                console.log(`Location: ${outputPath}`);
                console.log(`Size: ${this.formatBytes(this.downloadedBytes)}`);
                
                const stats = fs.statSync(outputPath);
                if (stats.size < 1024) {
                    console.log('Warning: File is very small, please check its content');
                }
                
                resolve(outputPath);
            });
            response.on('error', (err) => {
                fileStream.destroy();
                fs.unlink(outputPath, () => {});
                reject(err);
            });

            fileStream.on('error', (err) => {
                response.destroy();
                fs.unlink(outputPath, () => {});
                reject(err);
            });
        });
    }
}

async function getUrlInfo(url) {
    const downloader = new GDriveDownloader();
    
    console.log('URL Information:');
    console.log(`   Original URL: ${url}`);
    
    if (downloader.isGoogleDrive(url)) {
        const fileId = downloader.extractFileId(url);
        if (fileId) {
            console.log(`   File ID: ${fileId}`);
            console.log(`   Direct URL: https://drive.usercontent.google.com/download?id=${fileId}&export=download`);
            console.log(`   View URL: https://drive.google.com/file/d/${fileId}/view`);
            console.log(`   Preview URL: https://drive.google.com/file/d/${fileId}/preview`);
        }
    } else {
        console.log('Only Google Drive URLs are supported');
    }
}

async function downloadUrl(url, outputPath = null) {
    const downloader = new GDriveDownloader();
    
    try {        
        const filePath = await downloader.downloadFile(url, outputPath);
        return filePath;
        
    } catch (error) {
        console.error('\nDownload failed:', error.message);
        throw error;
    }
}

async function main() {
    const url = '';
    
    try {
        const filePath = await downloadUrl(url);
        console.log(`\nSuccess! File saved to: ${filePath}`);
        
    } catch (error) {
        console.error('\nFailed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    GDriveDownloader,
    downloadUrl,
    getUrlInfo
};