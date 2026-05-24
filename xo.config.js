import globals from 'globals';

export default [
  {
    ignores: [
      'types/**',
      'test/fixtures/**'
    ]
  },
  {
    space: 2,
    rules: {
      '@stylistic/comma-dangle': [
        'error',
        'never'
      ],
      '@stylistic/curly-newline': [
        'error',
        {
          consistent: true
        }
      ],
      '@stylistic/object-curly-spacing': [
        'error',
        'always'
      ],
      '@stylistic/operator-linebreak': [
        'error',
        'after'
      ],
      '@stylistic/spaced-comment': 'off',
      '@stylistic/space-before-function-paren': [
        'error',
        'never'
      ],
      'arrow-body-style': 'off',
      camelcase: [
        'error',
        {
          properties: 'never'
        }
      ],
      'capitalized-comments': 'off',
      curly: [
        'error',
        'multi-line'
      ],
      'prefer-template': 'error',
      'require-unicode-regexp': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prevent-abbreviations': 'off'
    }
  },
  {
    files: [
      'test/**/*.js'
    ],
    languageOptions: {
      globals: globals.mocha
    }
  }
];
