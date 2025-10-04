// Chango AI Server - Entry Point
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chango-ai' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Chango AI server running on port ${PORT}`);
});