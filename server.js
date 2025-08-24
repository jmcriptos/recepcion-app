const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from web app dist directory
app.use(express.static(path.join(__dirname, 'apps/web/dist')));

// Enable CORS for camera access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Security headers for camera access
  res.header('Permissions-Policy', 'camera=*, microphone=*');
  res.header('Feature-Policy', 'camera *; microphone *');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    app: 'Meat Reception Web',
    version: '1.0.0'
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'apps/web/dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log('🚀 Meat Reception Web App started!');
  console.log(`📱 Server running on port ${PORT}`);
  console.log('📷 Camera scanning enabled for mobile devices');
  console.log('🌐 Ready for production use!');
});