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
      branches: 4,
      functions: 5,
      lines: 5,
      statements: 5
    }
  }
};