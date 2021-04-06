import { createGfxFramebuffer, GfxFramebuffer } from './gfx/framebuffers'
import { createGfxBuffer, GfxBuffer } from './gfx/buffers'
import {
	createGfxShaderProgram,
	deleteGfxShaderProgramWithShaders,
	GfxSharerProgram,
	mustGetGfxUniformLocation,
} from './gfx/shaders'
import { createGfxTexture2d, GfxTexture2d, resizeGfxTexture2d } from './gfx/textures'
import { makeSimpleDrawFunc, setRenderTarget } from './gfx/utils'
import { mat3 } from 'gl-matrix'

type FSParts = { declaration: string; usage: string }
type FSPrepareFunc = (valMin: number, valMax: number) => void

export type Mask = {
	getFSParts(suffix: string): FSParts
	prepareFSUniforms(gl: WebGLRenderingContext, prog: GfxSharerProgram, suffix: string): FSPrepareFunc
}

export class MaskSolid {
	getFSParts(suffix: string): FSParts {
		return { declaration: `uniform float uMaskSolid${suffix};`, usage: `uMaskSolid${suffix}` }
	}
	prepareFSUniforms(gl: WebGLRenderingContext, prog: GfxSharerProgram, suffix: string): FSPrepareFunc {
		const uMaskGradient = mustGetGfxUniformLocation(gl, prog, `uMaskSolid${suffix}`)
		return (valMin: number, valMax: number) => {
			gl.uniform1f(uMaskGradient, valMax)
		}
	}
}

export class MaskGradient {
	constructor(private angle: number) {}

	getFSParts(suffix: string): FSParts {
		const c = Math.cos(this.angle).toFixed(5)
		const s = Math.sin(-this.angle).toFixed(5) //-angle since y is flipped (goes up)
		const varName = 'uMaskGradient' + suffix
		return {
			declaration: `uniform vec2 ${varName};`,
			usage: `mix(${varName}.x, ${varName}.y, clamp(0.5 + dot(vTextureCoord-0.5, vec2(${c},${s})), 0., 1.))`,
		}
	}
	prepareFSUniforms(gl: WebGLRenderingContext, prog: GfxSharerProgram, suffix: string): FSPrepareFunc {
		const uMaskGradient = mustGetGfxUniformLocation(gl, prog, `uMaskGradient${suffix}`)
		return (valMin: number, valMax: number) => {
			gl.uniform2f(uMaskGradient, valMin, valMax)
		}
	}

	getAngleDeg(): number {
		return (this.angle / Math.PI) * 180
	}
}

export class Coef {
	constructor(public minVal: number, public maxVal: number, public mask: Mask) {}
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
const iterationFSRaw = `
precision highp float;
precision highp sampler2D;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTimeDelta;
uniform vec2 uScale;
{{COEF_DECLARATIONS}}

void main(void) {
	// vec4 c = texture2D(uSamplerCoefs, vTextureCoord);
	float diffusionRateA = {{diffusionRateA}};
	float diffusionRateB = {{diffusionRateB}};
	float feedRate = {{feedRate}};
	float killRate = {{killRate}};

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
const copyFS = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;

void main(void) {
	gl_FragColor = texture2D(uSampler, vTextureCoord);
}`
const lineVS = `
precision highp float;

attribute vec2 aPosition;
uniform mat3 uTransform;

void main(void) {
	gl_Position = vec4(((uTransform*vec3(aPosition, 1.)).xy-0.5)*2., 0, 1.);
}`
const lineFS = `
precision highp float;

uniform vec4 uColor;

void main(void) {
	gl_FragColor = uColor;
}`
const LINE_W = 5

export class ReactionDiffusion {
	private curFB: GfxFramebuffer
	private nextFB: GfxFramebuffer
	// private coefsFB: GfxFramebuffer
	private rect: GfxBuffer

	private coefs: Coefs
	private masks: Mask[]

	private wrapMode: WrapMode = 'repeat'
	private frameIsVisible = true

	private iteration: {
		prog: GfxSharerProgram
		draw: () => void
	} | null = null
	private drawResult: (view: View | null) => void
	private drawCopy: () => void
	private drawLineInner: (x0: number, y0: number, x1: number, y1: number) => void

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
		// this.coefsFB = createGfxFramebuffer(gl, makeFieldTexture(gl, 2, 2))

		const rectVtx = [0,0, 0,1, 1,1, 1,1, 1,0, 0,0] //prettier-ignore
		this.rect = createGfxBuffer(gl, rectVtx, 2, gl.TRIANGLES)

		const maskSolid = new MaskSolid()
		this.coefs = {
			diffusionRateA: new Coef(1.0, 1.0, maskSolid),
			diffusionRateB: new Coef(0.5, 0.5, maskSolid),
			feedRate: new Coef(0.055, 0.055, maskSolid),
			killRate: new Coef(0.062, 0.062, maskSolid),
		}
		this.masks = [
			maskSolid,
			new MaskGradient(0),
			new MaskGradient((Math.PI * 3) / 2),
			new MaskGradient(Math.PI / 4),
			new MaskGradient((Math.PI * 7) / 4),
		]

		this.updateIterationData()

		const progResult = createGfxShaderProgram(gl, simpleTextureVS, resultFS)
		const uOffset = mustGetGfxUniformLocation(gl, progResult, 'uOffset')
		const uSize = mustGetGfxUniformLocation(gl, progResult, 'uSize')
		const uFrameVisible = mustGetGfxUniformLocation(gl, progResult, 'uFrameVisible')
		this.drawResult = makeSimpleDrawFunc(gl, this.rect, progResult, {
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

		const progCopy = createGfxShaderProgram(gl, simpleTextureVS, copyFS)
		this.drawCopy = makeSimpleDrawFunc(gl, this.rect, progCopy)

		const progLine = createGfxShaderProgram(gl, lineVS, lineFS)
		const uTransform = mustGetGfxUniformLocation(gl, progLine, 'uTransform')
		const uColor = mustGetGfxUniformLocation(gl, progLine, 'uColor')
		this.drawLineInner = makeSimpleDrawFunc(gl, this.rect, progLine, {
			beforeDraw: (x0: number, y0: number, x1: number, y1: number) => {
				const len = Math.sqrt((x1 - x0) ** 2 + (y0 - y1) ** 2) + 1
				const dir = Math.atan2(y1 - y0, x1 - x0)
				const mat = mat3.create()
				mat3.translate(mat, mat, [0, 1])
				mat3.scale(mat, mat, [1, -1])
				mat3.translate(mat, mat, [x0 / this.width, y0 / this.height])
				mat3.rotate(mat, mat, dir)
				mat3.scale(mat, mat, [len / this.width, LINE_W / this.height])
				gl.uniform4f(uColor, 0, 1, 0, 0)
				gl.uniformMatrix3fv(uTransform, false, mat)
			},
		})
	}

	iter(n: number): void {
		const gl = this.gl

		// gl.activeTexture(gl.TEXTURE1)
		// this.coefsFB.gfxTex.bind(gl)

		for (let i = 0; i < n; i++) {
			setRenderTarget(gl, this.nextFB)

			gl.activeTexture(gl.TEXTURE0)
			this.curFB.gfxTex.bind(gl)

			this.iteration && this.iteration.draw()
			;[this.curFB, this.nextFB] = [this.nextFB, this.curFB]
		}
	}

	draw(view: View | null): void {
		setRenderTarget(this.gl, null)
		// this.gl.viewport(0, 0, this.width, this.height)
		this.curFB.gfxTex.bind(this.gl)
		this.drawResult(view)
	}

	updateIterationData(): void {
		const gl = this.gl
		if (this.iteration) deleteGfxShaderProgramWithShaders(gl, this.iteration.prog)

		const coefs = Object.entries(this.coefs)

		let iterationFS = iterationFSRaw
		let declarations = ''
		for (const [name, coef] of coefs) {
			const { declaration, usage } = coef.mask.getFSParts('_' + name)
			declarations += declaration + '\n'
			iterationFS = iterationFS.replace(`{{${name}}}`, usage)
		}
		iterationFS = iterationFS.replace('{{COEF_DECLARATIONS}}', declarations)

		const prog = createGfxShaderProgram(gl, simpleTextureVS, iterationFS)

		const prepareFuncs: FSPrepareFunc[] = []
		for (const [name, coef] of coefs) {
			prepareFuncs.push(coef.mask.prepareFSUniforms(gl, prog, '_' + name))
		}

		const uScale = mustGetGfxUniformLocation(gl, prog, 'uScale')
		const uSampler = mustGetGfxUniformLocation(gl, prog, 'uSampler')
		const uSamplerCoefs = null
		const uTimeDelta = mustGetGfxUniformLocation(gl, prog, 'uTimeDelta')

		const draw = makeSimpleDrawFunc(gl, this.rect, prog, {
			beforeDraw: () => {
				gl.uniform2f(uScale, 1 / this.width, 1 / this.height)
				gl.uniform1i(uSampler, 0)
				if (uSamplerCoefs !== null) gl.uniform1i(uSamplerCoefs, 1)
				gl.uniform1f(uTimeDelta, 0.5)
				for (let i = 0; i < coefs.length; i++) {
					const coef = coefs[i][1]
					prepareFuncs[i](coef.minVal, coef.maxVal)
				}
			},
		})

		this.iteration = { prog, draw }
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

	private resizeFB(fb: GfxFramebuffer, width: number, height: number): void {
		const gl = this.gl
		resizeGfxTexture2d(gl, fb.gfxTex, width, height)
		fb.bind(gl)
		gl.clear(gl.COLOR_BUFFER_BIT)
	}
	resize(width: number, height: number): void {
		const gl = this.gl

		this.resizeFB(this.nextFB, width, height)
		setRenderTarget(gl, this.nextFB)
		this.curFB.gfxTex.bind(gl)
		this.drawCopy()

		this.resizeFB(this.curFB, width, height)
		setRenderTarget(gl, this.curFB)
		this.nextFB.gfxTex.bind(gl)
		this.drawCopy()

		this.width = width
		this.height = height
	}
	drawDot(x: number, y: number): void {
		setRenderTarget(this.gl, this.curFB)
		this.drawLineInner(x - LINE_W / 2, y, x + LINE_W / 2, y)
	}
	drawLine(x0: number, y0: number, x1: number, y1: number): void {
		setRenderTarget(this.gl, this.curFB)
		this.drawLineInner(x0, y0, x1, y1)
	}

	getMaxFieldSize(): number {
		return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)
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
