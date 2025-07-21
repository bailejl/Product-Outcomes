const nxPreset = require('@nx/jest/preset').default

module.exports = {
  ...nxPreset,
  testEnvironment: 'node',
  coverageReporters: ['html', 'text', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,ts}',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
}
