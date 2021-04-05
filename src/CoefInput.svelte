<script lang="ts">
	import { Coef, MaskSolid } from './engine'
	import type { Mask } from './engine'
	import NumberInputExt from './NumberInputExt.svelte'

	export let label: string
	export let coef: Coef
	export let masks: Mask[]
	export let onChange: () => void
	export let slideStep

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

<div>
	{label}
	{#if !(coef.mask instanceof MaskSolid)}
		<NumberInputExt value={coef.minVal} onChange={onMinValChange} {slideStep} /> —
	{/if}
	<NumberInputExt value={coef.maxVal} onChange={onMaxValChange} {slideStep} />
	<!-- svelte-ignore a11y-no-onchange -->
	<select value={coef.mask} on:change={e => console.log(e.currentTarget.value)}>
		{#each masks as m, i}
			<option value={i}>{maskName(m)}</option>
		{/each}
	</select>
</div>
