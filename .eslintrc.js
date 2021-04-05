module.exports = {
	parser: '@typescript-eslint/parser',
	env: {
		es6: true,
		node: true,
		browser: true,
	},
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020,
	},
	plugins: ['svelte3', '@typescript-eslint'],
	overrides: [
		{
			files: ['*.svelte'],
			processor: 'svelte3/svelte3',
		},
	],
	settings: {
		'svelte3/typescript': require('typescript'),
	},
	extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
	rules: {
		'no-unused-vars': ['warn', { vars: 'all', args: 'none' }],
		'@typescript-eslint/no-unused-vars': ['warn', { vars: 'all', args: 'none' }],
		eqeqeq: ['warn', 'always'],
		'no-constant-condition': 'off',
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/no-non-null-assertion': 'off',
	},
}
