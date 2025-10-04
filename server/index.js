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

// routes
app.use('/', health);
app.use('/', feedback);
app.use('/', checkpoints);
app.use('/', voiceProfiles);

// static client
app.use('/client', express.static(path.join(process.cwd(), 'client')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log('[ChangoAI] Server listening on', PORT));