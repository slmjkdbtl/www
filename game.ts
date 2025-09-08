// helper functions for creating canvas & webgl based games and toys

import {
	Vec2,
} from "./math"

const DEF_WIDTH = 640
const DEF_HEIGHT = 480

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

export type Anchor =
	"topleft"
	| "top"
	| "topright"
	| "left"
	| "center"
	| "right"
	| "botleft"
	| "bot"
	| "botright"

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
	pixelDensity?: number,
	maxFPS?: number,
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

export class Registry<T> extends Map<number, T> {
	private lastID: number = 0
	push(v: T): number {
		const id = this.lastID
		this.set(id, v)
		this.lastID++
		return id
	}
	pushd(v: T): () => void {
		const id = this.push(v)
		return () => this.delete(id)
	}
}

export class Event<Arg = any> {
	private handlers: Registry<(arg: Arg) => void> = new Registry()
	add(action: (arg: Arg) => void): EventController {
		const cancel = this.handlers.pushd((arg: Arg) => {
			if (ev.paused) return
			action(arg)
		})
		const ev = new EventController(cancel)
		return ev
	}
	addOnce(action: (arg: Arg) => void): EventController {
		const ev = this.add((arg) => {
			ev.cancel()
			action(arg)
		})
		return ev
	}
	next(): Promise<Arg> {
		return new Promise((res) => this.addOnce(res))
	}
	trigger(arg: Arg) {
		this.handlers.forEach((action) => action(arg))
	}
	numListeners(): number {
		return this.handlers.size
	}
	clear() {
		this.handlers.clear()
	}
}

export class EventController {
	paused: boolean = false
	readonly cancel: () => void
	constructor(cancel: () => void) {
		this.cancel = cancel
	}
	static join(events: EventController[]): EventController {
		const ev = new EventController(() => events.forEach((e) => e.cancel()))
		Object.defineProperty(ev, "paused", {
			get: () => events[0].paused,
			set: (p: boolean) => events.forEach((e) => e.paused = p),
		})
		ev.paused = false
		return ev
	}
}

// TODO: only accept one argument?
export class EventHandler<EventMap extends Record<string, any>> {
	private handlers: Partial<{
		[Name in keyof EventMap]: Event<EventMap[Name]>
	}> = {}
	on<Name extends keyof EventMap>(
		name: Name,
		action: (arg: EventMap[Name]) => void,
	): EventController {
		if (!this.handlers[name]) {
			this.handlers[name] = new Event<EventMap[Name]>()
		}
		return this.handlers[name].add(action)
	}
	onOnce<Name extends keyof EventMap>(
		name: Name,
		action: (arg: EventMap[Name]) => void,
	): EventController {
		const ev = this.on(name, (arg) => {
			ev.cancel()
			action(arg)
		})
		return ev
	}
	next<Name extends keyof EventMap>(name: Name): Promise<unknown> {
		return new Promise((res) => {
			this.onOnce(name, (arg: EventMap[Name]) => res(arg))
		})
	}
	trigger<Name extends keyof EventMap>(name: Name, arg: EventMap[Name]) {
		if (this.handlers[name]) {
			this.handlers[name].trigger(arg)
		}
	}
	remove<Name extends keyof EventMap>(name: Name) {
		delete this.handlers[name]
	}
	clear() {
		this.handlers = {}
	}
	numListeners<Name extends keyof EventMap>(name: Name): number {
		return this.handlers[name]?.numListeners() ?? 0
	}
}

export function deepEq(o1: any, o2: any): boolean {
	if (o1 === o2) {
		return true
	}
	const t1 = typeof o1
	const t2 = typeof o2
	if (t1 !== t2) {
		return false
	}
	if (t1 === "object" && t2 === "object" && o1 !== null && o2 !== null) {
		if (Array.isArray(o1) !== Array.isArray(o2)) {
			return false
		}
		const k1 = Object.keys(o1)
		const k2 = Object.keys(o2)
		if (k1.length !== k2.length) {
			return false
		}
		for (const k of k1) {
			const v1 = o1[k]
			const v2 = o2[k]
			if (!deepEq(v1, v2)) {
				return false
			}
		}
		return true
	}
	return false
}

export function createApp(opts: CreateAppOpts) {

	const canvas = opts.canvas ?? (() => {
		const canvasEl = document.createElement("canvas")
		document.body.append(canvasEl)
		canvasEl.width = opts.width || DEF_WIDTH
		canvasEl.height = opts.height || DEF_HEIGHT
		return canvasEl
	})()

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
		mergedGamepadState: new GamepadState(),
		gamepadStates: new Map<number, GamepadState>(),
		gamepads: [] as KGamePad[],
		charInputted: [],
		isMouseMoved: false,
		lastWidth: canvas.offsetWidth,
		lastHeight: canvas.offsetHeight,
		events: new EventHandler<{
			mouseMove: [],
			mouseDown: [MouseButton],
			mousePress: [MouseButton],
			mouseRelease: [MouseButton],
			charInput: [string],
			keyPress: [Key],
			keyDown: [Key],
			keyPressRepeat: [Key],
			keyRelease: [Key],
			touchStart: [Vec2, Touch],
			touchMove: [Vec2, Touch],
			touchEnd: [Vec2, Touch],
			gamepadButtonDown: [string],
			gamepadButtonPress: [string],
			gamepadButtonRelease: [string],
			gamepadStick: [string, Vec2],
			gamepadConnect: [KGamePad],
			gamepadDisconnect: [KGamePad],
			scroll: [Vec2],
			hide: [],
			show: [],
			resize: [],
			input: [],
		}>(),
	}

}
