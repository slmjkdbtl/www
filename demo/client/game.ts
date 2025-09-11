import {
	createApp,
} from "./../../app"

import {
	createGfx,
} from "./../../gfx"

import {
	vec2,
} from "./../../math"

const WIDTH = 640
const HEIGHT = 480
const SCALE = 1
const ANIM_FPS = 8

const app = createApp({
	width: WIDTH * SCALE,
	height: HEIGHT * SCALE,
})

const gfx = createGfx({
	canvas: app.canvas,
	width: WIDTH,
	height: HEIGHT,
	background: [255, 255, 255],
})

app.focus()

function nfiles(name: string, num: number) {
	const files = []
	for (let i = 1; i <= num; i++) {
		files.push(name.replace("?", i + ""))
	}
	return files
}

function framen(n: number) {
	return Math.floor(app.time() * ANIM_FPS % n)
}

;(async function() {

	const sprites = {
		lilfang: await gfx.loadSpritesAnim(nfiles("/static/lilfang_noeye-?.png", 3)),
		eye: await gfx.loadSpritesAnim(nfiles("/static/lilfang_eye-?.png", 3)),
		moon: await gfx.loadSpritesAnim(nfiles("/static/moon-?.png", 3)),
	}

	const lilfangPos = vec2(420, 360)
	const leftEyeCenter = vec2(31, 19)
	const rightEyeCenter = vec2(61, 18)
	const eyeDist = 2

	app.run(() => {

		const mpos = app.mousePos()
		const lookat = mpos
		const d1 = lookat.sub(lilfangPos.add(leftEyeCenter)).unit().scale(eyeDist)
		const d2 = lookat.sub(lilfangPos.add(rightEyeCenter)).unit().scale(eyeDist)

		gfx.frameStart()

		gfx.pushTransform()
		gfx.pushTranslate(vec2(360, 240))
		gfx.drawSprite({ sprite: sprites["moon"], frame: framen(3) })
		gfx.popTransform()

		gfx.pushTransform()
		gfx.pushTranslate(lilfangPos)
		gfx.drawSprite({ sprite: sprites["lilfang"], frame: framen(3), })

		gfx.pushTransform()
		gfx.pushTranslate(leftEyeCenter.add(d1))
		gfx.drawSprite({ sprite: sprites["eye"], frame: framen(3) })
		gfx.popTransform()

		gfx.pushTransform()
		gfx.pushTranslate(rightEyeCenter.add(d2))
		gfx.drawSprite({ sprite: sprites["eye"], frame: framen(3) })
		gfx.popTransform()

		gfx.popTransform()

		gfx.frameEnd()

	})

})()
