// .eslintrc.cjs – ESLint configuration for LearnSphere project
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: false,
  },
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended"
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    "no-undef": "error",
    // Additional rules can be added as needed
  },
};
