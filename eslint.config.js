import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'examples/', 'node_modules/', 'scripts/', 'test/'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ...jsxA11y.flatConfigs.recommended,
    // This is an a11y-only gate. The 5 orphaned `react-hooks/*` inline directives
    // reference a plugin we intentionally don't load here, so don't fail on them.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // autofocus is deliberate focus management for modals/inline-edit (good a11y here).
      'jsx-a11y/no-autofocus': 'off',
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
