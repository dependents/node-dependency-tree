### dependency-tree [![npm](http://img.shields.io/npm/v/dependency-tree.svg)](https://npmjs.org/package/dependency-tree) [![npm](http://img.shields.io/npm/dm/dependency-tree.svg)](https://npmjs.org/package/dependency-tree)

> Get the dependency tree of a module

`npm install --save dependency-tree`

### Usage

```js
var dependencyTree = require('dependency-tree');

// Returns a dependency tree object for the given file
var tree = dependencyTree({
  filename: 'path/to/a/file',
  directory: 'path/to/all/files',
  requireConfig: 'path/to/requirejs/config', // optional
  webpackConfig: 'path/to/webpack/config', // optional
  filter: path => path.indexOf('node_modules') === -1, // optional
  nonExistent: [] // optional
});

// Returns a post-order traversal (list form) of the tree with duplicate sub-trees pruned.
// This is useful for bundling source files, because the list gives the concatenation order.
// Note: you can pass the same arguments as you would to dependencyTree()
var list = dependencyTree.toList({
  filename: 'path/to/a/file',
  directory: 'path/to/all/files'
});
```

* Works for JS (AMD, CommonJS, ES6 modules) and CSS preprocessors (Sass, Stylus); basically, any module type supported by [Precinct](https://github.com/mrjoelkemp/node-precinct).
  - For CommonJS modules, 3rd party dependencies (npm installed dependencies) are included in the tree by default
  - Dependency path resolutions are handled by [filing-cabinet](https://github.com/mrjoelkemp/node-filing-cabinet)
  - Supports RequireJS and Webpack loaders
* All core Node modules (assert, path, fs, etc) are removed from the dependency list by default

#### Options

* `requireConfig`: path to a requirejs config for AMD modules (allows for the result of aliased module paths)
* `webpackConfig`: path to a webpack config for aliased modules
* `visited`: object used for avoiding redundant subtree generations via memoization.
* `nonExistent`: array used for storing the list of partial paths that do not exist
* `filter`: a function used to determine if a module (and its subtree) should be included in the dependency tree
 - The first argument given to the filter is an absolute filepath to the dependency and the second is the filepath to the currently traversed file. Should return a `Boolean`. If it returns `true`, the module is included in the resulting tree.
* `detective`: object with configuration specific to detectives used to find dependencies of a file
 - for example `detective.amd.skipLazyLoaded: true` tells the AMD detective to omit inner requires
 - See [precinct's usage docs](https://github.com/dependents/node-precinct#usage) for the list of module types you can pass options to.

#### Format Details

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

##### CLI version

* Assumes a global install: `npm install -g dependency-tree`

```
dependency-tree --directory=path/to/all/supported/files [--list-form] [-c path/to/require/config] [-w path/to/webpack/config] filename
```

Prints the dependency tree of the given filename as stringified json (by default).

* You can alternatively print out the list form one element per line using the `--list-form` option.

### FAQ

#### Why aren't some some dependencies being detected?

If there are bugs in [precinct](https://github.com/dependents/node-precinct) or if the `requireConfig`/`webpackConfig` options are incomplete,
some dependencies may not be resolved. The optional array passed to the `nonExistent` option will be populated with paths
that could not be resolved. You can check this array to see where problems might exist.

You can also use the `DEBUG=*` env variable along with the cli version to see debugging information explaining where resolution went wrong.
Example: `DEBUG=* dependency-tree -w path/to/webpack.config.json path/to/a/file`
