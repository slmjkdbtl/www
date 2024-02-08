import {
	createDatabase,
} from "./../www"

export const db = createDatabase("data/data.db")

export type DBBlob = {
	id: string,
	data: Uint8Array,
	type: string,
}

export const blobTable = db.table<DBBlob>("blob", {
	"id":   { type: "TEXT", primaryKey: true },
	"data": { type: "BLOB" },
	"type": { type: "TEXT" },
}, {
	timeCreated: true,
	timeUpdated: true,
})

export type DBUser = {
	id: string,
	name: string,
	password: string,
	salt: string,
	desc?: string,
	img_id?: string,
}

export const userTable = db.table<DBUser>("user", {
	"id":       { type: "TEXT", primaryKey: true },
	"name":     { type: "TEXT", unique: true, index: true },
	"password": { type: "TEXT" },
	"salt":     { type: "TEXT" },
	"desc":     { type: "TEXT", allowNull: true },
	"img_id":   { type: "TEXT", allowNull: true, reference: { table: "img", column: "id" } },
}, {
	timeCreated: true,
	timeUpdated: true,
})

export type DBSession = {
	id: string,
	user_id: string,
}

export const sessionTable = db.table<DBSession>("session", {
	"id":       { type: "TEXT", primaryKey: true },
	"user_id":  { type: "TEXT", index: true, reference: { table: "user", column: "id" } },
}, {
	timeCreated: true,
	timeUpdated: true,
})

export type DBPost = {
	id: string,
	content: string,
	user_id: string,
}

export const postTable = db.table<DBPost>("post", {
	"id":       { type: "TEXT", primaryKey: true },
	"content":  { type: "TEXT" },
	"user_id":  { type: "TEXT", index: true, reference: { table: "user", column: "id" } },
}, {
	timeCreated: true,
	timeUpdated: true,
	paranoid: true,
})

export type DBPostImg = {
	post_id: string,
	img_id: string,
}

export const postImgTable = db.table<DBPostImg>("post_img", {
	"id":       { type: "INTEGER", primaryKey: true, autoIncrement: true },
	"post_id":  { type: "TEXT", index: true, reference: { table: "post", column: "id" } },
	"img_id":   { type: "TEXT", reference: { table: "img", column: "id" } },
}, {
	timeCreated: true,
	timeUpdated: true,
})

export type DBChat = {
	id: string,
	msg: string,
	from_user_id: string,
	to_user_id: string,
}

export const chatTable = db.table<DBChat>("chat", {
	"id":            { type: "TEXT", primaryKey: true },
	"msg":           { type: "TEXT" },
	"from_user_id":  { type: "TEXT", index: true, reference: { table: "user", column: "id" } },
	"to_user_id":    { type: "TEXT", index: true, reference: { table: "user", column: "id" } },
}, {
	timeCreated: true,
	timeUpdated: true,
})
