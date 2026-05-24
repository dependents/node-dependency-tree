import fs from 'node:fs';
import path from 'node:path';
import { debuglog } from 'node:util';
import cabinet from 'filing-cabinet';
import precinct from 'precinct';
import Config from './lib/config.js';

const debug = debuglog('tree');

/**
 * Returns the dependency tree of a module as a nested object
 *
 * @param {import('./lib/config.js').ConfigOptions} [options]
 * @returns {object}
 */
function dependencyTree(options = {}) {
  const config = new Config(options);

  if (!fs.existsSync(config.filename)) {
    debug(`file ${config.filename} does not exist`);
    return config.isListForm ? [] : {};
  }

  const results = config.isListForm ? traverseList(config) : traverse(config);
  debug('traversal complete', results);

  dedupeNonExistent(config.nonExistent);
  debug('deduped list of nonExistent partials: ', config.nonExistent);

  let tree;
  if (config.isListForm) {
    debug('list form of results requested');
    tree = results;
  } else {
    debug('object form of results requested');
    tree = {
      [config.filename]: results
    };
  }

  debug('final tree', tree);
  return tree;
}

/**
 * Returns a post-order flat list of absolute file paths (dependencies before dependents).
 * Every file's dependencies appear at lower indices, so the root entry point is last.
 * The list contains no duplicates. Accepts the same options as the default export.
 *
 * @param {Parameters<typeof dependencyTree>[0]} options - Same as the default export
 * @returns {string[]}
 */
dependencyTree.toList = function(options = {}) {
  return dependencyTree({ ...options, isListForm: true });
};

/**
 * Returns resolved dependency paths for the file described by `config`.
 *
 * @param {Config} config
 * @returns {string[]}
 */
function getDependencies(config) {
  const precinctOptions = config.detectiveConfig;
  precinctOptions.includeCore = false;
  let dependencies;

  try {
    dependencies = precinct.paperwork(config.filename, precinctOptions);
    debug(`extracted ${dependencies.length} dependencies: `, dependencies);
  } catch(error) {
    debug(`error getting dependencies: ${error.message}`);
    debug(error.stack);
    return [];
  }

  const resolvedDependencies = [];

  for (const dependency of dependencies) {
    const result = cabinet({
      partial: dependency,
      filename: config.filename,
      directory: config.directory,
      ast: precinct.ast,
      config: config.requireConfig,
      webpackConfig: config.webpackConfig,
      nodeModulesConfig: config.nodeModulesConfig,
      tsConfig: config.tsConfig,
      tsConfigPath: config.tsConfigPath,
      noTypeDefinitions: config.noTypeDefinitions
    });

    if (!result) {
      debug(`skipping an empty filepath resolution for partial: ${dependency}`);
      config.nonExistent.push(dependency);
      continue;
    }

    const exists = fs.existsSync(result);

    if (!exists) {
      config.nonExistent.push(dependency);
      debug(`skipping non-empty but non-existent resolution: ${result} for partial: ${dependency}`);
      continue;
    }

    resolvedDependencies.push(result);
  }

  return resolvedDependencies;
}

/**
 * @param {Config} config
 * @returns {Object}
 */
function traverse(config) {
  const subTree = {};

  debug(`traversing ${config.filename}`);

  if (config.visited[config.filename]) {
    debug(`already visited ${config.filename}`);
    return config.visited[config.filename];
  }

  let dependencies = getDependencies(config);

  debug('cabinet-resolved all dependencies: ', dependencies);
  // Eagerly mark the current file before recursing so any re-entrant visit exits early
  config.visited[config.filename] = {};

  if (config.filter) {
    debug('using filter function to filter out dependencies');
    debug(`unfiltered number of dependencies: ${dependencies.length}`);
    // eslint-disable-next-line unicorn/no-array-method-this-argument, unicorn/no-array-callback-reference
    dependencies = dependencies.filter(filePath => config.filter(filePath, config.filename));
    debug(`filtered number of dependencies: ${dependencies.length}`);
  }

  for (const dependency of dependencies) {
    const localConfig = config.clone();
    localConfig.filename = dependency;
    localConfig.directory = getLocalConfigDirectory(localConfig);
    subTree[dependency] = traverse(localConfig);
  }

  config.visited[config.filename] = subTree;

  return subTree;
}

/**
 * @param {Config} config
 * @returns {Array<string>}
 */
function traverseList(config) {
  const result = [];
  traverseListHelper(config, result);
  return result;
}

/**
 * @param {Config} config
 * @param {Array<string>} result
 */
function traverseListHelper(config, result) {
  if (config.visited[config.filename]) return;

  // Eagerly mark the current file before recursing so any re-entrant visit exits early
  config.visited[config.filename] = [];

  let dependencies = getDependencies(config);

  debug('cabinet-resolved all dependencies: ', dependencies);

  if (config.filter) {
    debug('using filter function to filter out dependencies');
    debug(`unfiltered number of dependencies: ${dependencies.length}`);
    // eslint-disable-next-line unicorn/no-array-method-this-argument, unicorn/no-array-callback-reference
    dependencies = dependencies.filter(filePath => config.filter(filePath, config.filename));
    debug(`filtered number of dependencies: ${dependencies.length}`);
  }

  for (const dependency of dependencies) {
    const localConfig = config.clone();
    localConfig.filename = dependency;
    localConfig.directory = getLocalConfigDirectory(localConfig);
    traverseListHelper(localConfig, result);
  }

  result.push(config.filename);
}

// Dedupe in-place so the caller's array reference stays valid
/**
 * @param {string[]} nonExistent
 */
function dedupeNonExistent(nonExistent) {
  const deduped = new Set(nonExistent);
  nonExistent.length = deduped.size;

  let i = 0;
  for (const elem of deduped) {
    nonExistent[i] = elem;
    i++;
  }
}

// If the file is in a node_modules directory, we want to resolve the root of the package,
// not the file itself, since the file may be buried in a subdirectory and not contain all
// of the package's dependencies
/**
 * @param {Config} localConfig
 * @returns {string}
 */
function getLocalConfigDirectory(localConfig) {
  const { filename, directory } = localConfig;

  if (!filename.includes('node_modules')) {
    return directory;
  }

  const dir = path.dirname(filename);
  const parts = dir.split('node_modules');

  if (parts.length < 2) {
    return directory;
  }

  const afterNodeModules = parts.pop();
  if (!afterNodeModules) {
    return directory;
  }

  const segments = afterNodeModules.split(path.sep).filter(Boolean);
  if (segments.length === 0) {
    return directory;
  }

  const packageName = segments[0].startsWith('@') ? `${segments[0]}${path.sep}${segments[1]}` : segments[0];
  const projectPath = path.normalize(`${parts.join('node_modules')}node_modules${path.sep}${packageName}`);

  return projectPath;
}

export default dependencyTree;
