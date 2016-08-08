function Module(options) {
  options = options || {};

  /**
   * List of module references that this module depends on
   *
   * @type {Module[]}
   */
  this.dependencies = options.dependencies || [];

  /**
   * List of module references that depend on this module
   *
   * @type {Module[]}
   */
  this.dependents = options.dependents || [];

  /**
   * The absolute filename corresponding to this module
   * @type {String}
   */
  this.filename = options.filename || '';

  /**
   * The parsed AST corresponding to this module
   * @type {[type]}
   */
  this.ast = options.ast || null;
}

module.exports = Module;
