import {
	createServer,
	createDatabase,
	res,
	css,
	h,
	js,
	cron,
} from "./www"

const server = createServer()

const db = createDatabase("data/test.db")

type User = {
	id?: number,
	name: string,
	desc: string | null,
	picture: string | null,
	alive: boolean,
}

const users = db.table<User>("user", {
	"id":       { type: "INTEGER", primaryKey: true, autoIncrement: true },
	"name":     { type: "TEXT", unique: true, index: true },
	"desc":     { type: "TEXT", allowNull: true },
	"picture":  { type: "BLOB", allowNull: true },
	"alive":    { type: "BOOLEAN" },
})

server.get("/", () => {
	return res.html("<!DOCTYPE html>" + h("html", {}, [
		h("head", {}, [
			h("style", {}, css({
				// TODO
			})),
		]),
		h("body", {}, [
			h("table", {}, [
				h("tr", {}, Object.keys(users.schema).map((k) =>
					h("th", {}, k),
				)),
			]),
		]),
	]))
})
