require('dotenv').config();

const config = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
  jibri: {
    recordingsPath: process.env.JIBRI_RECORDINGS_PATH || '/opt/jitsi/jibri/recordings',
    uploadFolderId: process.env.UPLOAD_FOLDER_ID,
  },
  app: {
    logLevel: process.env.LOG_LEVEL || 'info',
    watchInterval: parseInt(process.env.WATCH_INTERVAL) || 5000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    cleanupAfterUpload: process.env.CLEANUP_AFTER_UPLOAD === 'true',
  }
};

module.exports = config;