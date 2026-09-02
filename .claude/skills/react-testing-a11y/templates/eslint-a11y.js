import jsxA11y from 'eslint-plugin-jsx-a11y';

export const a11y = {
  plugins: { 'jsx-a11y': jsxA11y },
  rules: {
    ...jsxA11y.configs.strict.rules,
    'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
    'jsx-a11y/anchor-is-valid': [
      'error',
      { components: ['Link'], specialLink: ['to'], aspects: ['noHref', 'invalidHref'] },
    ],
    'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],
    'jsx-a11y/no-noninteractive-element-interactions': 'error',
    'jsx-a11y/no-static-element-interactions': 'error',
    'jsx-a11y/tabindex-no-positive': 'error',
  },
};
