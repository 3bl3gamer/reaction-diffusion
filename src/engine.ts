import { createGfxFramebuffer, GfxFramebuffer } from './gfx/framebuffers'
import { createGfxBuffer, GfxBuffer } from './gfx/buffers'
import { createShaderProgram, mustGetUniformLocation } from './gfx/shaders'
import { createGfxTexture2d, GfxTexture2d } from './gfx/textures'
import { makeSimpleDrawFunc, setRenderTarget } from './gfx/utils'


export type Mask = {
	fill(tex: GfxTexture2d, channel: number, valMin: number, valMax: number): void
}

export class MaskSolid {
	private draw: (tex: GfxTexture2d, channel: number, valMin: number, valMax: number) => void
	private uChannel: WebGLUniformLocation
	private uValueRange: WebGLUniformLocation

	constructor(gl: WebGLRenderingContext, rect: GfxBuffer) {
		const fs = `
		precision highp float;

		varying vec2 vTextureCoord;
		uniform sampler2D uSampler;
		uniform int uChannel;
		uniform vec2 uValueRange;

		void main(void) {
			vec4 c = texture2D(uSampler, vTextureCoord);
			if (uChannel == 0) c.x = uValueRange.y;
			if (uChannel == 1) c.y = uValueRange.y;
			if (uChannel == 2) c.z = uValueRange.y;
			if (uChannel == 3) c.w = uValueRange.y;
			gl_FragColor = c;
		}`
		const prog = createShaderProgram(gl, simpleTextureVS, fs)
		this.uChannel = mustGetUniformLocation(gl, prog, 'uChannel')
		this.uValueRange = mustGetUniformLocation(gl, prog, 'uValueRange')
		this.draw = makeSimpleDrawFunc(gl, rect, prog, {
			beforeDraw: (tex: GfxTexture2d, channel: number, valMin: number, valMax: number) => {
				gl.uniform1i(this.uChannel, channel)
				gl.uniform2f(this.uValueRange, valMin, valMax)
				gl.activeTexture(gl.TEXTURE0)
				tex.bind(gl)
			},
		})
	}

	fill(tex: GfxTexture2d, channel: number, valMin: number, valMax: number): void {
		this.draw(tex, channel, valMin, valMax)
	}
}

export class Coef {
	constructor(public minVal: number, public maxVal: number, public mask: Mask) {}

	fill(tex: GfxTexture2d, channel: number): void {
		this.mask.fill(tex, channel, this.maxVal, this.minVal)
	}
}

export type Coefs = {
	diffusionRateA: Coef
	diffusionRateB: Coef
	feedRate: Coef
	killRate: Coef
}

export type WrapMode = 'repeat' | 'mirror'

export type View = { x: number; y: number; width: number; height: number }

function makeFieldTexture(gl: WebGLRenderingContext, w: number, h: number) {
	const tex = createGfxTexture2d(gl, w, h, gl.RGBA, gl.FLOAT, null)
	// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT) //CLAMP_TO_EDGE
	// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT) //CLAMP_TO_EDGE
	// min and mag are required for float tex
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	return tex
}

const dot = (() => {
	const width = 5
	const offset = (width - 1) / 2
	const buf = new Float32Array(4 * width * width)
	for (let i = 0; i < buf.length; i++) buf[i + 1] = 1
	return { width, offset, buf }
})()
function addDot(gl: WebGLRenderingContext, tex: GfxTexture2d, x: number, y: number): void {
	tex.bind(gl)
	const w = dot.width
	gl.texSubImage2D(gl.TEXTURE_2D, 0, x - dot.offset, y - dot.offset, w, w, gl.RGBA, gl.FLOAT, dot.buf)
}

const simpleTextureVS = `
precision highp float;

attribute vec2 aPosition;
varying vec2 vTextureCoord;

void main(void) {
	vTextureCoord = aPosition;
	gl_Position = vec4((aPosition.xy-0.5)*2., 0, 1.);
}`
const iterationFS = `
precision highp float;
precision highp sampler2D;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uSamplerCoefs;
uniform float uTimeDelta;
uniform vec2 uScale;

void main(void) {
	vec4 c = texture2D(uSamplerCoefs, vTextureCoord);
	float diffusionRateA = c.x;//1.0 + mix(0.3, 1.0, vTextureCoord.x)*0.;
	float diffusionRateB = c.y;//0.5 + mix(0.1, 0.6, vTextureCoord.y)*0.;
	float feedRate = c.z;//0.055 + mix(0.01-0.007, 0.1+0.03, vTextureCoord.x)*0.;
	float killRate = c.w;//0.062 + mix(0.045-0.01, 0.07+0.01, vTextureCoord.y)*0.;

	vec2 cur = texture2D(uSampler, vTextureCoord).xy;

	vec2 lap = -cur + 
		0.2 * (
			texture2D(uSampler, vTextureCoord + uScale*vec2(1, 0)).xy +
			texture2D(uSampler, vTextureCoord + uScale*vec2(-1,0)).xy +
			texture2D(uSampler, vTextureCoord + uScale*vec2(0, 1)).xy +
			texture2D(uSampler, vTextureCoord + uScale*vec2(0,-1)).xy
		) + 0.05 * (
			texture2D(uSampler, vTextureCoord + uScale*vec2(-1,-1)).xy +
			texture2D(uSampler, vTextureCoord + uScale*vec2( 1,-1)).xy +
			texture2D(uSampler, vTextureCoord + uScale*vec2( 1, 1)).xy +
			texture2D(uSampler, vTextureCoord + uScale*vec2(-1, 1)).xy
		);

	float a = cur.x;
	float b = cur.y;
	float newA = a + (diffusionRateA * lap.x - a * b * b + feedRate * (1. - a)) * uTimeDelta;
	float newB = b + (diffusionRateB * lap.y + a * b * b - (killRate + feedRate) * b) * uTimeDelta;

	gl_FragColor = vec4(clamp(newA, 0., 1.), clamp(newB, 0., 1.), 0, 1.);
}`
const resultFS = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec2 uOffset;
uniform vec2 uSize;
uniform lowp int uFrameVisible;

void main(void) {
	vec2 pos = vTextureCoord*uSize + uOffset;
	vec2 col = texture2D(uSampler, pos).xy;
	float c = clamp((col.x - col.y)*2., 0., 1.);//(col.x-0.4)*4.;
	// float isIn = pos.x >= 0. && pos.y >= 0. && pos.x < 1. && pos.y < 1. ? 1. : 0.7;
	vec2 innerRect = step(0., pos) * step(-1., -pos);
	vec2 outerRect = step(-0.005, pos) * step(-1.005, -pos);
	float isIn = uFrameVisible > 0
		? (min(innerRect.x, innerRect.y)*0.8+0.2) + (1.-min(outerRect.x, outerRect.y))*0.4
		: 1.;
	gl_FragColor = vec4(mix(vec3(0.5), vec3(c, c, c), isIn), 1.);
	// gl_FragColor = vec4(c, 1.-col.y, col.x, 1.);
}`

export class ReactionDiffusion {
	private curFB: GfxFramebuffer
	private nextFB: GfxFramebuffer
	private coefsFB: GfxFramebuffer

	private coefs: Coefs
	private masks: Mask[]

	private wrapMode: WrapMode = 'repeat'
	private frameIsVisible = true

	private drawIteration: () => void
	private drawResult: (view: View | null) => void

	constructor(private gl: WebGLRenderingContext, private width: number, private height: number) {
		this.curFB = createGfxFramebuffer(gl, makeFieldTexture(gl, width, height))
		this.nextFB = createGfxFramebuffer(gl, makeFieldTexture(gl, width, height))
		gl.clearColor(1, 0, 0, 0)
		for (const fb of [this.curFB, this.nextFB]) {
			fb.bind(gl)
			gl.clear(gl.COLOR_BUFFER_BIT)
		}
		for (let i = 0; i < 200; i++) {
			const x = (width * (0.5 + (Math.random() - 0.5) * 0.9)) | 0
			const y = (height * (0.5 + (Math.random() - 0.5) * 0.9)) | 0
			addDot(gl, this.curFB.gfxTex, x, y)
		}
		this.coefsFB = createGfxFramebuffer(gl, makeFieldTexture(gl, 2, 2))

		const rectVtx = [0,0, 0,1, 1,1, 1,1, 1,0, 0,0] //prettier-ignore
		const rect = createGfxBuffer(gl, rectVtx, 2, gl.TRIANGLES)

		const progIteration = createShaderProgram(gl, simpleTextureVS, iterationFS)
		const progResult = createShaderProgram(gl, simpleTextureVS, resultFS)

		const maskSolid = new MaskSolid(gl, rect)
		this.coefs = {
			diffusionRateA: new Coef(1.0, 1.0, maskSolid),
			diffusionRateB: new Coef(0.5, 0.5, maskSolid),
			feedRate: new Coef(0.055, 0.055, maskSolid),
			killRate: new Coef(0.062, 0.062, maskSolid),
		}
		this.masks = [maskSolid]

		this.updateCoefsFB()

		const uScale = mustGetUniformLocation(gl, progIteration, 'uScale')
		const uSampler = mustGetUniformLocation(gl, progIteration, 'uSampler')
		const uSamplerCoefs = mustGetUniformLocation(gl, progIteration, 'uSamplerCoefs')
		const uTimeDelta = mustGetUniformLocation(gl, progIteration, 'uTimeDelta')
		this.drawIteration = makeSimpleDrawFunc(gl, rect, progIteration, {
			beforeDraw: () => {
				gl.uniform2f(uScale, 1 / this.width, 1 / this.height)
				gl.uniform1i(uSampler, 0)
				gl.uniform1i(uSamplerCoefs, 1)
				gl.uniform1f(uTimeDelta, 0.5)
			},
		})
		const uOffset = mustGetUniformLocation(gl, progResult, 'uOffset')
		const uSize = mustGetUniformLocation(gl, progResult, 'uSize')
		const uFrameVisible = mustGetUniformLocation(gl, progResult, 'uFrameVisible')
		this.drawResult = makeSimpleDrawFunc(gl, rect, progResult, {
			beforeDraw: (view: View | null) => {
				if (view === null) {
					gl.uniform2f(uOffset, 0, 0)
					gl.uniform2f(uSize, 1, 1)
					gl.uniform1i(uFrameVisible, 0)
				} else {
					const { width: gw, height: gh } = gl.canvas
					gl.uniform2f(uOffset, -view.x / view.width, -view.y / view.height)
					gl.uniform2f(uSize, gw / view.width, gh / view.height)
					gl.uniform1i(uFrameVisible, this.frameIsVisible ? 1 : 0)
				}
			},
		})
	}

	iter(n: number): void {
		const gl = this.gl

		gl.activeTexture(gl.TEXTURE1)
		this.coefsFB.gfxTex.bind(gl)

		for (let i = 0; i < n; i++) {
			setRenderTarget(gl, this.nextFB)

			gl.activeTexture(gl.TEXTURE0)
			this.curFB.gfxTex.bind(gl)

			this.drawIteration()
			;[this.curFB, this.nextFB] = [this.nextFB, this.curFB]
		}
	}

	draw(view: View | null): void {
		setRenderTarget(this.gl, null)
		// this.gl.viewport(0, 0, this.width, this.height)
		this.curFB.gfxTex.bind(this.gl)
		this.drawResult(view)
	}

	updateCoefsFB(): void {
		const gl = this.gl
		const nextFB = this.nextFB
		const coefsFB = this.coefsFB
		// Safari does not support EXT_float_blend, so we can't just add-blend 4 channes one-by-one
		setRenderTarget(gl, this.coefsFB)
		gl.clearColor(0, 0, 0, 0)
		gl.clear(gl.COLOR_BUFFER_BIT)

		setRenderTarget(gl, nextFB)
		this.coefs.diffusionRateA.fill(coefsFB.gfxTex, 0)

		setRenderTarget(gl, coefsFB)
		this.coefs.diffusionRateB.fill(nextFB.gfxTex, 1)

		setRenderTarget(gl, nextFB)
		this.coefs.feedRate.fill(coefsFB.gfxTex, 2)

		setRenderTarget(gl, coefsFB)
		this.coefs.killRate.fill(nextFB.gfxTex, 3)

		setRenderTarget(gl, null)
	}
	updateTexWrapMode(): void {
		const gl = this.gl
		const mode = this.wrapMode === 'repeat' ? gl.REPEAT : gl.MIRRORED_REPEAT
		for (const fb of [this.curFB, this.nextFB]) {
			fb.gfxTex.bind(gl)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mode)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mode)
		}
	}

	getCoefs(): Coefs {
		return this.coefs
	}
	getMasks(): Mask[] {
		return this.masks
	}
	getSize(): [number, number] {
		return [this.width, this.height]
	}
	getWrapMode(): WrapMode {
		return this.wrapMode
	}
	setWrapMode(wrapMode: WrapMode): void {
		this.wrapMode = wrapMode
		this.updateTexWrapMode()
	}
	isFrameVisible(): boolean {
		return this.frameIsVisible
	}
	toggleFrame(isVisible: boolean): void {
		this.frameIsVisible = isVisible
	}
}

export function setupRecorder(
	canvas: HTMLCanvasElement,
): { start(): void; stop(): void; requestFrame(): void } {
	const stream = canvas.captureStream(0)
	const recordedBlobs: BlobPart[] = []
	const recorderOptions = { videoBitsPerSecond: 100 * 1000 * 1000, mimeType: 'video/webm;codecs=vp9' }
	const mediaRecorder = new MediaRecorder(stream, recorderOptions)

	mediaRecorder.onstart = handleStart
	mediaRecorder.onstop = handleStop
	mediaRecorder.ondataavailable = handleDataAvailable
	// // @ts-ignore
	// window.mediaRecorder = mediaRecorder

	function handleDataAvailable(event) {
		// console.log('chunk', event.data.size)
		if (event.data && event.data.size > 0) {
			recordedBlobs.push(event.data)
		}
	}
	function handleStart() {
		console.log('recording started')
		recordedBlobs.length = 0
	}
	function handleStop() {
		console.log('recording stopped')
		const superBuffer = new Blob(recordedBlobs, { type: 'video/webm' })
		if (true) {
			const video = document.createElement('video')
			video.src = URL.createObjectURL(superBuffer)
			video.controls = true
			video.style.position = 'absolute'
			video.style.zIndex = '100'
			document.body.appendChild(video)
			console.log('done, check video element somewhere at page bottom')
		}
		if (true) {
			const a = document.createElement('a')
			document.body.appendChild(a)
			a.style.display = 'none'
			a.href = URL.createObjectURL(superBuffer)
			a.download = 'video.webm'
			a.click()
			//document.body.removeChild(a);
			//URL.revokeObjectURL(a.href);
		}
	}
	return {
		start() {
			mediaRecorder.start()
		},
		stop() {
			mediaRecorder.stop()
		},
		requestFrame() {
			// @ts-ignore
			const track: CanvasCaptureMediaStreamTrack = stream.getVideoTracks()[0]
			track.requestFrame()
		},
	}
}
