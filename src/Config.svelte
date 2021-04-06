<script context="module" lang="ts">
	export type FrameMode = 'visible' | 'darken' | 'hidden'
</script>

<script lang="ts">
	import CoefInput from './CoefInput.svelte'
	import type { ReactionDiffusion } from './engine'

	export let engine: ReactionDiffusion
	export let frameSize: number
	export let frameMode: FrameMode = 'darken'

	const e = () => engine //hiding engine (and it's methods) from reactivity

	$: diffusionRateA = e().getCoefs().diffusionRateA
	$: diffusionRateB = e().getCoefs().diffusionRateB
	$: killRate = e().getCoefs().killRate
	$: feedRate = e().getCoefs().feedRate
	const onMaskChange = () => engine.updateIterationData()

	$: e().setWrapMode(wrapMode)
	$: wrapMode = e().getWrapMode()

	$: e().toggleFrame(frameMode === 'darken')
</script>

<div class="cfg-wrap">
	<div class="cfg-head">...</div>
	<div class="cfg-scroll">
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
		<div>speed: <slot name="fps" /></div>
	</div>
</div>

<style>
	.cfg-wrap {
		position: fixed;
		left: 0;
		top: 0;
		max-height: 100vh;
		background-color: rgba(255, 255, 255, 0.92);
		transition: opacity 0.1s ease;
		z-index: 1;
		white-space: nowrap;
		display: flex;
		flex-direction: column;
		transform: translateZ(0);
		opacity: 0.95;
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

	.frame-cfg .switches {
		display: flex;
		margin-bottom: 8px;
	}
	.frame-cfg .column:first-of-type {
		margin-right: 40px;
	}
	.frame-cfg .column div {
		margin-left: 12px;
	}
</style>
