#!/usr/bin/env node

'use strict';

var dependencyTree = require('../');
var program = require('commander');

program
  .version(require('../package.json').version)
  .usage('[options] <filename>')
  .option('-d, --directory <path>', 'location of files of supported filetypes')
  .option('--list-form', 'output the list form of the tree (one element per line)')
  .parse(process.argv);

var directory = program.directory;
var listForm = program.listForm;
var filename = program.args[0];

var tree;

if (listForm) {
  tree = dependencyTree.toList(filename, directory);
  tree.forEach(function(node) {
    console.log(node);
  });

} else {
  tree = dependencyTree(filename, directory);
  console.log(JSON.stringify(tree));
}
