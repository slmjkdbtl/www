import {
	Mat4,
	Vec2,
	Color,
	Quad,
} from "./math"

import {
	deepEq,
	getErrorMsg,
} from "./utils"

export type Vertex = {
	pos: Vec2,
	uv: Vec2,
	color: Color,
	opacity: number,
}

export type ImageSource = Exclude<TexImageSource, VideoFrame>
export type TexFilter = "nearest" | "linear"
export type TexWrap = "repeat" | "clampToEdge"

export type TextureOpt = {
	filter?: TexFilter,
	wrap?: TexWrap,
}

export type UniformValue =
	number
	| Vec2
	| Color
	| Mat4
	| number[]
	| Vec2[]
	| Color[]

export type UniformKey = Exclude<string, "u_tex">
export type Uniform = Record<UniformKey, UniformValue>

export const DEF_FILTER: TexFilter = "nearest"
export const DEF_WRAP: TexWrap = "clampToEdge"

export type LineJoin =
	| "none"
	| "round"
	| "bevel"
	| "miter"

export interface Outline {
	width?: number,
	color?: Color,
	join?: LineJoin,
}

export interface RenderProps {
	pos?: Vec2,
	scale?: Vec2 | number,
	angle?: number,
	color?: Color,
	opacity?: number,
	uniform?: Uniform,
	shader?: Shader,
	outline?: Outline,
}

type DrawTextureOpt = RenderProps & {
	tex: Texture,
	width?: number,
	height?: number,
	tiled?: boolean,
	flipX?: boolean,
	flipY?: boolean,
	quad?: Quad,
	anchor?: Anchor | Vec2,
}

export type NineSlice = {
	left: number,
	right: number,
	top: number,
	bottom: number,
}

export type LoadSpriteSrc = string | ImageSource

export interface LoadSpriteOpt {
	sliceX?: number,
	sliceY?: number,
	slice9?: NineSlice,
	frames?: Quad[],
	anims?: SpriteAnims,
}

export interface LoadSpritesAnimOpt {
	anims?: SpriteAnims,
}

export type SpriteAnim = number | {
	from: number,
	to: number,
	loop?: boolean,
	pingpong?: boolean,
	speed?: number,
}

export type SpriteAnims = Record<string, SpriteAnim>

export function loadImg(src: string): Promise<HTMLImageElement> {
	const img = new Image()
	img.crossOrigin = "anonymous"
	img.src = src
	return new Promise<HTMLImageElement>((resolve, reject) => {
		img.onload = () => resolve(img)
		img.onerror = (e) => reject(e)
	})
}

export default class TexPacker {
	private textures: Texture[] = []
	private bigTextures: Texture[] = []
	private canvas: HTMLCanvasElement
	private c2d: CanvasRenderingContext2D
	private x: number = 0
	private y: number = 0
	private curHeight: number = 0
	private glCtx: GLCtx
	constructor(glCtx: GLCtx, w: number, h: number) {
		this.glCtx = glCtx
		this.canvas = document.createElement("canvas")
		this.canvas.width = w
		this.canvas.height = h
		this.textures = [Texture.fromImage(glCtx, this.canvas)]
		this.bigTextures = []
		const ctx2D = this.canvas.getContext("2d")
		if (!ctx2D) {
			throw new Error("failed to get canvas 2d context")
		}
		this.c2d = ctx2D
	}
	add(img: ImageSource): [Texture, Quad] {
		if (img.width > this.canvas.width || img.height > this.canvas.height) {
			const tex = Texture.fromImage(this.glCtx, img)
			this.bigTextures.push(tex)
			return [tex, new Quad(0, 0, 1, 1)]
		}
		// next row
		if (this.x + img.width > this.canvas.width) {
			this.x = 0
			this.y += this.curHeight
			this.curHeight = 0
		}
		// next texture
		if (this.y + img.height > this.canvas.height) {
			this.c2d.clearRect(0, 0, this.canvas.width, this.canvas.height)
			this.textures.push(Texture.fromImage(this.glCtx, this.canvas))
			this.x = 0
			this.y = 0
			this.curHeight = 0
		}
		const curTex = this.textures[this.textures.length - 1]
		const pos = new Vec2(this.x, this.y)
		this.x += img.width
		if (img.height > this.curHeight) {
			this.curHeight = img.height
		}
		if (img instanceof ImageData) {
			this.c2d.putImageData(img, pos.x, pos.y)
		} else {
			this.c2d.drawImage(img, pos.x, pos.y)
		}
		curTex.update(this.canvas)
		return [curTex, new Quad(
			pos.x / this.canvas.width,
			pos.y / this.canvas.height,
			img.width / this.canvas.width,
			img.height / this.canvas.height,
		)]
	}
	free() {
		for (const tex of this.textures) {
			tex.free()
		}
		for (const tex of this.bigTextures) {
			tex.free()
		}
	}
}

export type DrawSpriteOpt = RenderProps & {
	sprite: Sprite,
	frame?: number,
	width?: number,
	height?: number,
	tiled?: boolean,
	flipX?: boolean,
	flipY?: boolean,
	quad?: Quad,
	anchor?: Anchor | Vec2,
}

export type Sprite = {
	frames: {
		tex: Texture,
		quad: Quad,
	}[],
	anims: SpriteAnims,
}

export type Anchor =
	"topleft"
	| "top"
	| "topright"
	| "left"
	| "center"
	| "right"
	| "botleft"
	| "bot"
	| "botright"

export type DrawUVQuadOpt = RenderProps & {
	width: number,
	height: number,
	flipX?: boolean,
	flipY?: boolean,
	tex?: Texture,
	quad?: Quad,
	anchor?: Anchor | Vec2,
}

// some default charsets for loading bitmap fonts
const ASCII_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"

const DEF_ANCHOR = "topleft"
const BG_GRID_SIZE = 64

const DEF_FONT = "monospace"
const DBG_FONT = "monospace"
const DEF_TEXT_SIZE = 36
const DEF_TEXT_CACHE_SIZE = 64
const MAX_TEXT_CACHE_SIZE = 256
const FONT_ATLAS_WIDTH = 2048
const FONT_ATLAS_HEIGHT = 2048
const SPRITE_ATLAS_WIDTH = 2048
const SPRITE_ATLAS_HEIGHT = 2048
// 0.1 pixel padding to texture coordinates to prevent artifact
const UV_PAD = 0.1
const DEF_HASH_GRID_SIZE = 64
const DEF_FONT_FILTER = "linear"

const LOG_MAX = 8
const LOG_TIME = 4

const VERTEX_FORMAT = [
	{ name: "a_pos", size: 2 },
	{ name: "a_uv", size: 2 },
	{ name: "a_color", size: 4 },
]

const STRIDE = VERTEX_FORMAT.reduce((sum, f) => sum + f.size, 0)

const MAX_BATCHED_QUAD = 2048
const MAX_BATCHED_VERTS = MAX_BATCHED_QUAD * 4 * STRIDE
const MAX_BATCHED_INDICES = MAX_BATCHED_QUAD * 6

// vertex shader template, replace {{user}} with user vertex shader code
const VERT_TEMPLATE = `
attribute vec2 a_pos;
attribute vec2 a_uv;
attribute vec4 a_color;

varying vec2 v_pos;
varying vec2 v_uv;
varying vec4 v_color;

vec4 def_vert() {
	return vec4(a_pos, 0.0, 1.0);
}

{{user}}

void main() {
	vec4 pos = vert(a_pos, a_uv, a_color);
	v_pos = a_pos;
	v_uv = a_uv;
	v_color = a_color;
	gl_Position = pos;
}
`

// fragment shader template, replace {{user}} with user fragment shader code
const FRAG_TEMPLATE = `
precision mediump float;

varying vec2 v_pos;
varying vec2 v_uv;
varying vec4 v_color;

uniform sampler2D u_tex;

vec4 def_frag() {
	return v_color * texture2D(u_tex, v_uv);
}

{{user}}

void main() {
	gl_FragColor = frag(v_pos, v_uv, v_color, u_tex);
	if (gl_FragColor.a == 0.0) {
		discard;
	}
}
`

// default {{user}} vertex shader code
const DEF_VERT = `
vec4 vert(vec2 pos, vec2 uv, vec4 color) {
	return def_vert();
}
`

// default {{user}} fragment shader code
const DEF_FRAG = `
vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
	return def_frag();
}
`

export type GLCtx = ReturnType<typeof createGLCtx>

export class Texture {

	ctx: GLCtx
	src: null | ImageSource = null
	glTex: WebGLTexture
	width: number
	height: number

	constructor(ctx: GLCtx, w: number, h: number, opt: TextureOpt = {}) {

		this.ctx = ctx
		const gl = ctx.gl
		this.glTex = ctx.gl.createTexture()
		ctx.onDestroy(() => this.free())

		this.width = w
		this.height = h

		// TODO: no default
		const filter = {
			"linear": gl.LINEAR,
			"nearest": gl.NEAREST,
		}[opt.filter ?? ctx.opts.texFilter ?? DEF_FILTER]

		const wrap = {
			"repeat": gl.REPEAT,
			"clampToEdge": gl.CLAMP_TO_EDGE,
		}[opt.wrap ?? DEF_WRAP]

		this.bind()

		if (w && h) {
			gl.texImage2D(
				gl.TEXTURE_2D,
				0, gl.RGBA,
				w,
				h,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				null,
			)
		}

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
		this.unbind()

	}

	static fromImage(ctx: GLCtx, img: ImageSource, opt: TextureOpt = {}): Texture {
		const tex = new Texture(ctx, img.width, img.height, opt)
		tex.update(img)
		tex.src = img
		return tex
	}

	update(img: ImageSource, x = 0, y = 0) {
		const gl = this.ctx.gl
		this.bind()
		gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, img)
		this.unbind()
	}

	bind() {
		this.ctx.pushTexture2D(this.glTex)
	}

	unbind() {
		this.ctx.popTexture2D()
	}

	free() {
		this.ctx.gl.deleteTexture(this.glTex)
	}

}

export class FrameBuffer {

	ctx: GLCtx
	tex: Texture
	glFramebuffer: WebGLFramebuffer
	glRenderbuffer: WebGLRenderbuffer

	constructor(ctx: GLCtx, w: number, h: number, opt: TextureOpt = {}) {

		this.ctx = ctx
		const gl = ctx.gl
		ctx.onDestroy(() => this.free())
		this.tex = new Texture(ctx, w, h, opt)
		this.glFramebuffer = gl.createFramebuffer()
		this.glRenderbuffer = gl.createRenderbuffer()
		this.bind()
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h)
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this.tex.glTex,
			0,
		)
		gl.framebufferRenderbuffer(
			gl.FRAMEBUFFER,
			gl.DEPTH_STENCIL_ATTACHMENT,
			gl.RENDERBUFFER,
			this.glRenderbuffer,
		)
		this.unbind()
	}

	get width() {
		return this.tex.width
	}

	get height() {
		return this.tex.height
	}

	toImageData() {
		const gl = this.ctx.gl
		const data = new Uint8ClampedArray(this.width * this.height * 4)
		this.bind()
		gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, data)
		this.unbind()
		// flip vertically
		const bytesPerRow = this.width * 4
		const temp = new Uint8Array(bytesPerRow)
		for (let y = 0; y < (this.height / 2 | 0); y++) {
			const topOffset = y * bytesPerRow
			const bottomOffset = (this.height - y - 1) * bytesPerRow
			temp.set(data.subarray(topOffset, topOffset + bytesPerRow))
			data.copyWithin(topOffset, bottomOffset, bottomOffset + bytesPerRow)
			data.set(temp, bottomOffset)
		}
		return new ImageData(data, this.width, this.height)
	}

	toDataURL() {
		const canvas = document.createElement("canvas")
		const ctx = canvas.getContext("2d")
		if (!ctx) {
			throw new Error("failed to get canvas 2d context")
		}
		canvas.width = this.width
		canvas.height = this.height
		ctx.putImageData(this.toImageData(), 0, 0)
		return canvas.toDataURL()
	}

	clear() {
		const gl = this.ctx.gl
		gl.clear(gl.COLOR_BUFFER_BIT)
	}

	draw(action: () => void) {
		this.bind()
		action()
		this.unbind()
	}

	bind() {
		this.ctx.pushFramebuffer(this.glFramebuffer)
		this.ctx.pushRenderbuffer(this.glRenderbuffer)
		this.ctx.pushViewport({ x: 0, y: 0, w: this.width, h: this.height })
	}

	unbind() {
		this.ctx.popFramebuffer()
		this.ctx.popRenderbuffer()
		this.ctx.popViewport()
	}

	free() {
		const gl = this.ctx.gl
		gl.deleteFramebuffer(this.glFramebuffer)
		gl.deleteRenderbuffer(this.glRenderbuffer)
		this.tex.free()
	}

}

export class Shader {

	ctx: GLCtx
	glProgram: WebGLProgram

	constructor(ctx: GLCtx, vert: string, frag: string, attribs: string[]) {

		this.ctx = ctx
		ctx.onDestroy(() => this.free())

		const gl = ctx.gl
		const vertShader = gl.createShader(gl.VERTEX_SHADER)
		const fragShader = gl.createShader(gl.FRAGMENT_SHADER)

		if (!vertShader) {
			throw new Error("failed to create vertex shader")
		}

		if (!fragShader) {
			throw new Error("failed to create vertex shader")
		}

		gl.shaderSource(vertShader, vert)
		gl.shaderSource(fragShader, frag)
		gl.compileShader(vertShader)
		gl.compileShader(fragShader)

		const prog = gl.createProgram()
		this.glProgram = prog

		gl.attachShader(prog, vertShader)
		gl.attachShader(prog, fragShader)

		attribs.forEach((attrib, i) => gl.bindAttribLocation(prog, i, attrib))

		gl.linkProgram(prog)

		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			const vertError = gl.getShaderInfoLog(vertShader)
			if (vertError) throw new Error("VERTEX SHADER " + vertError)
			const fragError = gl.getShaderInfoLog(fragShader)
			if (fragError) throw new Error("FRAGMENT SHADER " + fragError)
		}

		gl.deleteShader(vertShader)
		gl.deleteShader(fragShader)

	}

	bind() {
		this.ctx.pushProgram(this.glProgram)
	}

	unbind() {
		this.ctx.popProgram()
	}

	send(uniform: Uniform) {
		const gl = this.ctx.gl
		for (const name in uniform) {
			const val = uniform[name]
			const loc = gl.getUniformLocation(this.glProgram, name)
			if (typeof val === "number") {
				gl.uniform1f(loc, val)
			} else if (val instanceof Mat4) {
				gl.uniformMatrix4fv(loc, false, new Float32Array(val.m))
			} else if (val instanceof Color) {
				gl.uniform3f(loc, val.r, val.g, val.b)
			} else if (val instanceof Vec2) {
				gl.uniform2f(loc, val.x, val.y)
			} else if (Array.isArray(val)) {
				const first = val[0]
				if (typeof first === "number") {
					gl.uniform1fv(loc, val as number[])
				} else if (first instanceof Vec2) {
					// @ts-ignore
					gl.uniform2fv(loc, val.map(v => [v.x, v.y]).flat())
				} else if (first instanceof Color) {
					// @ts-ignore
					gl.uniform3fv(loc, val.map(v => [v.r, v.g, v.b]).flat())
				}
			} else {
				throw new Error("Unsupported uniform data type")
			}
		}
	}

	free() {
		this.ctx.gl.deleteProgram(this.glProgram)
	}

}

export type VertexFormat = {
	name: string,
	size: number,
}[]

export class BatchRenderer {

	ctx: GLCtx

	glVBuf: WebGLBuffer
	glIBuf: WebGLBuffer
	vqueue: number[] = []
	iqueue: number[] = []
	stride: number
	maxVertices: number
	maxIndices: number

	vertexFormat: VertexFormat
	numDraws: number = 0

	curPrimitive: GLenum | null = null
	curTex: Texture | null = null
	curShader: Shader | null = null
	curUniform: Uniform = {}

	constructor(ctx: GLCtx, format: VertexFormat, maxVertices: number, maxIndices: number) {

		const gl = ctx.gl

		this.vertexFormat = format
		this.ctx = ctx
		this.stride = format.reduce((sum, f) => sum + f.size, 0)
		this.maxVertices = maxVertices
		this.maxIndices = maxIndices

		this.glVBuf = gl.createBuffer()
		ctx.pushArrayBuffer(this.glVBuf)
		gl.bufferData(gl.ARRAY_BUFFER, maxVertices * 4, gl.DYNAMIC_DRAW)
		ctx.popArrayBuffer()

		this.glIBuf = gl.createBuffer()
		ctx.pushElementArrayBuffer(this.glIBuf)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, maxIndices * 4, gl.DYNAMIC_DRAW)
		ctx.popElementArrayBuffer()

	}

	push(
		primitive: GLenum,
		verts: number[],
		indices: number[],
		shader: Shader,
		tex: Texture | null = null,
		uniform: Uniform = {},
	) {
		if (
			primitive !== this.curPrimitive
			|| tex !== this.curTex
			|| shader !== this.curShader
			|| !deepEq(this.curUniform, uniform)
			|| this.vqueue.length + verts.length * this.stride > this.maxVertices
			|| this.iqueue.length + indices.length > this.maxIndices
		) {
			this.flush()
		}
		const indexOffset = this.vqueue.length / this.stride
		for (const v of verts) {
			this.vqueue.push(v)
		}
		for (const i of indices) {
			this.iqueue.push(i + indexOffset)
		}
		this.curPrimitive = primitive
		this.curShader = shader
		this.curTex = tex
		this.curUniform = uniform
	}

	flush() {

		if (
			!this.curPrimitive
			|| !this.curShader
			|| this.vqueue.length === 0
			|| this.iqueue.length === 0
		) {
			return
		}

		const gl = this.ctx.gl

		this.ctx.pushArrayBuffer(this.glVBuf)
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(this.vqueue))
		this.ctx.pushElementArrayBuffer(this.glIBuf)
		gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(this.iqueue))
		this.ctx.setVertexFormat(this.vertexFormat)
		this.curShader.bind()
		this.curShader.send(this.curUniform)
		this.curTex?.bind()
		gl.drawElements(this.curPrimitive, this.iqueue.length, gl.UNSIGNED_SHORT, 0)
		this.curTex?.unbind()
		this.curShader.unbind()

		this.ctx.popArrayBuffer()
		this.ctx.popElementArrayBuffer()

		this.vqueue = []
		this.iqueue = []
		this.numDraws++

	}

	free() {
		const gl = this.ctx.gl
		gl.deleteBuffer(this.glVBuf)
		gl.deleteBuffer(this.glIBuf)
	}

}

export class Mesh {

	ctx: GLCtx
	glVBuf: WebGLBuffer
	glIBuf: WebGLBuffer
	vertexFormat: VertexFormat
	count: number

	constructor(ctx: GLCtx, format: VertexFormat, verts: number[], indices: number[]) {

		const gl = ctx.gl

		this.vertexFormat = format
		this.ctx = ctx

		this.glVBuf = gl.createBuffer()
		ctx.pushArrayBuffer(this.glVBuf)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW)
		ctx.popArrayBuffer()

		this.glIBuf = gl.createBuffer()
		ctx.pushElementArrayBuffer(this.glIBuf)
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
		ctx.popElementArrayBuffer()

		this.count = indices.length

	}

	draw(primitive?: GLenum) {
		const gl = this.ctx.gl
		this.ctx.pushArrayBuffer(this.glVBuf)
		this.ctx.pushElementArrayBuffer(this.glIBuf)
		this.ctx.setVertexFormat(this.vertexFormat)
		gl.drawElements(primitive ?? gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
		this.ctx.popArrayBuffer()
		this.ctx.popElementArrayBuffer()
	}

	free() {
		const gl = this.ctx.gl
		gl.deleteBuffer(this.glVBuf)
		gl.deleteBuffer(this.glIBuf)
	}


}

function genStack<T>(setFunc: (item: T | null) => void) {
	const stack: T[] = []
	// TODO: don't do anything if pushed item is the same as the one on top?
	const push = (item: T) => {
		stack.push(item)
		setFunc(item)
	}
	const pop = () => {
		stack.pop()
		setFunc(cur() ?? null)
	}
	const cur = () => stack[stack.length - 1]
	return [push, pop, cur] as const
}

export function createGLCtx(gl: WebGLRenderingContext, opts: {
	texFilter?: TexFilter,
} = {}) {

	const gc: Array<() => void> = []

	function onDestroy(action: () => void) {
		gc.push(action)
	}

	function destroy() {
		gc.forEach((action) => action())
		gl.getExtension("WEBGL_lose_context")?.loseContext()
	}

	let curVertexFormat: VertexFormat | null = null

	function setVertexFormat(fmt: VertexFormat) {
		if (deepEq(fmt, curVertexFormat)) return
		curVertexFormat = fmt
		const stride = fmt.reduce((sum, f) => sum + f.size, 0)
		fmt.reduce((offset, f, i) => {
			gl.vertexAttribPointer(i, f.size, gl.FLOAT, false, stride * 4, offset)
			gl.enableVertexAttribArray(i)
			return offset + f.size * 4
		}, 0)
	}

	const [ pushTexture2D, popTexture2D ] =
		genStack<WebGLTexture>((t) => gl.bindTexture(gl.TEXTURE_2D, t))

	const [ pushArrayBuffer, popArrayBuffer ] =
		genStack<WebGLBuffer>((b) => gl.bindBuffer(gl.ARRAY_BUFFER, b))

	const [ pushElementArrayBuffer, popElementArrayBuffer ] =
		genStack<WebGLBuffer>((b) => gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b))

	const [ pushFramebuffer, popFramebuffer ] =
		genStack<WebGLFramebuffer>((b) => gl.bindFramebuffer(gl.FRAMEBUFFER, b))

	const [ pushRenderbuffer, popRenderbuffer ] =
		genStack<WebGLRenderbuffer>((b) => gl.bindRenderbuffer(gl.RENDERBUFFER, b))

	const [ pushViewport, popViewport ] =
		genStack<{ x: number, y: number, w: number, h: number }>((v) => {
			if (v) {
				gl.viewport(v.x, v.y, v.w, v.h)
			} else {
				gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
			}
		})

	const [ pushProgram, popProgram ] = genStack<WebGLProgram>((p) => gl.useProgram(p))

	pushViewport({ x: 0, y: 0, w: gl.drawingBufferWidth, h: gl.drawingBufferHeight })

	return {
		gl,
		opts,
		onDestroy,
		destroy,
		pushTexture2D,
		popTexture2D,
		pushArrayBuffer,
		popArrayBuffer,
		pushElementArrayBuffer,
		popElementArrayBuffer,
		pushFramebuffer,
		popFramebuffer,
		pushRenderbuffer,
		popRenderbuffer,
		pushViewport,
		popViewport,
		pushProgram,
		popProgram,
		setVertexFormat,
	}

}

export type CreateGfxOpts = {
	canvas: HTMLCanvasElement,
	width?: number,
	height?: number,
	background?: [number, number, number] | [number, number, number, number],
}

function anchorPt(orig: Anchor | Vec2): Vec2 {
	switch (orig) {
		case "topleft": return new Vec2(-1, -1)
		case "top": return new Vec2(0, -1)
		case "topright": return new Vec2(1, -1)
		case "left": return new Vec2(-1, 0)
		case "center": return new Vec2(0, 0)
		case "right": return new Vec2(1, 0)
		case "botleft": return new Vec2(-1, 1)
		case "bot": return new Vec2(0, 1)
		case "botright": return new Vec2(1, 1)
		default: return orig
	}
}

export function createGfx(opts: CreateGfxOpts) {

	const gl = opts.canvas.getContext("webgl2", {
		antialias: true,
		depth: true,
		stencil: true,
		alpha: true,
		preserveDrawingBuffer: true,
	}) as WebGLRenderingContext

	if (!gl) {
		throw new Error("failed to get webgl2 context")
	}

	const glCtx = createGLCtx(gl)

	function createShader(
		vertSrc: string | null = DEF_VERT,
		fragSrc: string | null = DEF_FRAG,
	): Shader {
		const vcode = VERT_TEMPLATE.replace("{{user}}", vertSrc ?? DEF_VERT)
		const fcode = FRAG_TEMPLATE.replace("{{user}}", fragSrc ?? DEF_FRAG)
		try {
			return new Shader(glCtx, vcode, fcode, VERTEX_FORMAT.map((vert) => vert.name))
		} catch (e) {
			const lineOffset = 14
			const fmt = /(?<type>^\w+) SHADER ERROR: 0:(?<line>\d+): (?<msg>.+)/
			const match = getErrorMsg(e).match(fmt)
			if (match?.groups) {
				const line = Number(match.groups.line) - lineOffset
				const msg = match.groups.msg.trim()
				const ty = match.groups.type.toLowerCase()
				throw new Error(`${ty} shader line ${line}: ${msg}`)
			} else {
				throw e
			}
		}
	}

	const gfx = (() => {

		const defShader = createShader(DEF_VERT, DEF_FRAG)

		const emptyTex = Texture.fromImage(
			glCtx,
			new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1),
		)

		const frameBuffer = (opts.width && opts.height)
			? new FrameBuffer(glCtx, opts.width, opts.height)
			: new FrameBuffer(glCtx, gl.drawingBufferWidth, gl.drawingBufferHeight)

		let bgColor: null | Color = null
		let bgAlpha = 1

		if (opts.background) {
			bgColor = Color.fromArray(opts.background)
			bgAlpha = opts.background[3] ?? 1
			gl.clearColor(
				bgColor.r / 255,
				bgColor.g / 255,
				bgColor.b / 255,
				bgAlpha ?? 1,
			)
		}

		gl.enable(gl.BLEND)

		gl.blendFuncSeparate(
			gl.SRC_ALPHA,
			gl.ONE_MINUS_SRC_ALPHA,
			gl.ONE,
			gl.ONE_MINUS_SRC_ALPHA,
		)

		const renderer = new BatchRenderer(
			glCtx,
			VERTEX_FORMAT,
			MAX_BATCHED_VERTS,
			MAX_BATCHED_INDICES,
		)

		const bgTex = Texture.fromImage(
			glCtx,
			new ImageData(new Uint8ClampedArray([
				128, 128, 128, 255,
				190, 190, 190, 255,
				190, 190, 190, 255,
				128, 128, 128, 255,
			]), 2, 2), {
				wrap: "repeat",
				filter: "nearest",
			},
		)

		return {

			lastDrawCalls: 0,

			defShader: defShader,
			defTex: emptyTex,
			frameBuffer: frameBuffer,
			postShader: null,
			postShaderUniform: null,
			renderer: renderer,

			transform: new Mat4(),
			transformStack: [] as Mat4[],

			bgTex: bgTex,
			bgColor: bgColor,
			bgAlpha: bgAlpha,

			width: opts.width ?? gl.drawingBufferWidth,
			height: opts.height ?? gl.drawingBufferHeight,

			viewport: {
				x: 0,
				y: 0,
				width: gl.drawingBufferWidth,
				height: gl.drawingBufferHeight,
			},

		}

	})()

	function screen2ndc(pt: Vec2): Vec2 {
		return new Vec2(
			pt.x / gfx.width * 2 - 1,
			-pt.y / gfx.height * 2 + 1,
		)
	}

	function pushTransform() {
		gfx.transformStack.push(gfx.transform.clone())
	}

	function popTransform() {
		if (gfx.transformStack.length > 0) {
			gfx.transform = gfx.transformStack.pop() ?? new Mat4()
		}
	}

	function pushTranslate(p: Vec2) {
		if (p.x === 0 && p.y === 0) return
		gfx.transform.translate(p)
	}

	function pushScale(s: Vec2 | number) {
		if (typeof s === "number") return pushScale(new Vec2(s))
		if (s.x === 1 && s.y === 1) return
		gfx.transform.scale(s)
	}

	function pushRotate(a: number) {
		if (!a) return
		gfx.transform.rotate(a)
	}

	function drawRaw(
		verts: Vertex[],
		indices: number[],
		tex: Texture = gfx.defTex,
		shader: Shader = gfx.defShader,
		uniform: Uniform = {},
	) {

		const transformedVerts = []

		for (const v of verts) {
			const pt = screen2ndc(gfx.transform.multVec2(v.pos))
			transformedVerts.push(
				pt.x, pt.y,
				v.uv.x, v.uv.y,
				v.color.r / 255, v.color.g / 255, v.color.b / 255, v.opacity,
			)
		}

		gfx.renderer.push(
			gl.TRIANGLES,
			transformedVerts,
			indices,
			shader,
			tex,
			uniform,
		)

	}

	function drawUnscaled(content: () => void) {
		flush()
		const ow = gfx.width
		const oh = gfx.height
		gfx.width = gl.drawingBufferWidth
		gfx.height = gl.drawingBufferHeight
		content()
		flush()
		gfx.width = ow
		gfx.height = oh
	}

	function drawUVQuad(opt: DrawUVQuadOpt) {

		if (opt.width === undefined || opt.height === undefined) {
			throw new Error("drawUVQuad() requires property \"width\" and \"height\".")
		}

		if (opt.width <= 0 || opt.height <= 0) {
			return
		}

		const w = opt.width
		const h = opt.height
		const anchor = anchorPt(opt.anchor || DEF_ANCHOR)
		const offset = anchor.scale(new Vec2(w, h).scale(-0.5))
		const q = opt.quad || new Quad(0, 0, 1, 1)
		const color = opt.color || new Color(255, 255, 255)
		const opacity = opt.opacity ?? 1

		// apply uv padding to avoid artifacts
		const uvPadX = opt.tex ? UV_PAD / opt.tex.width : 0
		const uvPadY = opt.tex ? UV_PAD / opt.tex.height : 0
		const qx = q.x + uvPadX
		const qy = q.y + uvPadY
		const qw = q.w - uvPadX * 2
		const qh = q.h - uvPadY * 2

		pushTransform()
		if (opt.pos) pushTranslate(opt.pos)
		if (opt.angle) pushRotate(opt.angle)
		if (opt.scale) pushScale(opt.scale)
		pushTranslate(offset)

		drawRaw([
			{
				pos: new Vec2(-w / 2, h / 2),
				uv: new Vec2(opt.flipX ? qx + qw : qx, opt.flipY ? qy : qy + qh),
				color: color,
				opacity: opacity,
			},
			{
				pos: new Vec2(-w / 2, -h / 2),
				uv: new Vec2(opt.flipX ? qx + qw : qx, opt.flipY ? qy + qh : qy),
				color: color,
				opacity: opacity,
			},
			{
				pos: new Vec2(w / 2, -h / 2),
				uv: new Vec2(opt.flipX ? qx : qx + qw, opt.flipY ? qy + qh : qy),
				color: color,
				opacity: opacity,
			},
			{
				pos: new Vec2(w / 2, h / 2),
				uv: new Vec2(opt.flipX ? qx : qx + qw, opt.flipY ? qy : qy + qh),
				color: color,
				opacity: opacity,
			},
		], [0, 1, 3, 1, 2, 3], opt.tex, opt.shader, opt.uniform)

		popTransform()

	}

	function drawTexture(opt: DrawTextureOpt) {

		if (!opt.tex) {
			throw new Error("drawTexture() requires property \"tex\".")
		}

		const q = opt.quad ?? new Quad(0, 0, 1, 1)
		const w = opt.tex.width * q.w
		const h = opt.tex.height * q.h
		const scale = new Vec2(1)

		if (opt.tiled) {

			// TODO: draw fract
			const repX = Math.ceil((opt.width || w) / w)
			const repY = Math.ceil((opt.height || h) / h)
			const anchor = anchorPt(opt.anchor || DEF_ANCHOR).add(new Vec2(1, 1)).scale(0.5)
			const offset = anchor.scale(new Vec2(repX * w, repY * h))

			// TODO: rotation
			for (let i = 0; i < repX; i++) {
				for (let j = 0; j < repY; j++) {
					drawUVQuad(Object.assign({}, opt, {
						pos: (opt.pos || new Vec2(0)).add(new Vec2(w * i, h * j)).sub(offset),
						scale: scale.scale(opt.scale || new Vec2(1)),
						tex: opt.tex,
						quad: q,
						width: w,
						height: h,
						anchor: "topleft",
					}))
				}
			}
		} else {

			// TODO: should this ignore scale?
			if (opt.width && opt.height) {
				scale.x = opt.width / w
				scale.y = opt.height / h
			} else if (opt.width) {
				scale.x = opt.width / w
				scale.y = scale.x
			} else if (opt.height) {
				scale.y = opt.height / h
				scale.x = scale.y
			}

			drawUVQuad(Object.assign({}, opt, {
				scale: scale.scale(opt.scale || new Vec2(1)),
				tex: opt.tex,
				quad: q,
				width: w,
				height: h,
			}))

		}

	}

	function drawSprite(opt: DrawSpriteOpt) {

		if (!opt.sprite) {
			throw new Error("drawSprite() requires property \"sprite\"")
		}

		const frame = opt.sprite.frames[opt.frame ?? 0]

		if (!frame) {
			throw new Error(`frame not found: ${opt.frame ?? 0}`)
		}

		drawTexture(Object.assign({}, opt, {
			tex: frame.tex,
			quad: frame.quad.scale(opt.quad ?? new Quad(0, 0, 1, 1)),
		}))

	}

	function flush() {
		gfx.renderer.flush()
	}

	function frameStart() {

		gl.clear(gl.COLOR_BUFFER_BIT)
		gfx.frameBuffer.bind()
		gl.clear(gl.COLOR_BUFFER_BIT)

		if (!gfx.bgColor) {
			drawUnscaled(() => {
				drawUVQuad({
					width: gfx.width,
					height: gfx.height,
					quad: new Quad(
						0,
						0,
						gfx.width / BG_GRID_SIZE,
						gfx.height / BG_GRID_SIZE,
					),
					tex: gfx.bgTex,
				})
			})
		}

		gfx.renderer.numDraws = 0
		gfx.transformStack.length = 0
		gfx.transform = new Mat4()

	}

	function frameEnd() {

		flush()
		gfx.lastDrawCalls = gfx.renderer.numDraws
		gfx.frameBuffer.unbind()
		gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)

		drawTexture({
			flipY: true,
			tex: gfx.frameBuffer.tex,
			pos: new Vec2(gfx.viewport.x, gfx.viewport.y),
			width: gfx.viewport.width,
			height: gfx.viewport.height,
		})

		flush()

	}

	const packer = new TexPacker(glCtx, SPRITE_ATLAS_WIDTH, SPRITE_ATLAS_HEIGHT)

	function slice(x = 1, y = 1, dx = 0, dy = 0, w = 1, h = 1): Quad[] {
		const frames = []
		const qw = w / x
		const qh = h / y
		for (let j = 0; j < y; j++) {
			for (let i = 0; i < x; i++) {
				frames.push(new Quad(
					dx + i * qw,
					dy + j * qh,
					qw,
					qh,
				))
			}
		}
		return frames
	}

	async function loadSprite(src: string, opt: LoadSpriteOpt = {}): Promise<Sprite> {
		const img = await loadImg(src)
		const [tex, quad] = packer.add(img)
		const quads = opt.frames ? opt.frames.map((f) => new Quad(
			quad.x + f.x * quad.w,
			quad.y + f.y * quad.h,
			f.w * quad.w,
			f.h * quad.h,
		)) : slice(opt.sliceX || 1, opt.sliceY || 1, quad.x, quad.y, quad.w, quad.h)
		return {
			frames: quads.map((q) => ({
				tex: tex,
				quad: q,
			})),
			anims: opt.anims ?? {},
		}
	}

	async function loadSpritesAnim(src: string[], opt: LoadSpriteOpt = {}): Promise<Sprite> {
		const imgs = await Promise.all(src.map((url) => loadImg(url)))
		const frames = imgs.map((img) => {
			const [tex, quad] = packer.add(img)
			return {
				tex: tex,
				quad: quad,
			}
		})
		return {
			frames: frames,
			anims: opt.anims ?? {},
		}
	}

	return {
		frameStart,
		frameEnd,
		loadSprite,
		loadSpritesAnim,
		drawSprite,
		pushTransform,
		popTransform,
		pushTranslate,
		pushScale,
		pushRotate,
	}

}
