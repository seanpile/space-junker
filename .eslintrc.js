module.exports = {
  extends: 'airbnb',
  settings: {
    'import/resolver': {
      webpack: {
        config: 'webpack.config.js',
      },
    },
  },
  env: {
    browser: true,
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
    // indent: [
    //   'error',
    //   2,
    //   {
    //     SwitchCase: 1,
    //     VariableDeclarator: {
    //       var: 2,
    //       let: 2,
    //       const: 3,
    //     },
    //     outerIIFEBody: 1,
    //     FunctionDeclaration: {
    //       parameters: 'first',
    //       body: 1,
    //     },
    //     FunctionExpression: {
    //       parameters: 'first',
    //       body: 1,
    //     },
    //     CallExpression: { arguments: 'first' },
    //     ArrayExpression: 'first',
    //     ObjectExpression: 'first',
    //   },
    // ],
    'object-curly-newline': ['error', {
      minProperties: 1,
    }],
    'one-var-declaration-per-line': ['error', 'initializations'],
    'padded-blocks': ['error', {
      classes: 'always',
    }],
    'nodeca/indent': 2,
  },
};
