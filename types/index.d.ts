export default dependencyTree;
/**
 * Returns the dependency tree of a module as a nested object
 *
 * @param {import('./lib/config.js').ConfigOptions} [options]
 * @returns {object}
 */
declare function dependencyTree(options?: import("./lib/config.js").ConfigOptions): object;
declare namespace dependencyTree {
    /**
     * Returns a post-order flat list of absolute file paths (dependencies before dependents).
     * Every file's dependencies appear at lower indices, so the root entry point is last.
     * The list contains no duplicates. Accepts the same options as the default export.
     *
     * @param {Parameters<typeof dependencyTree>[0]} options - Same as the default export
     * @returns {string[]}
     */
    function toList(options?: Parameters<typeof dependencyTree>[0]): string[];
}
