#!/usr/bin/env node

'use strict';

var treeAsList = require('../').getTreeAsList,
    filename = process.argv[2],
    root = process.argv[3];

treeAsList(filename, root).then(function(tree) {
  tree.forEach(function(node) {
    console.log(node);
  });
});
