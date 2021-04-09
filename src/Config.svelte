<script context="module" lang="ts">
	export type FrameMode = 'visible' | 'darken' | 'hidden'
	// highlight is broken without this
	0; //prettier-ignore
</script>

<script lang="ts">
	import CoefInput from './CoefInput.svelte'
	import { MaskCircle, MaskGradient, MaskSmoothCircle, MaskSolid, ReactionDiffusion } from './engine'
	import type { ResultColorMode } from './engine'

	export let engine: ReactionDiffusion
	export let frameSize: number
	export let frameMode: FrameMode = 'darken'
	export let itersPerFrame = 24
	export let onResize: () => void
	export let onScreenshot: () => void
	export let wrapElem: HTMLDivElement
	export let isShown = true

	let colorMode: ResultColorMode = 'green'

	let e = () => engine //hiding engine (and it's methods) from reactivity

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
	$: timeDelta = e().getCoefs().timeDelta
	const onMaskChange = () => engine.updateIterationData()

	$: e().setWrapMode(wrapMode)
	$: wrapMode = e().getWrapMode()

	$: e().toggleFrame(frameMode === 'darken')

	$: e().setColorMode(colorMode)

	function toExp2(value: number) {
		if (value <= 1) return value
		const exp = Math.floor(Math.log2(value))
		return exp * 2 + (value - Math.pow(2, exp) < Math.pow(2, exp - 1) ? 0 : 1)
	}
	function fromExp2(exp: number) {
		if (exp <= 1) return exp
		const value = Math.pow(2, Math.floor(exp / 2))
		return value + (exp % 2 === 0 ? 0 : value / 2)
	}
	$: itersPerFrameExp = toExp2(itersPerFrame)
	const onItersPerFrameExpChange = e => (itersPerFrame = fromExp2(+e.currentTarget.value))

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') isShown = !isShown
	}

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

	function mustFundMask(func) {
		const mask = engine.getMasks().find(func)
		if (!mask) throw new Error('mask not found')
		return mask
	}
	function preset(func) {
		const coefs = engine.getCoefs()

		for (const name in coefs) coefs[name].mask = engine.getMasks().find(x => x instanceof MaskSolid)

		diffusionRateA.minVal = diffusionRateA.maxVal = 1
		diffusionRateB.minVal = diffusionRateB.maxVal = 0.5
		feedRate.minVal = feedRate.maxVal = 0.055
		killRate.minVal = killRate.maxVal = 0.062
		timeDelta.minVal = timeDelta.maxVal = 1

		wrapMode = 'repeat'
		engine.clear()
		func()
		engine.updateIterationData()
	}
	const presetFuncs = {
		'рождение Вселенной'() {
			feedRate.minVal = 0.018
			feedRate.maxVal = 0.055
			feedRate.mask = mustFundMask(x => x instanceof MaskSmoothCircle)
			drawOneDot()
		},
		'дерево в рамке'() {
			diffusionRateA.minVal = diffusionRateA.maxVal = 0.9344339479362163
			diffusionRateB.minVal = 0.6366397881990161
			diffusionRateB.maxVal = 0.4177794651597456
			diffusionRateB.mask = mustFundMask(x => x instanceof MaskGradient && x.getAngleDeg() === 315)
			feedRate.minVal = 0.0847265052049363
			feedRate.maxVal = 0.014681911230716192
			feedRate.mask = mustFundMask(x => x instanceof MaskGradient && x.getAngleDeg() === 315)
			killRate.minVal = killRate.maxVal = 0.061886156571588954
			drawVertLines(1)
		},
		реактор() {
			feedRate.minVal = 0.055
			feedRate.maxVal = 0.0272
			feedRate.mask = mustFundMask(x => x instanceof MaskCircle)
			killRate.minVal = 0.062
			killRate.maxVal = 0.05
			killRate.mask = mustFundMask(x => x instanceof MaskSmoothCircle)
			drawRandomDots()
		},
		спирали() {
			diffusionRateA.minVal = diffusionRateA.maxVal = 0
			diffusionRateB.minVal = diffusionRateB.maxVal = 0.5
			feedRate.minVal = feedRate.maxVal = 0.015
			killRate.minVal = killRate.maxVal = 0.045
			timeDelta.minVal = timeDelta.maxVal = 0.3
			const [w, h] = engine.getSize()
			const [cx, cy] = [w / 2, h / 2]
			const step = 0.2
			const r = a => a * 30
			const xy = (a, dr) => [cx + Math.cos(a) * (r(a) + dr), cy + Math.sin(a) * (r(a) + dr)] as const
			for (let a = 0; r(a) < Math.min(w / 2, h / 2); a += step) {
				engine.drawLine(...xy(a, 0), ...xy(a + step, 0), [0.25, 0.2])
				engine.drawLine(...xy(a, 3), ...xy(a + step, 3), [0.25, 0.2])
				engine.drawLine(...xy(a, 6), ...xy(a + step, 6), [0.25, 0.2])
				engine.drawLine(...xy(a, 9), ...xy(a + step, 9), [0.25, 0.2])
				engine.drawLine(...xy(a, 12), ...xy(a + step, 12), [0, 1])
			}
		},
		'карта kill/feed'() {
			feedRate.minVal = 0.01 //- 0.007
			feedRate.maxVal = 0.1 //+ 0.03
			feedRate.mask = mustFundMask(x => x instanceof MaskGradient && x.getAngleDeg() === 0)
			killRate.minVal = 0.045 //- 0.01
			killRate.maxVal = 0.07 //+ 0.01
			killRate.mask = mustFundMask(x => x instanceof MaskGradient && x.getAngleDeg() === 270)
			wrapMode = 'mirror'
			for (let i = 0; i < 10; i++) drawRandomDots()
		},
		'карта диффузий'() {
			diffusionRateA.minVal = 0.3
			diffusionRateA.maxVal = 1
			diffusionRateA.mask = mustFundMask(x => x instanceof MaskGradient && x.getAngleDeg() === 0)
			diffusionRateB.minVal = 0.1
			diffusionRateB.maxVal = 0.6
			diffusionRateB.mask = mustFundMask(x => x instanceof MaskGradient && x.getAngleDeg() === 270)
			wrapMode = 'mirror'
			for (let i = 0; i < 10; i++) drawRandomDots()
		},
	}
	function random() {
		preset(() => {
			const limits: Record<string, [number, number]> = {
				diffusionRateA: [0.2, 1],
				diffusionRateB: [0.1, 0.8],
				feedRate: [0.005, 0.12],
				killRate: [0.035, 0.07],
				timeDelta: [0.8, 1],
			}
			const masks = engine.getMasks()
			const maskSolid = masks.find(x => x instanceof MaskSolid)!
			for (const [name, coef] of Object.entries(engine.getCoefs())) {
				const mask = Math.random() > 0.8 ? maskSolid : masks[(Math.random() * masks.length) | 0]
				coef.mask = mask
				const [min, max] = limits[name]
				coef.maxVal = min + Math.random() * (max - min)
				coef.minVal = mask === maskSolid ? coef.maxVal : min + Math.random() * (max - min)
			}
			if (Math.random() < 0.25) {
				drawVertLines((1 + Math.random() * 3.999) | 0)
			} else if (Math.random() < 0.333) {
				drawOneDot()
			} else if (Math.random() < 0.5) {
				drawThreeDots()
			} else {
				drawRandomDots()
			}
		})
	}
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="cfg-wrap" class:minimized={!isShown} bind:this={wrapElem}>
	<div class="cfg-head">
		{#if isShown}
			<button class="link-like" on:click={() => (isShown = false)}>&lt;&lt; скрыть (esc)</button>
		{:else}
			<button class="link-like" on:click={() => (isShown = true)}>&gt;&gt;</button>
		{/if}
		<button class="link-like" style="float:right" on:click={onScreenshot}>скриншот</button>
	</div>
	<div class="cfg-scroll">
		<div class="info-block">
			<h1>Reaction-Diffusion</h1>
		</div>
		<fieldset class="cfg-presets">
			<legend>Пресеты</legend>
			<button class="link-like random" on:click={random}>случайно</button><br />
			{#each Object.entries(presetFuncs) as [name, func]}
				<button class="link-like" on:click={() => preset(func)}>{name}</button><br />
			{/each}
		</fieldset>
		<fieldset>
			<legend>Статус</legend>
			<div><slot name="fps" /> FPS, <slot name="ips" /> итераций/с</div>
			{#if !engine.isHighpSupported()}
				<div class="warn small wrap-words">
					девайс/браузер не поддерживает высокую точность вычислений на видеокарте, симуляция будет
					неточной
				</div>
			{/if}
		</fieldset>
		<fieldset>
			<legend>Цвет</legend>
			<label><input type="radio" value="whiteBlack" bind:group={colorMode} />ч/б</label>
			<label><input type="radio" value="rgb" bind:group={colorMode} />RGB</label>
			<label><input type="radio" value="green" bind:group={colorMode} />зелёный</label><br />
			<label><input type="radio" value="changes" bind:group={colorMode} />изменения</label>
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
			<div class="dim small" style="text-align:center">а ещё — мышкой/пальцем</div>
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
			<CoefInput
				label="speed"
				bind:coef={timeDelta}
				{onMaskChange}
				masks={engine.getMasks()}
				slideStep={0.01}
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
		<fieldset>
			<legend>Итераций на кадр</legend>
			<span class="dim">плавнее</span>
			<input
				type="range"
				class="iters-input"
				min="1"
				max="14"
				value={itersPerFrameExp}
				on:input={onItersPerFrameExpChange}
			/>
			{itersPerFrame}
			<span class="dim">быстрее</span>
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
	button.link-like {
		border: none;
		background: none;
		color: #00e;
		cursor: pointer;
		font-family: Cantarell;
		font-size: 16px;
	}
	.wrap-words {
		white-space: initial;
	}

	.cfg-wrap {
		position: fixed;
		left: 0;
		top: 0;
		max-width: 324px;
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

	.cfg-wrap.minimized {
		background: none;
		width: 0;
		text-shadow: 0px 0px 2px white;
	}
	.cfg-wrap.minimized .cfg-scroll {
		display: none;
	}

	.cfg-head {
		padding: 5px 10px 5px 5px;
	}

	.cfg-scroll {
		padding: 0 5px 5px 5px;
		overflow-y: scroll;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
		transition: scrollbar-color 0.1s ease;
	}
	.cfg-scroll:hover {
		scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
	}
	.cfg-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.cfg-scroll::-webkit-scrollbar-track {
		background-color: transparent;
	}
	.cfg-scroll::-webkit-scrollbar-thumb {
		background-color: rgba(0, 0, 0, 0.2);
		/* not working transition: background-color 0.1s ease; */
	}
	.cfg-scroll:hover::-webkit-scrollbar-thumb {
		background-color: rgba(0, 0, 0, 0.3);
	}

	.info-block {
		margin-left: 14px;
		font-family: sans-serif;
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

	.cfg-presets .random {
		color: firebrick;
		text-shadow: 0 0 3px rgba(255, 0, 0, 0.3);
	}

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
	/* .draw-cfg button.active {
		box-shadow: 0 0 3px green;
	} */

	.iters-input {
		width: 84px;
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
