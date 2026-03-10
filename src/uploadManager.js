const fs = require('fs');
const path = require('path');
const GoogleDriveService = require('./googleDriveService');
const config = require('./config');
const logger = require('./logger');

class UploadManager {
  constructor() {
    this.driveService = new GoogleDriveService();
    this.uploadQueue = [];
    this.isProcessing = false;
    this.retryDelays = [1000, 5000, 15000]; // Exponential backoff delays
    this.mode = config.app.mode;
  }

  async initialize() {
    logger.info('Initializing upload manager...');
    const connected = await this.driveService.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Google Drive');
    }
    logger.info('Upload manager initialized successfully');
  }

  async queueUpload(filePath) {
    let roomName = null;
    if (this.mode === 'transcripts') {
      roomName = this.extractRoomNameFromTranscript(filePath);
    }

    const uploadItem = {
      filePath,
      fileName: this.generateFileName(filePath),
      retries: 0,
      addedAt: new Date(),
      roomName,
    };

    this.uploadQueue.push(uploadItem);
    logger.info(`Queued for upload: ${filePath}`);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isProcessing || this.uploadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info(`Processing upload queue (${this.uploadQueue.length} items)`);

    while (this.uploadQueue.length > 0) {
      const uploadItem = this.uploadQueue.shift();
      await this.processUploadItem(uploadItem);
    }

    this.isProcessing = false;
    logger.info('Upload queue processing completed');
  }

  async processUploadItem(uploadItem) {
    try {
      logger.info(`Processing: ${uploadItem.fileName}`);
      
      const options = {};
      if (uploadItem.roomName) {
        options.roomName = uploadItem.roomName;
      }

      const result = await this.driveService.uploadFile(
        uploadItem.filePath,
        uploadItem.fileName,
        options
      );

      if (result.skipped) {
        logger.info(`Upload skipped (file exists with same size): ${uploadItem.fileName}`, {
          fileId: result.id,
          webViewLink: result.webViewLink
        });
      } else {
        logger.info(`Upload successful: ${uploadItem.fileName}`, {
          fileId: result.id,
          webViewLink: result.webViewLink
        });
      }

      // Clean up local file if configured to do so
      if (config.app.cleanupAfterUpload) {
        await this.cleanupFile(uploadItem.filePath);
      }

    } catch (error) {
      await this.handleUploadError(uploadItem, error);
    }
  }

  async handleUploadError(uploadItem, error) {
    uploadItem.retries++;
    logger.error(`Upload failed for ${uploadItem.fileName} (attempt ${uploadItem.retries}/${config.app.maxRetries}):`, error);

    if (uploadItem.retries < config.app.maxRetries) {
      const delay = this.retryDelays[Math.min(uploadItem.retries - 1, this.retryDelays.length - 1)];
      logger.info(`Retrying upload for ${uploadItem.fileName} in ${delay}ms`);
      
      setTimeout(() => {
        this.uploadQueue.unshift(uploadItem); // Add back to front of queue
        if (!this.isProcessing) {
          this.processQueue();
        }
      }, delay);
    } else {
      logger.error(`Max retries exceeded for ${uploadItem.fileName}. Upload failed permanently.`);
    }
  }

  async cleanupFile(filePath) {
    try {
      await fs.promises.unlink(filePath);
      logger.info(`Cleaned up local file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to cleanup file ${filePath}:`, error);
    }
  }

  extractRoomNameFromTranscript(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/in room (.+?)@muc\.meet\.jitsi/);
      if (match) {
        return match[1];
      }
      logger.warn(`Could not extract room name from transcript: ${filePath}`);
      return 'unknown';
    } catch (error) {
      logger.error(`Failed to read transcript file ${filePath}:`, error);
      return 'unknown';
    }
  }

  generateFileName(filePath) {
    const originalName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, extension);
    
    return `${nameWithoutExt}${extension}`;
  }

  async forceReupload(filePath) {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check if it's a supported file type
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    const ext = path.extname(filePath).toLowerCase();
    if (this.mode === 'transcripts') {
      if (ext !== '.txt') {
        throw new Error(`Not a transcript file: ${filePath}`);
      }
    } else if (!videoExtensions.includes(ext)) {
      throw new Error(`Not a video file: ${filePath}`);
    }

    logger.info(`Force re-uploading file: ${filePath}`);

    let roomName = null;
    if (this.mode === 'transcripts') {
      roomName = this.extractRoomNameFromTranscript(filePath);
    }

    const uploadItem = {
      filePath,
      fileName: this.generateFileName(filePath),
      retries: 0,
      addedAt: new Date(),
      forceReupload: true,
      roomName,
    };

    // Add to front of queue for immediate processing
    this.uploadQueue.unshift(uploadItem);
    logger.info(`Added to front of queue for re-upload: ${filePath}`);

    if (!this.isProcessing) {
      this.processQueue();
    }

    return uploadItem.fileName;
  }

  getQueueStatus() {
    return {
      queueLength: this.uploadQueue.length,
      isProcessing: this.isProcessing,
      items: this.uploadQueue.map(item => ({
        fileName: item.fileName,
        retries: item.retries,
        addedAt: item.addedAt,
        forceReupload: item.forceReupload || false
      }))
    };
  }
}

module.exports = UploadManager;
