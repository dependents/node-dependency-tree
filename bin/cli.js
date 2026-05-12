#!/usr/bin/env node

import process from 'node:process';
import { stringifyChunked } from '@discoveryjs/json-ext';
import { program } from 'commander';
import dependencyTree from '../index.js';
import pkg from '../package.json' with { type: 'json' };

const { name, description, version } = pkg;

program
  .name(name)
  .description(description)
  .version(version)
  .argument('<filename>', 'the path to file to examine')
  .usage('[options] <filename>')
  .option('-d, --directory <path>', 'location of files of supported filetypes')
  .option('-c, --require-config <path>', 'path to a requirejs config')
  .option('-w, --webpack-config <path>', 'path to a webpack config')
  .option('-t, --ts-config <path>', 'path to a typescript config')
  .option('--es6-mixed-imports', 'detect dependencies from files that mix ES6 imports and CJS require() calls')
  .option('--list-form', 'output the list form of the tree (one element per line)')
  .showHelpAfterError()
  .parse();

const cliOptions = program.opts();
const options = {
  filename: program.args[0],
  root: cliOptions.directory,
  config: cliOptions.requireConfig,
  webpackConfig: cliOptions.webpackConfig,
  tsConfig: cliOptions.tsConfig,
  detective: {
    es6: {
      mixedImports: Boolean(cliOptions.es6MixedImports)
    }
  }
};

if (cliOptions.listForm) {
  const tree = dependencyTree.toList(options);

  for (const node of tree) {
    console.log(node);
  }
} else {
  const tree = dependencyTree(options);

  for (const chunk of stringifyChunked(tree)) {
    process.stdout.write(chunk);
  }

  process.stdout.write('\n');
}
