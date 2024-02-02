import {
	createServer,
	createDatabase,
	css,
	csslib,
	h,
	js,
	jsData,
	dir,
	route,
	cron,
} from "./../www"

import * as crypto from "crypto"

const SALT_LENGTH = 16

cron("* * * * *", () => {
	console.log(new Date())
})

const server = createServer({ port: 8000 })
console.log(`Listening on ${server.url.toString()}`)
const db = createDatabase("data/test.db")

type User = {
	id: string,
	name: string,
	password: string,
	salt: string,
	alive: boolean,
	power: number,
	age: number,
	picture?: Uint8Array,
}

const usersTable = db.table<User>("user", {
	"id":       { type: "TEXT", primaryKey: true },
	"name":     { type: "TEXT", unique: true, index: true },
	"password": { type: "TEXT" },
	"salt":     { type: "TEXT" },
	"picture":  { type: "BLOB", allowNull: true },
	"alive":    { type: "BOOLEAN" },
	"age":      { type: "INTEGER" },
	"power":    { type: "REAL" },
}, {
	timeCreated: true,
	timeUpdated: true,
})

const styles = {
	"*": {
		"box-sizing": "border-box",
	},
	"html": {
		"font-family": "Monospace",
		"font-size": "16px",
	},
	"@keyframes": {
		"bounce": {
			"from": {
				"opacity": "1",
			},
			"to": {
				"opacity": "0",
			},
		},
	},
	"@font-face": [
		{
			"font-family": "apl386",
		},
	],
}

type FormField = {
	name: string,
	[k: string]: any,
}
type FormOpts = {
	action: string,
	endpoint: string,
	method: string,
	fields: FormField[],
}

server.use(route("GET", "/", async ({ req, res }) => {
	const users = usersTable.select()
	console.log(users)
	const field = (name: string, input: Record<string, any> = {}) => {
		return h("label", { class: "hstack g4" }, [
			name,
			h("input", { ...input, name: name }),
		])
	}
	const form = (opts: FormOpts) => {
		return h("form", {
			class: "vstack g4",
			enctype: "multipart/form-data",
			action: opts.endpoint,
			method: opts.method,
		}, [
			...(opts.fields ?? []).map((f) => field(f.name, f)),
			h("input", { type: "submit", value: opts.action }),
		])
	}
	return res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
		h("head", {}, [
			// @ts-ignore
			h("style", {}, css(styles)),
			h("style", {}, csslib()),
		]),
		h("body", {}, [
			h("div", { class: "hstack g8" }, [
				form({
					endpoint: "/form/login",
					method: "GET",
					action: "log in",
					fields: [
						{ name: "name", required: true, },
						{ name: "password", type: "password", required: "true" },
					],
				}),
				form({
					endpoint: "/form/signup",
					method: "POST",
					action: "sign up",
					fields: [
						{ name: "name", required: true, },
						{ name: "password", type: "password", required: true, },
						{ name: "picture", type: "file" },
						{ name: "alive", type: "checkbox", checked: true, },
						{ name: "power", type: "number", required: true, },
						{ name: "age", type: "number", min: 0, required: true, },
					],
				}),
			]),
			h("table", {}, [
				h("tr", {}, [
					h("th", {}, "name"),
					h("th", {}, "alive"),
					h("th", {}, "age"),
					h("th", {}, "power"),
				]),
				...(users.map((user) => h("tr", {}, [
					h("td", {}, user.name),
					h("td", {}, user.alive ? "true" : "false"),
					h("td", {}, user.age + ""),
					h("td", {}, user.power + ""),
				]))),
			]),
			h("script", {}, jsData("DATA", {
				name: "tga",
				age: 25,
				tool: "saxophone",
			})),
			h("script", {}, await js("client.ts")),
		]),
	]))
}))

async function getFormFileData(form: FormData, key: string) {
	const f = form.get(key)
	if (f instanceof Blob) {
		return new Uint8Array(await f.arrayBuffer())
	}
}

server.use(route("POST", "/form/signup", async ({ req, res, next }) => {
	const id = crypto.randomUUID()
	const form = await req.formData()
	const required = [
		"name",
		"password",
		"power",
		"age",
	]
	console.log(req.url.pathname, "received form data", form)
	const pic = await getFormFileData(form, "picture")
	const errorPage = (msg: string) => {
		return res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
			h("head", {}, [
				h("title", {}, "error"),
				// @ts-ignore
				h("style", {}, css(styles)),
				h("style", {}, csslib()),
			]),
			h("body", {}, [
				h("p", {}, msg),
				h("a", { href: "/" }, "back to home"),
			]),
		]), { status: 400 })
	}
	for (const r of required) {
		if (!form.get(r)) {
			return errorPage("bad input")
		}
	}
	const name = form.get("name") as string
	const user = usersTable.find({
		"name": name,
	})
	if (user) return errorPage(`user "${name}" already exists`)
	const pass = form.get("password") as string
	const salt = crypto.randomBytes(SALT_LENGTH).toString("hex")
	const hash = crypto.pbkdf2Sync(pass, salt, 1000, 64, "sha256").toString("hex")
	const power = Number(form.get("power"))
	if (isNaN(power)) return errorPage(`invalid value for "power"`)
	const age = Number(form.get("age"))
	if (isNaN(age)) return errorPage(`invalid value for "age"`)
	const alive = form.get("alive") === "on"
	usersTable.insert({
		"id": id,
		"name": name,
		"salt": salt,
		"password": hash,
		"power": power,
		"age": age,
		"alive": alive,
		"picture": pic ?? undefined,
	})
	res.redirect("/")
}))

server.use(route("GET", "/form/login", async ({ req, res, next }) => {
	const form = await req.formData()
	console.log(form)
	res.redirect("/")
}))

server.use(route("GET", "/chat", ({ res }) => {
	res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
		h("head", {}, [
			h("title", {}, "chat room"),
			// @ts-ignore
			h("style", {}, css(styles)),
		]),
		h("body", {}, [
			h("h1", {}, "chat room"),
			h("div", { id: "messages" }, []),
			h("p", { id: "username" }, ""),
			h("input", { id: "input" }),
			h("script", {}, `
const ws = new WebSocket("ws://${server.hostname}:${server.port}/ws")
const input = document.querySelector("#input")
const messages = document.querySelector("#messages")
const usernameEl = document.querySelector("#username")

function addMsg(data) {
	const el = document.createElement("p")
	el.textContent = "(" + data.user + ")" + " " + data.msg
	messages.appendChild(el)
}

input.onkeydown = (e) => {
	if (e.key === "Enter") {
		ws.send(JSON.stringify({
			msg: e.target.value,
		}))
		e.target.value = ""
	}
}

ws.onmessage = (e) => {
	const data = JSON.parse(e.data)
	if (data.type === "MESSAGE") {
		addMsg(data)
	} else if (data.type === "CONNECT") {
		usernameEl.textContent = "your id is " + data.id
	}
}
			`),
		]),
	]))
}))

// TODO: why req.url.protocol isn't ws?
server.use(route("GET", "/ws", ({ req, res, upgrade, next }) => {
	const success = upgrade()
	if (!success) {
		res.sendText("failed to start web socket", { status: 500 })
	}
}))

server.ws.onMessage((ws, msg) => {
	const data = JSON.parse(msg as string)
	server.ws.broadcast(JSON.stringify({
		type: "MESSAGE",
		user: ws.data.id,
		msg: data.msg,
	}))
})

server.ws.onOpen((ws) => {
	ws.send(JSON.stringify({
		type: "CONNECT",
		id: ws.data.id,
	}))
})

server.use(dir("/dir", "."))

server.use(route("GET", "/err", async () => {
	throw new Error("yep")
}))

server.error(({ res }, err) => {
	res.status = 500
	res.sendText(`oh no: ` + err)
})

server.notFound(({ res }) => {
	res.status = 404
	res.sendText("nothing here")
})
