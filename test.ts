import {
	createServer,
	createDatabase,
	createAnalytics,
	res,
	css,
	h,
	js,
	cron,
} from "./www"

console.log(css({
	"a": {
		"color": "red",
		"font-size": "24px",
		"flex": 1,
		"@media": {
			"screen and (max-width: 960px)": {
				"width": "84%",
			},
			"screen and (max-width: 640px)": {
				"width": "100%",
			},
		},
		"> .img": {
			"width": "100%",
			":hover": {
				"opacity": "1",
			}
		},
	},
	"@font-face": [
		{
			"font-family": "apl386",
			"src": "url(/fonts/apl386.ttf)",
		},
	],
	"@keyframes": {
		"bounce": {
			"from": {
				"color": "#000000",
				"width": "100px",
			},
			"to": {
				"color": "#000000",
				"width": "200px",
			},
		},
	},
}, { readable: true }))

const server = createServer()
const ana = createAnalytics(server)

server.get("/", () => {
	return res.html(`<code>${ana.numRequests()}</code>`)
})
