module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  extends: ['standard', 'plugin:prettier/recommended', 'plugin:node/recommended'],
  parserOptions: {
    ecmaVersion: 2020,
  },
  overrides: [
    {
      files: ['hardhat.config.js'],
      globals: { task: true },
    },
    {
      files: ['scripts/**'],
      rules: {
        'no-process-exit': 'off',
        'node/no-unpublished-require': 'off',
      },
    },
    {
      files: ['test/**'],
      rules: { 'node/no-unpublished-require': 'off' },
    },
  ],
  rules: {
    'prettier/prettier': ['error', { singleQuote: true }],
    'node/no-unsupported-features/es-syntax': [
      'error',
      {
        ignores: ['modules'],
        version: '>=14.0.0',
      },
    ],
  },
};
