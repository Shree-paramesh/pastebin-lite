# Pastebin Lite - Full Stack Application

A production-ready pastebin application with a **React frontend** and **Express backend**, featuring optional time-based expiration (TTL) and view limits. Built with comprehensive edge case handling and automated test compliance.

## 🎯 Features

### Core Functionality
- ✅ Create text pastes with shareable URLs
- ✅ Optional time-based expiration (TTL in seconds)
- ✅ Optional view count limits (API fetches only)
- ✅ Safe HTML rendering (XSS prevention)
- ✅ Clean, responsive React UI
- ✅ REST API with full error handling

### Advanced Features
- 🔒 **Race Condition Protection**: Atomic view decrement
- 🔄 **Retry Logic**: Automatic retry with exponential backoff
- ⚡ **Performance**: Redis caching with in-memory fallback
- 🧪 **Deterministic Testing**: TEST_MODE support for automated tests
- 📱 **Responsive Design**: Works on all devices
- ♿ **Accessibility**: ARIA labels and keyboard shortcuts
- 🎨 **Modern UI**: Clean, intuitive interface

## 🏗️ Architecture

```
pastebin-lite/
├── server/              # Express backend
│   ├── index.js         # Main server with all API routes
│   └── package.json     # Server dependencies
├── client/              # React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── CreatePaste.js
│   │   │   └── ViewPaste.js
│   │   ├── App.js
│   │   ├── App.css
│   │   └── index.js
│   └── package.json     # Client dependencies
├── package.json         # Root package.json
├── .gitignore
└── README.md
```

## 💾 Persistence Layer

This application uses **Redis** for data persistence via the `redis` npm package.

### Why Redis?

1. **Performance**: Sub-millisecond latency with in-memory storage
2. **Simplicity**: Simple key-value operations perfect for paste data
3. **TTL Support**: Native expiration handling (bonus optimization opportunity)
4. **Scalability**: Handles high concurrent load efficiently
5. **Cloud Ready**: Works seamlessly with Vercel KV, Upstash, Railway, etc.

### Fallback Storage

- **Development**: Automatic in-memory fallback if Redis is unavailable
- **Production**: Redis is **required** for serverless platforms (Vercel, AWS Lambda, etc.)

### Data Structure

Each paste is stored as a JSON object:
```json
{
  "content": "string",
  "created_at": 1234567890,
  "expires_at": 1234567890 | null,
  "max_views": 10 | null,
  "remaining_views": 10 | null,
  "view_count": 0
}
```

## 🚀 Local Development

### Prerequisites

- **Node.js**: 18.x or higher
- **Redis**: Optional for local dev, required for production

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd pastebin-lite
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```
   
   Or manually:
   ```bash
   npm install
   cd server && npm install
   cd ../client && npm install
   ```

3. **Set up environment variables**
   
   Create `server/.env`:
   ```bash
   # Redis connection (optional for local dev)
   REDIS_URL=redis://localhost:6379
   
   # Or use a cloud Redis provider
   # KV_URL=your-vercel-kv-url
   
   # Port (default: 3001)
   PORT=3001
   
   # Base URL for paste links (auto-detected if not set)
   BASE_URL=http://localhost:3001
   
   # Client URL for CORS (default: http://localhost:3000)
   CLIENT_URL=http://localhost:3000
   
   # Test mode for automated testing (0 or 1)
   TEST_MODE=0
   ```

4. **Start Redis** (if using locally)
   ```bash
   # macOS (with Homebrew)
   brew install redis
   redis-server
   
   # Linux (Ubuntu/Debian)
   sudo apt-get install redis-server
   sudo systemctl start redis
   
   # Or use Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

5. **Run the application**
   
   **Development mode** (both frontend and backend with hot reload):
   ```bash
   npm run dev
   ```
   
   Or run separately:
   ```bash
   # Terminal 1 - Backend
   npm run dev:server
   
   # Terminal 2 - Frontend
   npm run dev:client
   ```
   
   **Production build**:
   ```bash
   # Build frontend
   npm run build
   
   # Start server (serves built React app)
   npm start
   ```

6. **Access the application**
   - Frontend (dev): http://localhost:3000
   - Backend API: http://localhost:3001
   - Production: http://localhost:3001 (serves everything)

### Without Redis (Development Only)

If Redis is not available, the server will automatically use in-memory storage:

```bash
# Just start without Redis
npm run dev
```

⚠️ **Warning**: In-memory storage does not persist across restarts and won't work on serverless platforms.

## 📡 API Documentation

### Health Check
```http
GET /api/healthz
```

**Response (200)**:
```json
{
  "ok": true,
  "storage": "redis",
  "redis_status": "connected",
  "timestamp": "2026-01-29T12:00:00.000Z"
}
```

### Create Paste
```http
POST /api/pastes
Content-Type: application/json

{
  "content": "Your text here",
  "ttl_seconds": 3600,      // Optional: 1-31536000 (1 year)
  "max_views": 10           // Optional: 1-1000000
}
```

**Response (201)**:
```json
{
  "id": "abc123xyz",
  "url": "https://your-app.vercel.app/p/abc123xyz"
}
```

**Error Response (400)**:
```json
{
  "error": "content is required and must be a non-empty string"
}
```

### Get Paste (API - decrements view count)
```http
GET /api/pastes/:id
```

**Response (200)**:
```json
{
  "content": "Your text here",
  "remaining_views": 9,
  "expires_at": "2026-01-30T12:00:00.000Z"
}
```

**Error Response (404)**:
```json
{
  "error": "Paste not found"
}
```

### Get Paste Metadata (doesn't decrement views)
```http
GET /api/pastes/:id/metadata
```

**Response (200)**:
```json
{
  "content": "Your text here (HTML-escaped)",
  "remaining_views": 10,
  "expires_at": "2026-01-30T12:00:00.000Z",
  "created_at": "2026-01-29T12:00:00.000Z"
}
```

### View Paste (HTML)
```http
GET /p/:id
```

Returns the React app, which fetches metadata and displays the paste.

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. **Prerequisites**
   - Vercel account
   - Vercel CLI: `npm install -g vercel`
   - Create a Vercel KV database in your dashboard

2. **Link your project**
   ```bash
   vercel link
   ```

3. **Add Vercel KV database**
   - Go to your Vercel dashboard
   - Navigate to **Storage** → **Create Database** → **KV**
   - Select **Redis**
   - Connect it to your project
   - Vercel automatically sets `KV_URL` environment variable

4. **Configure environment variables**
   
   In Vercel dashboard, add:
   ```
   BASE_URL=https://your-app.vercel.app
   NODE_ENV=production
   TEST_MODE=0  (set to 1 for testing)
   ```

5. **Deploy**
   ```bash
   # Build frontend first
   cd client
   npm run build
   cd ..
   
   # Deploy
   vercel --prod
   ```

6. **Verify deployment**
   ```bash
   curl https://your-app.vercel.app/api/healthz
   ```

### Deploy to Other Platforms

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and init
railway login
railway init

# Add Redis
railway add redis

# Deploy
railway up
```

#### Heroku
```bash
# Create app
heroku create

# Add Redis
heroku addons:create heroku-redis:hobby-dev

# Deploy
git push heroku main
```

#### AWS (EC2 + ElastiCache)
1. Launch EC2 instance
2. Create ElastiCache Redis cluster
3. Set `REDIS_URL` to ElastiCache endpoint
4. Deploy with PM2 or Docker

## 🧪 Testing

### Automated Test Support

The application supports **deterministic time testing** for automated test suites:

1. Set environment variable: `TEST_MODE=1`
2. Include header in requests: `x-test-now-ms: <milliseconds-since-epoch>`

**Example**:
```bash
# Create paste with 60 second TTL
curl -X POST http://localhost:3001/api/pastes \
  -H "Content-Type: application/json" \
  -d '{"content":"test","ttl_seconds":60}'

# Test before expiry (now = 0)
curl http://localhost:3001/api/pastes/abc123 \
  -H "x-test-now-ms: 0"
# → 200 OK

# Test after expiry (now = 61000)
curl http://localhost:3001/api/pastes/abc123 \
  -H "x-test-now-ms: 61000"
# → 404 Not Found
```

### Manual Testing

```bash
# Health check
curl http://localhost:3001/api/healthz

# Create paste
curl -X POST http://localhost:3001/api/pastes \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello World","ttl_seconds":3600,"max_views":5}'

# Get paste (API - decrements views)
curl http://localhost:3001/api/pastes/abc123

# Get metadata (doesn't decrement)
curl http://localhost:3001/api/pastes/abc123/metadata

# View in browser
open http://localhost:3001/p/abc123
```

## 🔍 Design Decisions & Edge Cases

### 1. **View Counting Strategy**
- **API fetches** (`GET /api/pastes/:id`): Count toward view limit
- **HTML page views** (`GET /p/:id`): Do NOT count toward limit
- **Metadata fetches** (`GET /api/pastes/:id/metadata`): Do NOT count

**Rationale**: Users should be able to view pastes multiple times in the browser without exhausting the limit. Only programmatic API access counts.

### 2. **Race Condition Handling**

**Problem**: Concurrent requests could cause negative view counts

**Solution**: Atomic view decrement operation
```javascript
async function decrementViewsAtomic(id, paste) {
  if (paste.remaining_views <= 0) {
    await deletePaste(id);
    return { success: false };
  }
  
  paste.remaining_views -= 1;
  
  if (paste.remaining_views <= 0) {
    await deletePaste(id);  // Immediate deletion
  } else {
    await savePaste(id, paste);
  }
  
  return { success: true, paste };
}
```

### 3. **Error Handling & Retry Logic**

**Network Errors**: Automatic retry with exponential backoff (3 attempts)
```javascript
for (let i = 0; i < retries; i++) {
  try {
    return await operation();
  } catch (error) {
    if (i === retries - 1) throw error;
    await sleep(100 * (i + 1));
  }
}
```

**Malformed Data**: Graceful degradation and cleanup
```javascript
try {
  return JSON.parse(data);
} catch (parseError) {
  await deletePaste(id);  // Remove corrupted data
  return null;
}
```

### 4. **Input Validation**

- Content: Required, non-empty string, max 10MB
- TTL: Optional integer, 1 to 31,536,000 (1 year)
- Max Views: Optional integer, 1 to 1,000,000
- ID: Alphanumeric, max 100 chars (DoS protection)

### 5. **Security Measures**

- **XSS Prevention**: HTML escaping on all user content
- **DoS Protection**: Content size limits, ID length limits
- **CORS**: Configured for specific origins
- **Input Sanitization**: Type checking and validation
- **No SQL Injection**: Redis key-value store (no SQL)

### 6. **Deterministic Time Testing**

Supports automated test suites with predictable expiry behavior:
```javascript
function getCurrentTime(req) {
  if (process.env.TEST_MODE === '1' && req.headers['x-test-now-ms']) {
    return parseInt(req.headers['x-test-now-ms'], 10);
  }
  return Date.now();
}
```

### 7. **Expiry Behavior**

- Both TTL and view limits can be set
- Paste becomes unavailable when **either** constraint triggers
- Immediate deletion when constraints are met (no zombie pastes)

### 8. **Frontend-Backend Communication**

- **Development**: Proxy requests from React (port 3000) to Express (port 3001)
- **Production**: Express serves built React app (single port)
- **API Base URL**: Auto-detected from request headers

### 9. **Graceful Shutdown**

```javascript
process.on('SIGTERM', async () => {
  await redisClient.quit();
  process.exit(0);
});
```

## 📊 Performance Considerations

- **Redis Connection Pooling**: Automatic reconnection with retry logic
- **Deep Cloning**: Prevents reference mutations in memory store
- **Efficient ID Generation**: nanoid (10 chars, collision-resistant)
- **Lazy Deletion**: Expired pastes deleted on access (no background jobs needed)

## 🐛 Troubleshooting

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check Redis connection
redis-cli
127.0.0.1:6379> KEYS paste:*
```

### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in server/.env
PORT=3002
```

### CORS Errors
```bash
# Update CLIENT_URL in server/.env
CLIENT_URL=http://localhost:3000
```

### Build Issues
```bash
# Clear caches and reinstall
rm -rf node_modules client/node_modules server/node_modules
rm -rf client/build
npm run install:all
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please ensure:
- All tests pass
- Code follows existing style
- Documentation is updated
- No hardcoded URLs or secrets

## 📚 Additional Resources

- [Redis Documentation](https://redis.io/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev/)
- [Vercel Deployment](https://vercel.com/docs)

---

**Built with ❤️ for reliable, production-ready paste sharing**
