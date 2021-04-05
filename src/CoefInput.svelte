<script lang="ts">
	import { Coef, MaskSolid } from './engine'
	import type { Mask } from './engine'
	import NumberInputExt from './NumberInputExt.svelte'

	export let label: string
	export let coef: Coef
	export let masks: Mask[]
	export let onChange: () => void
	export let slideStep
	export let paddingTop = ''

	function maskName(mask: Mask) {
		if (mask instanceof MaskSolid) return 'сплошная'
		return '???'
	}

	function onMinValChange(value: number) {
		coef.minVal = value
		onChange()
	}
	function onMaxValChange(value: number) {
		coef.maxVal = value
		if (coef.mask instanceof MaskSolid) coef.minVal = value
		onChange()
	}
</script>

<div class="wrap" style="padding-top:{paddingTop}">
	<b>{label}</b>
	<div style="float:right">
		<!-- svelte-ignore a11y-no-onchange -->
		<select value={coef.mask} on:change={e => console.log(e.currentTarget.value)}>
			{#each masks as m, i}
				<option value={i}>{maskName(m)}</option>
			{/each}
		</select>
	</div>
	<br />
	{#if !(coef.mask instanceof MaskSolid)}
		<NumberInputExt value={coef.minVal} onChange={onMinValChange} {slideStep} /> —
	{/if}
	<NumberInputExt value={coef.maxVal} onChange={onMaxValChange} {slideStep} />
</div>

<!-- <style>
	.wrap {
		margin-top: 4px;
	}
	.wrap:not(:last-child) {
		margin-bottom: 6px;
	}
</style> -->
