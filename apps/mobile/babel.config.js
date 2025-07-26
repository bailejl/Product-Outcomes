module.exports = {
  presets: ['@nx/react-native/babel'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    'react-native-reanimated/plugin', // Must be last
  ],
};