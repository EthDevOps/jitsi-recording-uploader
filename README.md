# Jitsi Recording Uploader

A tool that automatically uploads Jitsi recordings from a Jibri container's PVC (Persistent Volume Claim) to Google Drive.

## Features

- Monitors Jibri recordings directory for new video files
- Automatically uploads recordings to Google Drive
- Configurable retry logic with exponential backoff
- Comprehensive logging and error handling
- Optional cleanup of local files after successful upload
- Graceful shutdown handling
- Support for multiple video formats (MP4, AVI, MOV, MKV, WebM)

## Prerequisites

- Node.js 16+ 
- Google Drive API credentials
- Access to Jibri recordings directory

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Google Drive API:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Generate a refresh token using the OAuth playground

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REFRESH_TOKEN=your_refresh_token_here
   UPLOAD_FOLDER_ID=your_google_drive_folder_id
   JIBRI_RECORDINGS_PATH=/opt/jitsi/jibri/recordings
   ```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Docker Deployment

For Kubernetes/Docker environments, mount the Jibri PVC to the container and set the appropriate path in the environment variables.

Example Docker run:
```bash
docker run -d \
  --name jitsi-uploader \
  -v /path/to/jibri/recordings:/opt/jitsi/jibri/recordings:ro \
  -e GOOGLE_CLIENT_ID=your_client_id \
  -e GOOGLE_CLIENT_SECRET=your_client_secret \
  -e GOOGLE_REFRESH_TOKEN=your_refresh_token \
  -e UPLOAD_FOLDER_ID=your_folder_id \
  jitsi-recording-uploader
```

## Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Required |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth refresh token | Required |
| `UPLOAD_FOLDER_ID` | Target Google Drive folder ID | Optional |
| `JIBRI_RECORDINGS_PATH` | Path to Jibri recordings | `/opt/jitsi/jibri/recordings` |
| `LOG_LEVEL` | Logging level | `info` |
| `WATCH_INTERVAL` | File watcher interval (ms) | `5000` |
| `MAX_RETRIES` | Max upload retry attempts | `3` |
| `CLEANUP_AFTER_UPLOAD` | Delete local files after upload | `false` |

## Logging

Logs are written to:
- Console (colored output)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

## Google Drive Setup

1. **Create Google Cloud Project:**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Google Drive API

2. **Create OAuth Credentials:**
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Set authorized redirect URIs

3. **Generate Refresh Token:**
   - Use [Google OAuth Playground](https://developers.google.com/oauthplayground/)
   - Select Google Drive API v3 scopes
   - Authorize and exchange for refresh token

4. **Get Folder ID (Optional):**
   - Create or navigate to target folder in Google Drive
   - Copy folder ID from URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

## Error Handling

The tool includes comprehensive error handling:
- Automatic retries with exponential backoff
- File stability checks (waits for files to stop changing)
- Google Drive API error handling
- Graceful shutdown on system signals

## Monitoring

- Status logging every 30 seconds when uploads are active
- Detailed upload progress and results logging
- Error tracking with stack traces
- Queue status monitoring

## License

MIT