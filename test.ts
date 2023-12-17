import {
	createServer,
	createDatabase,
	css,
	h,
	js,
	cron,
} from "./www"

const server = createServer()

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

// TODO: use table.js to update
server.get("/", ({ res }) => {
	const users = usersTable.select()
	return res.sendHTML("<!DOCTYPE html>" + h("html", {}, [
		h("head", {}, [
			// @ts-ignore
			h("style", {}, css({
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
			})),
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
})
