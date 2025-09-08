import * as fs from "node:fs/promises"

export const isDev = Boolean(Bun.env["DEV"])

export const trydo = overload2(<T>(action: () => T, def: T) => {
	try {
		return action()
	} catch {
		return def
	}
}, <T>(action: () => T) => {
	return trydo(action, null)
})

export async function isFile(path: string) {
	try {
		const stat = await fs.stat(path)
		return stat.isFile()
	} catch {
		return false
	}
}

export async function isDir(path: string) {
	try {
		const stat = await fs.stat(path)
		return stat.isDirectory()
	} catch {
		return false
	}
}

type Func = (...args: any[]) => any

export function overload2<A extends Func, B extends Func>(fn1: A, fn2: B): A & B {
	return ((...args) => {
		const al = args.length
		if (al === fn1.length) return fn1(...args)
		if (al === fn2.length) return fn2(...args)
	}) as A & B
}

export function overload3<
	A extends Func,
	B extends Func,
	C extends Func,
>(fn1: A, fn2: B, fn3: C): A & B & C {
	return ((...args) => {
		const al = args.length
		if (al === fn1.length) return fn1(...args)
		if (al === fn2.length) return fn2(...args)
		if (al === fn3.length) return fn3(...args)
	}) as A & B & C
}

export function overload4<
	A extends Func,
	B extends Func,
	C extends Func,
	D extends Func,
>(fn1: A, fn2: B, fn3: C, fn4: D): A & B & C & D {
	return ((...args) => {
		const al = args.length
		if (al === fn1.length) return fn1(...args)
		if (al === fn2.length) return fn2(...args)
		if (al === fn3.length) return fn3(...args)
		if (al === fn4.length) return fn4(...args)
	}) as A & B & C & D
}

export function mapKeys<D>(obj: Record<string, D>, mapFn: (k: string) => string) {
	return Object.keys(obj).reduce((result: Record<string, D>, key) => {
		result[mapFn(key)] = obj[key]
		return result
	}, {})
}

export function mapValues<A, B>(obj: Record<string, A>, mapFn: (v: A) => B) {
	return Object.keys(obj).reduce((result: Record<string, B>, key) => {
		result[key] = mapFn(obj[key])
		return result
	}, {})
}

const alphaNumChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

export function randAlphaNum(len: number = 8) {
	let str = ""
	for (let i = 0; i < len; i++) {
		str += alphaNumChars.charAt(Math.floor(Math.random() * alphaNumChars.length))
	}
	return str
}

export const ansi = {
	reset:     "\x1b[0m",
	black:     "\x1b[30m",
	red:       "\x1b[31m",
	green:     "\x1b[32m",
	yellow:    "\x1b[33m",
	blue:      "\x1b[34m",
	magenta:   "\x1b[35m",
	cyan:      "\x1b[36m",
	white:     "\x1b[37m",
	blackbg:   "\x1b[40m",
	redbg:     "\x1b[41m",
	greenbg:   "\x1b[42m",
	yellowbg:  "\x1b[43m",
	bluebg:    "\x1b[44m",
	magentabg: "\x1b[45m",
	cyanbg:    "\x1b[46m",
	whitebg:   "\x1b[47m",
	bold:      "\x1b[1m",
	dim:       "\x1b[2m",
	italic:    "\x1b[3m",
	underline: "\x1b[4m",
	rgb: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
	rgbbg: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`,
}

// in bytes
export const KB = 1024
export const MB = KB * 1024
export const GB = MB * 1024
export const TB = GB * 1024

// in ms
export const SECOND = 1000
export const MINUTE = SECOND * 60
export const HOUR = MINUTE * 60
export const DAY = HOUR * 24
export const WEEK = DAY * 7
export const MONTH = DAY * 30
export const YEAR = DAY * 365

export type CronUnit = string
export type CronRule =
	| `${CronUnit} ${CronUnit} ${CronUnit} ${CronUnit} ${CronUnit}`
	| "yearly"
	| "monthly"
	| "weekly"
	| "daily"
	| "hourly"
	| "minutely"

const isReal = (n: any) => n !== undefined && n !== null && !isNaN(n)

// TODO: support intervals
export function cron(rule: CronRule, action: () => void) {
	if (rule === "yearly") return cron("0 0 1 1 *", action)
	if (rule === "monthly") return cron("0 0 1 * *", action)
	if (rule === "weekly") return cron("0 0 * * 0", action)
	if (rule === "daily") return cron("0 0 * * *", action)
	if (rule === "hourly") return cron("0 * * * *", action)
	if (rule === "minutely") return cron("* * * * *", action)
	let paused = false
	const [min, hour, date, month, day] = rule
		.split(" ")
		.map((def) => def === "*" ? "*" : new Set(def.split(",").map(Number).filter(isReal)))
	function run() {
		if (paused) return
		const now = new Date()
		if (month !== "*" && !month.has(now.getUTCMonth() + 1)) return
		if (date !== "*" && !date.has(now.getUTCDate())) return
		if (day !== "*" && !day.has(now.getUTCDay())) return
		if (hour !== "*" && !hour.has(now.getUTCHours())) return
		if (min !== "*" && !min.has(now.getUTCMinutes())) return
		action()
	}
	const timeout = setInterval(run, 1000 * 60)
	run()
	return {
		action: action,
		cancel: () => clearInterval(timeout),
		get paused() {
			return paused
		},
		set paused(p) {
			paused = p
		},
	}
}
