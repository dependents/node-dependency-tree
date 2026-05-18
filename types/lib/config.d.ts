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
    constructor(options?: ConfigOptions);
    filename: any;
    directory: string;
    visited: Record<string, object>;
    nonExistent: string[];
    isListForm: boolean;
    requireConfig: string | undefined;
    webpackConfig: string | undefined;
    nodeModulesConfig: Record<string, unknown> | undefined;
    detectiveConfig: Record<string, unknown>;
    tsConfig: any;
    tsConfigPath: string | undefined;
    noTypeDefinitions: boolean | undefined;
    filter: ((dependencyPath: string, parentPath: string) => boolean) | undefined;
    clone(): Config;
}
export type ConfigOptions = {
    /**
     * - Entry module path
     */
    filename?: string | undefined;
    /**
     * - Root directory containing all files
     */
    directory?: string | undefined;
    /**
     * - Alias for `directory`
     */
    root?: string | undefined;
    /**
     * - Path to a RequireJS config for AMD modules
     */
    requireConfig?: string | undefined;
    /**
     * - Alias for `requireConfig`
     */
    config?: string | undefined;
    /**
     * - Path to a webpack config for aliased modules
     */
    webpackConfig?: string | undefined;
    /**
     * - Config for resolving node_modules entry files
     */
    nodeModulesConfig?: Record<string, unknown> | undefined;
    /**
     * - Memoization cache: filename to subtree
     */
    visited?: Record<string, object> | undefined;
    /**
     * - Accumulator for unresolvable partials
     */
    nonExistent?: string[] | undefined;
    /**
     * - Return a flat list instead of a tree
     */
    isListForm?: boolean | undefined;
    /**
     * - Path to (or preloaded) TypeScript config
     */
    tsConfig?: string | Record<string, unknown> | undefined;
    /**
     * - Virtual path for the tsConfig object; required for Path Mapping
     */
    tsConfigPath?: string | undefined;
    /**
     * - Resolve TS imports to `*.js` instead of `*.d.ts`
     */
    noTypeDefinitions?: boolean | undefined;
    /**
     * - Options passed to precinct for dependency extraction
     */
    detectiveConfig?: Record<string, unknown> | undefined;
    /**
     * - Alias for `detectiveConfig`
     */
    detective?: Record<string, unknown> | undefined;
    /**
     * - Return `true` to include a dependency
     */
    filter?: ((dependencyPath: string, parentPath: string) => boolean) | undefined;
};
