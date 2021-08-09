/** 
 * @type {import('@jest/types').Config.InitialOptions}
 * @type {import('ts-jest/dist/types').InitialOptionsTsJest} 
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  verbose: true,
  moduleFileExtensions: ['ts', 'js'],
  globals: {
    'ts-jest': {
      compiler: 'typescript',
      tsconfig: '<rootDir>/tsconfig.json',
      isolatedModules: false,
      astTransformers: {
        before: ['ts-jest/dist/transformers/path-mapping'],
      },
      babelConfig: true,
    }
  },
  collectCoverage: true,
  coverageDirectory: '.coverage/frontend',
  coverageReporters: ['json', 'text-summary'],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10
    }
  }
};