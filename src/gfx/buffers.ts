import { AnyArray, glMust } from './utils'

export class GfxBuffer {
	constructor(
		public mode: number,
		public buf: WebGLBuffer,
		public vertexSize: number,
		public count: number,
	) {}
	// indices: { buf: WebGLBuffer; count: number } | null

	bind(gl: WebGLRenderingContext): void {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
		// gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.buf)
	}
	bindToAttribute(gl: WebGLRenderingContext, attrLocation: GLint): void {
		this.bind(gl)
		gl.vertexAttribPointer(attrLocation, this.vertexSize, gl.FLOAT, false, 0, 0)
	}

	draw(gl: WebGLRenderingContext): void {
		gl.drawArrays(this.mode, 0, this.count)
		// gl.drawElements(bufs.mode, bufs.indices.count, gl.UNSIGNED_SHORT, 0)
	}
}

export function createGfxBuffer(
	gl: WebGLRenderingContext,
	vertices: AnyArray,
	vertexSize: number,
	// indices: Uint16Array | null,
	mode: number,
): GfxBuffer {
	if (vertices instanceof Array) vertices = new Float32Array(vertices)
	// if (indices instanceof Array) indices = new Uint16Array(indices)

	const vtxBuf = glMust(gl, gl.createBuffer())
	gl.bindBuffer(gl.ARRAY_BUFFER, vtxBuf)
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
	gl.bindBuffer(gl.ARRAY_BUFFER, null)

	// let indicesExt: GfxBufferGroup['indices'] | null = null
	// if (indices !== null) {
	// 	const idxBuf = glMust(gl, gl.createBuffer())
	// 	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf)
	// 	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
	// 	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
	// 	indicesExt = { buf: idxBuf, count: indices.length }
	// }

	return new GfxBuffer(mode, vtxBuf, vertexSize, (vertices.length / vertexSize) | 0)
}
