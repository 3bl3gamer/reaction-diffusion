<script lang="ts">
	import { afterUpdate, onMount } from 'svelte'
	import Config from './Config.svelte'
	import type { FrameMode } from './Config.svelte'
	import Tip from './Tip.svelte'
	import FPS from './FPS.svelte'
	import { ReactionDiffusion } from './engine'
	import { controlSingle } from 'js-control'

	let fps: FPS | null = null
	let ips: FPS | null = null
	let drawRegion: HTMLDivElement
	let canvas: HTMLCanvasElement
	let engine: ReactionDiffusion | null = null
	let frameMode: FrameMode = 'darken'
	let itersPerFrame = 24
	let sidebarWrapElem: HTMLDivElement | null = null
	let screenshotTip: { left: number; top: number } | null = null
	let record = { started: false, address: '127.0.0.1:5001', hint: '' }

	const mainRegion = { x: 0, y: 0, width: 1, height: 1 }

	function updateRecordHint() {
		record.hint = canvas
			? `ffmpeg -vcodec rawvideo -f rawvideo -pixel_format rgba -r 60 -video_size ${canvas.width}x${canvas.height} -i - ...`
			: ''
	}

	let maxFrameSize = 0.2
	$: if (maxFrameSize === maxFrameSize && frameMode && sidebarWrapElem && record.started === record.started)
		resizeCanvas()

	let sidebarIsShown = true
	let sidebarIsShownPrev = sidebarIsShown
	afterUpdate(() => {
		if (sidebarIsShownPrev !== sidebarIsShown) resizeCanvas()
		sidebarIsShownPrev = sidebarIsShown
	})

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

		const sidebarWidth =
			sidebarWrapElem && !record.started ? sidebarWrapElem.getBoundingClientRect().width : 0
		const sideShift = (sidebarWidth / rect.width) * fullViewWidth
		const scale = Math.min(fullViewWidth / enWidth, fullViewHeight / enHeight)
		const scaleWithBorder = scale / (1 + maxFrameSize * 2)
		mainRegion.x = Math.floor((fullViewWidth - enWidth * scaleWithBorder + sideShift) / 2)
		mainRegion.x = Math.min(mainRegion.x, Math.floor(fullViewWidth - enWidth * scaleWithBorder))
		mainRegion.y = Math.floor((fullViewHeight - enHeight * scaleWithBorder) / 2)
		mainRegion.width = enWidth * scaleWithBorder
		mainRegion.height = enHeight * scaleWithBorder

		if (frameMode === 'hidden') {
			canvas.width = enWidth
			canvas.height = enHeight
		} else {
			canvas.width = fullViewWidth
			canvas.height = fullViewHeight
		}

		updateRecordHint()
	}

	function saveScreenshot() {
		if (!engine) return
		const [enWidth, enHeight] = engine.getSize()
		canvas.width = enWidth
		canvas.height = enHeight
		engine.draw(null)
		canvas.toBlob(blob => {
			const a = document.createElement('a')
			a.download = 'reaction-diffusion.png'
			document.body.appendChild(a)
			const url = URL.createObjectURL(blob)
			a.href = url
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		}, 'image/png')
		resizeCanvas()
	}

	onMount(() => {
		// canvas.width = w
		// canvas.height = h

		const _gl = canvas.getContext('webgl', {
			antialias: true,
			depth: false,
			alpha: false,
			stencil: false,
		})
		if (_gl === null) return alert('webgl not available')
		const gl = _gl

		try {
			engine = new ReactionDiffusion(gl, 512, 512)
		} catch (ex) {
			alert(ex + '')
			return
		}
		const rd = engine
		for (let i = 0; i < 200; i++) rd.drawDot(512 * Math.random(), 512 * Math.random())
		frameMode = rd.isFrameVisible() ? 'darken' : 'visible'
		// const recorder = setupRecorder(canvas)
		// window.recorder = recorder

		resizeCanvas()

		let recordPromise = Promise.resolve()
		let recordBuf = new Uint8Array(0)
		function step() {
			const p = canvasDrawPoint
			if (p !== null && p.upd < Date.now() - 250) {
				rd.drawDot(...xy2canvas(p.x, p.y))
			}

			rd.iter(itersPerFrame)
			ips && ips.frame(itersPerFrame)

			rd.draw(frameMode === 'hidden' ? null : mainRegion)
			fps && fps.frame()

			if (record && record.started) {
				const address = record.address
				const { width, height } = gl.canvas
				if (recordBuf.length !== width * height * 4) recordBuf = new Uint8Array(width * height * 4)
				gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, recordBuf)
				recordPromise = recordPromise
					.then(() => fetch('http://' + address, { method: 'POST', body: recordBuf }))
					.catch(console.error)
					.then(() => {
						requestAnimationFrame(step)
					})
			} else {
				requestAnimationFrame(step)
				// setTimeout(step, 1000)
			}
			// recorder.requestFrame()
		}
		step()
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
	let canvasDrawPoint: { x: number; y: number; upd: number } | null = null
	onMount(() => {
		const control = controlSingle({
			startElem: drawRegion,
			offsetElem: canvas,
			callbacks: {
				singleDown(e, id, x, y) {
					canvasDrawPoint = { x, y, upd: Date.now() }
					engine && engine.drawDot(...xy2canvas(x, y))
					return true
				},
				singleMove(e, id, x, y) {
					const p = canvasDrawPoint!
					engine && engine.drawLine(...xy2canvas(p.x, p.y), ...xy2canvas(x, y))
					p.x = x
					p.y = y
					p.upd = Date.now()
					return true
				},
				singleUp(e, id) {
					canvasDrawPoint = null
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
	<Config
		bind:wrapElem={sidebarWrapElem}
		bind:isShown={sidebarIsShown}
		{engine}
		{onResize}
		onScreenshot={saveScreenshot}
		bind:frameSize={maxFrameSize}
		bind:frameMode
		bind:itersPerFrame
		bind:record
	>
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
		on:contextmenu={e => (screenshotTip = { left: e.clientX, top: e.clientY })}
		on:mousemove={() => (screenshotTip = null)}
	/>
	{#if screenshotTip}
		<Tip origin={screenshotTip}>
			Так сохранить картинку, возможно,<br /> не получится. Вверху есть кнопка.
		</Tip>
	{/if}
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
	:global(.warn) {
		background-color: #ff9;
	}
	:global(input[type='range']) {
		vertical-align: middle;
	}
	:global(h1) {
		font-size: 110%;
		font-weight: normal;
	}
</style>
