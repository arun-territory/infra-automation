// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Octokit } = require('octokit');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3001;

// Initialize GitHub client
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Initialize SQLite database
const db = new sqlite3.Database('dashboard.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    region TEXT,
    cluster_name TEXT,
    node_count INTEGER,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.use(cors());
app.use(express.json());

// Routes
app.post('/api/deploy', async (req, res) => {
  const { projectId, region, clusterName, nodeCount, serviceAccountKey } = req.body;
  
  try {
    // Store deployment info
    db.run(
      'INSERT INTO deployments (project_id, region, cluster_name, node_count, status) VALUES (?, ?, ?, ?, ?)',
      [projectId, region, clusterName, nodeCount, 'pending']
    );

    // Trigger GitHub Actions workflow
    await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
      owner: process.env.GITHUB_REPO_OWNER,
      repo: process.env.GITHUB_REPO_NAME,
      event_type: 'deploy-infrastructure',
      client_payload: {
        project_id: projectId,
        region: region,
        cluster_name: clusterName,
        node_count: nodeCount
      }
    });

    res.json({ message: 'Deployment initiated', status: 'pending' });
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: 'Failed to initiate deployment' });
  }
});

app.get('/api/deployments', (req, res) => {
  db.all('SELECT * FROM deployments ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch deployments' });
      return;
    }
    res.json(rows);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});