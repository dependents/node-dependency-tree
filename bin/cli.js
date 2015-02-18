#!/usr/bin/env node

'use strict';

var dependencyTree = require('../');
var filename = process.argv[2];
var root = process.argv[3];

var tree = dependencyTree(filename, root);

console.log('Pre-Order:');
dependencyTree.traversePreOrder(tree).forEach(function(node) {
  console.log(node);
});

console.log('\nPost-Order:');
dependencyTree.traversePostOrder(tree).forEach(function(node) {
  console.log(node);
});
