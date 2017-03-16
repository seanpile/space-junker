module.exports = {
  "extends": "airbnb",
  "env": {
    "browser": true,
  },
  "globals": {
    "window": true,
    "document": true,
  },
  "rules": {
    "no-underscore-dangle": "off",
    "no-unused-expressions": ["error", { "allowShortCircuit": true }]
  }
}
