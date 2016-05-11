var precinct = require('precinct');
var path = require('path');
var fs = require('fs');
var cabinet = require('filing-cabinet');
var debug = require('debug')('tree');

/**
 * Recursively find all dependencies (avoiding circular) traversing the entire dependency tree
 * and returns a flat list of all unique, visited nodes
 *
 * @param {Object} options
 * @param {String} options.filename - The path of the module whose tree to traverse
 * @param {String} options.root - The directory containing all JS files
 * @param {Object} [options.visited] - Cache of visited, absolutely pathed files that should not be reprocessed.
 *                             Format is a filename -> tree as list lookup table
 * @param {Boolean} [options.isListForm=false]
 */
module.exports = function(options) {
  var filename = options.filename;
  var root = options.root;
  var visited = options.visited;
  var isListForm = options.isListForm;
  var requireConfig = options.config;
  var webpackConfig = options.webpackConfig;

  if (!filename) { throw new Error('filename not given'); }
  if (!root) { throw new Error('root directory not given'); }

  debug('given filename: ' + filename);

  filename = path.resolve(process.cwd(), filename);

  debug('resolved filename: ' + filename);

  visited = visited || {};

  debug('visited: ', visited);

  if (!fs.existsSync(filename)) {
    debug('file ' + filename + ' does not exist');
    return isListForm ? [] : {};
  }

  if (visited[filename]) {
    debug('already visited: ' + filename);

    return visited[filename];
  }

  var tree;
  var results = traverse({
    filename: filename,
    root: root,
    visited: visited,
    config: requireConfig,
    webpackConfig: webpackConfig,
    isListForm: isListForm
  });

  debug('traversal complete', results);

  if (isListForm) {
    debug('list form of results requested');

    tree = removeDups(results);
    debug('removed dups from the resulting list');

  } else {
    debug('object form of results requested');

    tree = {};
    tree[filename] = results;
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

  // Can't pass args since visited is optional and positions will be off
  return module.exports({
    filename: options.filename,
    root: options.root,
    visited: options.visited,
    config: options.config,
    webpackConfig: options.webpackConfig,
    isListForm: true
  });
};

/**
 * Returns the list of dependencies for the given filename
 *
 * Protected for testing
 *
 * @param  {String} filename
 * @return {String[]}
 */
module.exports._getDependencies = function(filename) {
  var dependencies;

  try {
    dependencies = precinct.paperwork(filename, {
      includeCore: false
    });
  } catch (e) {
    dependencies = [];
  }

  return dependencies;
};

/**
 * @param  {Object} options
 * @param  {String} options.filename
 * @param  {String} options.root
 * @param  {Object} options.visited
 * @param  {String} options.config
 * @param  {String} options.webpackConfig
 * @param  {Boolean} [options.isListForm=false] - Whether or not to collect the tree in a list form
 * @param  {Boolean} [options.config] - Path to a requirejs config for AMD apps
 * @return {Object|String[]}
 */
function traverse(options) {
  var filename = options.filename;
  var root = options.root;
  var visited = options.visited;
  var isListForm = options.isListForm;
  var config = options.config;
  var webpackConfig = options.webpackConfig;

  isListForm = !!isListForm;

  var subTree = isListForm ? [] : {};

  debug('traversing ' + filename);

  if (visited[filename]) {
    debug('already visited');
    return visited[filename];
  }

  var dependencies = module.exports._getDependencies(filename);

  debug('extracted ' + dependencies.length + ' dependencies: ', dependencies);

  if (dependencies.length) {
    debug('avoiding loaders');
    dependencies = avoidLoaders(dependencies);

    dependencies = dependencies
    .map(function(dep) {
      var options = {
        partial: dep,
        filename: filename,
        directory: root,
        config: config,
        webpackConfig: webpackConfig
      };

      debug('cabinet lookup with options', options);
      var result = cabinet(options);
      debug('cabinet result ' + result);

      if (!path.extname(result)) {
        debug('extensionless result');
        result += path.extname(filename);
        debug('after inheriting extension: ' + result);
      }

      return result;
    })
    .filter(function(dep) {
      debug('filtering out files that don\'t exist');
      return fs.existsSync(dep);
    });
  }

  // Prevents cycles by eagerly marking the current file as read
  // so that any dependent dependencies exit
  visited[filename] = isListForm ? [] : {};

  dependencies.forEach(function(d) {
    var options = {
      filename: d,
      root: root,
      visited: visited,
      config: config,
      webpackConfig: webpackConfig
    };

    if (isListForm) {
      options.isListForm = isListForm;
      subTree = subTree.concat(traverse(options));
    } else {
      subTree[d] = traverse(options);
    }
  });

  if (isListForm) {
    // Prevents redundancy about each memoized step
    subTree = removeDups(subTree);
    subTree.push(filename);
    visited[filename] = visited[filename].concat(subTree);

  } else {
    visited[filename] = subTree;
  }

  return subTree;
}

/**
 * Returns a list of unique items from the array
 *
 * If only we had es6 Set.
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

/**
 * Returns a list of dependencies that do not include requirejs loaders (like hogan, text, and css)
 *
 * @param  {String[]} dependencies
 * @return {String[]}
 */
function avoidLoaders(dependencies) {
  var avoided = [
    'hgn!',
    'css!',
    'txt!'
  ];
  var pattern = new RegExp(avoided.join('|'));

  return dependencies.filter(function(dep) {
    return !pattern.test(dep);
  });
}
