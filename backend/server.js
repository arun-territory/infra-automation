// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Octokit } = require('octokit');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3001;

// Validate environment variables
const requiredEnvVars = ['GITHUB_TOKEN', 'GITHUB_REPO_OWNER', 'GITHUB_REPO_NAME'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Initialize GitHub client with logging
const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN,
  log: {
    debug: () => {},
    info: console.log,
    warn: console.warn,
    error: console.error
  }
});

// Initialize SQLite database
const db = new sqlite3.Database('dashboard.db', (err) => {
  if (err) {
    console.error('Database initialization error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create tables with error handling
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    region TEXT,
    cluster_name TEXT,
    node_count INTEGER,
    status TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Table creation error:', err);
    } else {
      console.log('Deployments table ready');
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Helper function for database operations
const runQuery = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Routes
app.post('/api/deploy', async (req, res) => {
  const { projectId, region, clusterName, nodeCount, serviceAccountKey } = req.body;
  
  // Input validation
  if (!projectId || !region || !clusterName || !nodeCount) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['projectId', 'region', 'clusterName', 'nodeCount']
    });
  }

  console.log('Starting deployment process for:', {
    projectId,
    region,
    clusterName,
    nodeCount
  });

  try {
    // Store deployment info
    const dbResult = await runQuery(
      'INSERT INTO deployments (project_id, region, cluster_name, node_count, status) VALUES (?, ?, ?, ?, ?)',
      [projectId, region, clusterName, nodeCount, 'pending']
    );

    console.log('Deployment record created:', dbResult.lastID);

    // GitHub repository dispatch
    const githubResponse = await octokit.request('POST /repos/{owner}/{repo}/dispatches', {
      owner: process.env.GITHUB_REPO_OWNER,
      repo: process.env.GITHUB_REPO_NAME,
      event_type: 'deploy-infrastructure',
      client_payload: {
        project_id: projectId,
        region: region,
        cluster_name: clusterName,
        node_count: nodeCount,
        deployment_id: dbResult.lastID
      }
    });

    console.log('GitHub Action triggered successfully:', {
      status: githubResponse.status,
      headers: githubResponse.headers
    });

    res.json({ 
      message: 'Deployment initiated', 
      status: 'pending',
      deploymentId: dbResult.lastID
    });

  } catch (error) {
    console.error('Deployment error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data,
      stack: error.stack
    });

    // Update deployment status to failed
    try {
      await runQuery(
        'UPDATE deployments SET status = ?, error_message = ? WHERE id = ?',
        ['failed', error.message, dbResult?.lastID]
      );
    } catch (dbError) {
      console.error('Failed to update deployment status:', dbError);
    }

    // Send appropriate error response
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      error: 'Failed to initiate deployment',
      details: error.message,
      type: error.name,
      deploymentId: dbResult?.lastID
    });
  }
});

app.get('/api/deployments', async (req, res) => {
  try {
    const deployments = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM deployments ORDER BY created_at DESC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(deployments);
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch deployments',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(err ? 1 : 0);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`GitHub configuration:
    - Repository: ${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}
    - Token: ${process.env.GITHUB_TOKEN ? 'Present' : 'Missing'}`);
});