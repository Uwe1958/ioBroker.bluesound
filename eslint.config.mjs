import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
    {
        languageOptions: { globals: globals.browser },
        ignores: ['.prettierrc.js', '**/.eslintrc.js', 'admin/words.js'],
    },
    pluginJs.configs.recommended,
];
