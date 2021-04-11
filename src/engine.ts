import { createGfxFramebuffer, GfxFramebuffer } from './gfx/framebuffers'
import { createGfxBuffer, GfxBuffer } from './gfx/buffers'
import {
	createGfxShaderProgram,
	deleteGfxShaderProgramWithShaders,
	GfxSharerProgram,
	mustGetGfxUniformLocation,
} from './gfx/shaders'
import { createGfxTexture2d, resizeGfxTexture2d } from './gfx/textures'
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

export class MaskCircle {
	getFSParts(suffix: string): FSParts {
		const varName = 'uMaskCircle' + suffix
		return {
			declaration: `uniform vec2 ${varName};`,
			usage: `mix(${varName}.x, ${varName}.y, 1.-step(0.245, dot(vTextureCoord-0.5, vTextureCoord-0.5)))`,
		}
	}
	prepareFSUniforms(gl: WebGLRenderingContext, prog: GfxSharerProgram, suffix: string): FSPrepareFunc {
		const uMaskGradient = mustGetGfxUniformLocation(gl, prog, `uMaskCircle${suffix}`)
		return (valMin: number, valMax: number) => {
			gl.uniform2f(uMaskGradient, valMin, valMax)
		}
	}
}

export class MaskSmoothCircle {
	getFSParts(suffix: string): FSParts {
		const varName = 'uMaskSmoothCircle' + suffix
		return {
			declaration: `uniform vec2 ${varName};`,
			usage: `mix(${varName}.x, ${varName}.y, clamp(1.-length((vTextureCoord-0.5)*2.), 0., 1.))`,
		}
	}
	prepareFSUniforms(gl: WebGLRenderingContext, prog: GfxSharerProgram, suffix: string): FSPrepareFunc {
		const uMaskGradient = mustGetGfxUniformLocation(gl, prog, `uMaskSmoothCircle${suffix}`)
		return (valMin: number, valMax: number) => {
			gl.uniform2f(uMaskGradient, valMin, valMax)
		}
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
	timeDelta: Coef
}

export type WrapMode = 'repeat' | 'mirror'

export type View = { x: number; y: number; width: number; height: number }

const FS_FLOAT_HIGHP_OR_MEDIUMP = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp sampler2D;
#else
precision mediump float;
precision mediump sampler2D;
#endif
`

const simpleTextureVS = `
precision highp float;

attribute vec2 aPosition;
varying vec2 vTextureCoord;

void main(void) {
	vTextureCoord = aPosition;
	gl_Position = vec4((aPosition.xy-0.5)*2., 0, 1.);
}`

const iterationFSRaw = `
${FS_FLOAT_HIGHP_OR_MEDIUMP}

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec2 uScale;
{{COEF_DECLARATIONS}}

void main(void) {
	// vec4 c = texture2D(uSamplerCoefs, vTextureCoord);
	float diffusionRateA = {{diffusionRateA}};
	float diffusionRateB = {{diffusionRateB}};
	float feedRate = {{feedRate}};
	float killRate = {{killRate}};
	float timeDelta = {{timeDelta}};

	vec4 cur = texture2D(uSampler, vTextureCoord);

	vec2 laplacian = -cur.xy +
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

	/*
	// this should be faster theoretically but prctically compiler is smart enough and speed is same
	vec2 ab = cur.xy;
	float a = cur.x;
	float b = cur.y;
	float reactionValue = a * b * b;
	vec2 reaction = vec2(
		-reactionValue, //for a
		reactionValue   //for b
	);
	vec2 ambient = vec2(
		feedRate * (1. - a),       //for a
		-(killRate + feedRate) * b //for b
	);
	vec2 diffusionRate = vec2(diffusionRateA, diffusionRateB);

	vec2 newAB = ab + (diffusionRate * laplacian + reaction + ambient)*timeDelta;
	newAB = clamp(newAB, 0., 1.);
	float change = (a-newAB.x) - (b-newAB.y);

	gl_FragColor = vec4(newAB, max(change, mix(change, cur.z, 0.99)), 1.);
	*/

	float a = cur.x;
	float b = cur.y;
	float reaction = a * b * b;
	float newA = a + (diffusionRateA * laplacian.x - reaction + feedRate * (1. - a)) * timeDelta;
	float newB = b + (diffusionRateB * laplacian.y + reaction - (killRate + feedRate) * b) * timeDelta;
	newA = clamp(newA, 0., 1.);
	newB = clamp(newB, 0., 1.);
	float change = (a-newA) - (b-newB);
	vec4 _col = vec4(newA, newB, max(change, mix(change, cur.z, 0.99)), 1.);
	gl_FragColor = _col; //precision is lost if assigned directly (mediump is used?)
}`

const resultFSColorConvs = {
	whiteBlack: `
		float c = clamp((field.x - field.y*1.5)*4., 0., 1.);
		vec3 color = vec3(c, c, c);
	`,
	rgb: `
		float change = (abs(field.z)*200.);
		change = change/(0.25+change)*1.333;
		vec3 color = vec3(change, field.x*0.5, field.y*1.5);
	`,
	hsv: `
		float c = clamp((field.x - field.y), 0., 0.70);
		float change = (abs(field.z)*300.);
		change = change/(0.5+change)*1.5;
		vec3 color = hsv2rgb(vec3(c, 1.-change*0.25, (0.75+c*0.25+change*0.25)));
	`,
	darkSide: `
		float c = clamp((field.x - field.y), 0., 0.70);
		float change = (abs(field.z)*300.);
		change = change/(0.5+change)*1.5;
		vec3 color = hsv2rgb(vec3(c, 1.-change*0.25, (0.75+c*0.25)*(0.1+change*0.9)));
	`,
	green: `
		float c = clamp((field.x - field.y*1.5)*4., 0., 1.);
		vec3 color = vec3(c, 1.-field.y, field.x);
	`,
	blueGreen: `
		// float change = (abs(field.z)*100.);
		// change = change/(0.25+change)*1.333;
		// float c = clamp((field.x - field.y*1.5)*0.85+0.15, 0., 1.);
		// vec3 color = rgb2hsv(vec3(c, 0.5, 0.5-change*0.5));

		float c = clamp((field.x - field.y*1.5)*0.85+0.15, 0., 1.);
		vec3 color = rgb2hsv(vec3(c, 0.5, 0.5));
	`,
	changes: `
		float c = 1.-clamp((field.x - field.y*1.5)*4., 0., 1.);
		float change = (abs(field.z)*300.);
		change = change/(0.25+change)*1.333;
		vec3 changeCol = field.z < 0. ? vec3(1.,0.15,0.15) : vec3(0.25,0.75,0.25);
		vec3 color = mix(vec3(c, c, c)*0.2, changeCol, change);
	`,
	electric: `
		float change = (abs(field.z)*300.);
		change = change/(0.5+change)*1.5;
		float c = clamp((field.x - field.y*1.5), 0., 1.);
		vec3 color = hsv2rgb(vec3(fract(0.54+c*0.2+change*0.1), 1.-change*change*0.5, 0.4+change*0.6));
	`,
}
export type ResultColorMode = keyof typeof resultFSColorConvs
const resultFSRaw = `
${FS_FLOAT_HIGHP_OR_MEDIUMP}
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec2 uOffset;
uniform vec2 uSize;
uniform lowp int uFrameVisible;

// https://stackoverflow.com/a/17897228
vec3 rgb2hsv(vec3 c)
{
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c)
{
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main(void) {
	vec2 pos = vTextureCoord*uSize + uOffset;
	vec4 field = texture2D(uSampler, pos);

	vec2 innerRect = step(0., pos) * step(-1., -pos);
	vec2 outerRect = step(-0.005, pos) * step(-1.005, -pos);
	float isIn = uFrameVisible > 0
		? (min(innerRect.x, innerRect.y)*0.8+0.2) + (1.-min(outerRect.x, outerRect.y))*0.4
		: 1.;

	{{COLOR_CONV}}

	gl_FragColor = vec4(mix(vec3(0.5), color, isIn), 1.);
}`

const copyFS = `
${FS_FLOAT_HIGHP_OR_MEDIUMP}
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
${FS_FLOAT_HIGHP_OR_MEDIUMP}
uniform vec4 uColor;

void main(void) {
	gl_FragColor = uColor;
}`
const LINE_W = 3

export class ReactionDiffusion {
	private curFB: GfxFramebuffer
	private nextFB: GfxFramebuffer
	// private coefsFB: GfxFramebuffer
	private fieldTextureType: number
	private fieldTextureMinFilter: number
	private rect: GfxBuffer

	private coefs: Coefs
	private masks: Mask[]
	private colorMode: ResultColorMode

	private wrapMode: WrapMode = 'repeat'
	private frameIsVisible = true

	private iteration: {
		prog: GfxSharerProgram
		draw: () => void
	} | null = null
	private result: {
		prog: GfxSharerProgram
		draw: (view: View | null) => void
	} | null = null
	private drawCopy: () => void
	private drawLineInner: (x0: number, y0: number, x1: number, y1: number, ab?: [number, number]) => void

	constructor(private gl: WebGLRenderingContext, private width: number, private height: number) {
		this.fieldTextureType = (() => {
			const glTFloatExt = gl.getExtension('OES_texture_float')
			const glCBFloatExt = gl.getExtension('WEBGL_color_buffer_float')
			if (glTFloatExt && glCBFloatExt) return gl.FLOAT
			const glTHalfFloatExt = gl.getExtension('OES_texture_half_float')
			const glCBHalfFloatExt = gl.getExtension('EXT_color_buffer_half_float')
			if (glTHalfFloatExt && glCBHalfFloatExt) return glTHalfFloatExt.HALF_FLOAT_OES
			throw new Error('девайс/браузер не поддерживает достаточную точность вычислений на видеокарте')
		})()
		this.fieldTextureMinFilter = (() => {
			const name = this.isHighpSupported()
				? 'OES_texture_float_linear'
				: 'OES_texture_half_float_linear'
			return gl.getExtension(name) ? gl.LINEAR : gl.NEAREST
		})()

		this.curFB = createGfxFramebuffer(gl, this.makeFieldTexture(width, height))
		this.nextFB = createGfxFramebuffer(gl, this.makeFieldTexture(width, height))
		this.clear()
		// this.coefsFB = createGfxFramebuffer(gl, this.makeFieldTexture(gl, 2, 2))

		const rectVtx = [0,0, 0,1, 1,1, 1,1, 1,0, 0,0] //prettier-ignore
		this.rect = createGfxBuffer(gl, rectVtx, 2, gl.TRIANGLES)

		const maskSolid = new MaskSolid()
		this.coefs = {
			diffusionRateA: new Coef(1.0, 1.0, maskSolid),
			diffusionRateB: new Coef(0.5, 0.5, maskSolid),
			feedRate: new Coef(0.055, 0.055, maskSolid),
			killRate: new Coef(0.062, 0.062, maskSolid),
			timeDelta: new Coef(1, 1, maskSolid),
		}
		this.masks = [
			maskSolid,
			new MaskGradient(0),
			new MaskGradient((Math.PI * 3) / 2),
			new MaskGradient(Math.PI / 4),
			new MaskGradient((Math.PI * 7) / 4),
			new MaskCircle(),
			new MaskSmoothCircle(),
		]
		this.colorMode = 'green'

		this.updateIterationData()
		this.updateResultData()

		const progCopy = createGfxShaderProgram(gl, simpleTextureVS, copyFS)
		this.drawCopy = makeSimpleDrawFunc(gl, this.rect, progCopy)

		const progLine = createGfxShaderProgram(gl, lineVS, lineFS)
		const uTransform = mustGetGfxUniformLocation(gl, progLine, 'uTransform')
		const uColor = mustGetGfxUniformLocation(gl, progLine, 'uColor')
		this.drawLineInner = makeSimpleDrawFunc(gl, this.rect, progLine, {
			beforeDraw: (x0: number, y0: number, x1: number, y1: number, ab?: [number, number]) => {
				const len = Math.sqrt((x1 - x0) ** 2 + (y0 - y1) ** 2)
				const dir = Math.atan2(y1 - y0, x1 - x0)
				const mat = mat3.create()
				mat3.translate(mat, mat, [0, 1])
				mat3.scale(mat, mat, [1, -1])
				mat3.translate(mat, mat, [x0 / this.width, y0 / this.height])
				mat3.rotate(mat, mat, dir)
				mat3.scale(mat, mat, [len / this.width, LINE_W / this.height])
				mat3.translate(mat, mat, [0, -0.5])
				const [a, b] = ab || [0, 1]
				gl.uniform4f(uColor, a, b, 0, 0)
				gl.uniformMatrix3fv(uTransform, false, mat)
			},
		})

		// this.drawLine(-32, 64, 64, -64)
		// this.drawLine(64, 128, -32, -128)
		// this.drawLine(128, 64, 64, 256)
		// this.drawLine(-16, 32, 16, 32)
		// this.drawLine(32, -16, 32, 16)
	}

	private makeFieldTexture(w: number, h: number) {
		const gl = this.gl
		const tex = createGfxTexture2d(gl, w, h, gl.RGBA, this.fieldTextureType, null)
		// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT) //CLAMP_TO_EDGE
		// gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT) //CLAMP_TO_EDGE
		// min and mag are required for float tex
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.fieldTextureMinFilter)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
		return tex
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
		this.curFB.gfxTex.bind(this.gl)
		this.result && this.result.draw(view)
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

		const draw = makeSimpleDrawFunc(gl, this.rect, prog, {
			beforeDraw: () => {
				gl.uniform2f(uScale, 1 / this.width, 1 / this.height)
				gl.uniform1i(uSampler, 0)
				if (uSamplerCoefs !== null) gl.uniform1i(uSamplerCoefs, 1)
				for (let i = 0; i < coefs.length; i++) {
					const coef = coefs[i][1]
					prepareFuncs[i](coef.minVal, coef.maxVal)
				}
			},
		})

		this.iteration = { prog, draw }
	}
	updateResultData(): void {
		const gl = this.gl
		if (this.result) deleteGfxShaderProgramWithShaders(gl, this.result.prog)

		const resultFS = resultFSRaw.replace('{{COLOR_CONV}}', resultFSColorConvs[this.colorMode])

		const prog = createGfxShaderProgram(gl, simpleTextureVS, resultFS)
		const uOffset = mustGetGfxUniformLocation(gl, prog, 'uOffset')
		const uSize = mustGetGfxUniformLocation(gl, prog, 'uSize')
		const uFrameVisible = mustGetGfxUniformLocation(gl, prog, 'uFrameVisible')

		const draw = makeSimpleDrawFunc(gl, this.rect, prog, {
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
		this.result = { prog, draw }
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
	clear(): void {
		const gl = this.gl
		gl.clearColor(1, 0, 0, 0)
		for (const fb of [this.curFB, this.nextFB]) {
			fb.bind(gl)
			gl.clear(gl.COLOR_BUFFER_BIT)
		}
	}
	drawDot(x: number, y: number, ab?: [number, number]): void {
		this.drawLine(x - LINE_W / 2, y, x + LINE_W / 2, y, ab)
	}
	drawLine(x0: number, y0: number, x1: number, y1: number, ab?: [number, number]): void {
		// console.log(' --- ')
		setRenderTarget(this.gl, this.curFB)
		this.drawLineInner(x0, y0, x1, y1)
		// from left to right only
		if (x0 > x1) {
			;[x0, x1] = [x1, x0]
			;[y0, y1] = [y1, y0]
		}
		if (x0 === x1) x1 += 0.001
		const aspect = (y1 - y0) / (x1 - x0)
		let curX = x0
		let curY = y0
		let cellI = Math.floor(x0 / this.width)
		let cellJ = Math.floor(y0 / this.height)
		let n = 0
		while (curX < x1) {
			const cellX = cellI * this.width
			const cellY = cellJ * this.height
			this.drawLineInner(x0 - cellX, y0 - cellY, x1 - cellX, y1 - cellY, ab)
			const newY = curY + (cellX + this.width - curX) * aspect
			// console.log([cellI, cellJ], [cellX, cellY], [curX, curY], newY)
			if (newY < cellY) {
				// to upper cell (via upper border)
				curX += (curY - cellY) / -aspect
				curY = cellY
				cellJ -= 1
			} else if (newY > cellY + this.height) {
				// to bottom cell (via bottom border)
				curX += (cellY + this.height - curY) / aspect
				curY = cellY + this.height
				cellJ += 1
			} else {
				// to right cell (via right border)
				curX = cellX + this.width
				curY = newY
				cellI += 1
			}
			if (n++ > 10) {
				console.error('drawLine looped too much!')
				break
			}
		}
	}

	isHighpSupported(): boolean {
		return this.fieldTextureType === this.gl.FLOAT
	}

	getMaxFieldSize(): number {
		return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)
	}
	getSize(): [number, number] {
		return [this.width, this.height]
	}

	getCoefs(): Coefs {
		return this.coefs
	}
	getMasks(): Mask[] {
		return this.masks
	}

	getWrapMode(): WrapMode {
		return this.wrapMode
	}
	setWrapMode(wrapMode: WrapMode): void {
		this.wrapMode = wrapMode
		this.updateTexWrapMode()
	}

	getColorMode(): ResultColorMode {
		return this.colorMode
	}
	setColorMode(mode: ResultColorMode): void {
		this.colorMode = mode
		this.updateResultData()
	}

	isFrameVisible(): boolean {
		return this.frameIsVisible
	}
	toggleFrame(isVisible: boolean): void {
		this.frameIsVisible = isVisible
	}
}

// https://stackoverflow.com/questions/58907270/record-at-constant-fps-with-canvascapturemediastream-even-on-slow-computers
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
