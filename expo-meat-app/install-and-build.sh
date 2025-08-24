#!/bin/bash

# Navigate to the project directory
cd "/Users/josedasilva/Dropbox/Mi Mac (MacBook-Air-de-Jose.local)/Desktop/CURAÇAO/recepcionapp/recepcion-app/expo-meat-app"

echo "Installing dependencies..."
npm install

echo "Creating assets directory..."
mkdir -p assets

echo "Initializing EAS project (if needed)..."
npx eas project:init --id c97dc0fd-5ae9-40ea-9089-c7d5f8b95c52

echo "Starting EAS build for iOS development..."
npx eas build --platform ios --profile development --non-interactive

echo "Build complete! Check the EAS dashboard for the download link."