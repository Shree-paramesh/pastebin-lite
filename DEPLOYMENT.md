# Vercel Deployment Guide for Pastebin Lite

## Prerequisites
- A Vercel account (free at https://vercel.com)
- Git installed
- Your Upstash Redis credentials

## Deployment Steps

### 1. Push Code to GitHub
```bash
# Initialize git repo (if not already done)
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git push origin main
```

### 2. Create Vercel Project
1. Go to https://vercel.com and sign in
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Select the root folder where `vercel.json` is located
5. Click "Deploy"

### 3. Set Environment Variables in Vercel
After the first deployment fails (expected - no env vars), go to:
**Settings → Environment Variables** and add:

```
UPSTASH_REDIS_REST_URL = https://expert-swan-61155.upstash.io
UPSTASH_REDIS_REST_TOKEN = Ae7jAAIncDFkYzYyNDhlOThmN2Q0YjQ0OWVhOWQ1OWNjOTA1ZDRmN3AxNjExNTU
CLIENT_URL = https://your-vercel-domain.vercel.app
BASE_URL = https://your-vercel-domain.vercel.app
NODE_ENV = production
```

### 4. Redeploy
In Vercel dashboard, click "Redeploy" or push a commit to trigger deployment.

## Configuration Files

### `vercel.json`
- Defines build configuration for server (Node.js) and client (React build)
- Maps routes to appropriate handlers
- Sets environment variables

### `server/config.js`
- Centralizes all configuration
- Reads from environment variables with fallbacks
- Includes your Upstash credentials

### `.env.example`
- Template for local development environment variables
- Copy to `.env.local` for local testing

## Local Development

### Setup
```bash
npm run install:all
```

### Start Development Servers
```bash
npm run dev
```
- Server runs on `http://localhost:3001`
- Client runs on `http://localhost:3000`

### Build for Production
```bash
npm run build
```

## Testing Deployed App

1. Visit your Vercel domain
2. Create a paste using the frontend
3. Share the generated `/p/:id` link
4. Verify paste loads and view counts decrement correctly

## Troubleshooting

### Deployment Fails with "Cannot find module"
- Ensure `server/config.js` is in the repository
- Check that all dependencies are in `package.json` files

### Redis Connection Errors
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel environment
- Test credentials at https://console.upstash.io

### CORS Errors
- Set `CLIENT_URL` to your Vercel domain in environment variables
- Ensure it matches the domain you're visiting from

### Paste Links Show 404
- Check that `BASE_URL` environment variable is set to your domain
- Verify the paste was created successfully via API

## API Endpoints

After deployment, your API is available at:

- **Create Paste**: `POST /api/pastes`
  ```json
  {
    "content": "Your paste content",
    "ttl_seconds": 3600,
    "max_views": 5
  }
  ```

- **Fetch Paste**: `GET /api/pastes/:id`

- **Health Check**: `GET /api/healthz`

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Review `server/index.js` comments for API details
3. See `EDGE_CASES.md` for known limitations
