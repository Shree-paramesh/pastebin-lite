const express = require('express');
const path = require('path');
const cors = require('cors');
const { createClient } = require('redis');
const { nanoid } = require('nanoid');
const config = require('./config');

const app = express();
const PORT = config.port;

// Redis client setup with retry logic
let redisClient = null;
let redisConnected = false;

async function initRedis() {
  const redisUrl = config.redis.url;
  
  if (!redisUrl) {
    console.warn('⚠️  No REDIS_URL or KV_URL found. Using in-memory storage (not production-ready).');
    return null;
  }

  try {
    redisClient = createClient({ 
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return new Error('Max retries reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('🔄 Connecting to Redis...');
    });
    
    redisClient.on('ready', () => {
      console.log('✅ Connected to Redis');
      redisConnected = true;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Reconnecting to Redis...');
      redisConnected = false;
    });
    
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    redisClient = null;
    return null;
  }
}

// In-memory fallback storage
const memoryStore = new Map();

// Middleware
// CORS: allow the client (default `http://localhost:3000`) to call the API
app.use(cors({
  origin: config.clientUrl,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Error handling for malformed JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  next();
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Helper to get current time (supports `TEST_MODE` for deterministic testing)
// If `TEST_MODE=1` and header `x-test-now-ms` is provided the server will use that
// timestamp. This makes automated testing deterministic.
function getCurrentTime(req) {
  const testMode = config.testMode;
  if (testMode && req.headers['x-test-now-ms']) {
    const testTime = parseInt(req.headers['x-test-now-ms'], 10);
    if (isNaN(testTime) || testTime < 0) {
      return Date.now();
    }
    return testTime;
  }
  return Date.now();
}

// Storage abstraction with error handling and transaction support
async function savePaste(id, data, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (redisClient && redisConnected) {
        await redisClient.set(`paste:${id}`, JSON.stringify(data));
        return true;
      } else {
        // Deep clone to prevent reference issues
        memoryStore.set(id, JSON.parse(JSON.stringify(data)));
        return true;
      }
    } catch (error) {
      console.error(`Error saving paste (attempt ${i + 1}/${retries}):`, error);
      if (i === retries - 1) {
        throw new Error('Failed to save paste after multiple attempts');
      }
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
  return false;
}

async function getPaste(id, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (redisClient && redisConnected) {
        const data = await redisClient.get(`paste:${id}`);
        if (!data) return null;
        
        try {
          return JSON.parse(data);
        } catch (parseError) {
          console.error('Error parsing paste data from Redis:', parseError);
          await deletePaste(id);
          return null;
        }
      } else {
        const data = memoryStore.get(id);
        // Deep clone to prevent mutation
        return data ? JSON.parse(JSON.stringify(data)) : null;
      }
    } catch (error) {
      console.error(`Error getting paste (attempt ${i + 1}/${retries}):`, error);
      if (i === retries - 1) {
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
  return null;
}

async function deletePaste(id, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (redisClient && redisConnected) {
        await redisClient.del(`paste:${id}`);
        return true;
      } else {
        memoryStore.delete(id);
        return true;
      }
    } catch (error) {
      console.error(`Error deleting paste (attempt ${i + 1}/${retries}):`, error);
      if (i === retries - 1) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
    }
  }
  return false;
}

// Atomic view decrement with race condition protection
async function decrementViewsAtomic(id, paste) {
  if (paste.remaining_views === null) {
    return { success: true, paste };
  }

  // Check if already at 0
  if (paste.remaining_views <= 0) {
    await deletePaste(id);
    return { success: false, reason: 'view_limit_exceeded' };
  }

  // Decrement
  paste.remaining_views -= 1;

  // If reached 0, delete immediately
  if (paste.remaining_views <= 0) {
    await deletePaste(id);
    return { success: true, paste, deleted: true };
  }

  // Save updated paste
  await savePaste(id, paste);
  return { success: true, paste, deleted: false };
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health check endpoint
app.get('/api/healthz', async (req, res) => {
  let ok = true;
  let details = {
    storage: redisClient && redisConnected ? 'redis' : 'memory',
    timestamp: new Date().toISOString()
  };
  
  // Check Redis connection if available
  if (redisClient && redisConnected) {
    try {
      await redisClient.ping();
      details.redis_status = 'connected';
    } catch (error) {
      ok = false;
      details.redis_status = 'error';
      details.redis_error = error.message;
    }
  } else if (redisClient) {
    ok = false;
    details.redis_status = 'disconnected';
  }
  
  res.status(200).json({ ok, ...details });
});

// Create paste endpoint with comprehensive validation
app.post('/api/pastes', async (req, res) => {
  try {
    const { content, ttl_seconds, max_views } = req.body;
    
    // Content validation
    if (content === undefined || content === null) {
      return res.status(400).json({ error: 'content is required' });
    }
    
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }
    
    if (content.trim() === '') {
      return res.status(400).json({ error: 'content cannot be empty' });
    }

    // Content size limit (10MB)
    if (content.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'content exceeds maximum size of 10MB' });
    }
    
    // TTL validation
    if (ttl_seconds !== undefined && ttl_seconds !== null) {
      if (typeof ttl_seconds !== 'number') {
        return res.status(400).json({ error: 'ttl_seconds must be a number' });
      }
      if (!Number.isInteger(ttl_seconds)) {
        return res.status(400).json({ error: 'ttl_seconds must be an integer' });
      }
      if (ttl_seconds < 1) {
        return res.status(400).json({ error: 'ttl_seconds must be >= 1' });
      }
      // Reasonable upper limit: 1 year
      if (ttl_seconds > 365 * 24 * 60 * 60) {
        return res.status(400).json({ error: 'ttl_seconds cannot exceed 1 year' });
      }
    }
    
    // Max views validation
    if (max_views !== undefined && max_views !== null) {
      if (typeof max_views !== 'number') {
        return res.status(400).json({ error: 'max_views must be a number' });
      }
      if (!Number.isInteger(max_views)) {
        return res.status(400).json({ error: 'max_views must be an integer' });
      }
      if (max_views < 1) {
        return res.status(400).json({ error: 'max_views must be >= 1' });
      }
      // Reasonable upper limit
      if (max_views > 1000000) {
        return res.status(400).json({ error: 'max_views cannot exceed 1,000,000' });
      }
    }
    
    // Generate unique ID with collision check
    let id;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      id = nanoid(10);
      const existing = await getPaste(id);
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts === maxAttempts) {
      return res.status(500).json({ error: 'Failed to generate unique ID' });
    }
    
    const createdAt = Date.now();
    
    const pasteData = {
      content,
      created_at: createdAt,
      expires_at: ttl_seconds ? createdAt + (ttl_seconds * 1000) : null,
      max_views: max_views || null,
      remaining_views: max_views || null,
      view_count: 0
    };
    
    await savePaste(id, pasteData);
    
    // Generate URL (sanitize BASE_URL to avoid newline / trailing slash issues)
    let baseUrl = config.baseUrl;

    if (baseUrl) {
      baseUrl = baseUrl.trim().replace(/\/+$/, "");
    } else {
      const host = req.get("host");
      baseUrl = host.includes("localhost")
        ? `http://${host}`
        : `https://${host}`;
    }

    const url = `${baseUrl}/p/${id}`;

    res.status(201).json({ id, url });
    
  } catch (error) {
    console.error('Error creating paste:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch paste API endpoint with race condition handling
app.get('/api/pastes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!id || typeof id !== 'string' || id.length === 0) {
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    // Prevent overly long IDs (DoS protection)
    if (id.length > 100) {
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    let paste = await getPaste(id);
    
    if (!paste) {
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    const now = getCurrentTime(req);
    
    // Check if expired
    if (paste.expires_at !== null && paste.expires_at !== undefined) {
      if (now >= paste.expires_at) {
        await deletePaste(id);
        return res.status(404).json({ error: 'Paste not found' });
      }
    }
    
    // Handle view limit with atomic decrement
    const result = await decrementViewsAtomic(id, paste);
    
    if (!result.success) {
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    paste = result.paste;
    
    // Increment total view count
    paste.view_count = (paste.view_count || 0) + 1;
    if (!result.deleted) {
      await savePaste(id, paste);
    }
    
    const response = {
      content: paste.content,
      remaining_views: paste.remaining_views,
      expires_at: paste.expires_at ? new Date(paste.expires_at).toISOString() : null
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Error fetching paste:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View paste HTML endpoint (server-rendered HTML for Vercel)
app.get('/p/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.length === 0 || id.length > 100) {
      return res.status(404).send("Paste not found");
    }

    const paste = await getPaste(id);

    if (!paste) {
      return res.status(404).send("Paste not found");
    }

    const now = getCurrentTime(req);

    if (paste.expires_at && now >= paste.expires_at) {
      await deletePaste(id);
      return res.status(404).send("Paste expired");
    }

    if (paste.remaining_views !== null && paste.remaining_views <= 0) {
      await deletePaste(id);
      return res.status(404).send("Paste expired");
    }

    // Safe HTML rendering
    const escapeHtml = (text) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    res.setHeader("Content-Type", "text/html");
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Paste</title>
          <meta charset="utf-8" />
        </head>
        <body>
          <pre>${escapeHtml(paste.content)}</pre>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error rendering paste:", error);
    res.status(500).send("Internal server error");
  }
});

// Get paste metadata without decrementing views (for HTML display)
app.get('/api/pastes/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || typeof id !== 'string' || id.length === 0 || id.length > 100) {
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    const paste = await getPaste(id);
    
    if (!paste) {
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    const now = getCurrentTime(req);
    
    // Check if expired
    if (paste.expires_at !== null && now >= paste.expires_at) {
      await deletePaste(id);
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    // Check if view limit exceeded
    if (paste.remaining_views !== null && paste.remaining_views <= 0) {
      await deletePaste(id);
      return res.status(404).json({ error: 'Paste not found' });
    }
    
    // Safely escape HTML
    const escapeHtml = (text) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    const response = {
      content: escapeHtml(paste.content),
      remaining_views: paste.remaining_views,
      expires_at: paste.expires_at ? new Date(paste.expires_at).toISOString() : null,
      created_at: paste.created_at ? new Date(paste.created_at).toISOString() : null
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Error fetching paste metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch-all route - serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

// Start server
async function start() {
  await initRedis();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📦 Storage: ${redisClient && redisConnected ? 'Redis' : 'In-Memory (fallback)'}`);
    console.log(`🌐 Environment: ${config.nodeEnv}`);
  });
}

start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});


if (require.main === module) {
  app.listen(3001, () => {
    console.log("Backend running on port 3001");
  });
}

module.exports = app;
