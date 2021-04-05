import svelte from 'rollup-plugin-svelte'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'
import sveltePreprocess from 'svelte-preprocess'
import typescript from '@rollup/plugin-typescript'
import css from 'rollup-plugin-css-only'
import html from '@rollup/plugin-html'

const DIST = __dirname + '/dist'

function serve() {
	let server

	function toExit() {
		if (server) server.kill(0)
	}

	return {
		writeBundle() {
			if (server) return
			server = require('child_process').spawn('sirv', [DIST, '--no-clear', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true,
			})

			process.on('SIGTERM', toExit)
			process.on('exit', toExit)
		},
	}
}

function hashFixCSS(options) {
	// https://github.com/thgh/rollup-plugin-css-only/blob/f716e17b4faeba80b53fab04b9f6813e76301766/src/index.js
	// https://github.com/thgh/rollup-plugin-css-only/issues/25
	const plugin = css(options)
	const original_generateBundle = plugin.generateBundle
	const name = options.output
	let source
	options.output = s => (source = s)
	plugin.generateBundle = function (opts, bundle) {
		original_generateBundle.call(this, opts, bundle)
		this.emitFile({ type: 'asset', name, source })
	}
	return plugin
}

export default async function (commandOptions) {
	const isProd = process.env.NODE_ENV === 'production'
	const isWatch = process.env.ROLLUP_WATCH

	return {
		input: 'src/index.ts',
		output: {
			sourcemap: true,
			format: 'iife',
			name: '_',
			dir: DIST,
			entryFileNames: isProd ? '[name].[hash].js' : '[name].js',
			assetFileNames: isProd ? '[name].[hash][extname]' : '[name][extname]',
		},
		plugins: [
			svelte({
				preprocess: sveltePreprocess({ sourceMap: true }),
				compilerOptions: {
					// enable run-time checks when not in production
					dev: !isProd,
				},
			}),
			hashFixCSS({ output: 'styles.css' }),

			resolve({
				browser: true,
				dedupe: ['svelte'],
			}),
			commonjs(),
			typescript({
				sourceMap: true,
				inlineSources: !isProd,
			}),
			html({
				title: 'Reaction-Diffusion',
				lang: 'ru',
				meta: [{ charset: 'utf-8' }, { viewport: 'width=device-width,initial-scale=1' }],
			}),

			isWatch && serve(),
			isWatch && livereload(DIST),
			isProd && terser(),
		],
		watch: {
			clearScreen: false,
		},
	}
}
