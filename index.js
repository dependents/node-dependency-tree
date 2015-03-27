var precinct = require('precinct');
var q = require('q');
var path = require('path');
var fs = require('fs');
var resolveDependencyPath = require('resolve-dependency-path');
var amdModuleLookup = require('module-lookup-amd');

/**
 * Recursively find all dependencies (avoiding circular) traversing the entire dependency tree
 * and returns a flat list of all unique, visited nodes
 *
 * @param {Object} options
 * @param {String} options.filename - The path of the module whose tree to traverse
 * @param {String} options.root - The directory containing all JS files
 * @param {Function} options.success - Executed with the list of files in the dependency tree
 * @param {Object} [options.visited] - Cache of visited, absolutely pathed files that should not be reprocessed.
 *                                   Used for memoization.
 *                                   Format is a filename -> true lookup table
 * @param {String} [options.config] - RequireJS config file (for aliased dependency paths)
 * @param {Boolean} [isListForm=false]
 */
module.exports = function(options) {
  var filename = options.filename;
  var isListForm = options.isListForm;

  if (!filename) { throw new Error('filename not given'); }
  if (!options.directory) { throw new Error('root directory not given'); }

  filename = path.resolve(process.cwd(), filename);
  options.cache = options.cache || {};

  if (!fs.existsSync(filename)) {
    return isListForm ? [] : {};
  }

  if (options.cache[filename]) {
    return options.cache[filename];
  }

  var tree;
  var results = traverse(options);

  if (isListForm) {
    tree = removeDups(results);

  } else {
    tree = {};
    tree[filename] = results;
  }

  return tree;
};

/**
 * @param  {Object} options
 * @param  {String} options.filename
 * @param  {String} options.directory
 * @param  {String} options.cache
 * @param  {Object} options.requireJSConfig
 * @param  {Boolean} [options.isListForm=false] - Whether or not to collect the tree in a list form
 * @return {Object|String[]}
 */
function traverse(options) {
  var filename = options.filename;
  var root = options.directory;
  var visited = options.cache;
  var isListForm = !!options.isListForm;
  var config = options.requireJSConfig;
  var subTree = isListForm ? [] : {};

  if (visited[filename]) {
    return visited[filename];
  }

  var dependencies = module.exports._getDependencies(filename);

  if (dependencies.length) {

    if (config) {
      dependencies = dependencies.map(function(dependency) {
        return amdModuleLookup(config, dependency);
      });
    } else {
      // TODO: Could resolve loaders optionally for a complete tree
      dependencies = avoidLoaders(dependencies);
    }

    dependencies = dependencies
    .map(function(dep) {
      return resolveDependencyPath(dep, filename, root);
    })
    .filter(function(dep) {
      return fs.existsSync(dep);
    });
  }

  // Prevents cycles by eagerly marking the current file as read
  // so that any dependent dependencies exit
  visited[filename] = isListForm ? [] : {};

  dependencies.forEach(function(d) {
    var options = {
      filename: d,
      directory: root,
      cache: visited
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
 * Executes a post-order depth first search on the dependency tree and returns a
 * list of absolute file paths. The order of files in the list will be the
 * proper concatenation order for bundling.
 *
 * In other words, for any file in the list, all of that file's dependencies (direct or indirect) will appear at
 * lower indeces in the list. The root (entry point) file will therefore appear
 * last.
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
 * Protected for testing
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
