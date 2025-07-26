/* eslint-disable */
export default {
  displayName: 'mobile',
  preset: 'react-native',
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapping: {
    '\\.svg$': '@nx/react-native/plugins/jest/svg-mock',
  },
  transform: {
    '^.+\\.(js|ts|tsx)$': [
      'babel-jest',
      {
        cwd: __dirname,
        configFile: './babel.config.js',
      },
    ],
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': 'jest-transform-stub',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(js|ts|tsx)',
    '<rootDir>/src/**/*.(test|spec).(js|ts|tsx)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/**/__tests__/**/*',
    '!src/**/*.test.*',
    '!src/**/*.spec.*',
  ],
  coverageReporters: ['html', 'text', 'text-summary', 'cobertura'],
  snapshotSerializers: ['@relmify/jest-serializer-strip-ansi'],
  testEnvironment: 'jsdom',
};