import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
    {
        languageOptions: { globals: globals.browser },
        ignorePatterns: ['.prettierrc.js', '**/.eslintrc.js', 'admin/words.js'],
    },
    pluginJs.configs.recommended,
];
