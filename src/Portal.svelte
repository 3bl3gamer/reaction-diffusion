<script lang="ts">
	// https://github.com/sveltejs/svelte/issues/3088#issuecomment-505785516
	import { onMount } from 'svelte'

	export let fakeElem: HTMLDivElement | null = null

	onMount(() => {
		// const portalWrap = document.createElement('div')
		// portalWrap.className = 'portal'
		// document.body.appendChild(portalWrap)
		// portalWrap.appendChild(ref)
		// return () => document.body.removeChild(portalWrap)
		const child = fakeElem!.children[0]
		const parent = child.parentElement!
		document.body.appendChild(child)
		return () => parent.appendChild(child)
	})
</script>

<div class="fake-portal" bind:this={fakeElem}>
	<slot />
</div>

<style>
	.fake-portal {
		display: none;
	}
</style>
