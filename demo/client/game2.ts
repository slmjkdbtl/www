import {
	Sprite,
	createGame,
	loadAssets,
} from "./../../game"

import {
	Vec2,
	vec2,
	rgb,
	hsl2rgb,
	wave,
	deg2rad,
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
	// background: [255, 255, 255],
})

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
		lilfang: g.loadSpritesAnim(seq("/static/lilfang_noeye-?.png", 3)),
		eye: g.loadSpritesAnim(seq("/static/lilfang_eye-?.png", 3)),
		moon: g.loadSpritesAnim(seq("/static/moon-?.png", 3)),
		bg: g.loadSpritesAnim(seq("/static/bg-?.jpg", 3)),
	},
})

function drawLilfang(opts: {
	lookat: Vec2,
	pos: Vec2,
	angle?: number,
}) {

	// TODO: eye pos when rotating
	const leftEyeCenter = vec2(-46, -9)
	const rightEyeCenter = vec2(-16, -10)
	const eyeDist = 1.5
	const d1 = opts.lookat.sub(opts.pos.add(leftEyeCenter)).unit().scale(eyeDist)
	const d2 = opts.lookat.sub(opts.pos.add(rightEyeCenter)).unit().scale(eyeDist)

	g.pushTransform()
	g.pushTranslate(opts.pos)
	g.pushRotate(opts.angle ?? 0)
	g.drawSprite({
		sprite: assets.sprites["lilfang"],
		frame: framen(3),
		anchor: "center",
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

g.run(() => {

	if (!assets.loaded) {
		// TODO
		return
	}

	g.onKeyPress("space", () => {
		crazy = !crazy
		angle = 0
	})

	const dt = g.dt()
	const mpos = g.mousePos()
	const lookat = mpos
	const w = assets.sprites["lilfang"].width
	const h = assets.sprites["lilfang"].height

	g.drawSprite({
		sprite: assets.sprites["bg"], frame: Math.floor(g.time() * 0.3 % 3),
		width: g.width(),
		height: g.height(),
	})

	pos = pos.add(dir.scale(speed * dt * (crazy ? 2 : 1)))

	if (pos.x + w / 2 >= g.width() || pos.x <= w / 2) {
		dir.x *= -1
	}

	if (pos.y + h / 2 >= g.height() || pos.y <= h / 2) {
		dir.y *= -1
	}

	if (crazy) {
		angle += 800 * dt
	}

	drawLilfang({
		lookat: mpos,
		pos: pos,
		angle: angle,
	})

})
