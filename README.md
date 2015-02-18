### dependency-tree [![npm](http://img.shields.io/npm/v/dependency-tree.svg)](https://npmjs.org/package/dependency-tree) [![npm](http://img.shields.io/npm/dm/dependency-tree.svg)](https://npmjs.org/package/dependency-tree)

> Get the dependency tree of a module

`npm install dependency-tree`

### Usage

```js
var dependencyTree = require('dependency-tree');

// Returns a dependency tree for the given file
var tree = dependencyTree('path/to/a/file', 'path/to/all/js/files');

// Returns a pre-order traversal of the tree with duplicate sub-trees pruned.
var preOrderList = dependencyTree.traversePreOrder(tree);

// Returns a post-order traversal of the tree with duplicate sub-trees pruned.
// This is useful for bundling source files, because the list gives the
// concatenation order.
var postOrderList = dependencyTree.traversePostOrder(tree);
```

Returns the entire dependency tree as an object containing the absolute path of the entry file (tree.root) and a mapping from each processed file to its direct dependencies (tree.nodes). For example, the following yields the direct dependencies (child, but not grand-child dependencies) of the root file:

```js
var dependencyTree = require('dependency-tree');

var tree = dependencyTree('path/to/a/file', 'path/to/all/js/files');

var rootDependencies = tree.nodes[tree.root];
```

* All core Node modules (assert, path, fs, etc) are removed from the dependency list by default
* Works for AMD, CommonJS, ES6 modules and SASS files.


**Optional**

* `cache`: 3rd argument that's an empty object (or shared across multiple runs of this module)
used for avoiding redundant subtree generations.

**Shell version** (assuming `npm install -g dependency-tree`):

```
tree filename root
```

Prints the pre-order and post-order traversals of the dependency tree

```
Pre-Order:
/a.js
/b.js
/c.js

Post-Order:
/b.js
/c.js
/a.js
```

