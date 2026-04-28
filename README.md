# dependency-tree

[![CI](https://img.shields.io/github/actions/workflow/status/dependents/node-dependency-tree/ci.yml?branch=main&label=CI&logo=github)](https://github.com/dependents/node-dependency-tree/actions/workflows/ci.yml?query=branch%3Amain)
[![npm version](https://img.shields.io/npm/v/dependency-tree?logo=npm&logoColor=fff)](https://www.npmjs.com/package/dependency-tree)
[![npm downloads](https://img.shields.io/npm/dm/dependency-tree)](https://www.npmjs.com/package/dependency-tree)

> Get the dependency tree of a module

```sh
npm install dependency-tree
```

* Supports JS (AMD, CommonJS, ES6), TypeScript, and CSS preprocessors (PostCSS, Sass, Stylus, Less) - any type handled by [precinct](https://github.com/dependents/node-precinct)
  - CommonJS: third-party (npm) dependencies are included by default
  - Path resolution is handled by [filing-cabinet](https://github.com/dependents/node-filing-cabinet); RequireJS and webpack loaders are supported
* Core Node built-ins (assert, path, fs, etc.) are excluded by default

## Usage

```js
const dependencyTree = require('dependency-tree');

// Returns a nested dependency tree object for the given file
const tree = dependencyTree({
  filename: 'path/to/a/file',
  directory: 'path/to/all/files',
  requireConfig: 'path/to/requirejs/config', // optional
  webpackConfig: 'path/to/webpack/config', // optional
  tsConfig: 'path/to/typescript/config', // optional
  nodeModulesConfig: {
    entry: 'module'
  }, // optional
  filter: path => !path.includes('node_modules'), // optional
  nonExistent: [], // optional
  noTypeDefinitions: false // optional
});

// Returns a post-order flat list of absolute paths (dependencies before dependents).
// Useful as a concatenation order for bundling.
const list = dependencyTree.toList({
  filename: 'path/to/a/file',
  directory: 'path/to/all/files'
});
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `filename` | `string` | - | **Required.** Absolute path to the entry file |
| `directory` | `string` | - | **Required.** Root directory used to resolve relative paths |
| `requireConfig` | `string` | `undefined` | Path to a RequireJS config for AMD modules (resolves aliased paths) |
| `webpackConfig` | `string` | `undefined` | Path to a webpack config for aliased modules |
| `tsConfig` | `string \| object` | `undefined` | Path to a TypeScript config file, or a preloaded config object |
| `tsConfigPath` | `string` | `undefined` | Virtual path for the TypeScript config when `tsConfig` is an object. Required for [Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping); ignored when `tsConfig` is a string path |
| `nodeModulesConfig` | `object` | `undefined` | Config for resolving `node_modules` entry files (e.g. `{ entry: 'module' }`) |
| `visited` | `object` | `{}` | Memoization cache (`filename → subtree`) to skip already-processed files |
| `nonExistent` | `string[]` | `[]` | Array populated with partial paths that could not be resolved |
| `filter` | `(depPath, parentPath) => boolean` | `undefined` | Return `true` to include a dependency (and its subtree) in the tree |
| `detective` | `object` | `undefined` | Detector options passed to [precinct](https://github.com/dependents/node-precinct#usage) - e.g. `{ amd: { skipLazyLoaded: true } }` |
| `noTypeDefinitions` | `boolean` | `false` | Resolve TypeScript imports to `*.js` instead of `*.d.ts` |

### Output format

The default output is a nested object where every key is an absolute file path and the value is its own subtree:

```js
{
  '/path/to/a.js': {
    '/path/to/b.js': {
      '/path/to/d.js': {},
      '/path/to/e.js': {}
    },
    '/path/to/c.js': {
      '/path/to/f.js': {},
      '/path/to/g.js': {}
    }
  }
}
```

This format was designed for visual representation in the [Dependents](https://github.com/mrjoelkemp/sublime-dependents) plugin.

### CLI

Requires a global install: `npm install -g dependency-tree`

```
dependency-tree --directory=path/to/files [--list-form] [-c path/to/require/config] [-w path/to/webpack/config] filename
```

Prints the dependency tree as JSON. Use `--list-form` to print one path per line instead.

## How it works

dependency-tree passes the entry file to [precinct](https://github.com/dependents/node-precinct/) to extract raw dependency strings, then passes each to [filing-cabinet](https://github.com/dependents/node-filing-cabinet) to resolve them to real filesystem paths, and recurses until the full tree is built.

Precinct generates an AST via [node-source-walk](https://github.com/dependents/node-source-walk), detects the module format (CommonJS, AMD, or ES6), and delegates to the appropriate detective to extract dependency declarations.

Filing-cabinet reuses that AST to detect the module format again, then delegates to the right resolver - necessary because AMD supports path aliasing via a RequireJS config, while CommonJS has its own resolution algorithm. The resolver returns an absolute path, which dependency-tree then recurses into.

## FAQ

### Why aren't some dependencies being detected?

Bugs in [precinct](https://github.com/dependents/node-precinct) or an incomplete `requireConfig`/`webpackConfig`/`tsConfig` are the most common causes. Any path that could not be resolved is appended to the array passed as `nonExistent`.

For detailed resolution logs, set `NODE_DEBUG=*` when using the CLI:

```sh
NODE_DEBUG=* dependency-tree -w path/to/webpack.config.json path/to/a/file
```
