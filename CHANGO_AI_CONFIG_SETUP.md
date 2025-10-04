# Chango AI Configuration Setup

## Overview
This document contains the exact configuration files needed for the Chango AI project to run properly on Replit with Express backend.

## Important Note
Due to Replit's environment protection, the `package.json` and `.replit` files cannot be directly edited through the agent. The required configurations have been saved as:
- `package.json.chango` - The exact package.json configuration needed
- `.replit.chango` - The exact .replit configuration needed

## Required Configurations

### 1. package.json
The Chango AI project requires this exact package.json:

```json
{
  "name": "chango-ai",
  "private": true,
  "scripts": {
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "body-parser": "^1.20.2",
    "multer": "^1.4.5-lts.1",
    "archiver": "^6.0.2",
    "wav-decoder": "^1.3.0"
  }
}
```

### 2. .replit
The Chango AI project requires this exact .replit configuration:

```
run = "npm start"
language = "nodejs"
```

## Server Setup
A basic server entry point has been created at `server/index.js` that:
- Sets up an Express server on port 5000
- Configures body-parser middleware
- Serves static files from the client directory
- Provides a health check endpoint at `/health`

## How to Apply These Configurations

### Option 1: Manual Copy (Recommended)
1. Copy the content from `package.json.chango` to `package.json`
2. Copy the content from `.replit.chango` to `.replit`
3. Run `npm install` to install the dependencies
4. Run `npm start` to start the server

### Option 2: Using Terminal Commands
If you have direct access to the terminal:
```bash
# Backup existing files
cp package.json package.json.backup
cp .replit .replit.backup

# Apply new configurations
cp package.json.chango package.json
cp .replit.chango .replit

# Install dependencies
npm install

# Start the application
npm start
```

## Dependencies Explained
- **express** (^4.19.2): Web application framework
- **body-parser** (^1.20.2): Parse incoming request bodies
- **multer** (^1.4.5-lts.1): Handle multipart/form-data for file uploads
- **archiver** (^6.0.2): Create and extract archives
- **wav-decoder** (^1.3.0): Decode WAV audio files

## Files Created
✅ `package.json.chango` - Ready to use package.json configuration
✅ `.replit.chango` - Ready to use .replit configuration
✅ `server/index.js` - Basic Express server entry point
✅ `CHANGO_AI_CONFIG_SETUP.md` - This documentation file

## Next Steps
1. Apply the configurations as described above
2. Install the dependencies
3. Start the Chango AI application with `npm start`