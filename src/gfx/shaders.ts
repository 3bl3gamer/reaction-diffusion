import { glMust } from './utils'

export function createShaderProgram(gl: WebGLRenderingContext, vsText: string, fsText: string): WebGLProgram {
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
	return shaderProg
}

export function useShaderProgram(gl: WebGLRenderingContext, shaderProgram: WebGLProgram): void {
	gl.useProgram(shaderProgram)
}

export function mustGetAttributeLocation(
	gl: WebGLRenderingContext,
	program: WebGLProgram,
	name: string,
): GLint {
	const attr = gl.getAttribLocation(program, name)
	if (attr === -1) throw new Error(`attribute '${name}' not found in program`)
	return attr
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

export function assertShaderIsOk(gl: WebGLRenderingContext, shader: WebGLShader): void {
	const msg = gl.getShaderInfoLog(shader)
	if (msg !== '' && msg !== null) throw new Error(msg)
}
