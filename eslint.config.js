import pluginVue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';

export default [
    // Global ignores
    {
        ignores: ['dist/**', 'out/**', 'build/**', 'node_modules/**', '.vite/**'],
    },

    // Vue recommended rules (includes vue-eslint-parser)
    ...pluginVue.configs['flat/recommended'],

    // Project rules for JS and Vue files
    {
        files: ['src/**/*.{js,vue}'],
        rules: {
            'no-unused-vars': 'warn',
            'vue/multi-word-component-names': 'off',
        },
    },

    // Config/script files at root level
    {
        files: ['*.config.js', 'src/scripts/**/*.js'],
        languageOptions: {
            globals: {
                process: 'readonly',
                console: 'readonly',
            },
        },
        rules: {
            'no-console': 'off',
        },
    },

    // Prettier compatibility
    prettierConfig,

    // Vue template formatting rules (after prettierConfig to avoid being disabled)
    {
        files: ['src/**/*.vue'],
        rules: {
            'vue/first-attribute-linebreak': ['error', {
                singleline: 'ignore',
                multiline: 'beside',
            }],
            'vue/html-closing-bracket-newline': ['error', {
                singleline: 'never',
                multiline: 'never',
                selfClosingTag: {
                    singleline: 'never',
                    multiline: 'never',
                },
            }],
            "vue/html-indent": ["error", 4, {
                attribute: 1,
                baseIndent: 1,
                closeBracket: 0,
                alignAttributesVertically: true,
                ignores: []
            }],
            "vue/html-closing-bracket-spacing": ["error", {
                startTag: "never",
                endTag: "never",
                selfClosingTag: "always"
            }]
        },
    },
];
