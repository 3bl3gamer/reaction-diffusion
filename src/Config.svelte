<script context="module" lang="ts">
	export type FrameMode = 'visible' | 'darken' | 'hidden'
</script>

<script lang="ts">
	import CoefInput from './CoefInput.svelte'
	import type { ReactionDiffusion } from './engine'

	export let engine: ReactionDiffusion
	export let frameSize: number
	export let frameMode: FrameMode = 'darken'
	export let onResize: () => void

	const e = () => engine //hiding engine (and it's methods) from reactivity

	$: fieldIsRect = e().getSize()[0] === e().getSize()[1]
	$: maxFieldSizeExp = Math.floor(Math.log2(e().getMaxFieldSize()))
	$: fieldWidth = e().getSize()[0]
	$: fieldHeight = e().getSize()[1]
	$: if (fieldIsRect && fieldHeight !== fieldWidth) {
		fieldHeight = fieldWidth
		engine.resize(fieldWidth, fieldHeight)
		onResize()
	}
	$: fieldWidthExp = Math.floor(Math.log2(fieldWidth))
	$: fieldHeightExp = Math.floor(Math.log2(fieldHeight))
	const onFieldWidthExpChange = e => {
		fieldWidth = Math.pow(2, +e.currentTarget.value)
		if (fieldIsRect) fieldHeight = fieldWidth
		engine.resize(fieldWidth, fieldHeight)
		onResize()
	}
	const onFieldHeightExpChange = e => {
		fieldHeight = Math.pow(2, +e.currentTarget.value)
		engine.resize(fieldWidth, fieldHeight)
		onResize()
	}

	$: diffusionRateA = e().getCoefs().diffusionRateA
	$: diffusionRateB = e().getCoefs().diffusionRateB
	$: killRate = e().getCoefs().killRate
	$: feedRate = e().getCoefs().feedRate
	const onMaskChange = () => engine.updateIterationData()

	$: e().setWrapMode(wrapMode)
	$: wrapMode = e().getWrapMode()

	$: e().toggleFrame(frameMode === 'darken')

	function drawVertLines(n: number) {
		const [w, h] = engine.getSize()
		const step = 24
		for (let i = 0; i < n; i++) {
			const x = w / 2 + (i - (n - 1) / 2) * step
			engine.drawLine(x, 0, x, h)
		}
	}
	function drawOneDot() {
		const [w, h] = engine.getSize()
		engine.drawDot(w / 2, h / 2)
	}
	function drawThreeDots() {
		const [w, h] = engine.getSize()
		const n = 3
		for (let i = 0; i < n; i++) {
			const a = (i / n) * 2 * Math.PI - Math.PI / 2
			engine.drawDot(w / 2 + (w / 8) * Math.cos(a), h / 2 + (h / 8) * Math.sin(a))
		}
	}
	function drawRandomDots() {
		const [w, h] = engine.getSize()
		const n = Math.max(5, Math.round((w * h) / 50 / 50))
		for (let i = 0; i < n; i++) {
			engine.drawDot(w * Math.random(), h * Math.random())
		}
	}
</script>

<div class="cfg-wrap">
	<div class="cfg-head">...</div>
	<div class="cfg-scroll">
		<fieldset>
			<legend>Статус</legend>
			<div><slot name="fps" /> FPS, <slot name="ips" /> итераций/с</div>
		</fieldset>
		<fieldset class="sim-cfg">
			<legend>Симуляция</legend>
			<div class="mask-label small">маска</div>
			<CoefInput
				label="a diffusion rate"
				bind:coef={diffusionRateA}
				{onMaskChange}
				masks={engine.getMasks()}
				slideStep={0.001}
				paddingTop="4px"
			/>
			<CoefInput
				label="b diffusion rate"
				bind:coef={diffusionRateB}
				{onMaskChange}
				masks={engine.getMasks()}
				slideStep={0.001}
				paddingTop="7px"
			/>
			<CoefInput
				label="feed rate"
				bind:coef={feedRate}
				{onMaskChange}
				masks={engine.getMasks()}
				slideStep={0.0001}
				paddingTop="7px"
			/>
			<CoefInput
				label="kill rate"
				bind:coef={killRate}
				{onMaskChange}
				masks={engine.getMasks()}
				slideStep={0.0001}
				paddingTop="7px"
			/>
		</fieldset>
		<fieldset class="size-cfg">
			<legend>Размер</legend>
			<div>
				{#if !fieldIsRect}<span class="dir-icon">↔</span>{/if}<input
					type="range"
					min="5"
					max={maxFieldSizeExp}
					value={fieldWidthExp}
					on:input={onFieldWidthExpChange}
				/>
				{fieldWidth}
				<label><input type="checkbox" bind:checked={fieldIsRect} />квадрат</label>
			</div>
			{#if !fieldIsRect}
				<div>
					<span class="dir-icon">↕</span><input
						type="range"
						min="5"
						max={maxFieldSizeExp}
						value={fieldHeightExp}
						on:input={onFieldHeightExpChange}
					/>
					{fieldHeight}
				</div>
			{/if}
		</fieldset>
		<fieldset class="draw-cfg">
			<legend>Рисование</legend>
			<button on:click={() => engine.clear()}>♻️</button>&nbsp;
			<button on:click={() => drawVertLines(1)}>|</button>
			<button on:click={() => drawVertLines(2)}>||</button>
			<button on:click={() => drawVertLines(3)}>|||</button>&nbsp;
			<button on:click={drawOneDot}>•</button>
			<button on:click={drawThreeDots}>
				<div style="margin:0 -2px 0 -2px; transform:translateY(-2px)">𐬽</div>
			</button>
			<button on:click={drawRandomDots} style="position:relative">
				<div style="margin:0 -3px 0 -2px">𐬽</div>
				<div style="position:absolute;left:-3px;top:-3px">𐬼</div>
			</button>
		</fieldset>
		<fieldset class="frame-cfg">
			<legend>Внешняя область</legend>
			<div class="switches">
				<div class="column">
					<label><input type="radio" value="repeat" bind:group={wrapMode} />повторять</label><br />
					<label><input type="radio" value="mirror" bind:group={wrapMode} />отразить</label>
					<div class="small dim">влияет на<br />симуляцию</div>
				</div>
				<div class="column">
					<label><input type="radio" value="visible" bind:group={frameMode} />отображать</label><br
					/>
					<label><input type="radio" value="darken" bind:group={frameMode} />затемнять</label><br />
					<label><input type="radio" value="hidden" bind:group={frameMode} />скрыть</label>
					<span class="small dim">быстрее</span>
				</div>
			</div>
			<div>
				размер: <input type="range" min="0" max="3" step="0.1" bind:value={frameSize} />
				{frameSize}
			</div>
		</fieldset>
	</div>
</div>

<style>
	fieldset legend {
		font-family: sans-serif;
	}

	.cfg-wrap {
		position: fixed;
		left: 0;
		top: 0;
		max-height: 100vh;
		background-color: rgba(255, 255, 255, 0.95);
		transition: opacity 0.1s ease;
		z-index: 1;
		white-space: nowrap;
		display: flex;
		flex-direction: column;
		transform: translateZ(0);
		opacity: 0.95;
		box-shadow: 1px 1px 8px black;
	}
	.cfg-wrap:hover {
		opacity: 1;
	}

	.cfg-head {
		padding: 5px 10px 5px 5px;
	}

	.cfg-scroll {
		padding: 0 5px 5px 5px;
		overflow-y: scroll;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
		transition: scrollbar-color 0.1s ease;
	}
	.cfg-scroll:hover {
		scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
	}
	.cfg-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.cfg-scroll::-webkit-scrollbar-track {
		background-color: transparent;
	}
	.cfg-scroll::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.1);
		/* not working transition: background-color 0.1s ease; */
	}
	.cfg-scroll:hover::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.3);
	}

	fieldset {
		border: 2px solid darkgray;
		border-radius: 4px;
	}
	/* fieldset.collapsed {
		border-left: none;
		border-bottom: none;
		border-right: none;
		border-radius: 0;
		padding: inherit 0 0 0;
		padding-bottom: 0;
		padding-top: 0;
	} */

	.sim-cfg {
		position: relative;
	}
	.mask-label {
		position: absolute;
		right: 44px;
		top: -10px;
	}

	.size-cfg input[type='range'] {
		width: 128px;
	}
	.dir-icon {
		display: inline-block;
		width: 16px;
		text-align: center;
	}

	@supports (-moz-appearance: none) {
		.draw-cfg button {
			padding: 0;
		}
	}
	.draw-cfg button {
		line-height: 18px;
	}
	.draw-cfg button.active {
		box-shadow: 0 0 3px green;
	}

	.frame-cfg .switches {
		display: flex;
		margin-bottom: 8px;
	}
	.frame-cfg .column:first-of-type {
		margin-right: 24px;
	}
	.frame-cfg .column div {
		margin-left: 12px;
	}
	.frame-cfg input[type='range'] {
		width: 128px;
	}
</style>
