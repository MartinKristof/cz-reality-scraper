import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

import apify from '@apify/eslint-config/ts.js';
import globals from 'globals';
import tsEslint from 'typescript-eslint';

// eslint-disable-next-line import/no-default-export
export default [
    { ignores: ['**/dist', 'eslint.config.mjs', 'vitest.config.ts'] },
    ...apify,
    prettier,
    {
        languageOptions: {
            parser: tsEslint.parser,
            parserOptions: {
                project: 'tsconfig.json',
            },
            globals: {
                ...globals.node,
                ...globals.vitest,
            },
        },
        plugins: {
            '@typescript-eslint': tsEslint.plugin,
            prettier: prettierPlugin,
        },
        rules: {
            'no-console': 0,
            'prettier/prettier': 'error',
        },
    },
    {
        files: ['src/__tests__/**/*.test.ts'],
        rules: {
            'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        },
    },
];
