var precinct = require('precinct');
var q = require('q');
var path = require('path');
var fs = require('fs');
var resolveDependencyPath = require('resolve-dependency-path');

var PRE_ORDER = 1;
var POST_ORDER = 2;

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
  var tree = {
    root: filename,
    nodes: visited
  };
  return tree;
};

/**
 * Executes a pre-order depth first search on the dependency tree and returns a
 * list of absolute file paths. The order of files in the list will be the order
 * in which the module processed files as it built the tree. The root (entry
 * point) file will be first, followed by the root file's first dependency and
 * the first dependency's dependencies. The list will not contain duplicates.
 *
 * @param {Object} tree - Tree object produced by this module.
 */
module.exports.traversePreOrder = function(tree) {
  if (!tree) { throw new Error('tree not given'); }
  if (!tree.root) { throw new Error('Tree object is missing root'); }
  if (!tree.nodes) { throw new Error('Tree object is missing nodes'); }

  return traverseTree(tree.root, tree.nodes, {}, PRE_ORDER);
};

/**
 * Executes a post-order depth first search on the dependency tree and returns a
 * list of absolute file paths. The order of files in the list will be the
 * proper concatenation order for bundling. In other words, for any file in the
 * list, all of that file's dependencies (direct or indirect) will appear at
 * lower indeces in the list. The root (entry point) file will therefore appear
 * last. The list will not contain duplicates.
 *
 * @param {Object} tree - Tree object produced by this module.
 */
module.exports.traversePostOrder = function(tree) {
  if (!tree) { throw new Error('tree not given'); }
  if (!tree.root) { throw new Error('Tree object is missing root'); }
  if (!tree.nodes) { throw new Error('Tree object is missing nodes'); }

  return traverseTree(tree.root, tree.nodes, {}, POST_ORDER);
};

/**
 * Executes an ordered depth first search on the dependency tree and returns a
 * list of nodes.
 *
 * @param {String} root - The root or current node.
 * @param {Object} nodes - Child map (node -> children[])
 * @param {Object} visited - Map of visited nodes (node -> true || false)
 * @param {Integer} order - 1 = pre-order; 2 = post-order
 */
function traverseTree(root, nodes, visited, order) {
  if ((order !== PRE_ORDER) && (order !== POST_ORDER)) {
    throw new Error ('Traversal order not supported: ' + order);
  }

  var list = [];
  if (order === PRE_ORDER) {
    list.push(root);
  }

  // If the root has already been visited, it, and its dependencies, will
  // already appear in the list.
  if (visited[root]) {
    return [];
  }

  // Mark the node as visited
  visited[root] = true;

  var children = nodes[root] || [];

  children.forEach(function(child) {
    list = list.concat(traverseTree(child, nodes, visited, order));
  });

  if (order === POST_ORDER) {
    list.push(root);
  }

  return list;
}

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
 * @param  {String} filename
 * @param  {String} root
 * @param  {Object} visited
 * @return {String[]}
 */
function traverse(filename, root, visited) {
  var tree = [];

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
  tree.push(filename);
  return tree;
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
