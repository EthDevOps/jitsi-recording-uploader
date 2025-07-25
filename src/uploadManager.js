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
    const uploadItem = {
      filePath,
      fileName: this.generateFileName(filePath),
      retries: 0,
      addedAt: new Date()
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
      
      const result = await this.driveService.uploadFile(
        uploadItem.filePath,
        uploadItem.fileName
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

    // Check if it's a video file
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    const ext = path.extname(filePath).toLowerCase();
    if (!videoExtensions.includes(ext)) {
      throw new Error(`Not a video file: ${filePath}`);
    }

    logger.info(`Force re-uploading file: ${filePath}`);
    
    const uploadItem = {
      filePath,
      fileName: this.generateFileName(filePath),
      retries: 0,
      addedAt: new Date(),
      forceReupload: true
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
