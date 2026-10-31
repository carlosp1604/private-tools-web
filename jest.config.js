module.exports = {
  rootDir: '.',
  passWithNoTests: true,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.unit.spec.ts'],
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1',
  },
}
