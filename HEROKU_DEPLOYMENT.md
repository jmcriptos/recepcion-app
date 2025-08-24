# Heroku Deployment Configuration

This document provides step-by-step instructions for configuring the Heroku application and completing the deployment setup.

## Prerequisites
- Heroku CLI installed and authenticated
- Git repository connected to GitHub
- GitHub repository secrets configured

## 1. Create Heroku Application

```bash
# Create Heroku app
heroku create your-app-name

# Add to git remote
heroku git:remote -a your-app-name
```

## 2. Add Required Addons

```bash
# Add PostgreSQL addon
heroku addons:create heroku-postgresql:essential-0

# Add Redis addon for session storage
heroku addons:create heroku-redis:mini

# Add Cloudinary addon for image storage
heroku addons:create cloudinary:starter
```

## 3. Configure Environment Variables

```bash
# Generate and set SECRET_KEY
heroku config:set SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')

# Set production log level
heroku config:set LOG_LEVEL=INFO

# Set testing flag
heroku config:set TESTING=false

# Optional: Add Google Vision API key for OCR fallback
heroku config:set GOOGLE_VISION_API_KEY=your-api-key
```

## 4. Configure GitHub Actions Secrets

In your GitHub repository settings, add these secrets:

- `HEROKU_API_KEY`: Your Heroku API key
- `HEROKU_APP_NAME`: Your Heroku app name
- `HEROKU_EMAIL`: Your Heroku account email

## 5. Initial Deployment

```bash
# Push to deploy
git push heroku main

# Run database migrations
heroku run "cd src && flask db upgrade"

# Verify deployment
curl https://your-app-name.herokuapp.com/health
```

## 6. Seed Production Database (Optional)

```bash
# Run seed commands
heroku run "cd src && flask seed-users-only"
```

## Health Check Verification

The application includes a health check endpoint at `/health` that:
- Returns HTTP 200 when healthy, 503 when unhealthy
- Tests database connectivity
- Provides system status and timestamp

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-20T10:19:45.755768Z",
  "database_connected": true
}
```

## Automatic Deployment

Once configured, the GitHub Actions workflows will:
1. Run tests on every push/PR
2. Automatically deploy to Heroku when tests pass on main branch
3. Validate deployment with health check after deployment

## Troubleshooting

- Check `heroku logs --tail` for deployment issues
- Verify all environment variables: `heroku config`
- Test database connectivity: `heroku run "cd src && flask db upgrade"`
- Monitor addon status: `heroku addons`