# Meat Reception App

## Quick Start

1. Make the installation script executable:
   ```bash
   chmod +x install-and-build.sh
   ```

2. Run the installation and build script:
   ```bash
   ./install-and-build.sh
   ```

## Manual Steps

If the script doesn't work, run these commands manually:

```bash
cd "/Users/josedasilva/Dropbox/Mi Mac (MacBook-Air-de-Jose.local)/Desktop/CURAÇAO/recepcionapp/recepcion-app/expo-meat-app"

# Install dependencies
npm install

# Create assets directory
mkdir -p assets

# Initialize EAS project
npx eas project:init --id c97dc0fd-5ae9-40ea-9089-c7d5f8b95c52

# Build for iOS
npx eas build --platform ios --profile development
```

## Features

- User authentication with offline capability
- Weight registration with camera simulation
- Offline data storage and synchronization
- Works with your existing Flask API at 192.168.50.232:8080

## Test Users

- **Operador 1**: username: `operador1`, password: `password123`
- **Operador 2**: username: `operador2`, password: `password123`  
- **Supervisor**: username: `supervisor`, password: `admin123`

## Installation on iPhone

After the build completes:

1. Check the EAS dashboard or terminal output for the download URL
2. Open the URL on your iPhone
3. Install the development build
4. The app will connect to your local API server

## Troubleshooting

- Make sure your Flask API is running on 192.168.50.232:8080
- Ensure your iPhone and development machine are on the same network
- If you encounter build issues, check the EAS dashboard for detailed logs