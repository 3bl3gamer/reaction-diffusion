<script lang="ts">
	import { onMount } from 'svelte'
	import { controlSingle } from 'js-control'

	export let value: number
	export let onChange: ((val: number) => void) | null | undefined
	export let slideStep = 1

	let slider: HTMLDivElement

	let isGrabing = false
	onMount(() => {
		let grabValue = 0
		let grabX = 0
		const control = controlSingle({
			startElem: slider,
			callbacks: {
				singleDown(e, id, x, y) {
					isGrabing = true
					grabValue = value
					grabX = x
					return true
				},
				singleMove(e, id, x, y) {
					value = grabValue + (x - grabX) * slideStep
					if (onChange) onChange(value)
					return true
				},
				singleUp(e, id) {
					isGrabing = false
					return true
				},
			},
		})
		return () => control.off()
	})

	$: document.body.classList.toggle('grabbing', isGrabing)

	function onChangeInner(e) {
		const val = parseFloat(e.currentTarget.value)
		if (!isNaN(val)) {
			value = val
			if (onChange) onChange(val)
		}
	}
</script>

<div class="number-input-ext" class:grabbing={isGrabing}>
	<input type="number" step="any" {value} on:change={onChangeInner} />
	<div class="slider" bind:this={slider}>⟷</div>
</div>

<style>
	.number-input-ext {
		position: relative;
		display: inline-block;
	}
	.number-input-ext input {
		width: 56px;
	}
	.slider {
		position: absolute;
		display: flex;
		left: 0;
		top: 0;
		width: 100%;
		height: 40%;
		align-items: center;
		justify-content: center;
		background-color: lightgray;
		opacity: 0;
		transition: opacity ease 0.1s, height ease 0.1s;
	}
	.number-input-ext:not(.grabbing) .slider {
		cursor: grab;
	}
	.number-input-ext:hover .slider {
		opacity: 0.5;
	}
	.number-input-ext .slider:hover {
		opacity: 1;
		height: 60%;
	}
	.number-input-ext.grabbing .slider {
		opacity: 0.5;
		height: 100%;
	}
</style>
