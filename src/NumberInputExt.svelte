<script context="module" lang="ts">
	let specialControlsUsedTimes = 0
</script>

<script lang="ts">
	import { onMount } from 'svelte'
	import { controlSingle, controlWheel } from 'js-control'
	import Tip from './Tip.svelte'

	export let value: number
	export let onChange: ((val: number) => void) | null | undefined
	export let slideStep = 1

	let wrap: HTMLDivElement
	let slider: HTMLDivElement
	let mouseIsOver = false

	let isGrabing = false
	onMount(() => {
		let grabValue = 0
		let grabY = 0
		const control = controlSingle({
			startElem: slider,
			callbacks: {
				singleDown(e, id, x, y) {
					isGrabing = true
					grabValue = value
					grabY = y
					return true
				},
				singleMove(e, id, x, y) {
					value = grabValue - (y - grabY) * slideStep
					specialControlsUsedTimes++
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
	onMount(() => {
		const control = controlWheel({
			startElem: wrap,
			offsetElem: 'no-offset',
			wheelRot(e, dx, dy, dz, x, y) {
				value -= dy * 0.02 * slideStep
				specialControlsUsedTimes++
				if (onChange) onChange(value)
				return true
			},
		})
		return () => control.off()
	})

	$: document.body.classList.toggle('grabbing', isGrabing)

	function onChangeInner(e) {
		const val = +e.currentTarget.value
		if (isNaN(val)) {
			e.currentTarget.setCustomValidity('не число')
		} else {
			value = val
			if (onChange) onChange(val)
			e.currentTarget.setCustomValidity('')
		}
	}
</script>

<div
	class="number-input-ext"
	class:grabbing={isGrabing}
	bind:this={wrap}
	on:mouseover={() => (mouseIsOver = true)}
	on:mouseout={() => (mouseIsOver = false)}
>
	<input {value} on:change={onChangeInner} />
	<div class="slider" bind:this={slider}>⭥</div>
	{#if mouseIsOver && specialControlsUsedTimes < 10}
		<Tip>
			Можно плавно изменять значение, если<br />
			потянуть <b>стрелочку</b> или покрутить <b>колёсико</b> мыши.
		</Tip>
	{/if}
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
		pointer-events: none;
		right: -4px;
		top: -2px;
		bottom: -2px;
		width: 13px;
		font-size: 20px;
		line-height: 18px;
		align-items: center;
		justify-content: center;
		background-color: lightgray;
		border-radius: 4px;
		border: 1px solid darkgray;
		opacity: 0;
		transition: opacity 0.1s ease;
	}
	.number-input-ext:not(.grabbing) .slider {
		cursor: grab;
	}
	.number-input-ext:hover .slider {
		pointer-events: all;
		opacity: 0.7;
	}
	.number-input-ext.grabbing .slider,
	.number-input-ext .slider:hover {
		pointer-events: all;
		opacity: 1;
		width: 15px;
		right: -5px;
		top: -3px;
		bottom: -3px;
		border-radius: 5px;
	}
</style>
