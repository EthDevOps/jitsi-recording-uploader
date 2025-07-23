const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

class GoogleDriveService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    if (config.google.refreshToken) {
      this.oauth2Client.setCredentials({
        refresh_token: config.google.refreshToken
      });
    }

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  async uploadFile(filePath, fileName = null) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileMetadata = {
        name: fileName || path.basename(filePath),
        parents: config.jibri.uploadFolderId ? [config.jibri.uploadFolderId] : undefined
      };

      const media = {
        mimeType: this.getMimeType(filePath),
        body: fs.createReadStream(filePath)
      };

      logger.info(`Starting upload: ${filePath}`);
      
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink'
      });

      logger.info(`Upload successful: ${fileName || path.basename(filePath)}`, {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink
      });

      return response.data;
    } catch (error) {
      logger.error(`Upload failed for ${filePath}:`, error);
      throw error;
    }
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.webm': 'video/webm'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async testConnection() {
    try {
      const response = await this.drive.about.get({ fields: 'user' });
      logger.info(`Connected to Google Drive as: ${response.data.user.emailAddress}`);
      return true;
    } catch (error) {
      logger.error('Failed to connect to Google Drive:', error);
      return false;
    }
  }
}

module.exports = GoogleDriveService;