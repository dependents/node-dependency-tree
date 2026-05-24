import path from 'node:path';
import { describe, it, expect } from 'vitest';
import Config from '../lib/config.js';
import dependencyTree from '../index.js';
import { fixtures } from './helpers.js';

function testTreesForFormat(format, ext = '.js') {
  it('returns an object form of the dependency tree for a file', () => {
    const directory = fixtures(format);
    const filename = path.normalize(`${directory}/a${ext}`);

    const tree = dependencyTree({ filename, directory });
    const subTree = tree[filename];

    expect(tree).toBeInstanceOf(Object);
    expect(subTree).toBeInstanceOf(Object);
    expect(Object.keys(subTree)).toHaveLength(2);
  });
}

describe('module formats', () => {
  describe('amd', () => {
    testTreesForFormat('amd');
  });

  describe('commonjs', () => {
    testTreesForFormat('commonjs');

    describe('when given a CJS file with lazy requires', () => {
      it('includes the lazy dependency', () => {
        const directory = fixtures('cjs');
        const filename = path.normalize(`${directory}/foo.js`);
        const barPath = path.normalize(`${directory}/bar.js`);

        const tree = dependencyTree({ filename, directory });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        expect(deps).toContain(barPath);
      });
    });

    describe('when given a CJS file with module property in package.json', () => {
      it('includes the module entry as dependency', () => {
        const directory = fixtures('es6', 'moduleEntry');
        const filename = path.normalize(`${directory}/module.entry.js`);
        const moduleEntryPath = path.normalize(`${directory}/node_modules/module.entry/index.module.js`);

        const tree = dependencyTree({
          filename,
          directory,
          nodeModulesConfig: {
            entry: 'module'
          }
        });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        expect(deps).toContain(moduleEntryPath);
      });
    });
  });

  describe('es6', () => {
    const directory = fixtures('es6');

    testTreesForFormat('es6');

    it('resolves files that have jsx', () => {
      const filename = path.normalize(`${directory}/jsx.js`);

      const tree = dependencyTree({ filename, directory });
      const subTree = tree[filename];

      expect(subTree[path.normalize(`${directory}/c.js`)]).toBeDefined();
    });

    it('resolves files with a jsx extension', () => {
      const filename = path.normalize(`${directory}/foo.jsx`);

      const tree = dependencyTree({ filename, directory });
      const subTree = tree[filename];

      expect(subTree[path.normalize(`${directory}/b.js`)]).toBeDefined();
    });

    it('resolves files that have es7', () => {
      const filename = path.normalize(`${directory}/es7.js`);

      const tree = dependencyTree({ filename, directory });
      const subTree = tree[filename];

      expect(subTree[path.normalize(`${directory}/c.js`)]).toBeDefined();
    });

    describe('when given an es6 file using CJS lazy requires', () => {
      const lazyDir = fixtures('es6', 'lazyRequires');
      const filename = path.normalize(`${lazyDir}/foo.js`);
      const barPath = path.normalize(`${lazyDir}/bar.js`);

      it('includes the lazy dependency when mixedImports is on', () => {
        const tree = dependencyTree({
          filename,
          directory: lazyDir,
          detective: {
            es6: {
              mixedImports: true
            }
          }
        });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        expect(deps).toContain(barPath);
      });

      it('toList includes the lazy dependency when mixedImports is on', () => {
        const results = dependencyTree.toList({
          filename,
          directory: lazyDir,
          detective: {
            es6: {
              mixedImports: true
            }
          }
        });

        expect(results).toStrictEqual([barPath, filename]);
      });

      it('does not include the lazy dependency when mixedImports is off', () => {
        const tree = dependencyTree({ filename, directory: lazyDir });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        expect(deps).not.toContain(barPath);
      });
    });

    describe('when given an es6 file using dynamic imports', () => {
      it('includes the dynamic import', () => {
        const dynamicDir = fixtures('es6', 'dynamicImports');
        const filename = path.normalize(`${dynamicDir}/foo.js`);
        const barPath = path.normalize(`${dynamicDir}/bar.js`);

        const tree = dependencyTree({ filename, directory: dynamicDir });
        const subTree = tree[filename];
        const deps = Object.keys(subTree);

        expect(deps).toContain(barPath);
      });
    });
  });

  describe('sass', () => {
    testTreesForFormat('sass', '.scss');
  });

  describe('stylus', () => {
    testTreesForFormat('stylus', '.styl');
  });

  describe('less', () => {
    testTreesForFormat('less', '.less');
  });

  describe('typescript', () => {
    const directory = fixtures('ts');
    const depB = path.join(directory, 'b.ts');
    const depC = path.join(directory, 'c.ts');

    testTreesForFormat('ts', '.ts');

    it('utilizes a tsconfig', () => {
      const filename = path.join(directory, 'a.ts');
      const tsConfigPath = path.join(directory, '.tsconfig');

      const results = dependencyTree.toList({
        filename,
        directory,
        tsConfig: tsConfigPath
      });

      expect(results).toStrictEqual([depB, depC, filename]);
    });

    it('supports tsx files', () => {
      const results = dependencyTree.toList({
        filename: path.join(directory, 'd.tsx'),
        directory
      });

      expect(results[0]).toBe(depC);
    });

    it('excludes type-only imports when skipTypeImports is set', () => {
      const filename = path.join(directory, 'type-imports.ts');
      const results = dependencyTree.toList({
        filename,
        directory,
        detective: {
          ts: {
            skipTypeImports: true
          }
        }
      });

      const regularDep = path.join(directory, 'c.ts');
      const typeOnlyDep = path.join(directory, 'b.ts');

      expect(results).toContain(regularDep);
      expect(results).not.toContain(typeOnlyDep);
      expect(results).toHaveLength(2);
    });

    describe('mixedTsJs', () => {
      const directory = fixtures('ts', 'mixedTsJs');

      it('recognizes ts file import from js file when allowJs is on (#104)', () => {
        const filename = path.join(directory, 'a.js');
        const tsConfigPath = path.join(directory, '.tsconfig');

        const options = {
          filename,
          directory,
          tsConfig: tsConfigPath
        };
        const parsedTsConfig = new Config(options).tsConfig;

        expect(parsedTsConfig.compilerOptions.allowJs).toBe(true);

        const results = dependencyTree.toList(options);

        const depB = path.join(directory, 'b.ts');

        expect(results[0]).toBe(depB);
      });
    });
  });
});
