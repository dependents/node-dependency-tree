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
