### dependency-tree [![npm](http://img.shields.io/npm/v/dependency-tree.svg)](https://npmjs.org/package/dependency-tree) [![npm](http://img.shields.io/npm/dm/dependency-tree.svg)](https://npmjs.org/package/dependency-tree)

> Get the dependency tree of a module (as a list)

`npm install dependency-tree`

### Usage

```js
var getTreeAsList = require('dependency-tree');

// Returns a list of filepaths for all visited dependencies
var tree = getTreeAsList('path/to/a/file', 'path/to/all/js/files');
```

Returns the entire dependency tree as a **flat** list of filepaths for a given module.
Basically, all files visited during traversal of the dependency-tree are returned.

* All core Node modules (assert, path, fs, etc) are removed from the dependency list by default
* Works for AMD, CommonJS, ES6 modules and SASS files.


**Optional**

* `cache`: 3rd argument that's an empty object (or shared across multiple runs of this module)
used for avoiding redundant subtree generations.

**Shell version** (assuming `npm install -g dependency-tree`):

```
tree filename root
```

Prints

```
/a.js
/b.js
```

