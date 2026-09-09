module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.(js|jsx)$': 'babel-jest' },
  testMatch: ['**/*.test.{js,jsx}'],
  moduleNameMapper: { '\\.css$': '<rootDir>/src/test/styleMock.cjs' },
};