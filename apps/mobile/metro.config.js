const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 */
const config = {
  projectRoot: __dirname,
  resolver: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@screens': path.resolve(__dirname, 'src/screens'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@navigation': path.resolve(__dirname, 'src/navigation'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
    platforms: ['ios', 'android', 'native', 'web'],
  },
  watchFolders: [
    path.resolve(__dirname, 'src'),
    path.resolve(__dirname, 'node_modules'),
  ],
  server: {
    port: 8081,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);