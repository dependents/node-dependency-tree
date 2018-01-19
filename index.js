var precinct = require('precinct');
var fs = require('fs');
var cabinet = require('filing-cabinet');
var debug = require('debug')('tree');
var Config = require('./lib/Config');

/**
 * Recursively find all dependencies (avoiding circular) traversing the entire dependency tree
 * and returns a flat list of all unique, visited nodes
 *
 * @param {Object} options
 * @param {String} options.filename - The path of the module whose tree to traverse
 * @param {String} options.directory - The directory containing all JS files
 * @param {String} [options.requireConfig] - The path to a requirejs config
 * @param {String} [options.webpackConfig] - The path to a webpack config
 * @param {String} [options.nodeModulesConfig] - config for resolving entry file for node_modules
 * @param {Object} [options.visited] - Cache of visited, absolutely pathed files that should not be reprocessed.
 *                             Format is a filename -> tree as list lookup table
 * @param {Array} [options.nonExistent] - List of partials that do not exist
 * @param {Boolean} [options.isListForm=false]
 * @return {Object}
 */
module.exports = function(options) {
  var config = new Config(options);

  if (!fs.existsSync(config.filename)) {
    debug('file ' + config.filename + ' does not exist');
    return config.isListForm ? [] : {};
  }

  var results = traverse(config);
  debug('traversal complete', results);

  dedupeNonExistent(config.nonExistent);
  debug('deduped list of nonExistent partials: ', config.nonExistent);

  var tree;
  if (config.isListForm) {
    debug('list form of results requested');

    tree = removeDups(results);
    debug('removed dups from the resulting list');

  } else {
    debug('object form of results requested');

    tree = {};
    tree[config.filename] = results;
  }

  debug('final tree', tree);
  return tree;
};

/**
 * Executes a post-order depth first search on the dependency tree and returns a
 * list of absolute file paths. The order of files in the list will be the
 * proper concatenation order for bundling.
 *
 * In other words, for any file in the list, all of that file's dependencies (direct or indirect) will appear at
 * lower indices in the list. The root (entry point) file will therefore appear last.
 *
 * The list will not contain duplicates.
 *
 * Params are those of module.exports
 */
module.exports.toList = function(options) {
  options.isListForm = true;

  return module.exports(options);
};

/**
 * Returns the list of dependencies for the given filename
 *
 * Protected for testing
 *
 * @param  {Config} config
 * @return {Array}
 */
module.exports._getDependencies = function(config) {
  var dependencies;
  var precinctOptions = config.detectiveConfig;
  precinctOptions.includeCore = false;

  try {
    dependencies = precinct.paperwork(config.filename, precinctOptions);

    debug('extracted ' + dependencies.length + ' dependencies: ', dependencies);

  } catch (e) {
    debug('error getting dependencies: ' + e.message);
    debug(e.stack);
    return [];
  }

  var resolvedDependencies = [];

  for (var i = 0, l = dependencies.length; i < l; i++) {
    var dep = dependencies[i];

    var result = cabinet({
      partial: dep,
      filename: config.filename,
      directory: config.directory,
      ast: precinct.ast,
      config: config.requireConfig,
      webpackConfig: config.webpackConfig,
      nodeModulesConfig: config.nodeModulesConfig
    });

    if (!result) {
      debug('skipping an empty filepath resolution for partial: ' + dep);
      config.nonExistent.push(dep);
      continue;
    }

    var exists = fs.existsSync(result);

    if (!exists) {
      config.nonExistent.push(dep);
      debug('skipping non-empty but non-existent resolution: ' + result + ' for partial: ' + dep);
      continue;
    }

    resolvedDependencies.push(result);
  }

  return resolvedDependencies;
};

/**
 * @param  {Config} config
 * @return {Object|String[]}
 */
function traverse(config) {
  var subTree = config.isListForm ? [] : {};

  debug('traversing ' + config.filename);

  if (config.visited[config.filename]) {
    debug('already visited ' + config.filename);
    return config.visited[config.filename];
  }

  var dependencies = module.exports._getDependencies(config);

  debug('cabinet-resolved all dependencies: ', dependencies);
  // Prevents cycles by eagerly marking the current file as read
  // so that any dependent dependencies exit
  config.visited[config.filename] = config.isListForm ? [] : {};

  if (config.filter) {
    debug('using filter function to filter out dependencies');
    debug('unfiltered number of dependencies: ' + dependencies.length);
    dependencies = dependencies.filter(function(filePath) {
      return config.filter(filePath, config.filename);
    });
    debug('filtered number of dependencies: ' + dependencies.length);
  }

  for (var i = 0, l = dependencies.length; i < l; i++) {
    var d = dependencies[i];
    var localConfig = config.clone();
    localConfig.filename = d;

    if (localConfig.isListForm) {
      subTree = subTree.concat(traverse(localConfig));
    } else {
      subTree[d] = traverse(localConfig);
    }
  }

  if (config.isListForm) {
    // Prevents redundancy about each memoized step
    subTree = removeDups(subTree);
    subTree.push(config.filename);
    config.visited[config.filename] = config.visited[config.filename].concat(subTree);

  } else {
    config.visited[config.filename] = subTree;
  }

  return subTree;
}

/**
 * Returns a list of unique items from the array
 *
 * @param  {String[]} list
 * @return {String[]}
 */
function removeDups(list) {
  var cache = {};
  var unique = [];

  list.forEach(function(item) {
    if (!cache[item]) {
      unique.push(item);
      cache[item] = true;
    }
  });

  return unique;
}

// Mutate the list input to do a dereferenced modification of the user-supplied list
function dedupeNonExistent(nonExistent) {
  var deduped = removeDups(nonExistent);
  nonExistent.length = deduped.length;

  for (var i = 0, l = deduped.length; i < l; i++) {
    nonExistent[i] = deduped[i];
  }
}
