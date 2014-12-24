var precinct = require('precinct');
var q = require('q');
var path = require('path');
var fs = require('fs');
var resolveDependencyPath = require('resolve-dependency-path');

/**
 * Recursively find all dependencies (avoiding circular) traversing the entire dependency tree
 * and returns a flat list of all unique, visited nodes
 *
 * @param {String} filename - The path of the module whose tree to traverse
 * @param {String} root - The directory containing all JS files
 * @param {Object} [visited] - Cache of visited, absolutely pathed files that should not be reprocessed.
 *                             Format is a filename -> tree as list lookup table
 */
module.exports = function(filename, root, visited) {
  if (!filename) { throw new Error('filename not given'); }
  if (!root) { throw new Error('root not given'); }

  filename = path.resolve(process.cwd(), filename);
  visited = visited || {};

  if (!fs.existsSync(filename)) {
    return [];
  }

  if (visited[filename]) {
    return visited[filename];
  }

  var results = traverse(filename, root, visited);
  results = removeDups(results);

  return results;
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
}

/**
 * @param  {String} filename
 * @param  {String} root
 * @param  {Object} visited
 * @return {String[]}
 */
function traverse(filename, root, visited) {
  var tree = [filename];

  if (visited[filename]) {
    return visited[filename];
  }

  var dependencies = module.exports._getDependencies(filename);

  if (dependencies.length) {
    // TODO: Could resolve loaders optionally for a complete tree
    dependencies = avoidLoaders(dependencies);

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
  visited[filename] = [];

  dependencies.forEach(function(d) {
    tree = tree.concat(traverse(d, root, visited));
  });

  // Prevents redundancy about each memoized step
  tree = removeDups(tree);

  visited[filename] = visited[filename].concat(tree);
  return tree;
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
