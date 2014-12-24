var utils = require('../');
var assert = require('assert');
var sinon = require('sinon');

describe('getTreeAsList', function() {
  var root = __dirname + '/example/amd';
  var filename = root + '/a.js';

  function testTreesForFormat(format, ext) {
    ext = ext || '.js';

    it('returns a list form of the dependency tree for a file', function(done) {
      var root = __dirname + '/example/' + format;
      var filename = root + '/a' + ext;

      utils.getTreeAsList(filename, root, function(tree) {
        assert(tree instanceof Array);
        assert(tree.length === 3);
        done();
      });
    });
  }

  it('does not choke on cyclic dependencies', function(done) {
    var root = __dirname + '/example/cyclic';
    var filename = root + '/a.js';

    var spy = sinon.spy(utils, '_getDependencies');

    utils.getTreeAsList(filename, root, function(tree) {
      assert(spy.callCount === 2);
      assert(tree.length);
      utils._getDependencies.restore();
      done();
    });
  });

  it('excludes Node core modules by default', function(done) {
    var root = __dirname + '/example/commonjs';
    var filename = root + '/b.js';

    utils.getTreeAsList(filename, root, function(tree) {
      assert(tree.length === 1);
      assert(tree[0].indexOf('b.js') !== -1);
      done();
    });
  });

  it('returns a list of absolutely pathed files', function(done) {
    var root = __dirname + '/example/commonjs';
    var filename = root + '/b.js';

    utils.getTreeAsList(filename, root, function(tree) {
      assert(tree[0].indexOf(process.cwd()) !== -1);
      done();
    });
  });

  describe('throws', function() {
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
  });

  describe('on file error', function() {
    it('does not throw', function(done) {
      assert.doesNotThrow(function() {
        utils.getTreeAsList('foo', root, function() {
          done();
        });
      });
    });

    it('returns no dependencies', function(done) {
      utils.getTreeAsList('foo', root, function(tree) {
        assert(!tree.length);
        done();
      })
    });
  });

  describe('memoization (#2)', function() {
    var spy;

    beforeEach(function() {
      spy = sinon.spy(utils, '_getDependencies');
    });

    afterEach(function() {
      utils._getDependencies.restore();
    });

    it('accepts an optional cache object for memoization (#2)', function(done) {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';

      var callback = function(tree) {
        assert(tree.length === 3);
        assert(spy.neverCalledWith(__dirname + '/example/amd/b.js'));
        done();
      };

      var cache = {};

      cache[__dirname + '/example/amd/b.js'] = [
        __dirname + '/example/amd/b.js',
        __dirname + '/example/amd/c.js'
      ];

      utils.getTreeAsList(filename, root, callback, cache);
    });

    it('returns the precomputed list of a cached entry point', function(done) {
      var filename = __dirname + '/example/amd/a.js';
      var root = __dirname + '/example/amd';

      var callback = function(tree) {
        assert(!tree.length);
        done();
      };

      var cache = {};
      // Shouldn't process the first file's tree
      cache[filename] = [];

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
