// helper functions for the world wide web with Bun

if (typeof Bun === "undefined") {
	throw new Error("requires bun")
}

import * as fs from "node:fs/promises"
import * as path from "node:path"

import type {
	ServeOptions,
	WebSocketServeOptions,
	SocketAddress,
	ServerWebSocket,
	ServerWebSocketSendStatus,
	WebSocketHandler,
} from "bun"

import * as sqlite from "bun:sqlite"

import {
	isDev,
	isFile,
	isDir,
	mapValues,
	ansi,
} from "./utils"

import type {
	Table,
} from "./db"

import {
	createDatabase,
} from "./db"

import {
	h,
	style,
	css,
} from "./html"

export type Req = {
	method: string,
	headers: Headers,
	url: URL,
	params: Record<string, string>,
	text: () => Promise<string>,
	arrayBuffer: () => Promise<ArrayBuffer>,
	json<T = any>(): Promise<T>,
	formData: () => Promise<FormData>,
	blob: () => Promise<Blob>,
	getIP: () => string | null,
	getCookies: () => Record<string, string>,
}

export type Res = {
	headers: Headers,
	status: number,
	body: null | BodyInit,
	send: (data?: BodyInit | null, opt?: ResOpt) => void,
	sendText: (content: string, opt?: ResOpt) => void,
	sendHTML: (content: string, opt?: ResOpt) => void,
	sendJSON: <T = any>(content: T, opt?: ResOpt) => void,
	sendFile: (path: string, opt?: ResOpt) => void,
	redirect: (url: string, status?: number) => void,
}

export type ResOpt = {
	headers?: Record<string, string>,
	status?: number,
}

export type SendFileOpt = ResOpt & {
	mimes?: Record<string, string>,
}

export type ServerCtx = {
	req: Req,
	res: Res,
	next: () => void,
	upgrade: (opts?: ServerUpgradeOpts) => boolean,
	onFinish: (action: () => void) => void,
	onError: (action: (e: Error) => void) => void,
}

export type Handler = (ctx: ServerCtx) => void | Promise<void>
export type ErrorHandler = (ctx: ServerCtx, err: Error) => void
export type NotFoundHandler = (ctx: ServerCtx) => void

export class Registry<T> extends Map<number, T> {
	private lastID: number = 0
	push(v: T): number {
		const id = this.lastID
		this.set(id, v)
		this.lastID++
		return id
	}
	pushd(v: T): () => void {
		const id = this.push(v)
		return () => this.delete(id)
	}
}

export type Server = {
	use: (handler: Handler) => void,
	error: (handler: ErrorHandler) => void,
	notFound: (action: NotFoundHandler) => void,
    stop: (closeActiveConnections?: boolean) => void,
	hostname: string | undefined,
	url: URL,
	port: number | undefined,
	ws: {
		clients: Map<string, WebSocket>,
		onMessage: (action: (ws: WebSocket, msg: string | Buffer) => void) => EventController,
		onOpen: (action: (ws: WebSocket) => void) => EventController,
		onClose: (action: (ws: WebSocket) => void) => EventController,
		publish: (
			topic: string,
			data: string | DataView | ArrayBuffer | SharedArrayBuffer,
			compress?: boolean,
		) => ServerWebSocketSendStatus,
	},
}

export type ServerOpts = {
	hostname?: string,
	port?: number,
	idleTimeout?: number,
}

export type ServerUpgradeOpts<T = undefined> = {
	headers?: HeadersInit,
	data?: T,
}

export type EventController = {
	paused: boolean,
	cancel: () => void
}

export function createEvent<Args extends any[] = any[]>() {

	const actions = new Registry<(...args: Args) => void>()

	function add(action: (...args: Args) => void): EventController {
		let paused = false
		const cancel = actions.pushd((...args: Args) => {
			if (paused) return
			action(...args)
		})
		return {
			get paused() {
				return paused
			},
			set paused(p: boolean) {
				paused = p
			},
			cancel: cancel,
		}
	}
	function addOnce(action: (...args: Args) => void): EventController {
		const ev = add((...args) => {
			ev.cancel()
			action(...args)
		})
		return ev
	}

	const next = () => new Promise((res) => addOnce((...args) => res(args)))
	const trigger = (...args: Args) => actions.forEach((action) => action(...args))
	const numListeners = () => actions.size
	const clear = () => actions.clear()

	return {
		add,
		addOnce,
		next,
		trigger,
		numListeners,
		clear,
	}
}

export type WebSocketData = {
	id: string,
}

// TODO: support arbituary data
export type WebSocket = ServerWebSocket<WebSocketData>

// TODO: can pass a full Response
export class HTTPError extends Error {
	code: number
	constructor(code: number, msg: string) {
		super(msg)
		this.code = code
		this.name = "HTTPError"
	}
}

const isPromise = (value: any): value is Promise<any> => {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof value.then === "function" &&
		typeof value.catch === "function"
	)
}

export function createServer(opts: ServerOpts = {}): Server {

	const wsClients = new Map<string, WebSocket>()
	const wsEvents = {
		message: createEvent<[WebSocket, string | Buffer]>(),
		open: createEvent<[WebSocket]>(),
		close: createEvent<[WebSocket]>(),
	}
	const websocket: WebSocketHandler<WebSocketData> = {
		message: (ws, msg) => {
			wsEvents.message.trigger(ws, msg)
		},
		open: (ws) => {
			const id = crypto.randomUUID()
			wsClients.set(id, ws)
			ws.data = {
				id: id,
			}
			wsEvents.open.trigger(ws)
		},
		close: (ws) => {
			wsClients.delete(ws.data.id)
			wsEvents.close.trigger(ws)
		},
	}

	// TODO: make all next() await so middlewares like logger are easier
	async function fetch(bunReq: Request): Promise<Response> {
		return new Promise((resolve) => {
			let done = false
			const req: Req = {
				method: bunReq.method,
				url: new URL(bunReq.url),
				headers: bunReq.headers,
				params: {},
				text: bunReq.text.bind(bunReq),
				json: bunReq.json.bind(bunReq),
				arrayBuffer: bunReq.arrayBuffer.bind(bunReq),
				formData: bunReq.formData.bind(bunReq),
				blob: bunReq.blob.bind(bunReq),
				getIP: () => {
					let ip = bunReq.headers.get("X-Forwarded-For")?.split(",")[0].trim()
						?? bunServer.requestIP(bunReq)?.address
					if (!ip) return null
					const ipv6Prefix = "::ffff:"
					// ipv4 in ipv6
					if (ip?.startsWith(ipv6Prefix)) {
						ip = ip.substring(ipv6Prefix.length)
					}
					const localhostIPs = new Set([
						"127.0.0.1",
						"::1",
					])
					if (localhostIPs.has(ip)) return null
					return ip
				},
				getCookies: () => {
					const str = bunReq.headers.get("Cookie")
					if (!str) return {}
					const cookies: Record<string, string> = {}
					for (const c of str.split(";")) {
						const [k, v] = c.split("=")
						cookies[k.trim()] = v.trim()
					}
					return cookies
				},
			}

			const onFinishEvents: Array<() => void> = []
			const onErrorEvents: Array<(e: Error) => void> = []
			let headers = new Headers()
			let status = 200
			let body: null | BodyInit = null

			function send(b?: BodyInit | null, opt: ResOpt = {}) {
				if (done) return
				body = b ?? body
				status = opt.status ?? status
				if (opt.headers) {
					for (const k in opt.headers) {
						headers.set(k, opt.headers[k])
					}
				}
				const bunRes = new Response(body, {
					headers: headers,
					status: status,
				})
				if (bunReq.method.toUpperCase() === "HEAD") {
					// TODO
				}
				resolve(bunRes)
				done = true
				onFinishEvents.forEach((f) => f())
			}

			function sendText(content: string, opt: ResOpt = {}) {
				headers.set("Content-Type", "text/plain; charset=utf-8")
				send(content, opt)
			}

			function sendHTML(content: string, opt: ResOpt = {}) {
				headers.set("Content-Type", "text/html; charset=utf-8")
				send(content, opt)
			}

			function sendJSON(content: unknown, opt: ResOpt = {}) {
				headers.set("Content-Type", "application/json; charset=utf-8")
				send(JSON.stringify(content), opt)
			}

			function sendFile(p: string, opt: SendFileOpt = {}) {
				const file = Bun.file(p)
				// TODO: use file.exists()
				if (file.size === 0) {
					throw new HTTPError(404, "not found")
				}
				const mtimeServer = req.headers.get("If-Modified-Since")
				const mtimeClient = toHTTPDate(new Date(file.lastModified))
				if (mtimeServer === mtimeClient) {
					return send(null, { status: 304 })
				}
				// TODO: stream not working
				// https://github.com/oven-sh/bun/blob/main/examples/http-file-extended.ts
				// const range = bunReq.headers.get("Range")
				// if (range) {
					// let [start, end] = range
						// .replace("bytes=", "")
						// .split("-")
						// .map(parseInt)
					// start = start || 0
					// end = end || file.size - 1
					// if (start >= file.size || end >= file.size) {
						// headers.set("Content-Range", `bytes */${file.size}`)
						// return send(null, { status: 416 })
					// }
					// headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`)
					// headers.set("Content-Length", "" + (end - start + 1))
					// headers.set("Accept-Ranges", "bytes")
					// return send(file.slice(start, end), {
						// ...opt,
						// status: 206,
					// })
				// }
				headers.set("Last-Modified", mtimeClient)
				headers.set("Cache-Control", "no-cache")
				return send(file, opt)
			}

			function redirect(url: string, s: number = 302) {
				headers.set("Location", url)
				status = s
				send(null)
			}

			const res: Res = {
				get status() { return status },
				set status(s) { status = s },
				get body() { return body },
				set body(b) { body = b },
				headers,
				send,
				sendText,
				sendHTML,
				sendJSON,
				sendFile,
				redirect,
			}

			const curHandlers = [...handlers]

			function next() {
				if (done) return
				const h = curHandlers.shift()
				const ctx: ServerCtx = {
					req,
					res,
					next,
					upgrade: (opts) => {
						const success = bunServer.upgrade(bunReq, opts)
						// @ts-ignore
						if (success) resolve()
						return success
					},
					onFinish(action) {
						onFinishEvents.push(action)
					},
					onError(action) {
						onErrorEvents.push(action)
					},
				}
				if (h) {
					try {
						const res = h(ctx)
						if (isPromise(res)) {
							res.catch((e) => {
								errHandler(ctx, e)
								onErrorEvents.forEach((f) => f(e))
							})
						}
					} catch (e) {
						errHandler(ctx, e as Error)
						onErrorEvents.forEach((f) => f(e as Error))
					}
				} else {
					notFoundHandler(ctx)
				}
			}
			next()
		})
	}

	const bunServer = Bun.serve({
		port: opts.port,
		hostname: opts.hostname ?? "::",
		websocket,
		fetch,
		development: isDev,
	})

	const handlers: Handler[] = []
	const use = (handler: Handler) => handlers.push(handler)
	let errHandler: ErrorHandler = ({ req, res, next }, err) => {
		console.error(err)
		if (err instanceof HTTPError) {
			res.status = err.code
			res.sendText(`${err.code} ${err.message}`)
		} else {
			res.status = 500
			res.sendText("500 internal server error")
		}
	}
	let notFoundHandler: NotFoundHandler = ({ res }) => {
		res.status = 404
		res.sendText("404 not found")
	}

	return {
		use: use,
		error: (action: ErrorHandler) => errHandler = action,
		notFound: (action: NotFoundHandler) => notFoundHandler = action,
		stop: bunServer.stop.bind(bunServer),
		hostname: bunServer.hostname,
		url: bunServer.url,
		port: bunServer.port,
		ws: {
			clients: wsClients,
			onMessage: (action) => wsEvents.message.add(action),
			onOpen: (action) => wsEvents.open.add(action),
			onClose: (action) => wsEvents.close.add(action),
			publish: bunServer.publish.bind(bunServer),
		},
	}
}

export function matchPath(pat: string, url: string): Record<string, string> | null {

	pat = pat.replace(/\/$/, "")
	url = url.replace(/\/$/, "")

	if (pat === url) return {}

	const vars = pat.match(/:[^\/]+/g) || []
	let regStr = pat

	for (const v of vars) {
		const name = v.substring(1)
		regStr = regStr.replace(v, `(?<${name}>[^\/]+)`)
	}

	regStr = "^" + regStr + "$"

	const reg = new RegExp(regStr)
	const matches = reg.exec(url)

	if (matches) {
		return { ...matches.groups }
	} else {
		return null
	}

}

type HTTPMethod =
	| "GET"
	| "HEAD"
	| "POST"
	| "PUT"
	| "DELETE"
	| "CONNECT"
	| "OPTIONS"
	| "TRACE"
	| "PATCH"

type Router = {
	add: (method: HTTPMethod | "*", path: string, handler: Handler) => void,
	mount: (prefix?: string) => Handler,
}

type RouteDef = {
	method: HTTPMethod | "*",
	path: string,
	handler: Handler,
}

export function createRouter(): Router {
	const routes: RouteDef[] = []
	function add(method: HTTPMethod | "*", path: string, handler: Handler) {
		routes.push({
			path: path,
			method: method,
			handler: handler,
		})
	}
	function mount(prefix: string = ""): Handler {
		return (ctx) => {
			const { req, res, next } = ctx
			const method = req.method.toUpperCase()
			for (const route of routes) {
				if (
					route.method !== "*" &&
					route.method.toUpperCase() !== method
				) {
					continue
				}
				const match = matchPath(prefix + route.path, decodeURI(req.url.pathname))
				if (match) {
					ctx.req.params = match
					return route.handler(ctx)
				}
			}
			next()
		}
	}
	return {
		add,
		mount,
	}
}

export const route = (method: HTTPMethod, path: string, handler: Handler) => {
	const r = createRouter()
	r.add(method, path, handler)
	return r.mount()
}

const trimSlashes = (str: string) => str.replace(/\/*$/, "").replace(/^\/*/, "")

export async function mapAsync<T, U>(
	arr: T[],
	fn: (item: T, index: number, arr: T[]) => Promise<U>
): Promise<U[]> {
	return Promise.all(arr.map(fn))
}

export function files(route = "", root = ""): Handler {
	return ({ req, res, next }) => {
		route = trimSlashes(route)
		const pathname = trimSlashes(decodeURI(req.url.pathname))
		if (!pathname.startsWith(route)) return next()
		const baseDir = "./" + trimSlashes(root)
		const relativeURLPath = pathname.replace(new RegExp(`^${route}/?`), "")
		const p = path.join(baseDir, relativeURLPath)
		return res.sendFile(p)
	}
}

export function filebrowser(route = "", root = ""): Handler {
	route = trimSlashes(route)
	root = trimSlashes(root)
	return async ({ req, res, next }) => {
		const urlPath = trimSlashes(decodeURIComponent(req.url.pathname))
		if (!urlPath.startsWith(route)) return next()
		const relativeURLPath = urlPath.replace(new RegExp(`^${route}/?`), "")
		const isRoot = relativeURLPath === ""
		const diskPath = path.join("./" + root, relativeURLPath)
		if (await isFile(diskPath)) return res.sendFile(diskPath)
		if (!await isDir(diskPath)) return next()
		const entries = (await fs.readdir(diskPath))
			.filter((entry) => !entry.startsWith("."))
			.sort((a, b) => a > b ? -1 : 1)
			.sort((a, b) => path.extname(a) > path.extname(b) ? 1 : -1)
		const files = []
		const dirs = []
		for (const entry of entries) {
			const p = path.join(diskPath, entry)
			if (await isDir(p)) {
				dirs.push(entry)
			} else if (await isFile(p)) {
				if (entry.startsWith("README") || entry === "index.html") {
					files.unshift(entry)
				} else {
					files.push(entry)
				}
			}
		}
		async function resolveDefFile(p: string) {
			if (await isFile(path.join(p, "index.html"))) {
				return p + "#index.html"
			} else if (await isFile(path.join(p, "README.txt"))) {
				return p + "#README.txt"
			}
			return p
		}
		return res.sendHTML("<!DOCTYPE html>" + h("html", { lang: "en" }, [
			h("head", {}, [
				h("title", {}, urlPath + "/"),
				h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
				h("style", {}, css({
					"*": {
						"margin": "0",
						"padding": "0",
						"box-sizing": "border-box",
					},
					"html": {
						"width": "100%",
						"height": "100%",
					},
					"body": {
						"width": "100%",
						"height": "100%",
						"padding": "8px",
						"font-size": "16px",
						"font-family": "Monospace",
						"display": "grid",
						"grid-template-columns": "1fr 3fr",
						"gap": "8px",
						"@media": {
							"(max-width: 640px)": {
								"grid-template-columns": "1fr",
								"grid-template-rows": "1fr 2fr",
							},
						},
					},
					"#tree": {
						"border-right": "dotted 2px #ccc",
						"outline": "none",
						"@media": {
							"(max-width: 640px)": {
								"border-bottom": "dotted 2px #ccc"
							},
						},
					},
					".box": {
						"padding": "8px",
						"overflow": "scroll",
						"height": "100%",
					},
					"li": {
						"list-style": "none",
					},
					"a": {
						"color": "blue",
						"text-decoration": "none",
						"cursor": "pointer",
						":hover": {
							"background": "blue",
							"color": "white",
						},
						"&.selected": {
							"background": "blue",
							"color": "white",
						},
					},
					"p": {
						"white-space": "pre-wrap",
						"overflow": "scroll",
						"height": "100%",
					},
					"img": {
						"max-width": "calc(100% - 4px)",
						"max-height": "calc(100% - 4px)",
					},
					"video": {
						"max-width": "calc(100% - 4px)",
						"max-height": "calc(100% - 4px)",
					},
					"iframe": {
						"border": "none",
						"outline": "none",
						"width": "calc(100% - 4px)",
						"height": "calc(100% - 4px)",
					},
					"embed": {
						"border": "none",
						"outline": "none",
						"width": "calc(100% - 4px)",
						"height": "calc(100% - 4px)",
					},
				})),
			]),
			h("body", {}, [
				h("ul", { id: "tree", class: "box", tabindex: 0 }, [
					...(isRoot ? [] : [
						h("a", { href: `/${await resolveDefFile(path.dirname(diskPath))}`, }, ".."),
					]),
					...await mapAsync(dirs, async (d: string) => h("li", {}, [
						h("a", { href: `/${await resolveDefFile(`${diskPath}/${d}`)}`, }, d + "/"),
					])),
					...files.map((file) => h("li", {}, [
						h("a", { href: `#${file}`, class: "entry" }, file),
					])),
				]),
				h("div", { id: "content", class: "box" }, []),
				h("script", {}, `
const entries = document.querySelectorAll(".entry")
const content = document.querySelector("#content")
const tree = document.querySelector("#tree")
let curIdx = null

tree.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault()
    if (curIdx === null) {
      toIdx(0)
    } else {
      if (e.key === "ArrowUp") {
        if (curIdx > 0) {
          location.hash = "#" + entries[curIdx - 1].textContent
        }
      } else if (e.key === "ArrowDown") {
        if (curIdx < entries.length - 1) {
          location.hash = "#" + entries[curIdx + 1].textContent
        }
      }
    }
  }
})

function isInView(el) {
  const rect = el.getBoundingClientRect()
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  )
}

function reset() {
  for (const entry of entries) {
    entry.classList.remove("selected")
  }
  content.innerHTML = ""
  document.title = "${urlPath}" + "/"
  curIdx = null
}

async function toIdx(i) {

  const entry = entries[i]
  if (!entry) return

  reset()
  curIdx = i
  entry.classList.add("selected")

  if (!isInView(entry)) {
    entry.scrollIntoView()
  }

  const file = entry.textContent

  document.title = "${urlPath}" + "/" + file

  const anim = setInterval(() => {
    let c = content.textContent.length
    c = (c + 1) % 4
    content.textContent = ".".repeat(c)
  }, 100)

  const url = "/" + "${diskPath}" + "/" + encodeURIComponent(file)
  const res = await fetch(url)

  clearInterval(anim)
  content.innerHTML = ""

  if (!res.ok) {
    content.textContent = "file not found"
    return
  }

  const ty = res.headers.get("Content-Type")

  if (ty.startsWith("text/html")) {
    const iframe = document.createElement("iframe")
    iframe.src = url
    content.append(iframe)
  } else if (ty.startsWith("text/")) {
    const p = document.createElement("p")
    p.textContent = await res.text()
    content.append(p)
  } else if (ty.startsWith("image/")) {
    const img = document.createElement("img")
    img.src = url
    content.append(img)
  } else if (ty.startsWith("video/")) {
    const video = document.createElement("video")
    video.src = url
    video.controls = true
    content.append(video)
  } else if (ty.startsWith("audio/")) {
    const audio = document.createElement("audio")
    audio.src = url
    audio.controls = true
    content.append(audio)
  } else if (ty.includes("pdf")) {
    const embed = document.createElement("embed")
    embed.src = url
    content.append(embed)
  } else {
    content.textContent = "file type not supported"
  }

}

function findIdx(file) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.textContent === file) {
      return i
    }
  }
  return -1
}

function getHash() {
  return decodeURIComponent(location.hash.substring(1))
}

function updateHash() {
  const hash = getHash()
  const idx = findIdx(hash)
  if (idx !== -1) {
    toIdx(idx)
  } else {
    reset()
  }
}

window.addEventListener("hashchange", () => {
  updateHash()
})

if (location.hash) {
  updateHash()
}
				`),
			]),
		]))
	}
}

export type RateLimiterOpts = {
	time: number,
	limit: number,
	handler: Handler,
}

export function rateLimiter(opts: RateLimiterOpts): Handler {
	const reqCounter: Record<string, number> = {}
	return (ctx) => {
		const ip = ctx.req.getIP()
		if (!ip) return ctx.next()
		if (!(ip in reqCounter)) {
			reqCounter[ip] = 0
		}
		reqCounter[ip] += 1
		setTimeout(() => {
			reqCounter[ip] -= 1
			if (reqCounter[ip] === 0) {
				delete reqCounter[ip]
			}
		}, opts.time * 1000)
		if (reqCounter[ip] > opts.limit) {
			ctx.res.status = 429
			return opts.handler(ctx)
		}
		return ctx.next()
	}
}

export function toHTTPDate(d: Date) {
	return d.toUTCString()
}

export type LoggerOpts = {
	filter?: (req: Req, res: Res) => boolean,
	db?: string,
	file?: string,
	stdout?: boolean,
	stderr?: boolean,
}

export function fmtBytes(bytes: number, decimals: number = 2) {
	if (bytes === 0) return "0b"
	const k = 1024
	const dm = decimals < 0 ? 0 : decimals
	const sizes = ["b", "kb", "mb", "gb", "tb", "pb"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
	return `${size}${sizes[i]}`
}


// TODO: is there a way to get bun calculated Content-Length result?
// TODO: ReadableStream?
export function getBodySize(body: BodyInit) {
	if (typeof body === "string") {
		return Buffer.byteLength(body)
	} else if (body instanceof Blob) {
		return body.size
	} else if (body instanceof ArrayBuffer || "byteLength" in body) {
		return body.byteLength
	} else if (body instanceof URLSearchParams) {
		return Buffer.byteLength(body.toString())
	} else if (body instanceof FormData) {
		let size = 0
		body.forEach((v, k) => {
			if (typeof v === "string") {
				size += Buffer.byteLength(v)
			} else {
				size += v.size
			}
		})
		return size
	}
	return 0
}

// TODO: can there be a onStart() to record time
export async function logger(opts: LoggerOpts = {}): Promise<Handler> {
	let reqTable: Table | null = null
	if (opts.db) {
		const db = await createDatabase(opts.db)
		reqTable = db.table("request", {
			"id":     { type: "INTEGER", primaryKey: true, autoIncrement: true },
			"method": { type: "TEXT" },
			"path":   { type: "TEXT" },
			"params": { type: "TEXT" },
			"ip":     { type: "TEXT", allowNull: true },
			"err":    { type: "TEXT", allowNull: true },
		}, {
			timeCreated: true,
		})
	}
	return ({ req, res, next, onFinish, onError }) => {
		if (opts.filter) {
			if (!opts.filter(req, res)) {
				return next()
			}
		}
		const genMsg = (msgOpts: {
			color?: boolean,
		} = {}) => {
			const a = mapValues(ansi, (v) => {
				if (msgOpts.color) {
					return v
				} else {
					if (typeof v === "string") {
						return ""
					} else if (typeof v === "function") {
						return () => ""
					}
					return v
				}
			})
			const endTime = new Date()
			const msg = []
			const year = endTime.getUTCFullYear().toString().padStart(4, "0")
			const month = (endTime.getUTCMonth() + 1).toString().padStart(2, "0")
			const date = endTime.getUTCDate().toString().padStart(2, "0")
			const hour = endTime.getUTCHours().toString().padStart(2, "0")
			const minute = endTime.getUTCMinutes().toString().padStart(2, "0")
			const seconds = endTime.getUTCSeconds().toString().padStart(2, "0")
			// TODO: why this turns dim red for 4xx and 5xx responses?
			msg.push(`${a.dim}[${year}-${month}-${date} ${hour}:${minute}:${seconds}]${a.reset}`)
			const statusClor = {
				"1": a.yellow,
				"2": a.green,
				"3": a.blue,
				"4": a.red,
				"5": a.red,
			}[res.status.toString()[0]] ?? a.yellow
			msg.push(`${a.bold}${statusClor}${res.status}${a.reset}`)
			msg.push(req.method)
			msg.push(req.url.pathname)
			msg.push(`${a.dim}${endTime.getTime() - startTime.getTime()}ms${a.reset}`)
			const size = res.body ? getBodySize(res.body) : 0
			if (size) {
				msg.push(`${a.dim}${fmtBytes(size)}${a.reset}`)
			}
			return msg.join(" ")
		}
		const startTime = new Date()
		onFinish(async () => {
			if (opts.stdout !== false) {
				console.log(genMsg({ color: true }))
			}
			if (opts.file) {
				fs.appendFile(opts.file, genMsg({ color: false }) + "\n", "utf8")
			}
			if (reqTable) {
				reqTable.insert({
					"method": req.method,
					"path": req.url.pathname,
					"params": req.url.search,
					"ip": req.getIP(),
				})
			}
		})
		onError((e) => {
			if (reqTable) {
				// TODO
			}
		})
		return next()
	}
}

export type ResponseOpts = {
	status?: number,
	headers?: Record<string, string>,
}

export function kvList(props: Record<string, string | boolean | number>) {
	return Object.entries(props)
		.filter(([k, v]) => v)
		.map(([k, v]) => v === true ? k : `${k}=${v}`)
		.join("; ")
}

export async function getReqData(req: Request) {
	const ty = req.headers.get("Content-Type")
	if (
		ty?.startsWith("application/x-www-form-urlencoded") ||
		ty?.startsWith("multipart/form-data")
	) {
		const formData = await req.formData()
		const json: any = {}
		formData.forEach((v, k) => json[k] = v)
		return json
	} else {
		return await req.json()
	}
}

export function formToJSON(form: FormData) {
	const json: any = {}
	form.forEach((v, k) => json[k] = v)
	return json
}

export function getFormText(form: FormData, key: string): string | null {
	const t = form.get(key)
	if (typeof t === "string") {
		return t
	}
	return null
}

export function getFormBlob(form: FormData, key: string): Blob | null {
	const b = form.get(key)
	if (b && b instanceof Blob && b.size > 0) {
		return b
	}
	return null
}

export async function getFormBlobData(form: FormData, key: string) {
	const b = getFormBlob(form, key)
	if (b) {
		return new Uint8Array(await b.arrayBuffer())
	}
}

export function getBasicAuth(req: Req): [string, string] | void {
	const auth = req.headers.get("Authorization")
	if (!auth) return
	const [ scheme, cred ] = auth.split(" ")
	if (scheme.toLowerCase() !== "basic") return
	if (!cred) return
	const [ user, pass ] = atob(cred).split(":")
	return [ user, pass ]
}

export function getBearerAuth(req: Req): string | void {
	const auth = req.headers.get("Authorization")
	if (!auth) return
	const [ scheme, cred ] = auth.split(" ")
	if (scheme.toLowerCase() !== "bearer") return
	return cred
}
