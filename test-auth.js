#!/usr/bin/env node

const GoogleDriveService = require('./src/googleDriveService');
const config = require('./src/config');

async function testAuthentication() {
  console.log('🔧 Testing Google Drive Authentication...\n');
  
  // Check required environment variables
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease check your .env file.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables found');
  
  try {
    const driveService = new GoogleDriveService();
    console.log('✅ Google Drive service initialized');
    
    const connected = await driveService.testConnection();
    
    if (connected) {
      console.log('✅ Successfully connected to Google Drive!');
      
      if (config.jibri.uploadFolderId) {
        console.log(`✅ Target folder ID configured: ${config.jibri.uploadFolderId}`);
      } else {
        console.log('ℹ️  No target folder specified - files will upload to Drive root');
      }
      
      console.log('\n🎉 Authentication setup complete!');
      console.log('You can now run: npm start');
      
    } else {
      console.error('❌ Failed to connect to Google Drive');
      console.error('Please check your credentials and try again.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    process.exit(1);
  }
}

testAuthentication();