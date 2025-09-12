import {
	Sprite,
	createGame,
	loadAssets,
} from "./../../game"

import {
	Vec2,
	Color,
	vec2,
	rgb,
	hsl,
	map,
	wave,
	deg2rad,
	easings,
} from "./../../math"

const WIDTH = 480
const HEIGHT = 480
const SCALE = 1
const ANIM_FPS = 8

const g = createGame({
	width: WIDTH,
	height: HEIGHT,
	// crisp: true,
	// pixelDensity: 1,
	background: [255, 255, 255],
})

g.setCursor("none")
g.focus()

function seq(name: string, num: number) {
	const files = []
	for (let i = 1; i <= num; i++) {
		files.push(name.replace("?", i + ""))
	}
	return files
}

function framen(n: number) {
	return Math.floor(g.time() * ANIM_FPS % n)
}

const assets = loadAssets({
	sprites: {
		lilfang: g.loadSpritesAnim(seq("/static/lilfang_head-?.png", 3)),
		eye: g.loadSpritesAnim(seq("/static/lilfang_eye-?.png", 3)),
		moon: g.loadSpritesAnim(seq("/static/moon-?.png", 3)),
		btfly: g.loadSpritesAnim(seq("/static/btfly-?.png", 2)),
		bg: g.loadSpritesAnim(seq("/static/bg-?.jpg", 7)),
	},
})

const shader = g.createShader(null, `
uniform float u_time;

vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
	vec4 tc = texture2D(tex, uv);
	return vec4(tc.r + color.r, tc.g + color.g, tc.b + color.b, tc.a);
}
`)

function drawLilFang(opts: {
	lookat: Vec2,
	pos: Vec2,
	angle?: number,
	color?: Color,
}) {

	// TODO: eye pos when rotating
	const leftEyeCenter = vec2(-13, -1)
	const rightEyeCenter = vec2(13, -2)
	const eyeDist = 2
	const d1 = opts.lookat.sub(opts.pos.add(leftEyeCenter)).unit().scale(eyeDist)
	const d2 = opts.lookat.sub(opts.pos.add(rightEyeCenter)).unit().scale(eyeDist)

	g.pushTransform()
	g.pushTranslate(opts.pos)
	g.pushRotate(opts.angle ?? 0)
	g.pushScale(vec2(1.5))
	g.drawSprite({
		sprite: assets.sprites["lilfang"],
		frame: framen(3),
		anchor: "center",
		shader: shader,
		color: opts.color ?? rgb(0, 0, 0),
		uniform: {
			"u_time": g.time(),
		}
	})

	g.pushTransform()
	g.pushTranslate(leftEyeCenter.add(d1))
	g.drawSprite({
		sprite: assets.sprites["eye"],
		frame: framen(3),
		anchor: "center",
	})
	g.popTransform()

	g.pushTransform()
	g.pushTranslate(rightEyeCenter.add(d2))
	g.drawSprite({
		sprite: assets.sprites["eye"],
		frame: framen(3),
		anchor: "center",
	})
	g.popTransform()

	g.popTransform()

}

let pos = vec2(320, 260)
let dir = Vec2.fromAngle(45)
let speed = 100
let crazy = false
let angle = 0
let curColor = 0

const colors = [
	rgb(0, 0, 0),
	// hsl(0.74, 0.5, 0.1),
	// hsl(0.41, 0.5, 0.1),
	// hsl(0.63, 0.5, 0.1),
	// hsl(0.03, 0.5, 0.1),
	// hsl(0.52, 0.5, 0.1),
]

let btflyPos = vec2(0)
let btflyAngle = 0
const MAX_MPOS_HIST = 32
const mposHist: Vec2[] = []

g.run(() => {

	if (!assets.loaded) {
		// TODO
		return
	}

	g.onKeyPress("space", () => {
		g.tween(0, 360, 0.4, (v) => angle = v, easings.easeOutCubic)
	})

	const dt = g.dt()
	const mpos = g.mousePos()
	const lookat = mpos
	const w = assets.sprites["lilfang"].width
	const h = assets.sprites["lilfang"].height

	// TODO: cross fade
	g.drawSprite({
		sprite: assets.sprites["bg"], frame: Math.floor(g.time() * 0.3 % 7),
		width: g.width(),
		height: g.height(),
	})

	pos = pos.add(dir.scale(speed * dt * (crazy ? 2 : 1)))

	if (pos.x + w / 2 >= g.width() || pos.x <= w / 2) {
		dir.x *= -1
		curColor = (curColor + 1) % colors.length
	}

	if (pos.y + h / 2 >= g.height() || pos.y <= h / 2) {
		dir.y *= -1
		curColor = (curColor + 1) % colors.length
	}

	drawLilFang({
		lookat: mpos,
		pos: pos,
		angle: angle,
		color: colors[curColor],
		// color: pickerColor,
	})

	// for (let i = 0; i < mposHist.length - 2; i++) {
		// g.drawLine({
			// p1: mposHist[i],
			// p2: mposHist[i + 1],
			// width: 2,
			// opacity: map(i, 0, MAX_MPOS_HIST, 0, 0.5),
			// color: rgb(255, 255, 255),
		// })
	// }

	btflyPos = btflyPos.lerp(mpos, dt * 4)
	mposHist.push(btflyPos)
	mposHist.splice(0, mposHist.length - MAX_MPOS_HIST)

	if (mposHist.length >= 2) {
		const p1 = mposHist[mposHist.length - 1]
		const p2 = mposHist[mposHist.length - 2]
		btflyAngle = p1.angle(p2)
	}

	g.drawSprite({
		pos: btflyPos,
		angle: btflyAngle + 90,
		sprite: assets.sprites["btfly"], frame: framen(2),
		anchor: "center",
	})

})

let pickerColor = rgb(0, 0, 0)

const picker = document.createElement("input")
picker.type = "color"
document.body.append(picker)
picker.addEventListener("input", (v) => {
	pickerColor = Color.fromHex(picker.value)
})
