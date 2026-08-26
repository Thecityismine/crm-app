import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'node_modules/**', '.vercel/**', 'crm-app/**', '.claude/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,

      // The classic pair. Deliberately NOT the v7 'recommended-latest' preset —
      // that turns on React Compiler rules (set-state-in-effect,
      // preserve-manual-memoization) which flag ~8 long-standing patterns here.
      // Worth revisiting as a dedicated pass, not as a gate on every commit.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // The whole point of adding this linter: catch identifiers that don't
      // exist. A crash mid-edit left `OPEN_STAGES` referenced after its
      // definition was deleted, and `vite build` passed anyway.
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // This codebase doesn't use prop-types, and JSX transform is automatic.
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
    },
  },

  // Vercel serverless functions and root build config run on Node, not in the browser.
  {
    files: ['api/**/*.{js,mjs}', '*.config.js', 'eslint.config.js', 'src/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, __dirname: 'readonly' },
    },
  },
]
