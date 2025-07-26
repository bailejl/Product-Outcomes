const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration for React Native
 * https://facebook.github.io/metro/docs/configuration
 */
const config = {
  watchFolders: [
    // Add the workspace root to watch folders for cross-platform sharing
    path.resolve(__dirname, '../../'),
  ],
  resolver: {
    // Ensure we can resolve shared libraries from the workspace
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../../node_modules'),
    ],
    alias: {
      // Shared libraries aliases
      '@shared': path.resolve(__dirname, '../../shared'),
      '@libs': path.resolve(__dirname, '../../libs'),
    },
    platforms: ['ios', 'android', 'native', 'web'],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);