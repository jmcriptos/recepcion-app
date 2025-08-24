# 🚀 Deploy Meat Reception Scanner

## One-Click Deploy to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/jmcriptos/recepcion-app/tree/main)

## Manual Deployment

### 1. Clone and setup
```bash
git clone https://github.com/jmcriptos/recepcion-app.git
cd recepcion-app/apps/web
```

### 2. Deploy to Heroku
```bash
# Login to Heroku
heroku login

# Create app (or use existing)
heroku create your-app-name

# Deploy
git subtree push --prefix=apps/web heroku main

# Or connect via GitHub in Heroku Dashboard
```

### 3. Access your app
- Your app will be available at: `https://your-app-name.herokuapp.com`
- Camera scanning works on mobile devices
- No additional configuration needed

## Features
- 📱 Mobile camera scanning for weight labels  
- 🔐 Role-based authentication
- 📊 Real-time dashboard
- 📋 Registration management
- 🖼️ Image upload with OCR simulation
- 🌐 Production-ready deployment