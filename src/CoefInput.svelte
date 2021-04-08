<script lang="ts">
	import { Coef, MaskCircle, MaskGradient, MaskSmoothCircle, MaskSolid } from './engine'
	import type { Mask } from './engine'
	import NumberInputExt from './NumberInputExt.svelte'

	export let label: string
	export let coef: Coef
	export let masks: Mask[]
	export let onMaskChange: () => void
	export let slideStep
	export let paddingTop = ''

	// 🡔 🡕 🡖 🡗  🡐 🡒 🡑 🡓
	const angleArrows = { 0: '🡒', 45: '🡖', 90: '🡓', 270: '🡑', 315: '🡕' }

	function needMinValueFor(mask: Mask) {
		return !(mask instanceof MaskSolid)
	}

	function maskName(mask: Mask) {
		if (mask instanceof MaskSolid) return 'сплошная ■'
		if (mask instanceof MaskGradient) {
			const angle = Math.round(mask.getAngleDeg())
			const label = angleArrows[angle] || angle.toFixed(0) + '°'
			return `градиент ${label}`
		}
		if (mask instanceof MaskCircle) return 'круг ⬤\uFE0E'
		if (mask instanceof MaskSmoothCircle) return 'пятно ☀'
		return '???'
	}

	function flipRange() {
		;[coef.minVal, coef.maxVal] = [coef.maxVal, coef.minVal]
	}

	function onMinValChange(value: number) {
		coef.minVal = value
	}
	function onMaxValChange(value: number) {
		coef.maxVal = value
		if (coef.mask instanceof MaskSolid) coef.minVal = value
	}
	function onMaskChangeInner(e) {
		const oldMask = coef.mask
		coef.mask = masks[e.currentTarget.value]
		if (!needMinValueFor(oldMask) && needMinValueFor(coef.mask) && coef.minVal === coef.maxVal)
			coef.minVal = (coef.maxVal * 3) / 4
		onMaskChange()
	}
</script>

<div class="wrap" style="padding-top:{paddingTop}">
	<b>{label}</b>
	<div style="float:right">
		<!-- svelte-ignore a11y-no-onchange -->
		<select value={coef.mask} on:change={onMaskChangeInner}>
			{#each masks as m, i}
				<option value={i}>{maskName(m)}</option>
			{/each}
		</select>
	</div>
	<br />
	{#if needMinValueFor(coef.mask)}
		<NumberInputExt value={coef.minVal} onChange={onMinValChange} {slideStep} />
		<button class="swap-button" on:click={flipRange}><div>⇄</div></button>
	{/if}
	<NumberInputExt value={coef.maxVal} onChange={onMaxValChange} {slideStep} />
</div>

<style>
	@supports (-moz-appearance: none) {
		.wrap .swap-button {
			padding: 0;
		}
	}
	.wrap .swap-button div {
		margin: -4px -7px;
	}
</style>
