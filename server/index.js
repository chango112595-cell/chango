const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { ensureDirs } = require('./utils/paths');
const health = require('./routes/health');
const feedback = require('./routes/feedback');
const checkpoints = require('./routes/checkpoints');
const voiceProfiles = require('./routes/voiceProfiles');

ensureDirs();
const app = express();
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// API routes
app.use('/api', health);
app.use('/api', feedback);
app.use('/api', checkpoints);
app.use('/api', voiceProfiles);

// Serve static files (CSS, JS) directly from client directory
app.use(express.static(path.join(process.cwd(), 'client')));

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'client', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log('[ChangoAI] Server listening on', PORT));