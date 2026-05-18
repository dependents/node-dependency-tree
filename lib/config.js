import path from 'node:path';
import process from 'node:process';
import { debuglog } from 'node:util';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const debug = debuglog('tree');

/**
 * @typedef {object} ConfigOptions
 * @property {string} [filename] - Entry module path
 * @property {string} [directory] - Root directory containing all files
 * @property {string} [root] - Alias for `directory`
 * @property {string} [requireConfig] - Path to a RequireJS config for AMD modules
 * @property {string} [config] - Alias for `requireConfig`
 * @property {string} [webpackConfig] - Path to a webpack config for aliased modules
 * @property {Record<string, unknown>} [nodeModulesConfig] - Config for resolving node_modules entry files
 * @property {Record<string, object>} [visited] - Memoization cache: filename to subtree
 * @property {string[]} [nonExistent] - Accumulator for unresolvable partials
 * @property {boolean} [isListForm] - Return a flat list instead of a tree
 * @property {string | Record<string, unknown>} [tsConfig] - Path to (or preloaded) TypeScript config
 * @property {string} [tsConfigPath] - Virtual path for the tsConfig object; required for Path Mapping
 * @property {boolean} [noTypeDefinitions] - Resolve TS imports to `*.js` instead of `*.d.ts`
 * @property {Record<string, unknown>} [detectiveConfig] - Options passed to precinct for dependency extraction
 * @property {Record<string, unknown>} [detective] - Alias for `detectiveConfig`
 * @property {(dependencyPath: string, parentPath: string) => boolean} [filter] - Return `true` to include a dependency
 */

export default class Config {
  /**
   * @param {ConfigOptions} [options]
   */
  constructor(options = {}) {
    this.filename = options.filename;
    this.directory = options.directory || options.root;
    this.visited = options.visited ?? {};
    this.nonExistent = options.nonExistent ?? [];
    this.isListForm = options.isListForm ?? false;
    this.requireConfig = options.config ?? options.requireConfig;
    this.webpackConfig = options.webpackConfig;
    this.nodeModulesConfig = options.nodeModulesConfig;
    this.detectiveConfig = options.detective ?? options.detectiveConfig ?? {};
    this.tsConfig = options.tsConfig;
    this.tsConfigPath = options.tsConfigPath;
    this.noTypeDefinitions = options.noTypeDefinitions;
    this.filter = options.filter;

    if (!this.filename) throw new Error('filename not given');
    if (!this.directory) throw new Error('directory not given');
    if (this.filter && typeof this.filter !== 'function') throw new Error('filter must be a function');

    if (typeof this.tsConfig === 'string') {
      // Pre-parse once so all recursive clones share the object form
      debug('preparsing the ts config into an object for performance');
      const ts = require('typescript');
      const tsParsedConfig = ts.readJsonConfigFile(this.tsConfig, ts.sys.readFile);
      const obj = ts.parseJsonSourceFileConfigFileContent(tsParsedConfig, ts.sys, path.dirname(this.tsConfig));
      this.tsConfigPath ||= this.tsConfig;
      this.tsConfig = obj.raw;
    }

    debug(`given filename: ${this.filename}`);

    this.filename = path.resolve(process.cwd(), this.filename);

    debug(`resolved filename: ${this.filename}`);
    debug('visited: ', this.visited);
  }

  clone() {
    return new Config(this);
  }
}
