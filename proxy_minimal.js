// proxy_minimal.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());


// Serve static files (including index.html) from the project root
app.use(express.static(path.join(__dirname)));

// Root route - explicitly serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve agent_minimal.js explicitly
app.get('/agent_minimal.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'agent_minimal.js'));
});

// API endpoints
app.post('/api/llm', require('./api/llm.js'));
app.get('/api/search', require('./api/search.js'));
app.post('/api/aipipe', require('./api/aipipe.js'));
app.post('/api/execute', require('./api/execute.js'));

// Fallback for unknown API routes
app.use('/api', (req, res) => {
  res.json({ status: 'Proxy working!', path: req.path, method: req.method });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Proxy running on http://localhost:${PORT}`));
// A minor change to test git
