var utils = require('../');
var assert = require('assert');

describe('getTreeAsList', function() {
  function testTreesForFormat(format, ext) {
    ext = ext || '.js';

    it('returns a list form of the dependency tree for a file', function(done) {
      var filename = __dirname + '/example/' + format + '/a' + ext;
      var root = __dirname + '/example/' + format;

      utils.getTreeAsList(filename, root, function(tree) {
        assert(tree instanceof Array);
        assert(tree.length === 3);
        done();
      });
    });
  }

  it('throws if the filename is missing', function() {
    assert.throws(function() {
      utils.getTreeAsList(root, function() {});
    });
  });

  it('throws if the root is missing', function() {
    assert.throws(function() {
      utils.getTreeAsList(filename, function() {});
    });
  });

  it('throws if the callback is missing', function() {
    assert.throws(function() {
      utils.getTreeAsList(filename, root);
    });
  });

  describe('memoization (#2)', function() {
    it('accepts an optional cache for memoization (#2)', function(done) {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';
      var callback = function(tree) {
        assert(tree.length === 2);
        done();
      };

      var cache = {};
      // Shouldn't process b.js' tree
      cache[__dirname + '/example/amd/b.js'] = true;

      utils.getTreeAsList(filename, root, callback, cache);
    });

    it('returns an empty list if entry point is cached', function(done) {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';
      var callback = function(tree) {
        assert(!tree.length);
        done();
      };

      var cache = {};
      // Shouldn't process the first file's tree
      cache[filename] = true;

      utils.getTreeAsList(filename, root, callback, cache);
    });
  });

  describe('module formats', function() {
    describe('amd', function() {
      testTreesForFormat('amd');
    });

    describe('commonjs', function() {
      testTreesForFormat('commonjs');
    });

    describe('es6', function() {
      testTreesForFormat('es6');
    });

    describe('sass', function() {
      testTreesForFormat('sass', '.scss');
    });
  });
});
