const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const logger = require('./logger');

class FileWatcher {
  constructor(onFileAdded) {
    this.onFileAdded = onFileAdded;
    this.watcher = null;
    this.processedFiles = new Set();
  }

  start() {
    const watchPath = config.jibri.recordingsPath;
    
    if (!fs.existsSync(watchPath)) {
      logger.error(`Watch path does not exist: ${watchPath}`);
      throw new Error(`Watch path does not exist: ${watchPath}`);
    }

    logger.info(`Starting file watcher on: ${watchPath}`);

    this.watcher = chokidar.watch(watchPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      depth: 2, // Watch subdirectories
      awaitWriteFinish: {
        stabilityThreshold: config.app.stabilityThreshold, // Configurable wait time after file stops changing
        pollInterval: 1000
      }
    });

    this.watcher
      .on('add', (filePath) => this.handleFileAdd(filePath))
      .on('ready', () => logger.info('Initial scan complete. Watching for changes...'))
      .on('error', (error) => logger.error('Watcher error:', error));

    return this;
  }

  async handleFileAdd(filePath) {
    try {
      // Only process video files
      if (!this.isVideoFile(filePath)) {
        return;
      }

      // Avoid processing the same file multiple times
      if (this.processedFiles.has(filePath)) {
        return;
      }

      logger.info(`New recording detected: ${filePath}`);
      this.processedFiles.add(filePath);

      // Call the callback function to handle the file
      if (this.onFileAdded) {
        await this.onFileAdded(filePath);
      }
    } catch (error) {
      logger.error(`Error handling file ${filePath}:`, error);
    }
  }

  isVideoFile(filePath) {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    const ext = path.extname(filePath).toLowerCase();
    return videoExtensions.includes(ext);
  }

  stop() {
    if (this.watcher) {
      logger.info('Stopping file watcher...');
      this.watcher.close();
      this.watcher = null;
    }
  }

  // Method to manually scan for existing files
  async scanExistingFiles() {
    const watchPath = config.jibri.recordingsPath;
    
    if (!fs.existsSync(watchPath)) {
      logger.warn(`Watch path does not exist: ${watchPath}`);
      return;
    }

    logger.info('Scanning for existing recording files...');
    
    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else if (this.isVideoFile(filePath)) {
          this.handleFileAdd(filePath);
        }
      }
    };

    try {
      scanDirectory(watchPath);
      logger.info('Existing files scan completed');
    } catch (error) {
      logger.error('Error scanning existing files:', error);
    }
  }
}

module.exports = FileWatcher;