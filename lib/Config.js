var path = require('path');
var debug = require('./debug');
var fs = require('fs');

function Config(options) {
  this.directory = options.directory || options.root;

  this.isListForm = options.isListForm;
  this.requireConfig = options.config || options.requireConfig;
  this.webpackConfig = options.webpackConfig;
  this.exclude = options.exclude || [];

  this.filter = options.filter;

  if (this.filter && typeof this.filter !== 'function') {
    throw new Error('filter must be a function');
  }
}

Config.prototype.clone = function() {
  return new Config(this);
};


/**
 * Separates out the excluded directories and files
 *
 * @todo move out to its own module
 *
 * @static
 * @param  {String[]} excludes - list of glob patterns for exclusion
 * @param  {String} directory - Used for resolving the exclusion to the filesystem
 *
 * @return {Object} results
 * @return {String} results.directoriesPattern - regex representing the directories
 * @return {String[]} results.directories
 * @return {String} results.filesPattern - regex representing the files
 * @return {String[]} results.files
 */
Config.processExcludes = function(excludes, directory) {
  var results = {
    directories: [],
    directoriesPattern: '',
    files: [],
    filesPattern: ''
  };

  if (!excludes) { return results; }

  var dirs = [];
  var files = [];

  excludes.forEach(function(exclude) {
    // Globbing breaks with excludes like foo/bar
    if (stripTrailingSlash(exclude).indexOf('/') !== -1) {
      debug('excluding from processing: ' + exclude);
      return;
    }

    try {
      var resolved = path.resolve(directory, exclude);
      var stats = fs.lstatSync(resolved);

      if (stats.isDirectory()) {
        dirs.push(stripTrailingSlash(exclude));

      } else if (stats.isFile()) {
        exclude = path.basename(exclude);
        files.push(exclude);
      }
    } catch (e) {
      // Ignore files that don't exist
    }
  }, this);

  if (dirs.length) {
    results.directoriesPattern = new RegExp(dirs.join('|'));
    results.directories = dirs;
  }

  if (files.length) {
    results.filesPattern = new RegExp(files.join('|'));
    results.files = files;
  }

  return results;
};

/**
 * @param  {String} str
 * @return {String}
 */
function stripTrailingSlash(str) {
  if (str[str.length - 1] === '/') {
    return str.slice(0, -1);
  }

  return str;
};

module.exports = Config;
