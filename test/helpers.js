import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mockfs from 'mock-fs';

export const testDir = path.dirname(fileURLToPath(import.meta.url));

export function fixtures(...parts) {
  return path.join(testDir, 'fixtures', ...parts);
}

export function mockStylus() {
  mockfs({
    [fixtures('stylus')]: {
      'a.styl': `
          @import "b"
          @require "c.styl"
        `,
      'b.styl': '@import "c"',
      'c.styl': ''
    }
  });
}

export function mockSass() {
  mockfs({
    [fixtures('sass')]: {
      'a.scss': `
          @import "_b";
          @import "_c.scss";
        `,
      '_b.scss': 'body { color: blue; }',
      '_c.scss': 'body { color: pink; }'
    }
  });
}

export function mockLess() {
  mockfs({
    [fixtures('less')]: {
      'a.less': `
          @import "b.css";
          @import "c.less";
        `,
      'b.css': 'body { color: blue; }',
      'c.less': 'body { color: pink; }'
    }
  });
}

export function mockEs6() {
  mockfs({
    [fixtures('es6')]: {
      'a.js': `
          import b from './b';
          import c from './c';
        `,
      'b.js': 'export default function() {};',
      'c.js': 'export default function() {};',
      'jsx.js': 'import c from "./c";\n export default <jsx />;',
      'foo.jsx': 'import React from "react";\n import b from "b";\n export default <jsx />;',
      'es7.js': 'import c from "./c";\n export default async function foo() {};'
    }
  });
}
