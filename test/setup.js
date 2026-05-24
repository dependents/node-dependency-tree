import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);

// Pre-load modules that filing-cabinet requires lazily at call time.
// When mock-fs intercepts the filesystem, require() for unloaded modules
// fails because node_modules is not in the mock. Loading them here ensures
// they are in Node's module cache before any test activates mock-fs.
req('filing-cabinet');
req('module-definition');
req('module-lookup-amd');
req('resolve');
