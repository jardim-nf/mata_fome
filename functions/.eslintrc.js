module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    'no-restricted-globals': ['error', 'firebase', 'XMLHttpRequest'],
    'no-unused-vars': 'off',
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
  },
};