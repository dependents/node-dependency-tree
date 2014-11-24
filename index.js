var precinct = require('precinct');
var q = require('q');
var path = require('path');
var fs = require('fs');

/**
 * Recursively find all dependencies (avoiding circular) until travering the entire dependency tree
 * and return a flat list of all nodes
 *
 * @param  {String} filename - The path of the module whose tree to traverse
 * @param  {String} root     - The directory containing all JS files
 * @param  {Function} cb     - Executed with the list of nodes
 */
module.exports.getTreeAsList = function(filename, root, cb) {
  if (!filename) { throw new Error('filename not given'); }
  if (!root) { throw new Error('root not given'); }
  if (!cb) { throw new Error('cb not given'); }

  filename = path.resolve(process.cwd(), filename);

  var results = [filename];
  var visited = {};

  visited[filename] = true;

  function traverse(filename, root) {
    var dependencies;
    var content = fs.readFileSync(filename, 'utf8');

    try {
      if (isSassFile(filename)) {
        dependencies = precinct(content, 'sass');
      } else {
        dependencies = precinct(content);
      }
    } catch (e) {
      dependencies = [];
    }

    if (dependencies.length) {
      dependencies = avoidLoaders(dependencies);
      dependencies = resolveFilepaths(dependencies, filename, root);
      dependencies = avoidDuplicates(dependencies, visited);
    }

    results = results.concat(dependencies);

    return q.all(dependencies.map(function(dep) {
      return traverse(dep, root);
    }))
    .then(function() {
      return results;
    });
  }

  if (cb) {
    traverse(filename, root).then(cb);
  }
};

/**
 * @param  {String[]} dependencies - dependencies of the given filename
 * @param  {String} filename
 * @param  {String} root
 * @return {String[]}
 */
function resolveFilepaths(dependencies, filename, root) {
  return dependencies.map(function(dep) {
    var depDir = path.dirname(filename);
    var fileExt = path.extname(filename);
    var depExt = path.extname(dep);

    // Relative paths are about current file, non-relative are about the root
    if (dep.indexOf('..') === 0 || dep.indexOf('.') === 0) {
      dep = path.resolve(path.dirname(filename), dep);

    } else {
      dep = path.resolve(root, dep);
    }

    // Adopt the current file's extension
    if (isSassFile(filename) && !depExt && depExt !== fileExt) {
      dep += fileExt;

    // Default to js
    } else if (fileExt === '.js') {
      dep += '.js';
    }

    return dep;
  });
}

/**
 * Note: mutates the cache to note dependencies that were not visited but will be
 * @param  {String[]} dependencies
 * @param  {Object} cache        - A lookup table of visited nodes
 * @return {String[]}
 */
function avoidDuplicates(dependencies, cache) {
  return dependencies.filter(function(dep) {
    var wasVisited = !!cache[dep];

    if (!wasVisited) {
      cache[dep] = true;
    }

    return !wasVisited;
  });
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

/**
 * @param  {String}  filename
 * @return {Boolean}
 */
function isSassFile(filename) {
  return path.extname(filename) === '.sass' ||
         path.extname(filename) === '.scss';
}
