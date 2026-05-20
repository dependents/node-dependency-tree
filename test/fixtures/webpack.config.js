'use strict';

const path = require('path');

module.exports = {
  entry: './index.js',
  resolve: {
    alias: {
      F: './node_modules/filing-cabinet',
      '@': path.resolve(__dirname, 'webpack/src'),
    }
  }
};
