import { glMust } from './utils'

export class GfxTexture2d {
	constructor(
		public tex: WebGLTexture,
		public width: number,
		public height: number,
		public format: GLenum,
		public type: GLenum,
	) {}

	bind(gl: WebGLRenderingContext): void {
		gl.bindTexture(gl.TEXTURE_2D, this.tex)
	}
}

export function createGfxTexture2d(
	gl: WebGLRenderingContext,
	width: number,
	height: number,
	format: GLenum,
	type: GLenum,
	data: ArrayBufferView | null = null,
): GfxTexture2d {
	const tex = glMust(gl, gl.createTexture())
	const gfxTex = new GfxTexture2d(tex, width, height, format, type)
	gfxTex.bind(gl)
	gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, data)
	return gfxTex
}

export function resizeGfxTexture2d(
	gl: WebGLRenderingContext,
	gfxTexture: GfxTexture2d,
	width: number,
	height: number,
	data: ArrayBufferView | null = null,
): void {
	gfxTexture.bind(gl)
	const { format, type } = gfxTexture
	gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, data)
	gfxTexture.width = width
	gfxTexture.height = height
}
