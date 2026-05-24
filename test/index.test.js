import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import precinct from 'precinct';
import {
  describe,
  it,
  expect,
  vi
} from 'vitest';
import dependencyTree from '../index.js';
import { fixtures } from './helpers.js';

const { resolve } = createRequire(import.meta.url);

describe('dependencyTree', () => {
  it('returns an empty object for a non-existent filename', () => {
    const root = fixtures('imaginary');
    const filename = `${root}/notafile.js`;
    const tree = dependencyTree({ filename, root });

    expect(tree).toStrictEqual({});
  });

  it('handles nested tree structures', () => {
    const directory = fixtures('extended');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];
    const bTree = subTree[path.normalize(`${directory}/b.js`)];
    const cTree = subTree[path.normalize(`${directory}/c.js`)];

    expect(tree).toBeInstanceOf(Object);
    expect(subTree).toBeInstanceOf(Object);
    expect(Object.keys(subTree)).toHaveLength(2); // b and c
    expect(Object.keys(bTree)).toHaveLength(2); // d and e
    expect(Object.keys(cTree)).toHaveLength(2); // f and g
  });

  it('does not include files that are not real (#13)', () => {
    const directory = fixtures('onlyMissingDep');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];
    const deps = Object.keys(subTree);

    expect(deps).not.toContain('notReal');
  });

  it('does not choke on cyclic dependencies', () => {
    const directory = fixtures('cyclic');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const deps = Object.keys(tree[filename]);

    expect(deps.length).toBeGreaterThan(0);
  });

  it('excludes Node.js core modules by default', () => {
    const directory = fixtures('commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });
    const deps = Object.keys(tree[filename]);
    const firstKey = Object.keys(tree)[0];

    expect(deps).toHaveLength(0);
    expect(firstKey).toContain('b.js');
  });

  it('traverses installed 3rd party node modules', () => {
    const directory = fixtures('onlyRealDeps');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];
    const deps = Object.keys(subTree);

    expect(deps).toContain(resolve('debug'));
  });

  it('returns a list of absolutely pathed files', () => {
    const directory = fixtures('commonjs');
    const filename = path.normalize(`${directory}/b.js`);

    const tree = dependencyTree({ filename, directory });

    for (const node in tree.nodes) {
      if (Object.hasOwn(tree.nodes, node)) {
        expect(node).toContain(process.cwd());
      }
    }
  });

  it('excludes duplicate modules from the tree', () => {
    const directory = fixtures('duplicateModules');
    const filename = path.normalize(`${directory}/a.js`);

    const tree = dependencyTree.toList({ filename, directory });

    expect(tree).toHaveLength(3);
  });

  it('resolves TypeScript imports to their type definition files by default', () => {
    const directory = fixtures('noTypeDefinitions');
    const filename = path.join(directory, 'entrypoint.ts');
    const dtsPath = path.join(directory, 'required.d.ts');
    const jsPath = path.join(directory, 'required.js');

    const list = dependencyTree.toList({ filename, directory });

    expect(list).toContain(dtsPath);
    expect(list).not.toContain(jsPath);
  });

  it('passes detective config through to precinct', () => {
    const spy = vi.spyOn(precinct, 'paperwork');
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

    expect(spy).toHaveBeenCalledWith(filename, detectiveConfig);
    spy.mockRestore();
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
        expect(resolve('debug')).toBeDefined();
        expect(normalizedModuleFile).toMatch(expectedPath);
        return !filePath.includes('node_modules');
      }
    });

    const subTree = tree[filename];
    const deps = Object.keys(subTree);
    const treeKeys = Object.keys(tree);

    expect(treeKeys.length).toBeGreaterThan(0);
    expect(deps).not.toContain(resolve('debug'));
  });

  it('stores invalid partials in the nonExistent list', () => {
    const directory = fixtures('onlyMissingDep');
    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    expect(nonExistent).toStrictEqual(['./notReal']);
  });

  it('does not add valid partials to the nonExistent list', () => {
    const directory = fixtures('validPartials');
    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    expect(nonExistent).toStrictEqual([]);
  });

  it('stores only invalid partials when there is a mix of valid and invalid', () => {
    const directory = fixtures('mixedPartials');
    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    expect(nonExistent).toStrictEqual(['./notRealMan']);
  });

  it('only includes a non-existent partial once when referenced multiple times', () => {
    const directory = fixtures('repeatedMissing');
    const filename = path.normalize(`${directory}/a.js`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    expect(nonExistent).toStrictEqual(['./notRealMan']);
  });

  it('stores a Sass partial in nonExistent when the resolved path does not exist on disk', () => {
    const directory = fixtures('missingSassPartial');
    const filename = path.normalize(`${directory}/a.scss`);
    const nonExistent = [];

    dependencyTree({ filename, directory, nonExistent });

    expect(nonExistent).toStrictEqual(['missing-partial']);
  });

  describe('throws', () => {
    it('throws if the filename is missing', () => {
      expect(() => {
        dependencyTree({
          filename: undefined,
          directory: fixtures('commonjs')
        });
      }).toThrow(new Error('filename not given'));
    });

    it('throws if the root is missing', () => {
      expect(() => {
        dependencyTree({ undefined });
      }).toThrow(new Error('filename not given'));
    });

    it('throws if the directory is missing', () => {
      expect(() => {
        dependencyTree({
          filename: 'foo.js',
          directory: undefined
        });
      }).toThrow(new Error('directory not given'));
    });

    it('throws if a supplied filter is not a function', () => {
      const directory = fixtures('onlyRealDeps');
      const filename = path.normalize(`${directory}/a.js`);

      expect(() => {
        dependencyTree({
          filename,
          directory,
          filter: 'foobar'
        });
      }).toThrow(new Error('filter must be a function'));
    });

    it('does not throw on the legacy `root` option', () => {
      expect(() => {
        const directory = fixtures('onlyRealDeps');
        const filename = path.normalize(`${directory}/a.js`);

        dependencyTree({ filename, root: directory });
      }).not.toThrow();
    });
  });

  describe('on file error', () => {
    const directory = fixtures('commonjs');

    it('does not throw', () => {
      expect(() => {
        dependencyTree({ filename: 'foo', directory });
      }).not.toThrow();
    });

    it('returns no dependencies', () => {
      const tree = dependencyTree({ filename: 'foo', directory });
      expect(tree).toStrictEqual({});
    });

    it('returns empty tree when precinct throws', () => {
      const stub = vi.spyOn(precinct, 'paperwork').mockImplementation(() => {
        throw new Error('parse error');
      });
      const filename = path.join(directory, 'a.js');

      const tree = dependencyTree({ filename, directory });

      expect(tree[filename]).toStrictEqual({});
      stub.mockRestore();
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

      expect(deps).toHaveLength(2);
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

      expect(tree[filename]).toStrictEqual([]);
    });
  });

  describe('getLocalConfigDirectory', () => {
    it('resolves sub-dependencies of a file whose name contains "node_modules" but whose directory does not', () => {
      const directory = fixtures('nodeModulesInName');
      const filename = path.join(directory, 'a.js');
      const helperPath = path.join(directory, 'node_modules.helper.js');
      const subPath = path.join(directory, 'sub.js');

      const list = dependencyTree.toList({ filename, directory });

      expect(list).toContain(helperPath);
      expect(list).toContain(subPath);
    });

    it('resolves the correct root directory for a scoped package in node_modules', () => {
      const directory = fixtures('scopedPackage');
      const filename = path.join(directory, 'a.js');
      const indexPath = path.join(directory, 'node_modules', '@scope', 'pkg', 'index.js');
      const utilPath = path.join(directory, 'node_modules', '@scope', 'pkg', 'util.js');

      const list = dependencyTree.toList({ filename, directory });

      expect(list).toContain(indexPath);
      expect(list).toContain(utilPath);
    });

    it('resolves sub-dependencies for a package inside nested node_modules', () => {
      const directory = fixtures('nestedNodeModules');
      const filename = path.join(directory, 'a.js');
      const pkgAPath = path.join(directory, 'node_modules', 'pkg-a', 'index.js');
      const pkgBPath = path.join(directory, 'node_modules', 'pkg-a', 'node_modules', 'pkg-b', 'index.js');

      const list = dependencyTree.toList({ filename, directory });

      expect(list).toContain(pkgAPath);
      expect(list).toContain(pkgBPath);
    });

    it('does not throw when a file sits directly inside node_modules/ without a package subfolder', () => {
      const directory = fixtures('directNodeModules');
      const filename = path.join(directory, 'a.js');

      expect(() => {
        dependencyTree.toList({ filename, directory });
      }).not.toThrow();
    });
  });
});
