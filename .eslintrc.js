module.exports = {
  extends: 'airbnb',
  settings: {
    'import/resolver': {
      webpack: {
        config: 'webpack.config.js',
      },
    },
  },
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
    allowImportExportEverywhere: true,
  },
  env: {
    browser: true,
    es6: true,
  },
  globals: {
    window: true,
    document: true,
  },
  plugins: [
    'nodeca',
  ],
  rules: {
    'no-underscore-dangle': 'off',
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
    }],
    'no-param-reassign': ['error', {
      props: false,
    }],
    'brace-style': ['error', '1tbs', {
      allowSingleLine: false,
    }],
    'object-curly-newline': ['error', {
      minProperties: 1,
    }],
    'one-var-declaration-per-line': ['error', 'initializations'],
    'one-var': ['error', {
      initialized: 'never',
    }],

    'padded-blocks': ['error', {
      classes: 'always',
    }],
    'nodeca/indent': 2,
  },
};
