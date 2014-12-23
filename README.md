### dependency-tree [![npm](http://img.shields.io/npm/v/dependency-tree.svg)](https://npmjs.org/package/dependency-tree) [![npm](http://img.shields.io/npm/dm/dependency-tree.svg)](https://npmjs.org/package/dependency-tree)

> Utilities for interacting with the dependency tree of a module

`npm install dependency-tree`

### Usage

```js
var treeUtils = require('dependency-tree');
```

### Supported Utilities

##### getTreeAsList

Returns the entire dependency tree as a **flat** list of filepaths for a given module. Basically, all files
visited during traversal of the dependency-tree are returned.

* All core Node modules (assert, path, fs, etc) are removed from the dependency list by default
* Works for AMD, CommonJS, ES6 modules and SASS files.

```js
var getTreeAslist = require('dependency-tree').getTreeAsList;

getTreeAsList(filename, root, function(treeList) {
  console.log(treeList);
});
```

* `filename`: The file whose dependency tree to traverse
* `root`: The path to all of your JS files

Prints:

```js
[
  '/a.js',
  '/b.js'
]
```

**Optional**

* `cache`: 4th argument that's an empty object (or shared across multiple runs of this module)
used for avoiding redundant subtree generations.

**Shell version** (assuming `npm install -g dependency-tree`):

```
tree-as-list filename root
```

Prints

```
/a.js
/b.js
```

