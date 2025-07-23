# Google Drive Authentication Setup Guide

## Required Information
After completing the setup steps, you'll need these values:

```env
# From Step 2 (OAuth credentials)
GOOGLE_CLIENT_ID=your_client_id_from_step_2
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_2

# From Step 3 (OAuth Playground)
GOOGLE_REFRESH_TOKEN=your_refresh_token_from_step_3

# From Step 4 (Optional - folder ID)
UPLOAD_FOLDER_ID=your_folder_id_from_step_4

# Other settings (can leave as defaults)
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
JIBRI_RECORDINGS_PATH=/opt/jitsi/jibri/recordings
LOG_LEVEL=info
WATCH_INTERVAL=5000
MAX_RETRIES=3
CLEANUP_AFTER_UPLOAD=false
```

## Example .env file:
```env
GOOGLE_CLIENT_ID=123456789-abcdefghijk.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-1234567890abcdefghijk
GOOGLE_REFRESH_TOKEN=1//04xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
UPLOAD_FOLDER_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74mHvnckdWA
JIBRI_RECORDINGS_PATH=/opt/jitsi/jibri/recordings
LOG_LEVEL=info
WATCH_INTERVAL=5000
MAX_RETRIES=3
CLEANUP_AFTER_UPLOAD=false
```

## Test the setup:
```bash
npm install
npm start
```

The application will validate your credentials and show connection status.