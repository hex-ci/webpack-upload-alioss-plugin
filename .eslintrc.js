module.exports = {
  root: true,
  parserOptions: {
    parser: '@babel/eslint-parser',
    sourceType: 'module',
    ecmaVersion: 2020
  },
  env: {
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  rules: {
    'no-empty': [2, { 'allowEmptyCatch': true }],
    'indent': ['warn', 2, { 'SwitchCase': 1 }]
  }
}
