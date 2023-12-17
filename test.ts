import {
	createServer,
	createDatabase,
	css,
	h,
	js,
	cron,
	dir,
	route,
} from "./www"

const server = createServer()
console.log(`Listening on http://${server.hostname}:${server.port}`)
const db = createDatabase("data/test.db")

type User = {
	// TODO: this should be ? when inserting, not ? when selecting
	id?: number,
	name: string,
	desc?: string,
	picture?: string,
	alive: boolean,
}

const usersTable = db.table<User>("user", {
	"id":       { type: "INTEGER", primaryKey: true, autoIncrement: true },
	"name":     { type: "TEXT", unique: true, index: true },
	"desc":     { type: "TEXT", allowNull: true },
	"picture":  { type: "BLOB", allowNull: true },
	"alive":    { type: "BOOLEAN" },
}, {
	timeCreated: true,
	timeUpdated: true,
	initData: [
		{
			name: "tga",
			desc: "oh hi",
			alive: true,
		},
	]
})

// TODO: why req.url.protocol isn't ws?
server.use(route("GET", "/ws", ({ req, res, upgrade, next }) => {
	if (!upgrade()) {
		res.sendText("failed to start web socket", { status: 500 })
	}
	next()
}))

server.ws.onMessage((ws, msg) => {
	const id = ws.data.id
	console.log(`${id}: ${msg}`)
	ws.send(`what do you mean ${msg}? client ${id}`)
	server.ws.broadcast(`${id} said: "${msg}"`)
})

server.ws.onOpen((ws) => {
	console.log(`client connect: ${ws.data.id}`)
})

server.ws.onClose((ws) => {
	console.log(`client close: ${ws.data.id}`)
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

// TODO: use table.js to update
server.use(route("GET", "/", ({ req, res }) => {
	const users = usersTable.select()
	return res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
		h("head", {}, [
			// @ts-ignore
			h("style", {}, css(styles)),
		]),
		h("body", {}, [
			h("table", {}, [
				h("tr", {}, [
					h("th", {}, "name"),
					h("th", {}, "desc"),
					h("th", {}, "picture"),
					h("th", {}, "alive"),
				]),
				...(users.map((user) => h("tr", {}, [
					h("td", {}, user.name),
					h("td", {}, user.desc ?? ""),
					h("td", {}, user.picture ?? ""),
					h("td", {}, user.alive ? "true" : "false"),
				]))),
			]),
		]),
	]))
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
			h("input", { id: "input" }),
			h("script", {}, `
const ws = new WebSocket("ws://localhost:3000/ws")
const input = document.querySelector("#input")
const messages = document.querySelector("#messages")

function addMsg(msg) {
	const el = document.createElement("p")
	el.textContent = msg
	messages.appendChild(el)
}

input.onkeydown = (e) => {
	if (e.key === "Enter") {
		ws.send(e.target.value)
		addMsg(e.target.value)
		e.target.value = ""
	}
}

ws.onopen = () => {
	console.log("ws opened")
}

ws.onmessage = (e) => {
	addMsg(e.data)
}
			`),
		]),
	]))
}))

server.use(dir("/dir", "."))

server.use(route("GET", "/err", () => {
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
