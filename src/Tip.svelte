<script lang="ts">
	import { onMount } from 'svelte'
	import Portal from './Portal.svelte'

	let fakePortalElem: HTMLDivElement
	let wrap: HTMLDivElement
	let left = 0
	let top = 0

	onMount(() => {
		const parent = fakePortalElem.parentElement
		if (parent) {
			const parentRect = parent.getBoundingClientRect()
			const wrapRect = wrap.getBoundingClientRect()
			left = parentRect.left
			top = parentRect.top - wrapRect.height - 12
		}
	})
</script>

<Portal bind:fakeElem={fakePortalElem}>
	<div class="tip-wrap" style="left:{left}px; top:{top}px" bind:this={wrap}>
		<slot />
	</div>
</Portal>

<style>
	.tip-wrap {
		position: fixed;
		z-index: 10000;
		background: rgba(255, 255, 255, 0.9);
		padding: 3px 5px;
		border-radius: 3px;
		box-shadow: 0 0 5px black;
	}
</style>
