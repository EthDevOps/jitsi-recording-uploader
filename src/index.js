const FileWatcher = require('./fileWatcher');
const UploadManager = require('./uploadManager');
const logger = require('./logger');
const config = require('./config');
const fs = require('fs');

class JitsiRecordingUploader {
  constructor() {
    this.uploadManager = null;
    this.fileWatcher = null;
  }

  async start() {
    try {
      logger.info('Starting Jitsi Recording Uploader...');

      // Ensure logs directory exists
      if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
      }

      // Validate configuration
      this.validateConfig();

      // Initialize upload manager
      this.uploadManager = new UploadManager();
      await this.uploadManager.initialize();

      // Initialize file watcher
      this.fileWatcher = new FileWatcher((filePath) => {
        return this.uploadManager.queueUpload(filePath);
      });

      // Scan for existing files first
      await this.fileWatcher.scanExistingFiles();

      // Start watching for new files
      this.fileWatcher.start();

      logger.info('Jitsi Recording Uploader started successfully');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      // Log status periodically
      this.startStatusLogging();

    } catch (error) {
      logger.error('Failed to start Jitsi Recording Uploader:', error);
      process.exit(1);
    }
  }

  validateConfig() {
    const required = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET', 
      'GOOGLE_REFRESH_TOKEN'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (!fs.existsSync(config.jibri.recordingsPath)) {
      logger.warn(`Recordings path does not exist: ${config.jibri.recordingsPath}`);
    }

    logger.info('Configuration validated successfully');
  }

  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      if (this.fileWatcher) {
        this.fileWatcher.stop();
      }

      // Give some time for current uploads to complete
      setTimeout(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async forceReupload(filePath) {
    if (!this.uploadManager) {
      throw new Error('Upload manager not initialized');
    }
    return await this.uploadManager.forceReupload(filePath);
  }

  startStatusLogging() {
    setInterval(() => {
      if (this.uploadManager) {
        const status = this.uploadManager.getQueueStatus();
        if (status.queueLength > 0 || status.isProcessing) {
          logger.info('Upload status:', {
            queueLength: status.queueLength,
            isProcessing: status.isProcessing
          });
        }
      }
    }, 30000); // Log status every 30 seconds
  }
}

// Handle CLI commands
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'reupload' && args[1]) {
    // Force re-upload command
    const filePath = args[1];
    const uploader = new JitsiRecordingUploader();
    
    (async () => {
      try {
        await uploader.start();
        const fileName = await uploader.forceReupload(filePath);
        logger.info(`Re-upload initiated for: ${fileName}`);
      } catch (error) {
        logger.error('Force re-upload failed:', error);
        process.exit(1);
      }
    })();
  } else if (args[0] === 'reupload') {
    console.log('Usage: node src/index.js reupload <file-path>');
    console.log('Example: node src/index.js reupload /path/to/recording.mp4');
    process.exit(1);
  } else {
    // Normal startup
    const uploader = new JitsiRecordingUploader();
    uploader.start();
  }
}

module.exports = JitsiRecordingUploader;