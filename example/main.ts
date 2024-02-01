import {
	createServer,
	createDatabase,
	css,
	h,
	js,
	jsData,
	dir,
	route,
	cron,
} from "./../www"

cron("* * * * *", () => {
	console.log(new Date())
})

const server = createServer({ port: 8000 })
console.log(`Listening on ${server.url.toString()}`)
const db = createDatabase("data/test.db")

type User = {
	id: string,
	name: string,
	desc?: string,
	picture?: string,
	alive: boolean,
}

const usersTable = db.table<User>("user", {
	"id":       { type: "TEXT", primaryKey: true },
	"name":     { type: "TEXT", unique: true, index: true },
	"desc":     { type: "TEXT", allowNull: true },
	"picture":  { type: "BLOB", allowNull: true },
	"alive":    { type: "BOOLEAN" },
}, {
	timeCreated: true,
	timeUpdated: true,
	initData: [
		{
			id: crypto.randomUUID(),
			name: "tga",
			desc: "oh hi",
			alive: true,
		},
	]
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
server.use(route("GET", "/", async ({ req, res }) => {
	const users = usersTable.select()
	console.log(users)
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
			h("script", {}, jsData("DATA", {
				name: "tga",
				age: 25,
				tool: "saxophone",
			})),
			h("script", {}, await js("client.ts")),
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
