// helper functions for creating canvas & webgl based games and toys

if (typeof window === "undefined") {
	throw new Error("app.ts only runs in browser")
}

import {
	Vec2,
	map,
} from "./math"

import {
	Event,
	EventController,
	overload2,
} from "./utils"

const DEF_WIDTH = 640
const DEF_HEIGHT = 480

const GAMEPAD_MAP: Record<string, object> = {
	"Joy-Con L+R (STANDARD GAMEPAD Vendor: 057e Product: 200e)": {
		"buttons": {
			"0": "south",
			"1": "east",
			"2": "west",
			"3": "north",
			"4": "lshoulder",
			"5": "rshoulder",
			"6": "ltrigger",
			"7": "rtrigger",
			"8": "select",
			"9": "start",
			"10": "lstick",
			"11": "rstick",
			"12": "dpad-up",
			"13": "dpad-down",
			"14": "dpad-left",
			"15": "dpad-right",
			"16": "home",
			"17": "capture"
		},
		"sticks": {
			"left": { "x": 0, "y": 1 },
			"right": { "x": 2, "y": 3 }
		}
	},
	"Joy-Con (L) (STANDARD GAMEPAD Vendor: 057e Product: 2006)": {
		"buttons": {
			"0": "south",
			"1": "east",
			"2": "west",
			"3": "north",
			"4": "lshoulder",
			"5": "rshoulder",
			"9": "select",
			"10": "lstick",
			"16": "start"
		},
		"sticks": {
			"left": { "x": 0, "y": 1 }
		}
	},
	"Joy-Con (R) (STANDARD GAMEPAD Vendor: 057e Product: 2007)": {
		"buttons": {
			"0": "south",
			"1": "east",
			"2": "west",
			"3": "north",
			"4": "lshoulder",
			"5": "rshoulder",
			"9": "start",
			"10": "lstick",
			"16": "select"
		},
		"sticks": {
			"left": { "x": 0, "y": 1 }
		}
	},
	"Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)": {
		"buttons": {
			"0": "south",
			"1": "east",
			"2": "west",
			"3": "north",
			"4": "lshoulder",
			"5": "rshoulder",
			"6": "ltrigger",
			"7": "rtrigger",
			"8": "select",
			"9": "start",
			"10": "lstick",
			"11": "rstick",
			"12": "dpad-up",
			"13": "dpad-down",
			"14": "dpad-left",
			"15": "dpad-right",
			"16": "home",
			"17": "capture"
		},
		"sticks": {
			"left": { "x": 0, "y": 1 },
			"right": { "x": 2, "y": 3 }
		}
	},
	"default": {
		"buttons": {
			"0": "south",
			"1": "east",
			"2": "west",
			"3": "north",
			"4": "lshoulder",
			"5": "rshoulder",
			"6": "ltrigger",
			"7": "rtrigger",
			"8": "select",
			"9": "start",
			"10": "lstick",
			"11": "rstick",
			"12": "dpad-up",
			"13": "dpad-down",
			"14": "dpad-left",
			"15": "dpad-right",
			"16": "home"
		},
		"sticks": {
			"left": { "x": 0, "y": 1 },
			"right": { "x": 2, "y": 3 }
		}
	}
}

export type Cursor =
	string
	| "auto"
	| "default"
	| "none"
	| "context-menu"
	| "help"
	| "pointer"
	| "progress"
	| "wait"
	| "cell"
	| "crosshair"
	| "text"
	| "vertical-text"
	| "alias"
	| "copy"
	| "move"
	| "no-drop"
	| "not-allowed"
	| "grab"
	| "grabbing"
	| "all-scroll"
	| "col-resize"
	| "row-resize"
	| "n-resize"
	| "e-resize"
	| "s-resize"
	| "w-resize"
	| "ne-resize"
	| "nw-resize"
	| "se-resize"
	| "sw-resize"
	| "ew-resize"
	| "ns-resize"
	| "nesw-resize"
	| "nwse-resize"
	| "zoom-int"
	| "zoom-out"

export type Key =
	| "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8" | "f9" | "f10" | "f11" | "f12"
	| "`" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "0" | "-" | "="
	| "q" | "w" | "e" | "r" | "t" | "y" | "u" | "i" | "o" | "p" | "[" | "]" | "\\"
	| "a" | "s" | "d" | "f" | "g" | "h" | "j" | "k" | "l" | ";" | "'"
	| "z" | "x" | "c" | "v" | "b" | "n" | "m" | "," | "." | "/"
	| "escape" | "backspace" | "enter" | "tab" | "control" | "alt" | "meta" | "space" | " "
	| "left" | "right" | "up" | "down" | "shift"

export type MouseButton =
	| "left"
	| "right"
	| "middle"
	| "back"
	| "forward"

export type GamepadButton =
	| "north"
	| "east"
	| "south"
	| "west"
	| "ltrigger"
	| "rtrigger"
	| "lshoulder"
	| "rshoulder"
	| "select"
	| "start"
	| "lstick"
	| "rstick"
	| "dpad-up"
	| "dpad-right"
	| "dpad-down"
	| "dpad-left"
	| "home"
	| "capture"

export type GamePad = {
	index: number;
	isPressed(b: GamepadButton): boolean,
	isDown(b: GamepadButton): boolean,
	isReleased(b: GamepadButton): boolean,
	getStick(stick: GamepadStick): Vec2,
}

export type GamepadStick = "left" | "right"

export type GamepadDef = {
	buttons: Record<string, GamepadButton>,
	sticks: Partial<Record<GamepadStick, { x: number, y: number }>>,
}

export type CreateAppOpts = {
	canvas?: HTMLCanvasElement,
	width?: number,
	height?: number,
	touchToMouse?: boolean,
	gamepads?: Record<string, GamepadDef>,
	maxFPS?: number,
	crisp?: boolean,
}

export class ButtonState<T = string> {
	pressed: Set<T> = new Set([])
	pressedRepeat: Set<T> = new Set([])
	released: Set<T> = new Set([])
	down: Set<T> = new Set([])
	update() {
		this.pressed.clear()
		this.released.clear()
		this.pressedRepeat.clear()
	}
	press(btn: T) {
		this.pressed.add(btn)
		this.pressedRepeat.add(btn)
		this.down.add(btn)
	}
	pressRepeat(btn: T) {
		this.pressedRepeat.add(btn)
	}
	release(btn: T) {
		this.down.delete(btn)
		this.pressed.delete(btn)
		this.released.add(btn)
	}
}

class GamepadState {
	buttonState: ButtonState<GamepadButton> = new ButtonState()
	stickState: Map<GamepadStick, Vec2> = new Map()
}

export class FPSCounter {
	#dts: number[] = []
	#timer: number = 0
	fps: number = 0
	tick(dt: number) {
		this.#dts.push(dt)
		this.#timer += dt
		if (this.#timer >= 1) {
			this.#timer = 0
			this.fps = Math.round(1 / (this.#dts.reduce((a, b) => a + b) / this.#dts.length))
			this.#dts = []
		}
	}
}

export function createApp(opts: CreateAppOpts = {}) {

	const canvas = opts.canvas ?? (() => {
		const canvasEl = document.createElement("canvas")
		document.body.append(canvasEl)
		canvasEl.width = opts.width || DEF_WIDTH
		canvasEl.height = opts.height || DEF_HEIGHT
		return canvasEl
	})()

	canvas.tabIndex = 0

	const styles = [
		"outline: none",
		"cursor: default",
	]

	if (opts.crisp) {
		// chrome only supports pixelated and firefox only supports crisp-edges
		styles.push("image-rendering: pixelated")
		styles.push("image-rendering: crisp-edges")
	}

	canvas.style.cssText = styles.join(";")

	const state = {
		canvas: canvas,
		loopID: null as null | number,
		stopped: false,
		dt: 0,
		time: 0,
		realTime: 0,
		fpsCounter: new FPSCounter(),
		timeScale: 1,
		skipTime: false,
		isHidden: false,
		numFrames: 0,
		mousePos: new Vec2(0),
		mouseDeltaPos: new Vec2(0),
		keyState: new ButtonState<Key>(),
		mouseState: new ButtonState<MouseButton>(),
		gamepadStates: new Map<number, GamepadState>(),
		gamepads: [] as GamePad[],
		charInputted: [] as string[],
		isMouseMoved: false,
		lastWidth: canvas.offsetWidth,
		lastHeight: canvas.offsetHeight,
		events: {
			mouseMove: new Event<void>(),
			mouseDown: new Event<MouseButton>(),
			mousePress: new Event<MouseButton>(),
			mouseRelease: new Event<MouseButton>(),
			charInput: new Event<string>(),
			keyPress: new Event<Key>(),
			keyDown: new Event<Key>(),
			keyPressRepeat: new Event<Key>(),
			keyRelease: new Event<Key>(),
			touchStart: new Event<[Vec2, Touch]>,
			touchMove: new Event<[Vec2, Touch]>,
			touchEnd: new Event<[Vec2, Touch]>,
			gamepadButtonDown: new Event<GamepadButton>(),
			gamepadButtonPress: new Event<GamepadButton>(),
			gamepadButtonRelease: new Event<GamepadButton>(),
			gamepadStick: new Event<[GamepadStick, Vec2]>(),
			gamepadConnect: new Event<GamePad>(),
			gamepadDisconnect: new Event<GamePad>(),
			scroll: new Event<Vec2>(),
			hide: new Event<void>(),
			show: new Event<void>(),
			resize: new Event<void>(),
			input: new Event<void>(),
		},
	}

	function dt() {
		return state.dt * state.timeScale
	}

	function focus() {
		canvas.focus()
	}

	function isHidden() {
		return state.isHidden
	}

	function time() {
		return state.time
	}

	function fps() {
		return state.fpsCounter.fps
	}

	function numFrames() {
		return state.numFrames
	}

	function screenshot(): string {
		return state.canvas.toDataURL()
	}

	function setCursor(c: Cursor): void {
		state.canvas.style.cursor = c
	}

	function getCursor(): Cursor {
		return state.canvas.style.cursor
	}

	async function setCursorLocked(b: boolean): Promise<void> {
		if (b) {
			return state.canvas.requestPointerLock()
		} else {
			return Promise.resolve(document.exitPointerLock())
		}
	}

	function isCursorLocked(): boolean {
		return !!document.pointerLockElement
	}

	function setFullscreen(f: boolean = true) {
		if (f) {
			state.canvas.requestFullscreen()
		} else {
			document.exitFullscreen()
		}
	}

	function isFullscreen(): boolean {
		return Boolean(document.fullscreenElement)
	}

	function quit() {
		state.stopped = true
		for (const name in canvasEvents) {
			// @ts-ignore
			state.canvas.removeEventListener(name, canvasEvents[name])
		}
		for (const name in docEvents) {
			// @ts-ignore
			document.removeEventListener(name, docEvents[name])
		}
		for (const name in winEvents) {
			// @ts-ignore
			window.removeEventListener(name, winEvents[name])
		}
		resizeObserver.disconnect()
	}

	function run(action: () => void) {

		if (state.loopID !== null) {
			cancelAnimationFrame(state.loopID)
		}

		let accumulatedDt = 0

		const frame = (t: number) => {

			if (state.stopped) return

			// TODO: allow background actions?
			if (document.visibilityState !== "visible") {
				state.loopID = requestAnimationFrame(frame)
				return
			}

			const loopTime = t / 1000
			const realDt = loopTime - state.realTime
			const desiredDt = opts.maxFPS ? 1 / opts.maxFPS : 0

			state.realTime = loopTime
			accumulatedDt += realDt

			if (accumulatedDt > desiredDt) {
				if (!state.skipTime) {
					state.dt = accumulatedDt
					state.time += dt()
					state.fpsCounter.tick(state.dt)
				}
				accumulatedDt = 0
				state.skipTime = false
				state.numFrames++
				processInput()
				action()
				resetInput()
			}

			state.loopID = requestAnimationFrame(frame)

		}

		frame(0)

	}

	function isTouchscreen() {
		return ("ontouchstart" in window) || navigator.maxTouchPoints > 0
	}

	function mousePos(): Vec2 {
		return state.mousePos.clone()
	}

	function mouseDeltaPos(): Vec2 {
		return state.mouseDeltaPos.clone()
	}

	function isMousePressed(m: MouseButton = "left"): boolean {
		return state.mouseState.pressed.has(m)
	}

	function isMouseDown(m: MouseButton = "left"): boolean {
		return state.mouseState.down.has(m)
	}

	function isMouseReleased(m: MouseButton = "left"): boolean {
		return state.mouseState.released.has(m)
	}

	function isMouseMoved(): boolean {
		return state.isMouseMoved
	}

	function isKeyPressed(k?: Key): boolean {
		return k === undefined
			? state.keyState.pressed.size > 0
			: state.keyState.pressed.has(k)
	}

	function isKeyPressedRepeat(k?: Key): boolean {
		return k === undefined
			? state.keyState.pressedRepeat.size > 0
			: state.keyState.pressedRepeat.has(k)
	}

	function isKeyDown(k?: Key): boolean {
		return k === undefined
			? state.keyState.down.size > 0
			: state.keyState.down.has(k)
	}

	function isKeyReleased(k?: Key): boolean {
		return k === undefined
			? state.keyState.released.size > 0
			: state.keyState.released.has(k)
	}

	function onResize(action: () => void): EventController {
		return state.events.resize.add(action)
	}

	// input callbacks
	const onKeyDown = overload2((action: (key: Key) => void) => {
		return state.events.keyDown.add(action)
	}, (key: Key, action: (key: Key) => void) => {
		return state.events.keyDown.add((k) => k === key && action(key))
	})

	const onKeyPress = overload2((action: (key: Key) => void) => {
		return state.events.keyPress.add(action)
	}, (key: Key, action: (key: Key) => void) => {
		return state.events.keyPress.add((k) => k === key && action(key))
	})

	const onKeyPressRepeat = overload2((action: (key: Key) => void) => {
		return state.events.keyPressRepeat.add(action)
	}, (key: Key, action: (key: Key) => void) => {
		return state.events.keyPressRepeat.add((k) => k === key && action(key))
	})

	const onKeyRelease = overload2((action: (key: Key) => void) => {
		return state.events.keyRelease.add(action)
	}, (key: Key, action: (key: Key) => void) => {
		return state.events.keyRelease.add((k) => k === key && action(key))
	})

	const onMouseDown = overload2((action: (m: MouseButton) => void) => {
		return state.events.mouseDown.add((m) => action(m))
	}, (mouse: MouseButton, action: (m: MouseButton) => void) => {
		return state.events.mouseDown.add((m) => m === mouse && action(m))
	})

	const onMousePress = overload2((action: (m: MouseButton) => void) => {
		return state.events.mousePress.add((m) => action(m))
	}, (mouse: MouseButton, action: (m: MouseButton) => void) => {
		return state.events.mousePress.add((m) => m === mouse && action(m))
	})

	const onMouseRelease = overload2((action: (m: MouseButton) => void) => {
		return state.events.mouseRelease.add((m) => action(m))
	}, (mouse: MouseButton, action: (m: MouseButton) => void) => {
		return state.events.mouseRelease.add((m) => m === mouse && action(m))
	})

	function onMouseMove(f: (pos: Vec2, dpos: Vec2) => void): EventController {
		return state.events.mouseMove.add(() => f(mousePos(), mouseDeltaPos()))
	}

	function onCharInput(action: (ch: string) => void): EventController {
		return state.events.charInput.add(action)
	}

	function onTouchStart(f: ([pos, t]: [Vec2, Touch]) => void): EventController {
		return state.events.touchStart.add(f)
	}

	function onTouchMove(f: ([pos, t]: [Vec2, Touch]) => void): EventController {
		return state.events.touchMove.add(f)
	}

	function onTouchEnd(f: ([pos, t]: [Vec2, Touch]) => void): EventController {
		return state.events.touchEnd.add(f)
	}

	function onScroll(action: (delta: Vec2) => void): EventController {
		return state.events.scroll.add(action)
	}

	function onHide(action: () => void): EventController {
		return state.events.hide.add(action)
	}

	function onShow(action: () => void): EventController {
		return state.events.show.add(action)
	}

	function charInputted(): string[] {
		return [...state.charInputted]
	}

	function getGamepads(): GamePad[] {
		return [...state.gamepads]
	}

	function processInput() {
		state.events.input.trigger()
		state.keyState.down.forEach((k) => state.events.keyDown.trigger(k))
		state.mouseState.down.forEach((k) => state.events.mouseDown.trigger(k))
	}

	function resetInput() {
		state.keyState.update()
		state.mouseState.update()
		state.charInputted = []
		state.isMouseMoved = false

		state.gamepadStates.forEach((s) => {
			s.buttonState.update()
			s.stickState.forEach((v, k) => {
				s.stickState.set(k, new Vec2(0))
			})
		})
	}

	function registerGamepad(browserGamepad: Gamepad) {

		const gamepad = {
			index: browserGamepad.index,
			isPressed: (btn: GamepadButton) => {
				return state.gamepadStates.get(browserGamepad.index)?.buttonState.pressed.has(btn) ?? false
			},
			isDown: (btn: GamepadButton) => {
				return state.gamepadStates.get(browserGamepad.index)?.buttonState.down.has(btn) ?? false
			},
			isReleased: (btn: GamepadButton) => {
				return state.gamepadStates.get(browserGamepad.index)?.buttonState.released.has(btn) ?? false
			},
			getStick: (stick: GamepadStick) => {
				return state.gamepadStates.get(browserGamepad.index)?.stickState.get(stick) ?? new Vec2(0)
			},
		}

		state.gamepads.push(gamepad)

		state.gamepadStates.set(browserGamepad.index, {
			buttonState: new ButtonState(),
			stickState: new Map([
				["left", new Vec2(0)],
				["right", new Vec2(0)],
			]),
		})

		return gamepad

	}

	function removeGamepad(gamepad: Gamepad) {
		state.gamepads = state.gamepads.filter((g) => g.index !== gamepad.index)
		state.gamepadStates.delete(gamepad.index)
	}

	type EventList<M> = {
		[event in keyof M]?: (event: M[event]) => void
	}

	const canvasEvents: EventList<HTMLElementEventMap> = {}
	const docEvents: EventList<DocumentEventMap> = {}
	const winEvents: EventList<WindowEventMap> = {}

	canvasEvents.mousemove = (e) => {
		const mousePos = new Vec2(e.offsetX, e.offsetY)
		const mouseDeltaPos = new Vec2(e.movementX, e.movementY)
		if (isFullscreen()) {
			const cw = state.canvas.width
			const ch = state.canvas.height
			const ww = window.innerWidth
			const wh = window.innerHeight
			const rw = ww / wh
			const rc = cw / ch
			if (rw > rc) {
				const ratio = wh / ch
				const offset = (ww - (cw * ratio)) / 2
				mousePos.x = map(e.offsetX - offset, 0, cw * ratio, 0, cw)
				mousePos.y = map(e.offsetY, 0, ch * ratio, 0, ch)
			} else {
				const ratio = ww / cw
				const offset = (wh - (ch * ratio)) / 2
				mousePos.x = map(e.offsetX , 0, cw * ratio, 0, cw)
				mousePos.y = map(e.offsetY - offset, 0, ch * ratio, 0, ch)
			}
		}
		state.events.input.addOnce(() => {
			state.isMouseMoved = true
			state.mousePos = mousePos
			state.mouseDeltaPos = mouseDeltaPos
			state.events.mouseMove.trigger()
		})
	}

	const MOUSE_BUTTONS: MouseButton[] = [
		"left",
		"middle",
		"right",
		"back",
		"forward",
	]

	canvasEvents.mousedown = (e) => {
		state.events.input.addOnce(() => {
			const m = MOUSE_BUTTONS[e.button]
			if (!m) return
			state.mouseState.press(m)
			state.events.mousePress.trigger(m)
		})
	}

	canvasEvents.mouseup = (e) => {
		state.events.input.addOnce(() => {
			const m = MOUSE_BUTTONS[e.button]
			if (!m) return
			state.mouseState.release(m)
			state.events.mouseRelease.trigger(m)
		})
	}

	const PREVENT_DEFAULT_KEYS = new Set([
		" ",
		"ArrowLeft",
		"ArrowRight",
		"ArrowUp",
		"ArrowDown",
		"Tab",
	])

	// translate these key names to a simpler version
	const KEY_ALIAS: Record<string, Key> = {
		"ArrowLeft": "left",
		"ArrowRight": "right",
		"ArrowUp": "up",
		"ArrowDown": "down",
		" ": "space",
	}

	canvasEvents.keydown = (e) => {
		if (PREVENT_DEFAULT_KEYS.has(e.key)) {
			e.preventDefault()
		}
		state.events.input.addOnce(() => {
			const k = KEY_ALIAS[e.key] || e.key.toLowerCase()
			if (k.length === 1) {
				state.events.charInput.trigger(k)
				state.charInputted.push(k)
			} else if (k === "space") {
				state.events.charInput.trigger(" ")
				state.charInputted.push(" ")
			}
			if (e.repeat) {
				state.keyState.pressRepeat(k)
				state.events.keyPressRepeat.trigger(k)
			} else {
				state.keyState.press(k)
				state.events.keyPressRepeat.trigger(k)
				state.events.keyPress.trigger(k)
			}
		})
	}

	canvasEvents.keyup = (e) => {
		state.events.input.addOnce(() => {
			const k = KEY_ALIAS[e.key] || e.key.toLowerCase()
			state.keyState.release(k)
			state.events.keyRelease.trigger(k)
		})
	}

	// TODO: handle all touches at once instead of sequentially
	canvasEvents.touchstart = (e) => {
		// disable long tap context menu
		e.preventDefault()
		state.events.input.addOnce(() => {
			const touches = Array.from(e.changedTouches)
			const box = state.canvas.getBoundingClientRect()
			if (opts.touchToMouse !== false) {
				state.mousePos = new Vec2(
					touches[0].clientX - box.x,
					touches[0].clientY - box.y,
				)
				state.mouseState.press("left")
				state.events.mousePress.trigger("left")
			}
			touches.forEach((t) => {
				state.events.touchStart.trigger(
					[new Vec2(t.clientX - box.x, t.clientY - box.y), t],
				)
			})
		})
	}

	canvasEvents.touchmove = (e) => {
		// disable scrolling
		e.preventDefault()
		state.events.input.addOnce(() => {
			const touches = Array.from(e.changedTouches)
			const box = state.canvas.getBoundingClientRect()
			if (opts.touchToMouse !== false) {
				const lastMousePos = state.mousePos
				state.mousePos = new Vec2(
					touches[0].clientX - box.x,
					touches[0].clientY - box.y,
				)
				state.mouseDeltaPos = state.mousePos.sub(lastMousePos)
				state.events.mouseMove.trigger()
			}
			touches.forEach((t) => {
				state.events.touchMove.trigger(
					[new Vec2(t.clientX - box.x, t.clientY - box.y), t],
				)
			})
		})
	}

	canvasEvents.touchend = (e) => {
		state.events.input.addOnce(() => {
			const touches = Array.from(e.changedTouches)
			const box = state.canvas.getBoundingClientRect()
			if (opts.touchToMouse !== false) {
				state.mousePos = new Vec2(
					touches[0].clientX - box.x,
					touches[0].clientY - box.y,
				)
				state.mouseDeltaPos = new Vec2(0,0)
				state.mouseState.release("left")
				state.events.mouseRelease.trigger("left")
			}
			touches.forEach((t) => {
				state.events.touchEnd.trigger(
					[new Vec2(t.clientX - box.x, t.clientY - box.y), t],
				)
			})
		})
	}

	canvasEvents.touchcancel = (e) => {
		state.events.input.addOnce(() => {
			const touches = Array.from(e.changedTouches)
			const box = state.canvas.getBoundingClientRect()
			if (opts.touchToMouse !== false) {
				state.mousePos = new Vec2(
					touches[0].clientX - box.x,
					touches[0].clientY - box.y,
				)
				state.mouseState.release("left")
				state.events.mouseRelease.trigger("left")
			}
			touches.forEach((t) => {
				state.events.touchEnd.trigger(
					[new Vec2(t.clientX - box.x, t.clientY - box.y), t],
				)
			})
		})
	}

	// TODO: option to not prevent default?
	canvasEvents.wheel = (e) => {
		e.preventDefault()
		state.events.input.addOnce(() => {
			state.events.scroll.trigger(new Vec2(e.deltaX, e.deltaY))
		})
	}

	canvasEvents.contextmenu = (e) => e.preventDefault()

	docEvents.visibilitychange = () => {
		if (document.visibilityState === "visible") {
			// prevent a surge of dt when switch back after the tab being hidden for a while
			state.skipTime = true
			state.isHidden = false
			state.events.show.trigger()
		} else {
			state.isHidden = true
			state.events.hide.trigger()
		}
	}

	winEvents.gamepadconnected = (e) => {
		const kbGamepad = registerGamepad(e.gamepad)
		state.events.input.addOnce(() => {
			state.events.gamepadConnect.trigger(kbGamepad)
		})
	}

	winEvents.gamepaddisconnected = (e) => {
		const kbGamepad = getGamepads().filter((g) => g.index === e.gamepad.index)[0]
		removeGamepad(e.gamepad)
		state.events.input.addOnce(() => {
			state.events.gamepadDisconnect.trigger(kbGamepad)
		})
	}

	for (const name in canvasEvents) {
		// @ts-ignore
		state.canvas.addEventListener(name, canvasEvents[name])
	}

	for (const name in docEvents) {
		// @ts-ignore
		document.addEventListener(name, docEvents[name])
	}

	for (const name in winEvents) {
		// @ts-ignore
		window.addEventListener(name, winEvents[name])
	}

	const resizeObserver = new ResizeObserver((entries) => {
		for (const entry of entries) {
			if (entry.target !== state.canvas) continue
			if (
				state.lastWidth === state.canvas.offsetWidth
				&& state.lastHeight === state.canvas.offsetHeight
			) return
			state.lastWidth = state.canvas.offsetWidth
			state.lastHeight = state.canvas.offsetHeight
			state.events.input.addOnce(() => {
				state.events.resize.trigger()
			})
		}
	})

	resizeObserver.observe(state.canvas)

	return {
		dt,
		time,
		run,
		canvas: state.canvas,
		fps,
		numFrames,
		focus,
		quit,
		isHidden,
		setFullscreen,
		isFullscreen,
		setCursor,
		screenshot,
		getGamepads,
		getCursor,
		setCursorLocked,
		isCursorLocked,
		isTouchscreen,
		mousePos,
		mouseDeltaPos,
		isKeyDown,
		isKeyPressed,
		isKeyPressedRepeat,
		isKeyReleased,
		isMouseDown,
		isMousePressed,
		isMouseReleased,
		isMouseMoved,
		charInputted,
		onResize,
		onKeyDown,
		onKeyPress,
		onKeyPressRepeat,
		onKeyRelease,
		onMouseDown,
		onMousePress,
		onMouseRelease,
		onMouseMove,
		onCharInput,
		onTouchStart,
		onTouchMove,
		onTouchEnd,
		onScroll,
		onHide,
		onShow,
		events: state.events,
	}

}
