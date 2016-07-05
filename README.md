### dependency-tree [![npm](http://img.shields.io/npm/v/dependency-tree.svg)](https://npmjs.org/package/dependency-tree) [![npm](http://img.shields.io/npm/dm/dependency-tree.svg)](https://npmjs.org/package/dependency-tree)

> Get the dependency tree of a module

`npm install dependency-tree`

### Usage

```js
var dependencyTree = require('dependency-tree');

// Returns a dependency tree object for the given file
var tree = dependencyTree({
  filename: 'path/to/a/file',
  directory: 'path/to/all/files',
  requireConfig: 'path/to/requirejs/config', // optional
  webpackConfig: 'path/to/webpack/config', // optional
  filter: path => path.indexOf('node_modules') === -1 // optional
});

// Returns a post-order traversal (list form) of the tree with duplicate sub-trees pruned.
// This is useful for bundling source files, because the list gives the concatenation order.
var list = dependencyTree.toList({
  filename: 'path/to/a/file',
  directory: 'path/to/all/files'
});
```

* Works for JS (AMD, CommonJS, ES6 modules) and CSS preprocessors (Sass, Stylus); basically, any filetype supported by [Precinct](https://github.com/mrjoelkemp/node-precinct).
  - For CommonJS modules, 3rd party dependencies (npm installed dependencies) are included in the tree by default
  - Dependency path resolutions are handled by [filing-cabinet](https://github.com/mrjoelkemp/node-filing-cabinet)
  - Supports RequireJS and Webpack loaders
* All core Node modules (assert, path, fs, etc) are removed from the dependency list by default

The object form is a mapping of the dependency tree to the filesystem –
where every key is an absolute filepath and the value is another object/subtree.

Example:

```js
{
  '/Users/mrjoelkemp/Documents/node-dependency-tree/test/example/extended/a.js': {
    '/Users/mrjoelkemp/Documents/node-dependency-tree/test/example/extended/b.js': {
      '/Users/mrjoelkemp/Documents/node-dependency-tree/test/example/extended/d.js': {},
      '/Users/mrjoelkemp/Documents/node-dependency-tree/test/example/extended/e.js': {}
    },
    '/Users/mrjoelkemp/Documents/node-dependency-tree/test/example/extended/c.js': {
      '/Users/mrjoelkemp/Documents/node-dependency-tree/test/example/extended/f.js': {},
      '/Users/mrjoelkemp/Documents/node-dependency-tree/test/example/extended/g.js': {}
    }
  }
}
```

This structure was chosen to serve as a visual representation of the dependency tree
for use in the [Dependents](https://github.com/mrjoelkemp/sublime-dependents) plugin.

**Optional**

* `requireConfig`: path to a requirejs config for AMD modules (allows for the result of aliased module paths)
* `webpackConfig`: path to a webpack config for aliased modules
* `visited`: object used for avoiding redundant subtree generations via memoization.
* `filter`: a function used to determine if a module (and its subtree) should be included in the dependency tree
 - The function should accept an absolute filepath and return a boolean
 - If the filter returns true, the module is included in the resulting tree

**Shell version** (assuming `npm install -g dependency-tree`):

```
dependency-tree --directory=path/to/all/supported/files [--list-form] [-c path/to/require/config] [-w path/to/webpack/config] filename
```

Prints the dependency tree of the given filename as stringified json (by default).

* You can alternatively print out the list form one element per line using the `--list-form` option.
