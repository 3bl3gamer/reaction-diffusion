<script lang="ts">
	let fps = 0
	let lastUpdStamp = Date.now()
	let framesCount = 0

	export let intervalMS = 1000
	export function frame(n?: number): void {
		framesCount += n || 1
		const now = Date.now()
		if (now > lastUpdStamp + intervalMS) {
			fps = framesCount
			lastUpdStamp = now
			framesCount = 0
		}
	}
</script>

{fps}
