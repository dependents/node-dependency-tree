#!/usr/bin/env node

'use strict';

var treeAsList = require('../');
var filename = process.argv[2];
var root = process.argv[3];

var tree = treeAsList(filename, root);

tree.forEach(function(node) {
  console.log(node);
});
