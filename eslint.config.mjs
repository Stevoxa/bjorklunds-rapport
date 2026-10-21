import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/'] },
    js.configs.recommended,
    {
        // Appen laddas som vanliga <script>-filer som delar globalt scope (ingen bundler).
        files: ['storage.js', 'app.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser, QRious: 'readonly' } },
    },
    {
        files: ['app.js'],
        languageOptions: { globals: { HuntStore: 'readonly' } },
    },
    {
        files: ['sw.js'],
        languageOptions: { sourceType: 'script', globals: globals.serviceworker },
    },
    {
        files: ['eslint.config.mjs'],
        languageOptions: { sourceType: 'module' },
    },
];
