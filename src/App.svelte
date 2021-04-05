<script lang="ts">
	import { onMount } from 'svelte'
	import Config from './Config.svelte'
	import { ReactionDiffusion, setupRecorder } from './engine'
	import FPS from './FPS.svelte'
	import { mustgetWebGLContext } from './gfx/utils'

	/*import { mustGet2dContext } from './gfx/utils'

	let canvas: HTMLCanvasElement

	const w = 128
	const h = 128
	let buf = {
		a: new Float64Array(w * h),
		b: new Float64Array(w * h),
	}
	let newBuf = {
		a: new Float64Array(w * h),
		b: new Float64Array(w * h),
	}

	buf.a.fill(1)
	for (let n = 0; n < 3; n++) {
		const x = (w / 2 + (Math.random() - 0.5) * w * 0.8) | 0
		const y = (h / 2 + (Math.random() - 0.5) * h * 0.8) | 0
		for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) buf.b[x + i + w * (y + j)] = 1
	}
	const diffusionRateA = 1.0
	const diffusionRateB = 0.5
	const feedRate = 0.055
	const killRate = 0.062 * 1.03
	const timeDelta = 0.5

	function laplacian(buf: Float64Array, i: number, j: number): number {
		const pos = i + w * j
		// const dPosLeft = i === 0 ? 0 : -1
		// const dPosRight = i === w - 1 ? 0 : 1
		// const dPosTop = j === 0 ? 0 : -w
		// const dPosBottom = j === h - 1 ? 0 : w
		const dPosLeft = i === 0 ? w - 1 : -1
		const dPosRight = i === w - 1 ? -(w - 1) : 1
		const dPosTop = j === 0 ? (h - 1) * w : -w
		const dPosBottom = j === h - 1 ? -(h - 1) * w : w
		let sum = -buf[pos]
		sum +=
			0.2 *
			(buf[pos + dPosTop] + //
				buf[pos + dPosBottom] +
				buf[pos + dPosLeft] +
				buf[pos + dPosRight])
		sum +=
			0.05 *
			(buf[pos + dPosTop + dPosLeft] +
				buf[pos + dPosTop + dPosRight] +
				buf[pos + dPosBottom + dPosRight] +
				buf[pos + dPosBottom + dPosLeft])
		return sum
	}

	function iter() {
		const { a: aBuf, b: bBuf } = buf
		const { a: newABuf, b: newBBuf } = newBuf
		for (let i = 0; i < w; i++) {
			for (let j = 0; j < h; j++) {
				const pos = i + j * w
				const a = aBuf[pos]
				const b = bBuf[pos]
				const newA =
					a + (diffusionRateA * laplacian(buf.a, i, j) - a * b * b + feedRate * (1 - a)) * timeDelta
				const newB =
					b +
					(diffusionRateB * laplacian(buf.b, i, j) + a * b * b - (killRate + feedRate) * b) *
						timeDelta
				newABuf[pos] = newA > 0 ? newA : 0
				newBBuf[pos] = newB > 0 ? newB : 0
			}
		}
		;[newBuf, buf] = [buf, newBuf]
		// const t = newBuf
		// newBuf = buf
		// buf = t
	}
	function draw() {
		const rc = mustGet2dContext(canvas)
		const iData = rc.getImageData(0, 0, w, h)
		const pix = iData.data
		for (let i = 0; i < w; i++) {
			for (let j = 0; j < h; j++) {
				const pos = i + j * w
				const v = ((buf.a[pos] - 0.5) * 8 + 0.5) * 256
				pix[pos * 4 + 0] = v
				pix[pos * 4 + 1] = v
				pix[pos * 4 + 2] = v
				pix[pos * 4 + 3] = 255
			}
		}
		rc.putImageData(iData, 0, 0)
	}

	setTimeout(() => {
		canvas.width = w
		canvas.height = h
	}, 0)
	setTimeout(() => {
		setInterval(() => {
			for (let i = 0; i < 32; i++) iter()
			draw()
		}, 16)
	}, 0)*/

	let fps: FPS | null = null

	let canvas: HTMLCanvasElement
	let engine: ReactionDiffusion | null = null
	const mainRegion = { x: 0, y: 0, width: 1, height: 1 }
	let maxFrameSize = 0.2
	$: if (maxFrameSize === maxFrameSize) resizeCanvas()

	function resizeCanvas() {
		if (engine === null) return

		const rect = canvas.getBoundingClientRect()
		const pixWidth = Math.round(rect.width * devicePixelRatio)
		const pixHeight = Math.round(rect.height * devicePixelRatio)
		const [enWidth, enHeight] = engine.getSize()
		const canvasAspect = rect.width / rect.height
		const engineAspect = enWidth / enHeight
		let scale
		if (canvasAspect > engineAspect) {
			const enHeightWithFrame = enHeight * (1 + maxFrameSize * 2)
			if (enHeightWithFrame <= pixHeight) {
				canvas.width = canvasAspect * enHeightWithFrame
				canvas.height = enHeightWithFrame
				scale = enHeightWithFrame / enHeight
			} else {
				canvas.width = pixWidth
				canvas.height = pixHeight
				scale = pixHeight / enHeight
			}
		} else {
			const enWidthWithFrame = enWidth * (1 + maxFrameSize * 2)
			if (enWidthWithFrame <= pixWidth) {
				canvas.width = enWidthWithFrame
				canvas.height = enWidthWithFrame / canvasAspect
				scale = enWidthWithFrame / enWidth
			} else {
				canvas.width = pixWidth
				canvas.height = pixHeight
				scale = pixWidth / enWidth
			}
		}

		// const scale = Math.min(canvas.width / enWidth, canvas.height / enHeight)
		const s = scale / (1 + maxFrameSize * 2)
		mainRegion.width = enWidth * s
		mainRegion.height = enHeight * s
		mainRegion.x = Math.floor((canvas.width - enWidth * s) / 2)
		mainRegion.y = Math.floor((canvas.height - enHeight * s) / 2)
		console.log(mainRegion)
	}

	onMount(() => {
		// canvas.width = w
		// canvas.height = h

		const gl = mustgetWebGLContext(canvas)

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
		// const recorder = setupRecorder(canvas)
		// window.recorder = recorder

		resizeCanvas()

		setTimeout(() => {
			function step() {
				requestAnimationFrame(step)

				const n = 1
				rd.iter(n)
				fps && fps.frame(n)

				rd.draw(mainRegion)

				// recorder.requestFrame()
			}
			step()
		}, 0)
	})

	function onResize() {
		resizeCanvas()
		// engine.resize()
	}
</script>

<svelte:window on:resize={onResize} />

{#if engine}
	<Config {engine} bind:frameSize={maxFrameSize}>
		<span slot="fps"><FPS bind:this={fps} intervalMS={5000} /></span>
	</Config>
{/if}
<canvas class="main-canvas" bind:this={canvas} />

<style>
	.main-canvas {
		width: 100vw;
		height: 100vh;
	}

	:global(body) {
		display: flex;
		position: relative;
		margin: 0;
		width: 100vw;
		height: 100vh;
	}
	:global(body.grabbing) {
		cursor: grabbing !important;
	}
	:global(.dim) {
		color: #555;
	}
	:global(.small) {
		font-size: 90%;
	}
	:global(input[type='range']) {
		vertical-align: middle;
	}
</style>
