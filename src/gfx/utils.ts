import { mat3 } from 'gl-matrix'
import type { GfxBuffer } from './buffers'
import type { GfxFramebuffer } from './framebuffers'
import { GfxSharerProgram, mustGetGfxAttribLocation } from './shaders'

export type TypedArray =
	| Int8Array
	| Uint8Array
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Uint8ClampedArray
	| Float32Array
	| Float64Array
export type AnyArray = TypedArray | number[]

export function mustgetWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext {
	const gl = canvas.getContext('webgl')
	if (gl === null) throw new Error('webgl not available')
	return gl
}

export function mustGet2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const rc = canvas.getContext('2d')
	if (rc === null) throw new Error('canvas 2d context not available O_o')
	return rc
}

export function glMust<T>(gl: WebGLRenderingContext, value: T | null): T {
	if (value === null) throw new Error('gl error: ' + gl.getError())
	return value
}

export function setRenderTarget(gl: WebGLRenderingContext, framebuffer: GfxFramebuffer | null): void {
	if (framebuffer === null) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
	} else {
		framebuffer.bind(gl)
		gl.viewport(0, 0, framebuffer.width, framebuffer.height)
	}
}

export function makeSimpleDrawFunc<T extends unknown[]>(
	gl: WebGLRenderingContext,
	buffer: GfxBuffer,
	shader: GfxSharerProgram,
	opts: { defaultTransfMat?: mat3; beforeDraw?: (...args: T) => unknown } = {},
): (...args: T) => void {
	//transfMat: mat3
	const { defaultTransfMat = mat3.create(), beforeDraw = null } = opts || {}
	const aPos = mustGetGfxAttribLocation(gl, shader, 'aPosition')
	gl.enableVertexAttribArray(aPos)
	// const uTransf = shader.getUniformLocation(gl, 'uTransform')
	// const uSampler = shader.getUniformLocation(gl, 'uSampler')

	return function draw(...args /*transfMat = defaultTransfMat*/) {
		buffer.bindToAttribute(gl, aPos)
		shader.useProgram(gl)
		// gl.uniformMatrix3fv(uTransf, false, transfMat)
		if (beforeDraw) beforeDraw(...args)
		buffer.draw(gl)
	}
}
