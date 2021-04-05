import type { GfxTexture2d } from './textures'
import { glMust } from './utils'

export class GfxFramebuffer {
	constructor(public fb: WebGLFramebuffer, public gfxTex: GfxTexture2d) {}

	bind(gl: WebGLRenderingContext): void {
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb)
	}

	get width(): number {
		return this.gfxTex.width
	}
	get height(): number {
		return this.gfxTex.height
	}
}

export function createGfxFramebuffer(gl: WebGLRenderingContext, gfxTex: GfxTexture2d): GfxFramebuffer {
	const glFb = glMust(gl, gl.createFramebuffer())
	const fb = new GfxFramebuffer(glFb, gfxTex)
	fb.bind(gl)
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gfxTex.tex, 0)
	assertFramebufferIsOk(gl)
	return fb
}

export function assertFramebufferIsOk(gl: WebGLRenderingContext): void {
	const res = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
	switch (res) {
		case gl.FRAMEBUFFER_COMPLETE:
			return
		case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
			throw new Error(
				'The attachment types are mismatched ' +
					'or not all framebuffer attachment points are framebuffer attachment complete.',
			)
		case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
			throw new Error('There is no attachment.')
		case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
			throw new Error('Height and width of the attachment are not the same.')
		case gl.FRAMEBUFFER_UNSUPPORTED:
			throw new Error(
				'The format of the attachment is not supported or depth and stencil attachments are not the same renderbuffer.',
			)
		// WebGL2: FRAMEBUFFER_INCOMPLETE_MULTISAMPLE
		// OVR: FRAMEBUFFER_INCOMPLETE_VIEW_TARGETS_OVR
		default:
			throw new Error('unexpected frambuffer check result: ' + res)
	}
}
