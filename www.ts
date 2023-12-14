// helpers for the world wide web with Bun
// TODO: interactive console

import * as fs from "fs"
import * as path from "path"
import type { ServeOptions, SocketAddress } from "bun"
import * as sqlite from "bun:sqlite"
import type { Statement } from "bun:sqlite"

export const isDev = Boolean(Bun.env["DEV"])

export type Handler = (req: Request) => Response | Promise<Response> | void
export type MatchHandler = (req: Request, match?: Record<string, string>) => Response | Promise<Response> | void
export type ErrorHandler = (req: Request, err: Error) => Response | Promise<Response>
export type NotFoundHandler = (req: Request) => Response | Promise<Response>

export type Server = {
	// TODO: return an event controller
	handle: (handler: Handler) => void,
	error: (handler: ErrorHandler) => void,
	notFound: (action: NotFoundHandler) => void,
	match: (pat: string, handler: MatchHandler) => void,
	get: (pat: string, handler: MatchHandler) => void,
	post: (pat: string, handler: MatchHandler) => void,
	put: (pat: string, handler: MatchHandler) => void,
	delete: (pat: string, handler: MatchHandler) => void,
	patch: (pat: string, handler: MatchHandler) => void,
	files: (route: string, root: string) => void,
	dir: (route: string, root: string) => void,
}

// TODO: pass res object instead of returning?
export function createServer(opts: Omit<ServeOptions, "fetch"> = {}): Server {

	const server = Bun.serve({
		...opts,
		fetch: fetch,
	})

	async function fetch(req: Request) {
		// TODO: better async?
		for (const handle of handlers) {
			try {
				const res = handle(req)
				if (res instanceof Promise) {
					const awaitedRes = await res
					if (awaitedRes) return awaitedRes
				} else {
					if (res) return res
				}
			} catch (e) {
				return handleError(req, e as Error)
			}
		}
		return handleNotFound(req)
	}

	const handlers: Handler[] = []
	const handle = (handler: Handler) => handlers.push(handler)

	let handleError: ErrorHandler = (req, err) => {
		if (isDev) {
			throw err
		} else {
			const url = new URL(req.url)
			console.error(`Time: ${new Date()}`)
			console.error(`Request: ${req.method} ${url.pathname}`)
			console.error("")
			console.error(err)
			return new Response("Internal server error", { status: 500 })
		}
	}

	let handleNotFound: NotFoundHandler = (req) => new Response("404", { status: 404 })

	function handleMatch(req: Request, pat: string, handler: MatchHandler) {
		const url = new URL(req.url)
		const match = matchPath(pat, decodeURI(url.pathname))
		if (match) return handler(req, match)
	}

	function genMethodHandler(method: string) {
		return (pat: string, handler: Handler) => {
			handlers.push((req) => {
				if (req.method !== method) return
				return handleMatch(req, pat, handler)
			})
		}
	}

	return {
		handle: handle,
		error: (action: ErrorHandler) => handleError = action,
		notFound: (action: NotFoundHandler) => handleNotFound = action,
		match: (pat: string, handler: MatchHandler) => handle((req) => handleMatch(req, pat, handler)),
		get: genMethodHandler("GET"),
		post: genMethodHandler("POST"),
		put: genMethodHandler("PUT"),
		delete: genMethodHandler("DELETE"),
		patch: genMethodHandler("PATCH"),
		files: (route = "", root = "") => {
			handle((req) => {
				const url = new URL(req.url)
				route = trimSlashes(route)
				const pathname = trimSlashes(decodeURI(url.pathname))
				if (!pathname.startsWith(route)) return
				const baseDir = "./" + trimSlashes(root)
				const relativeURLPath = pathname.replace(new RegExp(`^${route}/?`), "")
				const p = path.join(baseDir, relativeURLPath)
				return res.file(p)
			})
		},
		dir: (route = "", root = "") => {
			handle((req) => {
				const url = new URL(req.url)
				route = trimSlashes(route)
				const pathname = trimSlashes(decodeURI(url.pathname))
				if (!pathname.startsWith(route)) return
				const baseDir = "./" + trimSlashes(root)
				const relativeURLPath = pathname.replace(new RegExp(`^${route}/?`), "")
				const p = path.join(baseDir, relativeURLPath)
				if (isFile(p)) {
					return res.file(p)
				} else if (isDir(p)) {
					const entries = fs.readdirSync(p)
						.filter((entry) => !entry.startsWith("."))
						.sort((a, b) => a > b ? -1 : 1)
						.sort((a, b) => path.extname(a) > path.extname(b) ? 1 : -1)
					const files = []
					const dirs = []
					for (const entry of entries) {
						const pp = path.join(p, entry)
						if (isDir(pp)) {
							dirs.push(entry)
						} else if (isFile(pp)) {
							files.push(entry)
						}
					}
					const isRoot = relativeURLPath === ""
					return res.html("<!DOCTYPE html>" + h("html", { lang: "en" }, [
						h("head", {}, [
							h("title", {}, decodeURI(url.pathname)),
							h("style", {}, css({
								"*": {
									"margin": "0",
									"padding": "0",
									"box-sizing": "border-box",
								},
								"body": {
									"padding": "16px",
									"font-size": "16px",
									"font-family": "Monospace",
								},
								"li": {
									"list-style": "none",
								},
								"a": {
									"color": "blue",
									"text-decoration": "none",
									":hover": {
										"background": "blue",
										"color": "white",
									},
								},
							})),
						]),
						h("body", {}, [
							h("ul", {}, [
								...(isRoot ? [] : [
									h("a", { href: `/${parentPath(pathname)}`, }, ".."),
								]),
								...dirs.map((dir) => h("li", {}, [
									h("a", { href: `/${pathname}/${dir}`, }, dir + "/"),
								])),
								...files.map((file) => h("li", {}, [
									h("a", { href: `/${pathname}/${file}`, }, file),
								])),
							]),
						]),
					]))
				}
			})
		},
	}
}

const trimSlashes = (str: string) => str.replace(/\/*$/, "").replace(/^\/*/, "")
const parentPath = (p: string, sep = "/") => p.split(sep).slice(0, -1).join(sep)

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

export type ColumnType =
	| "INTEGER"
	| "TEXT"
	| "BOOLEAN"
	| "REAL"
	| "BLOB"

export type ColumnDef = {
	type: ColumnType,
	primaryKey?: boolean,
	autoIncrement?: boolean,
	allowNull?: boolean,
	unique?: boolean,
	default?: string | number,
	index?: boolean,
	search?: boolean,
	reference?: {
		table: string,
		column: string,
	},
}

export type CreateDatabaseOpts = {
	init?: (db: Database) => void,
	wal?: boolean,
}

export type SQLVars = Record<string, string | number | boolean>
export type SQLData = Record<string, string | number | boolean>
export type WhereCondition = Record<string, string | { value: string, op: string }>
export type OrderCondition = {
	columns: string[],
	desc?: boolean,
}
export type LimitCondition = number

export type SelectOpts = {
	columns?: "*" | string[],
	distinct?: boolean,
	where?: WhereCondition,
	order?: OrderCondition,
	limit?: LimitCondition,
}

export type TableSchema = Record<string, ColumnDef>

export type Table<D> = {
	select: (opts?: SelectOpts) => D[],
	insert: (data: D) => void,
	update: (data: D, where: WhereCondition) => void,
	delete: (where: WhereCondition) => void,
	find: (where: WhereCondition) => D,
	findAll: (where: WhereCondition) => D[],
	count: (where?: WhereCondition) => number,
	search: (text: string) => D[],
	schema: TableSchema,
}

export type TableOpts = {
	timeCreated?: boolean,
	timeUpdated?: boolean,
}

export type Database = {
	table: <D extends Record<string, any>>(name: string, schema: TableSchema, opts?: TableOpts) => Table<D>,
	transaction: (action: () => void) => void,
	close: () => void,
    serialize: (name?: string) => Buffer,
}

// TODO: support views
// TODO: builtin cache system
export function createDatabase(dbname: string, opts: CreateDatabaseOpts = {}): Database {

	let uninitialized = !fs.existsSync(dbname)
	const bdb = new sqlite.Database(dbname)
	const queries: Record<string, Statement> = {}

	if (opts.wal) {
		bdb.run("PRAGMA journal_mode = WAL;")
	}

	function compile(sql: string) {
		sql = sql.trim()
		if (!queries[sql]) {
			queries[sql] = bdb.query(sql)
		}
		return queries[sql]
	}

	// TODO: support OR
	function genWhereSQL(where: WhereCondition, vars: SQLVars) {
		return `WHERE ${Object.entries(where).map(([k, v]) => {
			if (typeof v === "object") {
				vars[`$where_${k}`] = v.value
				return `${k} ${v.op} $where_${k}`
			} else {
				vars[`$where_${k}`] = v
				return `${k} = $where_${k}`
			}
		}).join(" AND ")}`
	}

	function genOrderSQL(order: OrderCondition) {
		return `ORDER BY ${order.columns.join(", ")}${order.desc ? " DESC" : ""}`
	}

	function genLimitSQL(limit: LimitCondition, vars: SQLVars) {
		vars["$limit"] = limit
		return `LIMIT $limit`
	}

	// TODO: support multiple values
	function genValuesSQL(data: SQLData, vars: SQLVars) {
		return `VALUES (${Object.entries(data).map(([k, v]) => {
			vars[`$value_${k}`] = v
			return `$value_${k}`
		}).join(", ")})`
	}

	function genSetSQL(data: SQLData, vars: SQLVars) {
		return `SET ${Object.entries(data).map(([k, v]) => {
			vars[`$set_${k}`] = v
			return `${k} = $set_${k}`
		}).join(", ")}`
	}

	function genColumnSQL(name: string, opts: ColumnDef) {
		let code = name + " " + opts.type
		if (opts.primaryKey) code += " PRIMARY KEY"
		if (opts.autoIncrement) code += " AUTOINCREMENT"
		if (!opts.allowNull) code += " NOT NULL"
		if (opts.unique) code += " UNIQUE"
		if (opts.default !== undefined) code += ` DEFAULT ${opts.default}`
		if (opts.reference) code += ` REFERENCES ${opts.reference.table}(${opts.reference.column})`
		return code
	}

	function genColumnsSQL(input: Record<string, ColumnDef>) {
		return Object.entries(input)
			.map(([name, opts]) => "    " + genColumnSQL(name, opts))
			.join(",\n")
	}

	function transaction(action: () => void) {
		return bdb.transaction(action)()
	}

	function run(sql: string) {
		bdb.run(sql.trim())
	}

	// TODO: auto migration?
	function table<D extends Record<string, any>>(
		tableName: string,
		schema: TableSchema,
		opts: TableOpts = {}
	): Table<D> {

		if (tableName.endsWith("_fts")) {
			throw new Error("Cannot manually operate a fts table")
		}

		const boolKeys: string[] = []

		for (const k in schema) {
			const t = schema[k].type
			if (t === "BOOLEAN") {
				boolKeys.push(k)
			}
		}

		const needsTransform = boolKeys.length > 0

		function transformItem(item: any): D {
			for (const k of boolKeys) {
				item[k] = Boolean(item[k])
			}
			return item
		}

		if (uninitialized) {

			run(`
CREATE TABLE ${tableName} (
${genColumnsSQL({
...schema,
...(opts.timeCreated ? {
	"time_created": { type: "TEXT", default: "CURRENT_TIMESTAMP" },
} : {}),
...(opts.timeUpdated ? {
	"time_updated": { type: "TEXT", default: "CURRENT_TIMESTAMP" },
} : {}),
})}
)
			`)
			const pks = []
			const searches = []
			for (const colName in schema) {
				const config = schema[colName]
				if (config.primaryKey) {
					pks.push(colName)
				}
				if (config.index) {
					run(`
CREATE INDEX idx_${tableName}_${colName} ON ${tableName}(${colName})
					`)
				}
				if (config.search) {
					searches.push(colName)
				}
			}
			if (opts.timeUpdated) {
				run(`
CREATE TRIGGER trigger_${tableName}_time_updated
AFTER UPDATE ON ${tableName}
BEGIN
	UPDATE ${tableName}
	SET time_updated = CURRENT_TIMESTAMP
	WHERE ${pks.map((pk) => `${pk} = NEW.${pk}`).join(" AND ")};
END
				`)
			}
			if (searches.length > 0) {
				// TODO: content / content_rowid?
				run(`
CREATE VIRTUAL TABLE ${tableName}_fts USING fts5 (${[...pks, ...searches].join(", ")})
			`)
			run(`
CREATE TRIGGER trigger_${tableName}_fts_insert
AFTER INSERT ON ${tableName}
BEGIN
	INSERT INTO ${tableName}_fts (${[...pks, ...searches].join(", ")})
	VALUES (${[...pks, ...searches].map((c) => `NEW.${c}`).join(", ")});
END
				`)
				run(`
CREATE TRIGGER trigger_${tableName}_fts_update
AFTER UPDATE ON ${tableName}
BEGIN
	UPDATE ${tableName}_fts
	SET ${searches.map((c) => `${c} = NEW.${c}`).join(", ")}
	WHERE ${pks.map((pk) => `${pk} = NEW.${pk}`).join(" AND ")};
END
				`)
				run(`
CREATE TRIGGER trigger_${tableName}_fts_delete
AFTER DELETE ON ${tableName}
BEGIN
	DELETE FROM ${tableName}_fts
	WHERE ${pks.map((pk) => `${pk} = OLD.${pk}`).join(" AND ")};
END
				`)
			}

		}

		// TODO: transform types?
		function select(opts: SelectOpts = {}) {
			const vars = {}
			return compile(`
SELECT${opts.distinct ? " DISTINCT" : ""} ${!opts.columns || opts.columns === "*" ? "*" : opts.columns.join(", ")}
FROM ${tableName}
${opts.where ? genWhereSQL(opts.where, vars) : ""}
${opts.order ? genOrderSQL(opts.order) : ""}
${opts.limit ? genLimitSQL(opts.limit, vars) : ""}
			`).all(vars) as D[] ?? []
		}

		function count(where?: WhereCondition) {
			const vars = {}
			const sql = `SELECT COUNT(*) FROM ${tableName} ${where ? genWhereSQL(where, vars) : ""}`
			// @ts-ignore
			return Number(compile(sql).all(vars)[0]["COUNT(*)"])
		}

		function findAll(where: WhereCondition) {
			return select({
				where: where,
			})
		}

		function find(where: WhereCondition) {
			return select({
				where: where,
				limit: 1,
			})[0]
		}

		// TODO: join
		function search(text: string) {
			const sql = `SELECT * FROM ${tableName}_fts WHERE ${tableName}_fts MATCH $query ORDER BY rank`
			return compile(sql).all({
				"$query": text,
			}) as D[] ?? []
		}

		function insert(data: D) {
			if (!data) {
				throw new Error("Cannot INSERT into database without table / data")
			}
			const vars = {}
			compile(`
INSERT INTO ${tableName} (${Object.keys(data).join(", ")})
${genValuesSQL(data, vars)}
			`).run(vars)
		}

		function update(data: D, where: WhereCondition) {
			const vars = {}
			const keys = Object.keys(data)
			compile(`
UPDATE ${tableName}
${genSetSQL(data, vars)}
${genWhereSQL(where, vars)}
			`).run(vars)
		}

		function remove(where: WhereCondition) {
			const vars = {}
			compile(`
DELETE FROM ${tableName}
${genWhereSQL(where, vars)}
			`).run(vars)
		}

		return {
			select,
			find,
			findAll,
			count,
			update,
			insert,
			search,
			delete: remove,
			schema,
		}

	}

	const db: Database = {
		table,
		transaction,
		close: bdb.close,
		serialize: bdb.serialize,
	}

	if (uninitialized) {
		if (opts.init) {
			opts.init(db)
		}
	}

	return db

}

function isFile(path: string) {
	try {
		return fs.statSync(path).isFile()
	} catch {
		return false
	}
}

function isDir(path: string) {
	try {
		return fs.statSync(path).isDirectory()
	} catch {
		return false
	}
}

export type ResponseOpts = {
	status?: number,
	headers?: Record<string, string>,
}

export const res = {
	text: (content: string, opts: ResponseOpts = {}) => new Response(content, {
		status: opts.status ?? 200,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			...(opts.headers ?? {}),
		},
	}),
	html: (content: string, opts: ResponseOpts = {}) => new Response(content, {
		status: opts.status ?? 200,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			...(opts.headers ?? {}),
		},
	}),
	json: (content: any, opts: ResponseOpts = {}) => new Response(content, {
		status: opts.status ?? 200,
		headers: {
			"Content-Type": "application/json",
			...(opts.headers ?? {}),
		},
	}),
	redirect: (location: string, opts: ResponseOpts = {}) => new Response(null, {
		status: opts.status ?? 303,
		headers: {
			"Location": location,
			...(opts.headers ?? {}),
		},
	}),
	file: (path: string, opts: ResponseOpts = {}) => {
		if (!isFile(path)) return
		const file = Bun.file(path)
		if (file.size === 0) return
		return new Response(file, {
			status: opts.status ?? 200,
			headers: {
				"Content-Type": file.type,
				...(opts.headers ?? {}),
			},
		})
	},
}

export function getCookies(req: Request) {
	const str = req.headers.get("Cookie")
	if (!str) return {}
	const cookies: Record<string, string> = {}
	for (const c of str.split(";")) {
		const [k, v] = c.split("=")
		cookies[k.trim()] = v.trim()
	}
	return cookies
}

export function kvList(props: Record<string, string | boolean>) {
	return Object.entries(props)
		.filter(([k, v]) => v)
		.map(([k, v]) => v === true ? k : `${k}=${v}`)
		.join("; ")
}

export async function getReqData(req: Request) {
	const ty = req.headers.get("Content-Type")
	if (
		ty?.startsWith("application/x-www-form-urlencoded")
		|| ty?.startsWith("multipart/form-data")
	) {
		const formData = await req.formData()
		const json: any = {}
		formData.forEach((v, k) => json[k] = v)
		return json
	} else {
		return await req.json()
	}
}

// html text builder
export function h(tagname: string, attrs: Record<string, any>, children?: string | string[]) {

	let html = `<${tagname}`

	for (const k in attrs) {
		let v = attrs[k]
		switch (typeof v) {
			case "boolean":
				if (v === true) {
					html += ` ${k}`
				}
				break
			case "string":
				html += ` ${k}="${escapeHTML(v)}"`
				break
			case "number":
				html += ` ${k}=${v}`
				break
			case "object":
				const value = Array.isArray(v) ? v.join(" ") : style(v)
				html += ` ${k}="${escapeHTML(value)}"`
				break
		}
	}

	html += ">"

	if (typeof(children) === "string" || typeof(children) === "number") {
		html += children
	} else if (Array.isArray(children)) {
		for (const child of children) {
			if (!child) continue
			if (Array.isArray(child)) {
				html += h("div", {}, child)
			} else {
				html += child
			}
		}
	}

	if (children !== undefined && children !== null) {
		html += `</${tagname}>`
	}

	return html

}

export function style(sheet: StyleSheet) {
	let style = ""
	for (const prop in sheet) {
		style += `${prop}: ${sheet[prop]};`
	}
	return style
}

export type StyleSheet = Record<string, string | number>

type StyleSheetRecursive = {
	[name: string]: string | number | StyleSheetRecursive,
}

// TODO: fix
// https://www.typescriptlang.org/docs/handbook/2/objects.html#index-signatures
export type CSS = {
	[name: string]: StyleSheetRecursive,
	// @ts-ignore
	"@keyframes"?: {
		[name: string]: Record<string, StyleSheet>,
	},
	// @ts-ignore
	"@font-face"?: StyleSheet[],
}

export type CSSOpts = {
	readable?: boolean,
}

// sass-like css preprocessor
export function css(list: CSS, opts: CSSOpts = {}) {

	const nl = opts.readable ? "\n" : ""
	const sp = opts.readable ? " " : ""
	let lv = 0
	const id = () => opts.readable ? " ".repeat(lv * 2) : ""

	function handleSheet(sheet: StyleSheet) {
		let code = "{" + nl
		lv++
		for (const prop in sheet) {
			code += id() + `${prop}:${sp}${sheet[prop]};${nl}`
		}
		lv--
		code += id() + "}" + nl
		return code
	}

	function handleSheetRecursive(sel: string, sheet: StyleSheetRecursive) {
		let code = id() + sel + sp + "{" + nl
		lv++
		let post = ""
		for (const key in sheet) {
			// media
			if (key === "@media") {
				const val = sheet[key] as Record<string, StyleSheet>
				for (const cond in val) {
					post += "@media " + cond + sp + "{" + nl
					post += id() + sel + sp + handleSheet(val[cond])
					post += "}" + nl
				}
			// pseudo class
			} else if (key[0] === ":") {
				lv--
				post += handleSheetRecursive(sel + key, sheet[key] as StyleSheetRecursive)
				lv++
			// self
			} else if (key[0] === "&") {
				lv--
				post += handleSheetRecursive(sel + key.substring(1), sheet[key] as StyleSheetRecursive)
				lv++
			// nesting child
			} else if (typeof sheet[key] === "object") {
				lv--
				post += handleSheetRecursive(sel + " " + key, sheet[key] as StyleSheetRecursive)
				lv++
			} else if (typeof sheet[key] === "string" || typeof sheet[key] === "number") {
				code += id() + `${key}:${sp}${sheet[key]};${nl}`
			}
		}
		lv--
		code += id() + "}" + nl + post
		return code
	}

	let code = ""

	// deal with @keyframes
	for (const sel in list) {
		if (sel === "@keyframes") {
			const sheet = list[sel] as CSS["@keyframes"] ?? {}
			for (const name in sheet) {
				const map = sheet[name]
				code += `@keyframes ${name} {` + nl
				lv++
				for (const time in map) {
					code += id() + time + " " + handleSheet(map[time])
				}
				lv--
				code += "}" + nl
			}
		} else if (sel === "@font-face") {
			const fonts = list[sel] as CSS["@font-face"] ?? []
			for (const font of fonts) {
				code += "@font-face " + handleSheet(font)
			}
		} else {
			code += handleSheetRecursive(sel, list[sel] as StyleSheetRecursive)
		}
	}

	return code

}

export function escapeHTML(unsafe: string) {
	return unsafe
		.replace(/&/g, "&amp")
		.replace(/</g, "&lt")
		.replace(/>/g, "&gt")
		.replace(/"/g, "&quot")
		.replace(/'/g, "&#039")
}

function mapKeys<D>(obj: Record<string, D>, mapFn: (k: string) => string) {
	return Object.keys(obj).reduce((result: Record<string, D>, key) => {
		result[mapFn(key)] = obj[key]
		return result
	}, {})
}

export type CSSLibOpts = {
	breakpoints?: Record<string, number>,
}

// TODO: a way to only generate used classes, record in h()?
// TODO: deal with pseudos like :hover
export function csslib(opt: CSSLibOpts = {}) {

	// tailwind-like css helpers
	const base: Record<string, Record<string, string | number>> = {
		".vstack": { "display": "flex", "flex-direction": "column" },
		".hstack": { "display": "flex", "flex-direction": "row" },
		".vstack-reverse": { "display": "flex", "flex-direction": "column-reverse" },
		".hstack-reverse": { "display": "flex", "flex-direction": "row-reverse" },
		".stretch-x": { "width": "100%" },
		".stretch-y": { "height": "100%" },
		".bold": { "font-weight": "bold" },
		".italic": { "font-style": "italic" },
		".underline": { "font-decoration": "underline" },
		".center": { "align-items": "center", "justify-content": "center" },
		".align-start": { "align-items": "flex-start" },
		".align-end": { "align-items": "flex-end" },
		".align-center": { "align-items": "center" },
		".align-stretch": { "align-items": "stretch" },
		".align-baseline": { "align-items": "baseline" },
		".justify-start": { "justify-content": "flex-start" },
		".justify-end": { "justify-content": "flex-end" },
		".justify-center": { "justify-content": "center" },
		".justify-between": { "justify-content": "space-between" },
		".justify-around": { "justify-content": "space-around" },
		".justify-evenly": { "justify-content": "space-evenly" },
		".align-self-start": { "align-items": "flex-start" },
		".align-self-end": { "align-self": "flex-end" },
		".align-self-center": { "align-self": "center" },
		".align-self-stretch": { "align-self": "stretch" },
		".align-self-baseline": { "align-self": "baseline" },
		".text-center": { "text-align": "center" },
		".text-left": { "text-align": "left" },
		".text-right": { "text-align": "right" },
		".wrap": { "flex-wrap": "wrap" },
		".wrap-reverse": { "flex-wrap": "wrap-reverse" },
		".nowrap": { "flex-wrap": "no-wrap" },
	}

	for (let i = 1; i <= 8; i++) {
		base[`.grow-${i}}`] = { "flex-grow": i }
		base[`.shrink-${i}}`] = { "flex-shrink": i }
		base[`.flex-${i}}`] = { "flex-grow": i, "flex-shrink": i }
	}

	const spaces = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128]

	for (const s of spaces) {
		base[`.g${s}`] = { "gap": `${s}px` }
		base[`.p${s}`] = { "padding": `${s}px` }
		base[`.px${s}`] = { "padding-left": `${s}px`, "padding-right": `${s}px` }
		base[`.py${s}`] = { "padding-top": `${s}px`, "padding-bottom": `${s}px` }
		base[`.m${s}`] = { "margin": `${s}px` }
		base[`.mx${s}`] = { "margin-left": `${s}px`, "margin-right": `${s}px` }
		base[`.my${s}`] = { "margin-top": `${s}px`, "margin-bottom": `${s}px` }
		base[`.f${s}`] = { "font-size": `${s}px` }
		base[`.r${s}`] = { "border-radius": `${s}px` }
	}

	const compileStyles = (sheet: Record<string, StyleSheet>) => {
		let css = ""
		for (const sel in sheet) {
			css += `${sel} { ${style(sheet[sel])} } `
		}
		return css
	}

	let css = compileStyles(base)
	const breakpoints = opt.breakpoints ?? {}

	for (const bp in breakpoints) {
		css += `@media (max-width: ${breakpoints[bp]}px) {`
		css += compileStyles(mapKeys(base, (sel) => `.${bp}:${sel.substring(1)}`))
		css += `}`
	}

	return css

}

// TODO: not global?
const buildCache: Record<string, string> = {}

export async function js(file: string) {
	if (!isDev) {
		if (buildCache[file]) {
			return Promise.resolve(buildCache[file])
		}
	}
	const res = await Bun.build({
		entrypoints: [file],
	})
	if (res.outputs.length !== 1) {
		throw new Error("Failed to build")
	}
	const code = await res.outputs[0].text()
	if (!isDev) {
		buildCache[file] = code
	}
	return code
}

export type CronTime = number | "*"

export function cron(
	min: CronTime,
	hour: CronTime,
	date: CronTime,
	month: CronTime,
	day: CronTime,
	action: () => void,
) {
	let paused = false
	const id = setInterval(() => {
		if (paused) return
		const time = new Date()
		if (month !== "*" && time.getMonth() + 1 !== month) return
		if (date !== "*" && time.getDate() !== date) return
		if (day !== "*" && time.getDay() !== day) return
		if (hour !== "*" && time.getHours() !== hour) return
		if (min !== "*" && time.getMinutes() !== min) return
		action()
	}, 1000 * 60)
	return {
		cancel: () => {
			clearInterval(id)
		},
		get paused() {
			return paused
		},
		set paused(p) {
			paused = p
		},
	}
}

function exec(cmd: string | string[], opts: Parameters<typeof Bun.spawn>[1] = {}) {
	return Bun.spawnSync(Array.isArray(cmd) ? cmd : cmd.split(" "), {
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		...opts,
	})
}

const cmds: Record<string, (...args: any[]) => void> = {
	dev: () => {
		exec("bun --watch main.ts", {
			env: { ...process.env, "DEV": "1" },
		})
	},
	deploy: (host: string, dir: string, service: string) => {
		host = host ?? Bun.env["DEPLOY_HOST"]
		dir = dir ?? Bun.env["DEPLOY_DIR"]
		service = service ?? Bun.env["DEPLOY_SERVICE"]
		if (!host || !dir) {
			console.error("Host and directory required for deployment!")
			console.log("")
			console.log(`
USAGE

    # Copy project to server and optionally restart systemd service
    $ deploy <host> <dir> <service>

    # Use $DEPLOY_HOST, $DEPLOY_DIR and $DEPLOY_SERVICE from env
    $ deploy
			`.trim())
			return
		}
		console.log(`copying project folder to ${host}:${dir}`)
		exec([
			"rsync",
			"-av", "--delete",
			"--exclude", ".DS_Store",
			"--exclude", ".git",
			"--exclude", "data",
			"--exclude", "node_modules",
			".", `${host}:${dir}`,
		])
		if (service) {
			console.log(`restarting service ${service}`)
			exec(`ssh -t ${host} sudo systemctl restart ${service}`)
		}
	},
}

const cmd = process.argv[2]

if (cmd) {
	if (cmds[cmd]) {
		cmds[cmd](...process.argv.slice(3))
	} else {
		console.error(`Command not found: ${cmd}`)
		console.log("")
		console.log(`
USAGE

    # Start dev server
    $ bun www.js dev

    # Copy project to server and optionally restart systemd service
    $ bun www.js deploy <host> <dir> <service>

    # Deploy using $DEPLOY_HOST, $DEPLOY_DIR and $DEPLOY_SERVICE from env
    $ bun www.js deploy
		`.trim())
	}
}
