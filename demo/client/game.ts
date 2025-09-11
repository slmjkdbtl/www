import {
	Sprite,
	createGame,
	load,
} from "./../../game"

import {
	Vec2,
	vec2,
	rgb,
	hsl2rgb,
	wave,
} from "./../../math"

const WIDTH = 640
const HEIGHT = 480
const SCALE = 1
const ANIM_FPS = 8

const g = createGame({
	width: WIDTH,
	height: HEIGHT,
	// pixelDensity: 1,
	// crisp: true,
	// background: [255, 255, 255],
})

g.focus()

function replaceSeq(name: string, num: number) {
	const files = []
	for (let i = 1; i <= num; i++) {
		files.push(name.replace("?", i + ""))
	}
	return files
}

function framen(n: number) {
	return Math.floor(g.time() * ANIM_FPS % n)
}

const assets = load({
	sprites: {
		lilfang: g.loadSpritesAnim(replaceSeq("/static/lilfang_noeye-?.png", 3)),
		eye: g.loadSpritesAnim(replaceSeq("/static/lilfang_eye-?.png", 3)),
		moon: g.loadSpritesAnim(replaceSeq("/static/moon-?.png", 3)),
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

g.run(() => {

	if (!assets.loaded) {
		// TODO
		return
	}

	const mpos = g.mousePos()
	const lookat = mpos

	g.pushTransform()
	g.pushTranslate(vec2(360, 240))
	g.drawSprite({
		sprite: assets.sprites["moon"], frame: framen(3),
		anchor: "center",
	})
	g.popTransform()

	g.drawText({
		text: "[green]oh hi[/green] here's some [wavy]styled[/wavy] text",
		width: g.width(),
		size: 32,
		styles: {
			"green": {
				color: rgb(128, 128, 255),
			},
			"wavy": (idx, ch) => ({
				color: hsl2rgb((g.time() * 0.2 + idx * 0.1) % 1, 0.7, 0.8),
				pos: vec2(0, wave(-4, 4, g.time() * 6 + idx * 0.5)),
			}),
		},
	})

	drawLilfang({
		lookat: mpos,
		pos: vec2(420, 360),
	})

})
