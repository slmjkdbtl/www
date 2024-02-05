const ws = new WebSocket(`ws://${location.hostname}:${location.port}/ws`)
const input = document.querySelector("#input")
const messages = document.querySelector("#messages")
const usernameEl = document.querySelector("#username")

ws.onmessage = (e) => {
	const msg = JSON.parse(e.data)
	if (msg.type === "MESSAGE") {
		// TODO
	}
}

