<script lang="ts">
	import { onMount } from 'svelte'
	import Config from './Config.svelte'
	import type { FrameMode } from './Config.svelte'
	import { ReactionDiffusion, setupRecorder } from './engine'
	import FPS from './FPS.svelte'
	import { controlSingle } from 'js-control'

	let fps: FPS | null = null
	let ips: FPS | null = null
	let drawRegion: HTMLDivElement
	let canvas: HTMLCanvasElement
	let engine: ReactionDiffusion | null = null
	let frameMode: FrameMode = 'darken'

	const mainRegion = { x: 0, y: 0, width: 1, height: 1 }

	let maxFrameSize = 0.2
	$: if (maxFrameSize === maxFrameSize && frameMode) resizeCanvas()

	function resizeCanvas() {
		if (engine === null) return

		const [enWidth, enHeight] = engine.getSize()

		const rect = drawRegion.getBoundingClientRect()
		const pixWidth = Math.round(rect.width * devicePixelRatio)
		const pixHeight = Math.round(rect.height * devicePixelRatio)
		const aspect = rect.width / rect.height
		const engineAspect = enWidth / enHeight
		let fullViewWidth
		let fullViewHeight
		if (aspect > engineAspect) {
			const enHeightWithFrame = enHeight * (1 + maxFrameSize * 2)
			if (enHeightWithFrame <= pixHeight && frameMode !== 'hidden') {
				fullViewWidth = aspect * enHeightWithFrame
				fullViewHeight = enHeightWithFrame
			} else {
				fullViewWidth = pixWidth
				fullViewHeight = pixHeight
			}
		} else {
			const enWidthWithFrame = enWidth * (1 + maxFrameSize * 2)
			if (enWidthWithFrame <= pixWidth && frameMode !== 'hidden') {
				fullViewWidth = enWidthWithFrame
				fullViewHeight = enWidthWithFrame / aspect
			} else {
				fullViewWidth = pixWidth
				fullViewHeight = pixHeight
			}
		}

		const scale = Math.min(fullViewWidth / enWidth, fullViewHeight / enHeight)
		const s = scale / (1 + maxFrameSize * 2)
		mainRegion.x = Math.floor((fullViewWidth - enWidth * s) / 2)
		mainRegion.y = Math.floor((fullViewHeight - enHeight * s) / 2)
		mainRegion.width = enWidth * s
		mainRegion.height = enHeight * s

		if (frameMode === 'hidden') {
			canvas.width = enWidth
			canvas.height = enHeight
		} else {
			canvas.width = fullViewWidth
			canvas.height = fullViewHeight
		}
	}

	onMount(() => {
		// canvas.width = w
		// canvas.height = h

		const gl = canvas.getContext('webgl', { antialias: true, depth: false, alpha: false, stencil: false })
		if (gl === null) return alert('webgl not available')

		const glTFloatExt = gl.getExtension('OES_texture_float')
		if (!glTFloatExt) return alert('OES_texture_float is not supported')

		const glCBFloatExt = gl.getExtension('WEBGL_color_buffer_float')
		if (!glCBFloatExt) return alert('WEBGL_color_buffer_float is not supported')

		// // TODO: warn but continue
		// const glTFloatLinearExt = gl.getExtension('OES_texture_float_linear')
		// if (!glTFloatLinearExt) return alert('OES_texture_float_linear is not supported')

		// console.log(gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.LOW_FLOAT))
		// console.log(gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT))
		// console.log(gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT))

		console.log(gl.getParameter(gl.SHADING_LANGUAGE_VERSION))
		console.log(gl.getParameter(gl.MAX_TEXTURE_SIZE))

		const rd = new ReactionDiffusion(gl, 512, 512)
		engine = rd
		frameMode = engine.isFrameVisible() ? 'darken' : 'visible'
		// const recorder = setupRecorder(canvas)
		// window.recorder = recorder

		resizeCanvas()

		setTimeout(() => {
			function step() {
				requestAnimationFrame(step)
				// setTimeout(step, 1000)

				const n = 24
				rd.iter(n)
				ips && ips.frame(n)

				rd.draw(frameMode === 'hidden' ? null : mainRegion)
				fps && fps.frame()

				// recorder.requestFrame()
			}
			step()
		}, 0)
	})

	function xy2canvas(x: number, y: number): [number, number] {
		if (!engine) return [x, y]
		if (frameMode === 'hidden') {
			const cs = devicePixelRatio / (mainRegion.width / canvas.width)
			return [x * cs, y * cs]
		} else {
			const [enWidth] = engine.getSize()
			const rect = drawRegion.getBoundingClientRect()
			const cs = canvas.width / rect.width
			const rs = enWidth / mainRegion.width
			return [(x * cs - mainRegion.x) * rs, (y * cs - mainRegion.y) * rs]
		}
	}
	onMount(() => {
		let prevX = 0
		let prevY = 0
		const control = controlSingle({
			startElem: drawRegion,
			offsetElem: canvas,
			callbacks: {
				singleDown(e, id, x, y) {
					prevX = x
					prevY = y
					engine && engine.drawDot(...xy2canvas(x, y))
					return true
				},
				singleMove(e, id, x, y) {
					engine && engine.drawLine(...xy2canvas(prevX, prevY), ...xy2canvas(x, y))
					prevX = x
					prevY = y
					return true
				},
				singleUp(e, id) {
					return true
				},
			},
		})
		return () => control.off()
	})

	function onResize() {
		resizeCanvas()
	}

	$: canvasPosStyle =
		frameMode === 'hidden'
			? `left: ${mainRegion.x / devicePixelRatio}px; ` +
			  `top: ${mainRegion.y / devicePixelRatio}px; ` +
			  `width: ${mainRegion.width / devicePixelRatio}px; ` +
			  `height: ${mainRegion.height / devicePixelRatio}px;`
			: ''
</script>

<svelte:window on:resize={onResize} />

{#if engine}
	<Config {engine} {onResize} bind:frameSize={maxFrameSize} bind:frameMode>
		<span slot="fps"><FPS bind:this={fps} /></span>
		<span slot="ips"><FPS bind:this={ips} average={5} /></span>
	</Config>
{/if}
<div class="draw-region" bind:this={drawRegion}>
	<canvas
		class="main-canvas"
		class:fullsize={frameMode !== 'hidden'}
		style={canvasPosStyle}
		bind:this={canvas}
	/>
</div>

<style>
	.draw-region {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		cursor: crosshair;
	}
	.main-canvas {
		outline: 2px solid gray;
		position: absolute;
		left: 0;
		top: 0;
	}
	.main-canvas.fullsize {
		width: 100%;
		height: 100%;
	}

	:global(body) {
		display: flex;
		position: relative;
		margin: 0;
		background-color: lightgray;
	}
	:global(body.grabbing) {
		cursor: grabbing !important;
	}
	:global(.dim) {
		color: #777;
	}
	:global(.small) {
		font-size: 90%;
	}
	:global(input[type='range']) {
		vertical-align: middle;
	}
</style>
