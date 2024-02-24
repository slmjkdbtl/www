// a twitter clone

import {
	isDev,
	createServer,
	css,
	csslib,
	h,
	js,
	jsData,
	files,
	dir,
	route,
	getFormBlob,
	getFormText,
	cron,
	kvList,
	rateLimiter,
	logger,
	randAlphaNum,
	Req,
	createAnalytics,
} from "./../www"

import {
	db,
	userTable,
	postTable,
	blobTable,
	sessionTable,
	postImgTable,
	chatTable,
} from "./db"

import * as crypto from "crypto"

export const SALT_LENGTH = 16

cron("* * * * *", () => {
	console.log(new Date())
})

const server = createServer({ port: 8000 })
console.log(`Listening on ${server.url.toString()}`)

const analytics = createAnalytics("data/analytics.db")

const styles = {
	"*": {
		"box-sizing": "border-box",
		"margin": "0",
		"padding": "0",
	},
	"html": {
		"font-family": "Monospace",
		"font-size": "16px",
	},
	"body": {
		"padding": "16px",
	},
	"input": {
		"padding": "2px",
	},
	"textarea": {
		"padding": "2px",
	},
	"fieldset": {
		"padding": "8px",
		"border": "solid 1px #767676",
		"border-radius": "2px",
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

function page(head: string[], body: string[]) {
	return "<!DOCTYPE html>" + h("html", {}, [
		h("head", {}, [
			...head,
			// @ts-ignore
			h("style", {}, css(styles)),
			h("style", {}, csslib()),
		]),
		h("body", {}, [
			...body,
		]),
	])
}

function errPage(msg: string) {
	return page([
		h("title", {}, "error"),
	], [
		h("div", { class: "vstack g8" }, [
			h("p", {}, msg),
			h("a", { href: "/" }, "back to home"),
		]),
	])
}

function confirmPage(msg: string, yes: string, no: string) {
	return page([
		h("title", {}, "confirm"),
	], [
		h("div", { class: "vstack g8" }, [
			h("p", {}, msg),
			h("a", { href: no }, "no"),
			h("a", { href: yes }, "yes"),
		]),
	])
}

type FormField = {
	name: string,
	label?: false | string,
	[k: string]: any,
}

type FormFieldSet = {
	legend: string,
	fields: FormField[],
}

type FormOpts = {
	action: string,
	endpoint: string,
	method: "GET" | "POST",
	fields?: FormField[],
	fieldsets?: FormFieldSet[],
}

const form = (opts: FormOpts) => {
	const field = (f: FormField) => {
		const el = f.type === "textarea"
			? h("textarea", { ...f }, f.value ?? "")
			: h("input", { ...f })
		if (f.label === false) {
			return el
		} else {
			return h("label", { class: "hstack g4" }, [
				f.label ?? f.name,
				el,
			])
		}
	}
	const fieldset = (f: FormFieldSet) => {
		return h("fieldset", { class: "vstack g4" }, [
			h("legend", {}, f.legend),
			...f.fields.map(field),
		])
	}
	const fields = opts.fields ?? []
	return h("form", {
		class: "vstack g8",
		enctype: "multipart/form-data",
		action: opts.endpoint,
		method: opts.method,
	}, [
		fields.length > 0 ? h("div", { class: "vstack g4" }, fields.map(field)) : null,
		...((opts.fieldsets ?? []).map(fieldset)),
		h("input", { type: "submit", value: opts.action }),
	])
}

server.use(analytics.handler)

server.use(logger({
	file: "data/log.txt",
}))

server.use(rateLimiter({
	time: 1,
	limit: 100,
	handler: ({ req, res, next }) => {
		return res.send("too many requests")
	},
}))

server.use(route("GET", "/", async ({ req, res }) => {
	const user = getSession(req)?.user
	const posts = postTable.select<any>({
		columns: ["id", "content", "user_id", "time_created"],
		join: [
			{
				table: userTable,
				columns: [
					{ name: "name", as: "user_name" },
					{ name: "img_id", as: "user_img_id" },
				],
				on: { column: "id", matchTable: postTable, matchColumn: "user_id" },
			},
			{
				table: postImgTable,
				columns: [ "img_id" ],
				on: { column: "post_id", matchTable: postTable, matchColumn: "id" },
				join: "LEFT",
			},
		],
	}).sort((a, b) => {
		return (new Date(b["time_created"])).getTime() - (new Date(a["time_created"])).getTime()
	})
	const postsHTML = h("div", { class: "vstack g16" }, [
		...posts.map((p) => {
			return h("div", { class: "vstack g4" }, [
				h("div", { class: "hstack g4 align-center" }, [
					h("img", {
						src: `/blob/${p["user_img_id"]}`,
						style: {
							"width": "24px",
							"height": "24px",
						},
					}),
					h("p", {}, p["user_name"]),
				]),
				...(p["img_id"] ? [
					h("img", {
						src: `/blob/${p["img_id"]}`,
						style: {
							"width": "160px",
							"height": "160px",
						},
					}),
				] : []),
				h("p", {}, p["content"]),
				h("p", { style: { color: "#666" } }, p["time_created"]),
				...(p.user_id === user?.id ? [
					h("a", { href: `/delete-post/${p["id"]}` }, "delete"),
				] : []),
			])
		})
	])
	if (user) {
		return res.sendHTML(page([
			h("title", {}, "home"),
		], [
			h("div", { class: "vstack g16" }, [
				h("div", { class: "hstack g8", }, [
					h("span", {}, `Hi! ${user.name}`),
					h("a", { href: "/logout" }, "log out"),
				]),
				h("a", { href: "/settings" }, "settings"),
				form({
					endpoint: "/form/post",
					method: "POST",
					action: "post",
					fieldsets: [
						{
							legend: "post",
							fields: [
								{ name: "img", type: "file", accept: "image/png, image/gif, image/jpeg" },
								{ name: "content", type: "textarea", required: true, label: false },

							],
						},
					],
				}),
				postsHTML,
			]),
		]))
	} else {
		return res.sendHTML(page([
			h("title", {}, "home"),
		], [
			h("div", { class: "vstack g16" }, [
				h("div", { class: "hstack g16" }, [
					form({
						endpoint: "/form/login",
						method: "POST",
						action: "log in",
						fieldsets: [
							{
								legend: "log in",
								fields: [
									{ name: "name", required: true, },
									{ name: "password", type: "password", required: "true" },
								],
							}
						],
					}),
					form({
						endpoint: "/form/signup",
						method: "POST",
						action: "sign up",
						fieldsets: [
							{
								legend: "sign up",
								fields: [
									{ name: "name", required: true, },
									{ name: "password", type: "password", required: true, },
									{ name: "img", type: "file", accept: "image/png, image/gif, image/jpeg" },
									{ name: "desc", type: "textarea" },
								],
							}
						],
					}),
				]),
				postsHTML,
			]),
		]))
	}
}))

server.use(route("GET", "/delete-post/:id", async ({ req, res, next }) => {
	const session = getSession(req)
	if (!session)
		return res.sendHTML(errPage("please log in first"), { status: 401 })
	const postID = req.params["id"]
	const post = postTable.find({
		id: postID,
	})
	if (post.user_id !== session.user.id) {
		return res.sendHTML(errPage("cannot delete other user's post"), { status: 401 })
	}
	db.transaction(() => {
		const postImgs = postImgTable.findAll({
			"post_id": postID,
		})
		for (const { img_id } of postImgs) {
			blobTable.delete({
				"id": img_id,
			})
		}
		postTable.delete({
			"id": postID,
		})
		postImgTable.delete({
			"post_id": postID,
		})
	})
	return res.redirect("/")
}))

server.use(route("GET", "/blob/:id", async ({ req, res, next }) => {
	const id = req.params["id"]
	const img = blobTable.find({ "id": id })
	if (!img) return next()
	return res.send(new Blob([img.data], { type: img.type }))
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
	const name = getFormText(form, "name")
	if (!name)
		return res.sendHTML(errPage(`missing required field "name"`), { status: 400 })
	const password = getFormText(form, "password")
	if (!password)
		return res.sendHTML(errPage(`missing required field "password"`), { status: 400 })
	const user = userTable.find({
		"name": name,
	})
	if (user)
		return res.sendHTML(errPage(`user "${name}" already exists`), { status: 400 })
	const salt = crypto.randomBytes(SALT_LENGTH).toString("hex")
	const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha256").toString("hex")
	const desc = getFormText(form, "desc")
	const id = crypto.randomUUID()
	const img = await getFormBlob(form, "img")
	let imgID = undefined
	if (img) {
		imgID = crypto.randomUUID()
		blobTable.insert({
			"id": imgID,
			"data": new Uint8Array(await img.arrayBuffer()),
			"type": img.type,
		})
	}
	userTable.insert({
		"id": id,
		"name": name,
		"desc": desc,
		"salt": salt,
		"password": hash,
		"img_id": imgID,
	})
	const sessionID = crypto.randomUUID()
	sessionTable.insert({
		"id": sessionID,
		"user_id": id,
	})
	return res.redirect("/", {
		headers: {
			// TODO: Expires
			"Set-Cookie": kvList({
				"session": sessionID,
				"HttpOnly": true,
				"Path": "/",
				"Secure": true,
			}),
		}
	})
}))

server.use(route("POST", "/form/settings", async ({ req, res, next }) => {
	const session = getSession(req)
	if (!session)
		return res.sendHTML(errPage("please log in first"), { status: 401 })
	const user = session.user
	const form = await req.formData()
	const name = getFormText(form, "name")
	const where = { id: user.id }
	if (name) userTable.update({ name: name }, where)
	const desc = getFormText(form, "desc")
	if (desc) userTable.update({ desc: desc }, where)
	const img = await getFormBlob(form, "img")
	if (img) {
		const imgID = crypto.randomUUID()
		if (user.img_id) {
			blobTable.delete({
				"id": user.img_id,
			})
		}
		blobTable.insert({
			"id": imgID,
			"data": new Uint8Array(await img.arrayBuffer()),
			"type": img.type,
		})
		userTable.update({ img_id: imgID }, where)
	}
	const pass = await getFormText(form, "password")
	if (pass) {
		const hash = crypto.pbkdf2Sync(pass, user.salt, 1000, 64, "sha256").toString("hex")
		userTable.update({ password: hash }, where)
	}
	return res.redirect("/")
}))

server.use(route("GET", "/settings", async ({ req, res, next }) => {
	const session = getSession(req)
	if (!session)
		return res.sendHTML(errPage("please log in first"), { status: 401 })
	const user = session.user
	return res.sendHTML(page([
		h("title", {}, "settings"),
	], [
		form({
			action: "save",
			endpoint: "/form/settings",
			method: "POST",
			fields: [
				{ name: "name", value: user.name },
				{ name: "password", type: "password", },
				{ name: "img", type: "file" },
				{ name: "desc", type: "textarea", value: user.desc },
			],
		}),
	]))
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
		return res.sendHTML(errPage("please log out first"), { status: 400 })
	const form = await req.formData()
	const name = getFormText(form, "name")
	if (!name)
		return res.sendHTML(errPage(`missing "name"`), { status: 400 })
	const password = getFormText(form, "password")
	if (!password)
		return res.sendHTML(errPage(`missing "password"`), { status: 400 })
	const user = userTable.find({ name: name })
	if (!user)
		return res.sendHTML(errPage(`user not found: "${name}"`), { status: 404 })
	const salt = user.salt
	const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha256").toString("hex")
	if (hash !== user.password)
		return res.sendHTML(errPage(`incorrect password`), { status: 401 })
	const sessionID = crypto.randomUUID()
	sessionTable.insert({
		"id": sessionID,
		"user_id": user.id,
	})
	return res.redirect("/", {
		headers: {
			// TODO: Expires
			"Set-Cookie": kvList({
				"session": sessionID,
				"HttpOnly": true,
				"Path": "/",
				"Secure": true,
			}),
		}
	})
}))

server.use(route("POST", "/form/post", async ({ req, res, next }) => {
	const session = getSession(req)
	if (!session)
		return res.sendHTML(errPage("please log in first"), { status: 401 })
	const form = await req.formData()
	const content = getFormText(form, "content")
	if (!content)
		return res.sendHTML(errPage("content cannot be empty"), { status: 400 })
	const postID = crypto.randomUUID()
	postTable.insert({
		"id": postID,
		"user_id": session.user.id,
		"content": content,
	})
	const img = getFormBlob(form, "img")
	if (img) {
		const imgID = crypto.randomUUID()
		const data = new Uint8Array(await img.arrayBuffer())
		blobTable.insert({
			"id": imgID,
			"data": data,
			"type": img.type,
		})
		postImgTable.insert({
			"post_id": postID,
			"img_id": imgID,
		})
	}
	return res.redirect("/")
}))

// TODO: why req.url.protocol isn't ws?
server.use(route("GET", "/ws", ({ req, res, upgrade, next }) => {
	const success = upgrade()
	if (!success) {
		return res.sendText("failed to start web socket", { status: 500 })
	}
	next()
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

server.use(route("GET", "/err", () => {
	throw new Error("yep")
}))

server.error(({ res }, err) => {
	if (isDev) throw err
	res.status = 500
	console.error(err)
	res.sendText(`internal server error`)
})

server.notFound(({ res }) => {
	res.status = 404
	res.sendText("not found")
})

server.use(route("GET", "/test", async ({ req, res }) => {
	const form = await req.formData()
	return res.sendText("Success!")
}))
