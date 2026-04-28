'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { debuglog } = require('node:util');
const cabinet = require('filing-cabinet');
const precinct = require('precinct');
const Config = require('./lib/config.js');

const debug = debuglog('tree');

/**
 * Returns the dependency tree of a module as a nested object
 *
 * @param {Object} options
 * @param {string} options.filename - Entry module path
 * @param {string} options.directory - Root directory containing all files
 * @param {string} [options.requireConfig] - Path to a RequireJS config
 * @param {string} [options.webpackConfig] - Path to a webpack config
 * @param {string} [options.nodeModulesConfig] - Config for resolving node_modules entry files
 * @param {Object} [options.visited] - Memoization cache: filename ? subtree
 * @param {Array}  [options.nonExistent] - Accumulator for unresolvable partials
 * @param {boolean} [options.isListForm=false] - Return a flat list instead of a tree
 * @param {string|Object} [options.tsConfig] - Path to (or preloaded) TypeScript config
 * @param {boolean} [options.noTypeDefinitions] - Resolve TS imports to `*.js` instead of `*.d.ts`
 * @returns {Object}
 */
module.exports = function(options = {}) {
  const config = new Config(options);

  if (!fs.existsSync(config.filename)) {
    debug(`file ${config.filename} does not exist`);
    return config.isListForm ? [] : {};
  }

  const results = traverse(config);
  debug('traversal complete', results);

  dedupeNonExistent(config.nonExistent);
  debug('deduped list of nonExistent partials: ', config.nonExistent);

  let tree;
  if (config.isListForm) {
    debug('list form of results requested');
    tree = [...results];
  } else {
    debug('object form of results requested');
    tree = {};
    tree[config.filename] = results;
  }

  debug('final tree', tree);
  return tree;
};

/**
 * Returns a post-order flat list of absolute file paths (dependencies before dependents).
 * Every file's dependencies appear at lower indices, so the root entry point is last.
 * The list contains no duplicates. Accepts the same options as the default export.
 *
 * @param {Object} options - Same as the default export
 * @returns {Array<string>}
 */
module.exports.toList = function(options = {}) {
  return module.exports({ ...options, isListForm: true });
};

/**
 * Returns resolved dependency paths for the file described by `config`.
 * Exposed for testing.
 *
 * @param {Config} config
 * @returns {Array<string>}
 */
module.exports._getDependencies = function(config = {}) {
  const precinctOptions = config.detectiveConfig;
  precinctOptions.includeCore = false;
  let dependencies;

  try {
    dependencies = precinct.paperwork(config.filename, precinctOptions);
    debug(`extracted ${dependencies.length} dependencies: `, dependencies);
  } catch (error) {
    debug(`error getting dependencies: ${error.message}`);
    debug(error.stack);
    return [];
  }

  const resolvedDependencies = [];

  for (const dependency of dependencies) {
    const result = cabinet({
      partial: dependency,
      filename: config.filename,
      directory: config.directory,
      ast: precinct.ast,
      config: config.requireConfig,
      webpackConfig: config.webpackConfig,
      nodeModulesConfig: config.nodeModulesConfig,
      tsConfig: config.tsConfig,
      tsConfigPath: config.tsConfigPath,
      noTypeDefinitions: config.noTypeDefinitions
    });

    if (!result) {
      debug(`skipping an empty filepath resolution for partial: ${dependency}`);
      config.nonExistent.push(dependency);
      continue;
    }

    const exists = fs.existsSync(result);

    if (!exists) {
      config.nonExistent.push(dependency);
      debug(`skipping non-empty but non-existent resolution: ${result} for partial: ${dependency}`);
      continue;
    }

    resolvedDependencies.push(result);
  }

  return resolvedDependencies;
};

/**
 * @param {Config} config
 * @returns {Object|Set}
 */
function traverse(config = {}) {
  const subTree = config.isListForm ? new Set() : {};

  debug(`traversing ${config.filename}`);

  if (config.visited[config.filename]) {
    debug(`already visited ${config.filename}`);
    return config.visited[config.filename];
  }

  let dependencies = module.exports._getDependencies(config);

  debug('cabinet-resolved all dependencies: ', dependencies);
  // Eagerly mark the current file before recursing so any re-entrant visit exits early
  config.visited[config.filename] = config.isListForm ? [] : {};

  if (config.filter) {
    debug('using filter function to filter out dependencies');
    debug(`unfiltered number of dependencies: ${dependencies.length}`);
    // eslint-disable-next-line unicorn/no-array-method-this-argument, unicorn/no-array-callback-reference
    dependencies = dependencies.filter(filePath => config.filter(filePath, config.filename));
    debug(`filtered number of dependencies: ${dependencies.length}`);
  }

  for (const dependency of dependencies) {
    const localConfig = config.clone();
    localConfig.filename = dependency;
    localConfig.directory = getDirectory(localConfig);

    if (localConfig.isListForm) {
      for (const item of traverse(localConfig)) {
        subTree.add(item);
      }
    } else {
      subTree[dependency] = traverse(localConfig);
    }
  }

  if (config.isListForm) {
    subTree.add(config.filename);
    config.visited[config.filename].push(...subTree);
  } else {
    config.visited[config.filename] = subTree;
  }

  return subTree;
}

// Dedupe in-place so the caller's array reference stays valid
function dedupeNonExistent(nonExistent) {
  const deduped = new Set(nonExistent);
  nonExistent.length = deduped.size;

  let i = 0;
  for (const elem of deduped) {
    nonExistent[i] = elem;
    i++;
  }
}

// For files inside node_modules, resolve from the package root rather than the app root
function getDirectory(localConfig) {
  if (!localConfig.filename.includes('node_modules')) {
    return localConfig.directory;
  }

  return getProjectPath(path.dirname(localConfig.filename)) || localConfig.directory;
}

function getProjectPath(filename) {
  try {
    const nodeModuleParts = filename.split('node_modules');
    const packageSubPathPath = nodeModuleParts.pop().split(path.sep).filter(Boolean);
    const packageName = packageSubPathPath[0].startsWith('@') ? `${packageSubPathPath[0]}${path.sep}${packageSubPathPath[1]}` : packageSubPathPath[0];

    return path.normalize([...nodeModuleParts, `${path.sep}${packageName}`].join('node_modules'));
  } catch {
    debug(`Could not determine the root directory of package file ${filename}. Using default`);
    return null;
  }
}
