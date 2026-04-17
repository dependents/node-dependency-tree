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
    const subTree = tree[filename];
    const bTree = subTree[path.normalize(`${directory}/b.js`)];
    const cTree = subTree[path.normalize(`${directory}/c.js`)];

    assert.ok(tree instanceof Object);
    assert.ok(subTree instanceof Object);
    assert.equal(Object.keys(subTree).length, 2); // b and c
    assert.equal(Object.keys(bTree).length, 2); // d and e
    assert.equal(Object.keys(cTree).length, 2); // f and g
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
    const deps = Object.keys(subTree);

    assert.equal(deps.includes('notReal'), false);
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
    const deps = Object.keys(tree[filename]);

    assert.notEqual(deps.length, 0);
  });

  it('excludes Node.js core modules by default', () => {
    const directory = fixtures('commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });
    const deps = Object.keys(tree[filename]);
    const firstKey = Object.keys(tree)[0];

    assert.equal(deps.length, 0);
    assert.equal(firstKey.includes('b.js'), true);
  });

  it('traverses installed 3rd party node modules', () => {
    const directory = fixtures('onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];
    const deps = Object.keys(subTree);

    assert.equal(deps.includes(require.resolve('debug')), true);
  });

  it('returns a list of absolutely pathed files', () => {
    const directory = fixtures('commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });

    for (const node in tree.nodes) {
      if (Object.hasOwn(tree.nodes, node)) {
        assert.equal(node.includes(process.cwd()), true);
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
    const dtsPath = path.join(directory, 'required.d.ts');
    const jsPath = path.join(directory, 'required.js');

    const list = dependencyTree.toList({ filename, directory });

    assert.equal(list.includes(dtsPath), true);
    assert.equal(list.includes(jsPath), false);
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

    assert.equal(spy.calledWith(filename, detectiveConfig), true);
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
        const normalizedModuleFile = moduleFile.replaceAll('\\', '/');
        const expectedPath = path.normalize('test/fixtures/onlyRealDeps/a.js').replaceAll('\\', '/');
        assert.ok(require.resolve('debug'));
        assert.ok(normalizedModuleFile.match(expectedPath));
        return !filePath.includes('node_modules');
      }
    });

    const subTree = tree[filename];
    const deps = Object.keys(subTree);
    const treeKeys = Object.keys(tree);

    assert.notEqual(treeKeys.length, 0);
    assert.equal(deps.includes(require.resolve('debug')), false);
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
    const directory = fixtures('sass');
    mockfs({
      [directory]: {
        'a.scss': '@import "missing-partial";'
      }
    });

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
      const entryFile = path.join(directory, 'a.js');

      const tree = dependencyTree({ filename: entryFile, directory });

      assert.deepEqual(tree[entryFile], {});
      stub.restore();
    });
  });

  describe('memoization (#2)', () => {
    it('accepts a cache object for memoization (#2)', () => {
      const directory = fixtures('amd');
      const filename = path.join(directory, 'a.js');
      const bFile = path.join(directory, 'b.js');
      const cFile = path.join(directory, 'c.js');
      const cache = {
        [bFile]: [bFile, cFile]
      };

      const tree = dependencyTree({
        filename,
        directory,
        visited: cache
      });
      const deps = Object.keys(tree[filename]);

      assert.equal(deps.length, 2);
    });

    it('returns the precomputed list of a cached entry point', () => {
      const directory = fixtures('amd');
      const filename = path.join(directory, 'a.js');

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
