<script lang="ts">
	let fps = 0
	let lastUpdStamp = Date.now()
	let framesCount = 0
	let prevFPS: number[] = []

	export let average = 1

	export function frame(n?: number): void {
		framesCount += n || 1
		const now = Date.now()
		const delta = now - lastUpdStamp
		if (delta >= 1000) {
			if (average <= 1) {
				fps = framesCount
			} else {
				prevFPS.push(framesCount)
				if (prevFPS.length > average) prevFPS.shift()
				let sum = 0
				for (let i = 0; i < prevFPS.length; i++) sum += prevFPS[i]
				fps = sum / prevFPS.length
			}
			lastUpdStamp = delta < 2000 ? lastUpdStamp - 1000 : now
			lastUpdStamp = now
			framesCount = 0
		}
	}
</script>

{fps.toFixed(0)}
