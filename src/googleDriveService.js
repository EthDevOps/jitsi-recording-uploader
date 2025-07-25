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

      const actualFileName = fileName || path.basename(filePath);
      const conferenceRoomName = this.extractConferenceRoomName(actualFileName);
      const conferenceDirectoryId = await this.ensureConferenceDirectory(conferenceRoomName);

      // Get local file size
      const localFileStats = fs.statSync(filePath);
      const localFileSize = localFileStats.size;

      // Check if file already exists in the target directory
      const existingFile = await this.findExistingFile(actualFileName, conferenceDirectoryId);
      
      if (existingFile) {
        const remoteFileSize = parseInt(existingFile.size);
        if (localFileSize === remoteFileSize) {
          logger.info(`File ${actualFileName} already exists with same size (${localFileSize} bytes). Skipping upload.`);
          return {
            id: existingFile.id,
            name: existingFile.name,
            webViewLink: `https://drive.google.com/file/d/${existingFile.id}/view`,
            skipped: true
          };
        } else {
          logger.info(`File ${actualFileName} exists but size differs (local: ${localFileSize}, remote: ${remoteFileSize}). Proceeding with upload.`);
        }
      }

      const fileMetadata = {
        name: actualFileName,
        parents: conferenceDirectoryId ? [conferenceDirectoryId] : (config.jibri.uploadFolderId ? [config.jibri.uploadFolderId] : undefined)
      };

      const media = {
        mimeType: this.getMimeType(filePath),
        body: fs.createReadStream(filePath)
      };

      logger.info(`Starting upload: ${filePath} to conference directory: ${conferenceRoomName}`);
      
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink'
      });

      logger.info(`Upload successful: ${actualFileName}`, {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
        conferenceRoom: conferenceRoomName
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

  extractConferenceRoomName(fileName) {
    const firstUnderscoreIndex = fileName.indexOf('_');
    if (firstUnderscoreIndex === -1) {
      logger.warn(`Could not extract conference room name from filename: ${fileName}`);
      return 'unknown';
    }
    return fileName.substring(0, firstUnderscoreIndex);
  }

  async ensureConferenceDirectory(conferenceRoomName) {
    try {
      const parentFolderId = config.jibri.uploadFolderId;
      if (!parentFolderId) {
        logger.warn('No upload folder ID configured, creating conference directory in root');
      }

      const existingDirectory = await this.findDirectory(conferenceRoomName, parentFolderId);
      if (existingDirectory) {
        logger.info(`Using existing conference directory: ${conferenceRoomName} (${existingDirectory.id})`);
        return existingDirectory.id;
      }

      const directoryMetadata = {
        name: conferenceRoomName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await this.drive.files.create({
        resource: directoryMetadata,
        fields: 'id,name'
      });

      logger.info(`Created conference directory: ${conferenceRoomName} (${response.data.id})`);
      return response.data.id;
    } catch (error) {
      logger.error(`Failed to ensure conference directory for ${conferenceRoomName}:`, error);
      throw error;
    }
  }

  async findDirectory(directoryName, parentFolderId = null) {
    try {
      let query = `name='${directoryName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id,name)',
        pageSize: 1
      });

      return response.data.files.length > 0 ? response.data.files[0] : null;
    } catch (error) {
      logger.error(`Failed to search for directory ${directoryName}:`, error);
      return null;
    }
  }

  async findExistingFile(fileName, parentFolderId = null) {
    try {
      let query = `name='${fileName}' and trashed=false`;
      if (parentFolderId) {
        query += ` and '${parentFolderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id,name,size)',
        pageSize: 1
      });

      return response.data.files.length > 0 ? response.data.files[0] : null;
    } catch (error) {
      logger.error(`Failed to search for file ${fileName}:`, error);
      return null;
    }
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