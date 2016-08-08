var precinct = require('precinct');
var path = require('path');
var fs = require('fs');
var cabinet = require('filing-cabinet');
var fileExists = require('file-exists');
var glob = require('glob-all');
var isDirectory = require('is-directory');

var debug = require('./lib/debug');
var Config = require('./lib/Config');
var Module = require('./lib/Module');

function DependencyTree(options) {
  options = options || {};

  /**
   * Flat cache/map of processed filename -> Module pairs
   *
   * @type {Object}
   */
  this.visited = options.visited || {};

  /**
   * List of absolute filenames to be processed
   *
   * @type {Array}
   */
  this.files = [];

  /**
   * Parsed configuration options
   *
   * @type {?Config}
   */
  this.config = options ? new Config(options) : null;
}

/**
 * The file extensions that dependency tree can process
 *
 * TODO: Possibly move into Config and make configurable
 *
 * @static
 * @type {String[]}
 */
DependencyTree.supportedFileExtensions = cabinet.supportedFileExtensions;

/**
 * Set of directories to ignore by default
 *
 * TODO: Possibly move into Config and make configurable
 *
 * @static
 * @type {String[]}
 */
DependencyTree.defaultExcludeDirs = [
  'node_modules',
  'bower_components',
  'vendor'
];

/**
 * Generate a dependency tree for a given file or directory
 *
 * This assumes that resolution options like webpackConfig or requireConfig
 * have been supplied during class instantiation as part of the config
 *
 * @param  {String} filepath - the file or directory about which to generate a dependency tree
 */
DependencyTree.prototype.generate = function(filepath) {
  filepath = path.resolve(filepath);

  var isDir = isDirectory.sync(filepath);

  if (!isDir) {
    if (!this.config.directory) {
      debug('Tried to process a file that has no associated directory');
      throw new Error('To generate a tree for a file, you need to supply a directory as configuration');
    }

    this.traverse(filepath);
    return;
  }

  var files = this._grabAllFilesToProcess(filepath);
  debug('files to traverse:\n', files);

  files.forEach(this.traverse, this);
};

DependencyTree.prototype._grabAllFilesToProcess = function(directory) {
  debug('grabbing all process-able files within ' + directory);

  var excludes = this.constructor.defaultExcludeDirs.concat(this.config.exclude);
  var exclusions = Config.processExcludes(excludes, directory);

  var exts = this.constructor.supportedFileExtensions;

  var extensions = exts.length > 1 ?
                   '+(' + exts.join('|') + ')' :
                   exts[0];

  var globbers = [directory + '/**/*' + extensions];

  globbers = globbers.concat(exclusions.directories.map(function(d) {
    return '!' + directory + '/' + d + '/**/*';
  })
  .concat(exclusions.files.map(function(f) {
    return '!' + directory + '/**/' + f;
  })));

  debug('globbers: ' + globbers.join('\n'));

  return glob.sync(globbers);
};

/**
 * Traverses the dependency tree of the given file, creating
 * modules and registering any parent/child relationships
 *
 * @param  {String} filename
 */
DependencyTree.prototype.traverse = function(filename) {
  filename = path.resolve(filename);
  debug('visiting ' + filename);

  if (this.visited[filename]) {
    debug('already visited ' + filename);
    return this.visited[filename];
  }

  var results = this.getResolvedDependencies(filename);
  var dependencies = results.dependencies;

  debug('resolved dependencies for ' + filename + ':\n', dependencies);

  if (this.config.filter) {
    dependencies = dependencies.filter(this.config.filter);
  }

  dependencies.forEach(this.traverse, this);

  var module = new Module({
    filename: filename,
    ast: results.ast
  });

  module.dependencies = dependencies.map(this.getModule, this);
  this._registerDependents(module, dependencies);

  this.visited[filename] = module;
};

/**
 * Returns the resolved list of dependencies for the given filename
 *
 * @param  {String} filename
 * @return {Object[]} result
 * @return {String[]} result.dependencies - List of dependency paths extracted from filename
 * @return {Object} result.ast - AST of the given filename
 */
DependencyTree.prototype.getResolvedDependencies = function(filename) {
  var results = this.findDependencies(filename);

  debug('raw dependencies for ' + filename + ':\n', results.dependencies);

  var dependencies = results.dependencies.map(function(dep) {
    var resolvedDep = cabinet({
      partial: dep,
      filename: filename,
      directory: this.config.directory,
      config: this.config.requireConfig,
      webpackConfig: this.config.webpackConfig
    });

    debug('cabinet result ' + resolvedDep);

    return resolvedDep;
  }.bind(this))
  .filter(function(dep) {
    var exists = fileExists(dep);

    if (!exists) {
      debug('filtering non-existent: ' + dep);
    }

    return exists;
  });

  return {
    dependencies: dependencies,
    ast: results.ast
  };
};

/**
 * Returns the list of dependencies for the given filename
 *
 * @param  {String} filename
 * @return {Object}
 */
DependencyTree.prototype.findDependencies = function(filename) {
  try {
    return {
      dependencies: precinct.paperwork(filename, {
        includeCore: false
      }),
      ast: precinct.ast
    };

  } catch (e) {
    debug('error getting dependencies: ' + e.message);
    debug(e.stack);
    return {
      dependencies: [],
      ast: null
    };
  }
};

/**
 * Returns the module object associated with the given filename
 *
 * @param  {String} filename
 * @return {?Module}
 */
DependencyTree.prototype.getModule = function(filename) {
  if (typeof filename !== 'string') {
    throw new Error('filename must be a string');
  }

  filename = path.resolve(filename);

  return this.visited[filename];
};

/**
 * Registers the given module as a dependent of each of the dependencies
 *
 * This assumes that each of the dependencies have been visited/traversed
 *
 * @private
 * @param  {Module} module
 * @param  {String[]} dependencies
 */
DependencyTree.prototype._registerDependents = function(module, dependencies) {
  dependencies.forEach(function(dep) {
    if (!this.visited[dep]) {
      debug('error: found an unvisited dependency');
      throw new Error('found an unvisited dependency');
    }

    this.getModule(dep).dependents.push(module);
  }, this);
};

/**
 * Returns a nested object form of the dependency tree
 *
 * @example
 *   {
 *     'path/to/foo': {
 *       'path/to/bar': {},
 *       'path/to/baz': {
 *         'path/to/car': {}
 *       }
 *     }
 *   }
 * @param  {Object} options
 * @return {Object}
 */
DependencyTree.prototype.toJSON = function(options) {
  var json = {};

  // TODO: implement

  return json;
};

/**
 * Executes a post-order depth first search on the dependency tree and returns a
 * list of absolute file paths. The order of files in the list will be the
 * proper concatenation order for bundling.
 *
 * In other words, for any file in the list, all of that file's dependencies (direct or indirect) will appear at
 * lower indices in the list. The root (entry point) file will therefore appear last.
 *
 * The list will not contain duplicates.
 *
 * Params are those of module.exports
 */
DependencyTree.prototype.toList = function(options) {
  // TODO: implement
};

/**
 * Deletes a file from the dependency tree adjusting any parent/child relationships appropriately
 *
 * This is useful if a file has been removed from the filesystem
 *
 * @param  {String} filename
 */
DependencyTree.prototype.delete = function(filename) {
  var module = this.getModule(filename);

  // TODO: Remove the module from the dependents list of module.dependencies

  delete this.visited[filename];
};

/**
 * Regenerates the dependency tree for the given file
 *
 * This is useful if a file has been modified
 *
 * @param  {String} filename
 */
DependencyTree.prototype.regenerate = function(filename) {
  // TODO: Could this be this.traverse(filename)?
};

// TODO: Do we want to return String[] or Module[]
DependencyTree.prototype.getDependencies = function(filename) {
  filename = path.resolve(filename);

  return this.visited[filename].dependencies;
};

// TODO: Do we want to return String[] or Module[]
DependencyTree.prototype.getDependents = function(filename) {
  filename = path.resolve(filename);

  return this.visited[filename].dependents;
};

DependencyTree.prototype.getRoots = function() {
  // TODO: Get all nodes that have no dependents
};

DependencyTree.prototype.getPathToFile = function(filename) {
  // TODO: return list of string paths (filename -> filename maybe)
  // from a root to the module associated with the given filename
};

module.exports = DependencyTree;
