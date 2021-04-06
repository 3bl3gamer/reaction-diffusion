import { glMust } from './utils'

export class GfxSharerProgram {
	constructor(public vSharer: WebGLShader, public fSharer: WebGLShader, public program: WebGLProgram) {}

	useProgram(gl: WebGLRenderingContext): void {
		gl.useProgram(this.program)
	}
}

export function createGfxShaderProgram(
	gl: WebGLRenderingContext,
	vsText: string,
	fsText: string,
): GfxSharerProgram {
	const vShader = glMust(gl, gl.createShader(gl.VERTEX_SHADER))
	gl.shaderSource(vShader, vsText)
	gl.compileShader(vShader)
	assertShaderIsOk(gl, vShader)

	const fShader = glMust(gl, gl.createShader(gl.FRAGMENT_SHADER))
	gl.shaderSource(fShader, fsText)
	gl.compileShader(fShader)
	assertShaderIsOk(gl, fShader)

	const shaderProg = glMust(gl, gl.createProgram())
	gl.attachShader(shaderProg, vShader)
	gl.attachShader(shaderProg, fShader)
	gl.linkProgram(shaderProg)
	console.log('TODO', gl.getProgramParameter(shaderProg, gl.LINK_STATUS))
	return new GfxSharerProgram(vShader, fShader, shaderProg)
}

export function deleteGfxShaderProgramWithShaders(
	gl: WebGLRenderingContext,
	gfxProgram: GfxSharerProgram,
): void {
	gl.deleteProgram(gfxProgram.program)
	gl.deleteShader(gfxProgram.vSharer)
	gl.deleteShader(gfxProgram.fSharer)
}

export function mustGetAttribLocation(gl: WebGLRenderingContext, program: WebGLProgram, name: string): GLint {
	const attr = gl.getAttribLocation(program, name)
	if (attr === -1) throw new Error(`attribute '${name}' not found in program`)
	return attr
}
export function mustGetGfxAttribLocation(
	gl: WebGLRenderingContext,
	gfxProgram: GfxSharerProgram,
	name: string,
): GLint {
	return mustGetAttribLocation(gl, gfxProgram.program, name)
}
export function mustGetUniformLocation(
	gl: WebGLRenderingContext,
	program: WebGLProgram,
	name: string,
): WebGLUniformLocation {
	const uni = gl.getUniformLocation(program, name)
	if (uni === null) throw new Error(`uniform '${name}' not found in program`)
	return uni
}
export function mustGetGfxUniformLocation(
	gl: WebGLRenderingContext,
	gfxProgram: GfxSharerProgram,
	name: string,
): WebGLUniformLocation {
	return mustGetUniformLocation(gl, gfxProgram.program, name)
}

export function assertShaderIsOk(gl: WebGLRenderingContext, shader: WebGLShader): void {
	const msg = gl.getShaderInfoLog(shader)
	if (msg !== '' && msg !== null) throw new Error(msg)
}
