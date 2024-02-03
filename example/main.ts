import {
	isDev,
	createServer,
	createDatabase,
	css,
	csslib,
	h,
	js,
	jsData,
	dir,
	route,
	getFormBlobData,
	cron,
	kvList,
	Req,
} from "./../www"

import * as crypto from "crypto"

const SALT_LENGTH = 16

cron("* * * * *", () => {
	console.log(new Date())
})

const server = createServer({ port: 8000 })
console.log(`Listening on ${server.url.toString()}`)
const db = createDatabase("data/data.db")

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

const userTable = db.table<User>("user", {
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

type DBSession = {
	id: string,
	user_id: string,
}

const sessionTable = db.table<DBSession>("session", {
	"id":       { type: "TEXT", primaryKey: true },
	"user_id":  { type: "TEXT", index: true, reference: { table: "user", column: "id" } },
}, {
	timeCreated: true,
	timeUpdated: true,
})

type DBPost = {
	id: string,
	content: string,
	user_id: string,
}

const postTable = db.table<DBPost>("post", {
	"id":       { type: "TEXT", primaryKey: true },
	"content":  { type: "TEXT" },
	"user_id":  { type: "TEXT", index: true, reference: { table: "user", column: "id" } },
}, {
	timeCreated: true,
	timeUpdated: true,
})

type DBChat = {
	id: string,
	msg: string,
	user_id: string,
}

const chatTable = db.table<DBChat>("chat", {
	"id":       { type: "TEXT", primaryKey: true },
	"msg":      { type: "TEXT" },
	"user_id":  { type: "TEXT", index: true, reference: { table: "user", column: "id" } },
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
	const user = getSession(req)?.user
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
	if (user) {
		return res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
			h("head", {}, [
				h("title", {}, "home"),
				// @ts-ignore
				h("style", {}, css(styles)),
				h("style", {}, csslib()),
			]),
			h("body", {}, [
				h("p", {}, `Hi! ${user.name}`),
				h("a", { href: "/logout" }, "log out"),
			]),
		]))
	} else {
		return res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
			h("head", {}, [
				h("title", {}, "login / signup"),
				// @ts-ignore
				h("style", {}, css(styles)),
				h("style", {}, csslib()),
			]),
			h("body", {}, [
				h("div", { class: "hstack g8" }, [
					form({
						endpoint: "/form/login",
						method: "POST",
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
				h("script", {}, jsData("DATA", {
					// TODO
				})),
				h("script", {}, await js("client.ts")),
			]),
		]))
	}
}))

const errorPage = (msg: string) => {
	return "<!DOCTYPE html>" + h("html", {}, [
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
	])
}

server.use(route("GET", "/users", async ({ req, res, next }) => {
	const users = userTable.select()
	return res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
		h("head", {}, [
			h("title", {}, "users"),
			// @ts-ignore
			h("style", {}, css(styles)),
			h("style", {}, csslib()),

		]),
		h("head", {}, [
			h("table", {}, [
				h("tr", {}, [
					h("th", {}, "picture"),
					h("th", {}, "name"),
					h("th", {}, "alive"),
					h("th", {}, "age"),
					h("th", {}, "power"),
				]),
				...(users.map((user) => h("tr", {}, [
					h("td", {}, [
						h("img", {
							src: `/pic/${user.id}`,
							style: {
								"width": "48px",
								"height": "48px",
							},
						}),
					]),
					h("td", {}, user.name),
					h("td", {}, user.alive ? "true" : "false"),
					h("td", {}, user.age + ""),
					h("td", {}, user.power + ""),
				]))),
			]),
		]),
	]))
}))

server.use(route("GET", "/pic/:id", async ({ req, res, next }) => {
	const id = req.params["id"]
	const user = userTable.find({
		"id": id,
	})
	if (!user) {
		return res.sendHTML(errorPage("not found"), { status: 404 })
	}
	return res.send(user.picture)
}))

function getSession(req: Req) {
	const cookies = req.getCookies()
	const id = cookies["session"]
	const session = sessionTable.find({ id: id })
	if (!session) return null
	const user = userTable.find({ id: session.user_id })
	if (!user) {
		sessionTable.delete({ id: id })
		return null
	}
	return {
		id: id,
		user: user,
	}
}

server.use(route("POST", "/form/signup", async ({ req, res, next }) => {
	const form = await req.formData()
	const required = [
		"name",
		"password",
		"power",
		"age",
	]
	for (const r of required) {
		if (!form.get(r)) {
			return res.sendHTML(errorPage(`missing required field "${r}"`), { status: 400 })
		}
	}
	const name = form.get("name") as string
	const user = userTable.find({
		"name": name,
	})
	if (user)
		return res.sendHTML(errorPage(`user "${name}" already exists`), { status: 400 })
	const power = Number(form.get("power"))
	if (isNaN(power))
		return res.sendHTML(errorPage(`invalid value for "power"`), { status: 400 })
	const age = Number(form.get("age"))
	if (isNaN(power))
		return res.sendHTML(errorPage(`invalid value for "age"`), { status: 400 })
	const pass = form.get("password") as string
	const salt = crypto.randomBytes(SALT_LENGTH).toString("hex")
	const hash = crypto.pbkdf2Sync(pass, salt, 1000, 64, "sha256").toString("hex")
	const alive = Boolean(form.get("alive"))
	const pic = await getFormBlobData(form, "picture")
	const id = crypto.randomUUID()
	userTable.insert({
		"id": id,
		"name": name,
		"salt": salt,
		"password": hash,
		"power": power,
		"age": age,
		"alive": alive,
		"picture": pic ?? undefined,
	})
	const sessionID = crypto.randomUUID()
	sessionTable.insert({
		"id": sessionID,
		"user_id": id,
	})
	return res.redirect("/", {
		headers: {
			// TODO: Expires
			"set-cookie": kvList({
				"session": sessionID,
				"HttpOnly": true,
				"Path": "/",
				"Secure": !isDev,
			}),
		}
	})
}))

server.use(route("GET", "/logout", async ({ req, res, next }) => {
	const session = getSession(req)
	if (session) {
		sessionTable.delete({ id: session.id })
	}
	res.redirect("/")
}))

server.use(route("POST", "/form/login", async ({ req, res, next }) => {
	const session = getSession(req)
	if (session)
		return res.sendHTML(errorPage("please log out first"), { status: 400 })
	const form = await req.formData()
	const name = form.get("name") as string
	if (!name)
		return res.sendHTML(errorPage(`missing "name"`), { status: 400 })
	const pass = form.get("password") as string
	if (!pass)
		return res.sendHTML(errorPage(`missing "pass"`), { status: 400 })
	const user = userTable.find({ name: name })
	if (!user)
		return res.sendHTML(errorPage(`user not found: "${name}"`), { status: 404 })
	const salt = user.salt
	const hash = crypto.pbkdf2Sync(pass, salt, 1000, 64, "sha256").toString("hex")
	if (hash !== user.password)
		return res.sendHTML(errorPage(`incorrect password`), { status: 400 })
	const sessionID = crypto.randomUUID()
	sessionTable.insert({
		"id": sessionID,
		"user_id": user.id,
	})
	return res.redirect("/", {
		headers: {
			// TODO: Expires
			"set-cookie": kvList({
				"session": sessionID,
				"HttpOnly": true,
				"Path": "/",
				"Secure": !isDev,
			}),
		}
	})
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
