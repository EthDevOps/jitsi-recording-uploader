#!/usr/bin/env node

const JitsiRecordingUploader = require('./src/index');
const logger = require('./src/logger');

if (process.argv.length < 3) {
  console.log('Usage: node reupload.js <file-path>');
  console.log('Example: node reupload.js /opt/jitsi/jibri/recordings/meeting-123.mp4');
  process.exit(1);
}

const filePath = process.argv[2];

(async () => {
  const uploader = new JitsiRecordingUploader();
  
  try {
    // Initialize the uploader (but don't start file watching)
    logger.info('Initializing uploader for force re-upload...');
    uploader.uploadManager = new (require('./src/uploadManager'))();
    await uploader.uploadManager.initialize();
    
    // Force re-upload the specified file
    const fileName = await uploader.uploadManager.forceReupload(filePath);
    logger.info(`Re-upload completed successfully: ${fileName}`);
    process.exit(0);
  } catch (error) {
    logger.error('Force re-upload failed:', error.message);
    process.exit(1);
  }
})();