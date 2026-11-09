import baseConfig from '../test/jest.config.js'

export default {
  ...baseConfig,
  // the throat's own workshop has its own tests
  testPathIgnorePatterns: ['/node_modules/', '/.chimera/'],
  modulePathIgnorePatterns: ['/.chimera/'],
}
