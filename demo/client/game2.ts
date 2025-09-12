import {
	createGame,
	loadAssets,
	loadAudio,
} from "./../../game"

import {
	Vec2,
	Color,
	vec2,
	rgb,
	hsl,
	map,
	lerp,
	wave,
	deg2rad,
	rand,
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

function anim(name: string, animName?: string) {
	const spr = assets.sprites[name]
	const anim = animName ? spr.anims[animName] : null
	if (anim) {
		return anim.from + Math.floor(g.time() * ANIM_FPS % (anim.to - anim.from))
	} else {
		return Math.floor(g.time() * ANIM_FPS % spr.frames.length)
	}
}

const assets = loadAssets({
	sprites: {
		lilfang: g.loadSpritesAnim(seq("/static/lilfang_head-?.png", 3)),
		face: g.loadSpritesAnim(seq("/static/lilfang_face-?.png", 1)),
		eye: g.loadSpritesAnim(seq("/static/lilfang_eye-?.png", 3)),
		mouth: g.loadSpritesAnim(seq("/static/lilfang_mouth-?.png", 6), {
			anims: {
				idle: { from: 0, to: 2, loop: true, },
				talk: { from: 3, to: 5, loop: true, },
			},
		}),
		moon: g.loadSpritesAnim(seq("/static/moon-?.png", 3)),
		btfly: g.loadSpritesAnim(seq("/static/btfly-?.png", 2)),
		bg: g.loadSpritesAnim(seq("/static/bg-?.jpg", 9)),
	},
	audio: {
		song: loadAudio("/static/song.mp3"),
	},
})

const shader = g.createShader(null, `
uniform float u_time;

vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
	vec4 tc = texture2D(tex, uv);
	return vec4(tc.r + color.r, tc.g + color.g, tc.b + color.b, tc.a);
}
`)

function shake(p: Vec2, s: number = 2) {
	return p.add(vec2(rand(-s, s), rand(-s, s)))
}

function drawLilFang(opt: {
	lookat: Vec2,
	pos: Vec2,
	angle?: number,
	color?: Color,
	crazy?: boolean,
	talking?: boolean,
}) {

	// TODO: eye pos when rotating
	const leftEyeCenter = vec2(-13, -1)
	const rightEyeCenter = vec2(13, -2)
	const eyeDist = 2
	const d1 = opt.lookat.sub(opt.pos.add(leftEyeCenter)).unit().scale(eyeDist)
	const d2 = opt.lookat.sub(opt.pos.add(rightEyeCenter)).unit().scale(eyeDist)

	for (let i = 0; i < lilFangPosHist.length - 1; i++) {
		g.drawSprite({
			pos: lilFangPosHist[i],
			sprite: assets.sprites["face"],
			opacity: map(i, 0, MAX_LILFANG_POS_HIST, 0.2, 0.7),
			anchor: "center",
		})
	}

	g.pushTransform()
	g.pushTranslate(crazy ? shake(opt.pos) : opt.pos)
	g.pushRotate(opt.angle ?? 0)
	g.pushScale(vec2(1.5))

	g.drawSprite({
		sprite: assets.sprites["lilfang"],
		frame: anim("lilfang"),
		anchor: "center",
		shader: shader,
		color: opt.color ?? rgb(0, 0, 0),
		uniform: {
			"u_time": g.time(),
		}
	})

	g.pushTransform()
	g.pushTranslate(leftEyeCenter.add(d1))
	// g.pushTranslate(leftEyeCenter.add(crazy ? vec2(rand(-eyeDist, eyeDist), rand(-eyeDist, eyeDist)) : d1))
	g.drawSprite({
		sprite: assets.sprites["eye"],
		frame: anim("eye"),
		anchor: "center",
	})
	g.popTransform()

	g.pushTransform()
	g.pushTranslate(rightEyeCenter.add(d2))
	// g.pushTranslate(rightEyeCenter.add(crazy ? vec2(rand(-eyeDist, eyeDist), rand(-eyeDist, eyeDist)) : d2))
	g.drawSprite({
		sprite: assets.sprites["eye"],
		frame: anim("eye"),
		anchor: "center",
	})
	g.popTransform()

	g.pushTransform()
	g.pushTranslate(vec2(0, 10))
	g.drawSprite({
		sprite: assets.sprites["mouth"],
		frame: anim("mouth", opt.talking ? "talk" : "idle"),
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
let talking = 0

const colors = [
	rgb(0, 0, 0),
	hsl(0.74, 0.5, 0.1),
	hsl(0.41, 0.5, 0.1),
	hsl(0.63, 0.5, 0.1),
	hsl(0.03, 0.5, 0.1),
	hsl(0.52, 0.5, 0.1),
]

let btflyPos = vec2(0)
let btflyAngle = 0
const MAX_BTFLY_POS_HIST = 32
const MAX_LILFANG_POS_HIST = 48
const btflyPosHist: Vec2[] = []
const lilFangPosHist: Vec2[] = []

g.onKeyPress("space", () => {
	g.tween(0, 360, 0.4, (v) => angle = v, easings.easeOutCubic)
})

g.onKeyPress("c", () => {
	crazy = !crazy
})

let popCursor = 0

const popSoundsTime = [
	9.15,
	27.15,
	27.3,
	27.45,
	40.05,
	40.15,
	57.25,
	57.35,
	115.3,
	115.5,
	115.7,
	121.9,
	121.9,
	130.15,
	130.4,
	130.5,
	130.85,
	182.55,
	182.65,
]

let songStarted = false
let songTimer = 0

assets.onReady(() => {
	g.onKeyPress("p", () => {
		songStarted = true
		assets.audio["song"].play()
	})
})

g.run(() => {

	if (!assets.ready) {
		// TODO
		return
	}

	const dt = g.dt()
	const mpos = g.mousePos()
	const lookat = mpos
	const w = assets.sprites["lilfang"].width * 1.6
	const h = assets.sprites["lilfang"].height * 1.6

	if (songStarted) {
		songTimer += dt
		const nextPop = popSoundsTime[popCursor]
		if (songTimer >= nextPop) {
			talking += 1
			g.wait(0.15, () => {
				talking -= 1
			})
			popCursor += 1
		}
	}

	// TODO: cross fade
	g.drawSprite({
		sprite: assets.sprites["bg"], frame: Math.floor(g.time() * 0.3 % assets.sprites["bg"].frames.length),
		width: g.width(),
		height: g.height(),
	})

	if (crazy) {
		g.drawRect({
			width: g.width(),
			height: g.height(),
			color: hsl(wave(0, 1, g.time() * 2), 0.5, 0.5),
			opacity: 0.3,
		})
	}

	lilFangPosHist.push(shake(pos, 16))
	lilFangPosHist.splice(0, lilFangPosHist.length - MAX_LILFANG_POS_HIST)
	pos = pos.add(dir.scale(speed * dt * (crazy ? 2 : 1)))

	if (pos.x + w / 2 >= g.width() || pos.x <= w / 2) {
		dir.x *= -1
		curColor = (curColor + 1) % colors.length
	}

	if (pos.y + h / 2 >= g.height() || pos.y <= h / 2) {
		dir.y *= -1
		curColor = (curColor + 1) % colors.length
	}

	const d = 2

	drawLilFang({
		crazy: crazy,
		lookat: mpos,
		pos: crazy ? pos.add(vec2(rand(-d, d), rand(-d, d))) : pos,
		angle: angle,
		talking: talking > 0,
		// color: colors[curColor],
		// color: pickerColor,
	})

	// for (let i = 0; i < btflyPosHist.length - 2; i++) {
		// g.drawLine({
			// p1: btflyPosHist[i],
			// p2: btflyPosHist[i + 1],
			// width: 2,
			// opacity: map(i, 0, MAX_BTFLY_POS_HIST, 0, 0.5),
			// color: rgb(255, 255, 255),
		// })
	// }

	btflyPos = btflyPos.lerp(mpos, dt * 4)
	btflyPosHist.push(btflyPos)
	btflyPosHist.splice(0, btflyPosHist.length - MAX_BTFLY_POS_HIST)

	if (btflyPosHist.length >= 2) {
		const p1 = btflyPosHist[btflyPosHist.length - 1]
		const p2 = btflyPosHist[btflyPosHist.length - 2]
		// btflyAngle = lerp(btflyAngle, p1.angle(p2), dt * 16)
		btflyAngle = p1.angle(p2)
	}

	g.drawSprite({
		pos: crazy ? shake(btflyPos) : btflyPos,
		angle: btflyAngle + 90,
		sprite: assets.sprites["btfly"], frame: anim("btfly"),
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
