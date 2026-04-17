import { strict as assert } from 'node:assert';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import mockfs from 'mock-fs';
import precinct from 'precinct';
import sinon from 'sinon';
import dependencyTree from '../index.js';
import { fixtures } from './helpers.mjs';

const require = createRequire(import.meta.url);

describe('dependencyTree', () => {
  afterEach(() => {
    mockfs.restore();
  });

  it('returns an empty object for a non-existent filename', () => {
    const root = fixtures('imaginary');
    mockfs({
      [root]: {}
    });

    const filename = `${root}/notafile.js`;
    const tree = dependencyTree({ filename, root });

    assert.ok(tree instanceof Object);
    assert.equal(Object.keys(tree).length, 0);
  });

  it('handles nested tree structures', () => {
    const directory = fixtures('extended');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    assert.ok(tree[filename] instanceof Object);

    // b and c
    const subTree = tree[filename];
    assert.equal(Object.keys(subTree).length, 2);

    const bTree = subTree[path.normalize(`${directory}/b.js`)];
    const cTree = subTree[path.normalize(`${directory}/c.js`)];
    // d and e
    assert.equal(Object.keys(bTree).length, 2);
    // f and g
    assert.equal(Object.keys(cTree).length, 2);
  });

  it('does not include files that are not real (#13)', () => {
    const directory = fixtures('onlyRealDeps');
    mockfs({
      [directory]: {
        'a.js': 'var notReal = require("./notReal");'
      }
    });

    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];

    assert.ok(!Object.keys(subTree).includes('notReal'));
  });

  it('does not choke on cyclic dependencies', () => {
    const directory = fixtures('cyclic');
    mockfs({
      [directory]: {
        'a.js': 'var b = require("./b");',
        'b.js': 'var a = require("./a");'
      }
    });

    const filename = path.normalize(`${directory}/a.js`);
    const tree = dependencyTree({ filename, directory });

    assert.ok(Object.keys(tree[filename]).length > 0);
  });

  it('excludes Node.js core modules by default', () => {
    const directory = fixtures('commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });
    assert.equal(Object.keys(tree[filename]).length, 0);
    assert.ok(Object.keys(tree)[0].includes('b.js'));
  });

  it('traverses installed 3rd party node modules', () => {
    const directory = fixtures('onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];

    assert.ok(Object.keys(subTree).includes(require.resolve('debug')));
  });

  it('returns a list of absolutely pathed files', () => {
    const directory = fixtures('commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });

    for (const node in tree.nodes) {
      if (Object.hasOwn(tree.nodes, node)) {
        assert.ok(node.includes(process.cwd()));
      }
    }
  });

  it('excludes duplicate modules from the tree', () => {
    mockfs({
      root: {
        // More than one module includes c
        'a.js': `import b from "b";
                 import c from "c";`,
        'b.js': 'import c from "c";',
        'c.js': 'export default 1;'
      }
    });

    const tree = dependencyTree.toList({
      filename: 'root/a.js',
      directory: 'root'
    });

    assert.equal(tree.length, 3);
  });

  it('resolves TypeScript imports to their type definition files by default', () => {
    const directory = fixtures('noTypeDefinitions');
    const filename = path.join(directory, 'entrypoint.ts');

    const list = dependencyTree.toList({ filename, directory });

    assert.ok(list.includes(path.join(directory, 'required.d.ts')));
    assert.ok(!list.includes(path.join(directory, 'required.js')));
  });

  it('passes detective config through to precinct', () => {
    const spy = sinon.spy(precinct, 'paperwork');
    const directory = fixtures('onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);
    const detectiveConfig = {
      amd: {
        skipLazyLoaded: true
      }
    };

    dependencyTree({
      filename,
      directory,
      detective: detectiveConfig
    });

    assert.ok(spy.calledWith(filename, detectiveConfig));
    spy.restore();
  });

  it('uses the filter to determine if a file should be included in the results', () => {
    const directory = fixtures('onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({
      filename,
      directory,
      // Skip all 3rd party deps
      filter(filePath, moduleFile) {
        assert.ok(require.resolve('debug'));
        assert.ok(moduleFile.replaceAll('\\', '/').match(path.normalize('test/fixtures/onlyRealDeps/a.js').replaceAll('\\', '/')));
        return !filePath.includes('node_modules');
      }
    });

    const subTree = tree[filename];
    assert.ok(Object.keys(tree).length > 0);
    assert.ok(!Object.keys(subTree).includes(require.resolve('debug')));
  });

  it('stores invalid partials in the nonExistent list', () => {
    const directory = fixtures('onlyRealDeps');
    mockfs({
      [directory]: {
        'a.js': 'var notReal = require("./notReal");'
      }
    });

    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    assert.equal(nonExistent.length, 1);
    assert.equal(nonExistent[0], './notReal');
  });

  it('does not add valid partials to the nonExistent list', () => {
    const directory = fixtures('onlyRealDeps');
    mockfs({
      [directory]: {
        'a.js': 'var b = require("./b");',
        'b.js': 'export default 1;'
      }
    });

    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    assert.equal(nonExistent.length, 0);
  });

  it('stores only invalid partials when there is a mix of valid and invalid', () => {
    const directory = fixtures('onlyRealDeps');
    mockfs({
      [directory]: {
        'a.js': 'var b = require("./b");',
        'b.js': 'var c = require("./c"); export default 1;',
        'c.js': 'var crap = require("./notRealMan");'
      }
    });

    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    assert.equal(nonExistent.length, 1);
    assert.equal(nonExistent[0], './notRealMan');
  });

  it('only includes a non-existent partial once when referenced multiple times', () => {
    const directory = fixtures('onlyRealDeps');
    mockfs({
      [directory]: {
        'a.js': 'var b = require("./b");\nvar crap = require("./notRealMan");',
        'b.js': 'var c = require("./c"); export default 1;',
        'c.js': 'var crap = require("./notRealMan");'
      }
    });

    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    assert.equal(nonExistent.length, 1);
    assert.equal(nonExistent[0], './notRealMan');
  });

  it('stores a Sass partial in nonExistent when the resolved path does not exist on disk', () => {
    mockfs({
      [fixtures('sass')]: {
        'a.scss': '@import "missing-partial";'
      }
    });

    const directory = fixtures('sass');
    const filename = path.normalize(`${directory}/a.scss`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    assert.equal(nonExistent.length, 1);
    assert.equal(nonExistent[0], 'missing-partial');
  });

  describe('throws', () => {
    it('throws if the filename is missing', () => {
      assert.throws(() => {
        dependencyTree({
          filename: undefined,
          directory: fixtures('commonjs')
        });
      }, /^Error: filename not given$/);
    });

    it('throws if the root is missing', () => {
      assert.throws(() => {
        dependencyTree({ undefined });
      }, /^Error: filename not given$/);
    });

    it('throws if the directory is missing', () => {
      assert.throws(() => {
        dependencyTree({
          filename: 'foo.js',
          directory: undefined
        });
      }, /^Error: directory not given$/);
    });

    it('throws if a supplied filter is not a function', () => {
      const directory = fixtures('onlyRealDeps');
      const filename = path.normalize(`${directory}/a.js`);

      assert.throws(() => {
        dependencyTree({
          filename,
          directory,
          filter: 'foobar'
        });
      }, /^Error: filter must be a function$/);
    });

    it('does not throw on the legacy `root` option', () => {
      assert.doesNotThrow(() => {
        const directory = fixtures('onlyRealDeps');
        const filename = path.normalize(`${directory}/a.js`);

        dependencyTree({ filename, root: directory });
      });
    });
  });

  describe('on file error', () => {
    const directory = fixtures('commonjs');

    it('does not throw', () => {
      assert.doesNotThrow(() => {
        dependencyTree({ filename: 'foo', directory });
      });
    });

    it('returns no dependencies', () => {
      const tree = dependencyTree({ filename: 'foo', directory });
      assert.equal(Object.keys(tree).length, 0);
    });

    it('returns no dependencies when precinct throws', () => {
      const stub = sinon.stub(precinct, 'paperwork').throws(new Error('parse error'));

      const tree = dependencyTree({
        filename: fixtures('commonjs', 'a.js'),
        directory: fixtures('commonjs')
      });

      assert.deepEqual(tree[fixtures('commonjs', 'a.js')], {});
      stub.restore();
    });
  });

  describe('memoization (#2)', () => {
    it('accepts a cache object for memoization (#2)', () => {
      const filename = fixtures('amd', 'a.js');
      const directory = fixtures('amd');
      const cache = {};

      cache[fixtures('amd', 'b.js')] = [
        fixtures('amd', 'b.js'),
        fixtures('amd', 'c.js')
      ];

      const tree = dependencyTree({
        filename,
        directory,
        visited: cache
      });

      assert.equal(Object.keys(tree[filename]).length, 2);
    });

    it('returns the precomputed list of a cached entry point', () => {
      const filename = fixtures('amd', 'a.js');
      const directory = fixtures('amd');

      const cache = {
        [filename]: [] // Shouldn't process the first file's tree
      };

      const tree = dependencyTree({
        filename,
        directory,
        visited: cache
      });

      assert.deepEqual(tree[filename], []);
    });
  });
});
