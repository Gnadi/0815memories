/**
 * The demo family's pictures (public/demo-media/), drawn here as flat SVG
 * illustrations and rendered to WebP with sharp.
 *
 *   node scripts/generate-demo-media.mjs
 *
 * Drawn rather than photographed so nothing in them belongs to anyone: no
 * real family, no licence to keep track of. To show photos instead, drop
 * WebP files with the same names into public/demo-media/ — src/demo/
 * demoFamily.js refers to them by name only.
 *
 * Nothing here is random from run to run, so regenerating gives the same
 * files and an unchanged picture never shows up in a diff.
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(root, 'public', 'demo-media')

// ── Drawing helpers ─────────────────────────────────────────────────────────

const W = 1200
const H = 900

const svg = (body, { w = W, h = H, defs = '' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`

const linear = (id, stops, [x1, y1, x2, y2] = [0, 0, 0, 1]) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`)
    .join('')}</linearGradient>`

const radial = (id, stops) =>
  `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">${stops
    .map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`)
    .join('')}</radialGradient>`

const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`
const ellipse = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`
const poly = (points, fill, extra = '') => `<polygon points="${points.map((p) => p.join(',')).join(' ')}" fill="${fill}" ${extra}/>`
const line = (x1, y1, x2, y2, stroke, width, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`
const stroke = (d, color, width, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`
const group = (transform, body) => `<g transform="${transform}">${body}</g>`

// A small seeded generator (mulberry32), for scattered dots that land in the
// same place every run.
function seeded(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function scatter(seed, count, area, draw) {
  const random = seeded(seed)
  let out = ''
  for (let i = 0; i < count; i++) {
    const x = area.x + random() * area.w
    const y = area.y + random() * area.h
    out += draw(x, y, random, i)
  }
  return out
}

function sun(cx, cy, r, core = '#FFE7A3', halo = '#FFF4D6') {
  return circle(cx, cy, r * 2, halo, 'opacity="0.35"') + circle(cx, cy, r * 1.45, halo, 'opacity="0.45"') + circle(cx, cy, r, core)
}

function cloud(x, y, s = 1, color = '#FFFFFF', opacity = 0.92) {
  return group(`translate(${x} ${y}) scale(${s})`,
    `<g fill="${color}" opacity="${opacity}">${ellipse(0, 0, 90, 30, color)}${ellipse(-45, -18, 42, 34, color)}${ellipse(25, -32, 52, 42, color)}${ellipse(70, -8, 36, 28, color)}</g>`)
}

function pine(x, base, h, color = '#2F5D4A', snow = false) {
  const tiers = [
    [base - h * 0.15, h * 0.34, h * 0.42],
    [base - h * 0.42, h * 0.27, h * 0.36],
    [base - h * 0.66, h * 0.2, h * 0.34],
  ]
  let out = rect(x - h * 0.035, base - h * 0.16, h * 0.07, h * 0.16, '#6B4A33')
  for (const [y, half, height] of tiers) {
    out += poly([[x, y - height], [x - half, y], [x + half, y]], color)
    if (snow) out += poly([[x, y - height], [x - half * 0.38, y - height * 0.6], [x - half * 0.1, y - height * 0.66], [x + half * 0.2, y - height * 0.55], [x + half * 0.38, y - height * 0.62]], '#FFFFFF', 'opacity="0.95"')
  }
  return out
}

function roundTree(x, base, r, colors = ['#4F8F4B', '#5FA35A', '#6DB565'], trunk = '#7B5233') {
  return rect(x - r * 0.12, base - r * 1.3, r * 0.24, r * 1.3, trunk)
    + circle(x - r * 0.45, base - r * 1.35, r * 0.7, colors[0])
    + circle(x + r * 0.45, base - r * 1.4, r * 0.72, colors[1])
    + circle(x, base - r * 1.85, r * 0.8, colors[2])
}

function bunting(y, sag, colors, { from = -20, to = W + 20, count = 13 } = {}) {
  const mid = (from + to) / 2
  let out = stroke(`M${from} ${y} Q ${mid} ${y + sag * 2} ${to} ${y}`, '#8A6A55', 3)
  for (let i = 1; i < count; i++) {
    const t = i / count
    const x = (1 - t) * (1 - t) * from + 2 * (1 - t) * t * mid + t * t * to
    const yy = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + sag * 2) + t * t * y
    out += poly([[x - 26, yy], [x + 26, yy], [x, yy + 58]], colors[i % colors.length])
  }
  return out
}

function candle(x, top, h, colors) {
  let out = rect(x - 8, top, 16, h, colors[0], 'rx="4"')
  for (let y = top + 10; y < top + h - 6; y += 18) out += rect(x - 8, y, 16, 7, colors[1])
  out += line(x, top, x, top - 10, '#5A4636', 3)
  out += ellipse(x, top - 26, 11, 18, '#FFB703') + ellipse(x, top - 22, 5, 9, '#FFF1B8')
  return out
}

function confetti(seed, count, area, colors) {
  return scatter(seed, count, area, (x, y, random) =>
    rect(x, y, 14, 6, colors[Math.floor(random() * colors.length)], `rx="3" transform="rotate(${Math.floor(random() * 180)} ${x} ${y})"`))
}

function apple(x, y, r, color = '#D9483B') {
  return circle(x, y, r, color) + circle(x - r * 0.35, y - r * 0.35, r * 0.25, '#FFFFFF', 'opacity="0.35"')
    + line(x, y - r * 0.9, x + 2, y - r * 1.35, '#6B4A33', 4) + ellipse(x + r * 0.35, y - r * 1.2, r * 0.32, r * 0.16, '#5FA35A', `transform="rotate(-25 ${x + r * 0.35} ${y - r * 1.2})"`)
}

// ── The scenes ──────────────────────────────────────────────────────────────

const scenes = {}

scenes.lake = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + sun(930, 190, 70)
  + cloud(260, 160, 1.1) + cloud(600, 110, 0.75)
  + stroke('M150 260 q 14 -12 28 0 q 14 -12 28 0', '#5A6B7A', 4) + stroke('M210 300 q 10 -9 20 0 q 10 -9 20 0', '#5A6B7A', 4)
  + path('M0 470 L120 380 L230 450 L360 330 L500 440 L640 360 L780 450 L900 370 L1040 440 L1200 380 L1200 530 L0 530 Z', '#A7BED0')
  + path('M0 505 Q 200 450 420 498 T 820 492 T 1200 478 L1200 545 L0 545 Z', '#8DB18F')
  + rect(0, 530, W, 200, 'url(#water)')
  + scatter(11, 26, { x: 0, y: 550, w: W, h: 150 }, (x, y) => rect(x, y, 40 + (x % 60), 4, '#FFFFFF', 'rx="2" opacity="0.45"'))
  + path('M700 602 L840 602 L815 628 L725 628 Z', '#FFFDF9') + line(770, 602, 770, 470, '#6B4A33', 4)
  + path('M774 596 L774 474 L836 596 Z', '#FFFFFF') + path('M766 596 L766 494 L716 596 Z', '#F5D7A1')
  + path('M0 700 Q 300 660 650 690 T 1200 680 L1200 900 L0 900 Z', '#F1D3A1')
  + path('M0 820 Q 400 790 800 815 T 1200 805 L1200 900 L0 900 Z', '#E8C48C')
  + rect(296, 640, 8, 170, '#8A6A55')
  + path('M180 652 Q 300 520 420 652 Z', '#E8563F')
  + path('M300 548 Q 255 590 240 652 L 272 652 Q 280 592 300 548 Z', '#FFFDF9')
  + path('M300 548 Q 345 590 360 652 L 328 652 Q 320 592 300 548 Z', '#FFFDF9')
  + group('rotate(-7 380 790)', rect(300, 760, 180, 64, '#4BA3A8', 'rx="6"') + rect(300, 776, 180, 10, '#FFFDF9') + rect(300, 800, 180, 10, '#FFFDF9'))
  + circle(520, 790, 22, '#F2B33D') + path('M498 790 a 22 22 0 0 0 44 0 Z', '#E35D4F'),
  { defs: linear('sky', [[0, '#8FCBEA'], [0.62, '#FBE9C9']]) + linear('water', [[0, '#5AA9CF'], [1, '#86C7DE']]) },
)

scenes.picnic = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + sun(180, 150, 60) + cloud(560, 140, 0.9) + cloud(880, 90, 0.7)
  + path('M0 430 Q 300 330 650 420 T 1200 380 L1200 900 L0 900 Z', '#A8CF8A')
  + path('M0 560 Q 400 480 800 560 T 1200 540 L1200 900 L0 900 Z', '#8DBF6E')
  + roundTree(1010, 600, 150)
  + poly([[300, 660], [820, 630], [940, 830], [230, 865]], 'url(#check)')
  + path('M500 640 L660 640 L645 722 Q 580 738 515 722 Z', '#C98A4B')
  + line(512, 668, 650, 668, '#A86C36', 4) + line(516, 696, 646, 696, '#A86C36', 4)
  + stroke('M515 642 Q 580 560 645 642', '#A86C36', 10)
  + apple(720, 724, 24) + apple(764, 742, 21, '#E05A45') + apple(688, 752, 19, '#C83D30')
  + rect(420, 606, 36, 96, '#7FBF9E', 'rx="12" opacity="0.92"') + rect(430, 584, 16, 26, '#7FBF9E', 'rx="4"')
  + scatter(4, 30, { x: 0, y: 560, w: W, h: 340 }, (x, y, random) =>
    circle(x, y, 5, ['#FFFFFF', '#FFD166', '#F28CA6'][Math.floor(random() * 3)], 'opacity="0.85"')),
  {
    defs: linear('sky', [[0, '#A9D8EE'], [1, '#F3F7E6']])
      + '<pattern id="check" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(-6) skewX(-14)">'
      + rect(0, 0, 64, 64, '#FBF6EC') + rect(0, 0, 32, 64, '#E35D4F', 'opacity="0.5"') + rect(0, 0, 64, 32, '#E35D4F', 'opacity="0.5"')
      + '</pattern>',
  },
)

scenes.snow = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + sun(940, 190, 55, '#FFF6DA', '#FFFFFF')
  + path('M -60 640 L 260 330 L 580 640 Z', '#A4B8CB')
  + poly([[260, 330], [205, 383], [240, 378], [262, 400], [290, 374], [316, 385]], '#FFFFFF')
  + path('M 690 640 L 1000 300 L 1310 640 Z', '#96AEC4')
  + poly([[1000, 300], [945, 361], [980, 355], [1003, 378], [1030, 352], [1060, 366]], '#FFFFFF')
  + path('M 240 640 L 600 220 L 960 640 Z', '#8EA6BE')
  + poly([[600, 220], [518, 316], [560, 306], [600, 340], [640, 304], [684, 318]], '#FFFFFF')
  + path('M0 650 Q 300 600 650 640 T 1200 620 L1200 900 L0 900 Z', '#F8FBFD')
  + path('M0 800 Q 400 770 800 795 T 1200 785 L1200 900 L0 900 Z', '#E6EEF5')
  + pine(110, 720, 260, '#2F5D4A', true) + pine(230, 690, 190, '#356650', true)
  + pine(1050, 730, 280, '#2F5D4A', true) + pine(935, 690, 170, '#356650', true)
  + scatter(8, 16, { x: 360, y: 660, w: 420, h: 230 }, (x, y, random, i) =>
    ellipse(320 + i * 26 + random() * 10, 880 - i * 15 - (i % 2) * 8, 7, 4, '#C9D7E3'))
  + rect(812, 720, 44, 90, '#D9483B', 'rx="12"') + rect(816, 702, 36, 22, '#5A4636', 'rx="6"') + rect(812, 750, 44, 10, '#FFFDF9')
  + scatter(21, 70, { x: 0, y: 0, w: W, h: 860 }, (x, y, random) => circle(x, y, 2 + random() * 4, '#FFFFFF', 'opacity="0.9"')),
  { defs: linear('sky', [[0, '#C3D9EC'], [1, '#F2F6FA']]) },
)

function cakeScene({ wall, table, bunt, balloons, tiers, plates, candles, seed }) {
  let body = rect(0, 0, W, H, wall)
  body += bunting(70, 60, bunt)
  for (const [x, y, r, color] of balloons) {
    body += stroke(`M${x} ${y + r} q -18 60 6 120 q 18 60 -6 130`, '#8A6A55', 3)
    body += ellipse(x, y, r * 0.86, r, color) + ellipse(x - r * 0.3, y - r * 0.4, r * 0.16, r * 0.24, '#FFFFFF', 'opacity="0.45"')
    body += poly([[x - 9, y + r + 12], [x + 9, y + r + 12], [x, y + r - 2]], color)
  }
  body += rect(0, 650, W, 250, table) + rect(0, 650, W, 16, '#000000', 'opacity="0.06"')
  body += ellipse(600, 668, 300, 38, '#FFFDF9') + ellipse(600, 662, 270, 28, '#F2EAE0')
  const [base, top] = tiers
  body += rect(380, 470, 440, 190, base.color, 'rx="26"')
  body += path(`M380 500 Q 380 470 410 470 L790 470 Q 820 470 820 500 L820 520 ${[...Array(8)].map((_, i) => `Q ${790 - i * 55} 560 ${765 - i * 55} 515`).join(' ')} L380 520 Z`, base.icing)
  body += rect(470, 350, 260, 132, top.color, 'rx="22"')
  body += path(`M470 380 Q 470 350 500 350 L700 350 Q 730 350 730 380 L730 396 ${[...Array(5)].map((_, i) => `Q ${705 - i * 52} 432 ${678 - i * 52} 392`).join(' ')} L470 396 Z`, top.icing)
  if (plates) {
    for (let i = 0; i < 6; i++) {
      const x = 490 + i * 44
      body += poly([[x, 352], [x + 22, 316], [x + 44, 352]], plates)
    }
  }
  body += confetti(seed, 40, { x: 390, y: 410, w: 420, h: 230 }, ['#FFFFFF', '#FFD166', '#7BC8C4', '#F28CA6'])
  candles.forEach((colors, i) => { body += candle(505 + i * 38, plates ? 262 : 290, 60, colors) })
  body += confetti(seed + 1, 60, { x: 0, y: 140, w: W, h: 760 }, ['#F28CA6', '#FFD166', '#7BC8C4', '#B39DDB'])
  return svg(body)
}

scenes.birthday = () => cakeScene({
  wall: '#F9D9DF',
  table: '#E9B98F',
  bunt: ['#F28CA6', '#FFD166', '#7BC8C4', '#B39DDB', '#F6A570'],
  balloons: [[170, 320, 78, '#F28CA6'], [1040, 290, 70, '#7BC8C4'], [1120, 420, 58, '#FFD166']],
  tiers: [{ color: '#FBE3EA', icing: '#F28CA6' }, { color: '#F9C9D6', icing: '#FFFDF9' }],
  plates: null,
  candles: [...Array(6)].map((_, i) => (i % 2 ? ['#FFD166', '#FFFDF9'] : ['#7BC8C4', '#FFFDF9'])),
  seed: 31,
})

scenes.cake = () => cakeScene({
  wall: '#D8EFE4',
  table: '#DDB98E',
  bunt: ['#7BC8C4', '#FFD166', '#8CCB9B', '#9CC9EA', '#F6A570'],
  balloons: [[160, 300, 74, '#9CC9EA'], [1050, 310, 72, '#8CCB9B'], [1130, 430, 54, '#FFD166']],
  tiers: [{ color: '#9CC9EA', icing: '#FFFDF9' }, { color: '#8CCB9B', icing: '#6DB565' }],
  plates: '#4F9A5E',
  candles: [...Array(6)].map((_, i) => (i % 2 ? ['#F6A570', '#FFFDF9'] : ['#FFD166', '#FFFDF9'])),
  seed: 47,
})

function sunflower(x, base, h) {
  let out = line(x, base, x, base - h, '#4E8B46', 10)
  out += ellipse(x - 34, base - h * 0.45, 34, 14, '#5FA35A', `transform="rotate(-25 ${x - 34} ${base - h * 0.45})"`)
  out += ellipse(x + 34, base - h * 0.62, 34, 14, '#5FA35A', `transform="rotate(25 ${x + 34} ${base - h * 0.62})"`)
  for (let i = 0; i < 14; i++) {
    out += ellipse(x, base - h - 46, 15, 40, '#FFC93C', `transform="rotate(${i * (360 / 14)} ${x} ${base - h})"`)
  }
  return out + circle(x, base - h, 40, '#7A4B2A') + scatter(x, 18, { x: x - 26, y: base - h - 26, w: 52, h: 52 }, (cx, cy) => circle(cx, cy, 3, '#5A3520'))
}

function tomatoPlant(x, base) {
  let out = stroke(`M${x} ${base} C ${x - 20} ${base - 80} ${x + 20} ${base - 150} ${x} ${base - 230}`, '#4E8B46', 9)
  out += line(x, base - 240, x, base + 10, '#B08B5E', 6)
  for (const [dx, dy, a] of [[-40, -70, -30], [40, -110, 30], [-38, -160, -35], [36, -200, 30]]) {
    out += ellipse(x + dx, base + dy, 34, 15, '#5FA35A', `transform="rotate(${a} ${x + dx} ${base + dy})"`)
  }
  for (const [dx, dy, r] of [[-22, -95, 20], [20, -140, 22], [-16, -185, 18], [26, -60, 18]]) out += apple(x + dx, base + dy, r, '#E3412F')
  return out
}

scenes.garden = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + sun(1040, 150, 62) + cloud(300, 130, 1) + cloud(700, 90, 0.7)
  + rect(0, 470, W, 18, '#F4EFE6') + rect(0, 530, W, 18, '#F4EFE6')
  + [...Array(21)].map((_, i) => poly([[i * 60 + 8, 590], [i * 60 + 8, 440], [i * 60 + 28, 418], [i * 60 + 48, 440], [i * 60 + 48, 590]], '#FFFDF9')).join('')
  + rect(0, 580, W, 320, '#9CCB7A')
  + rect(120, 700, 700, 120, '#8A5A3B', 'rx="14"') + rect(120, 700, 700, 18, '#6E452C', 'rx="9"')
  + sunflower(940, 690, 330) + sunflower(1080, 700, 260)
  + tomatoPlant(260, 715) + tomatoPlant(470, 715) + tomatoPlant(680, 715)
  + group('translate(900 780)', path('M0 0 L120 0 L110 90 L10 90 Z', '#4B8FC8') + stroke('M120 20 L190 -30', '#4B8FC8', 14) + stroke('M20 0 Q 60 -60 100 0', '#3A79AF', 10, '') + ellipse(196, -34, 14, 8, '#3A79AF')),
  { defs: linear('sky', [[0, '#BFE3F2'], [1, '#F4F9EA']]) },
)

scenes.kitchen = () => svg(
  rect(0, 0, W, H, '#F7E6CB')
  + [...Array(9)].map((_, i) => line(0, 380 + i * 26, W, 380 + i * 26, '#EED6B2', 2)).join('')
  + rect(760, 110, 320, 240, '#FFFDF9', 'rx="10"') + rect(780, 130, 280, 200, 'url(#window)')
  + line(920, 130, 920, 330, '#FFFDF9', 10) + line(780, 230, 1060, 230, '#FFFDF9', 10)
  + rect(840, 300, 60, 46, '#C7523A', 'rx="6"') + circle(870, 280, 30, '#5FA35A') + circle(850, 290, 20, '#6DB565')
  + rect(110, 290, 470, 16, '#B98352', 'rx="6"')
  + [['#E8A04A', 150], ['#7BC8C4', 250], ['#F28CA6', 350], ['#FFD166', 450]].map(([color, x]) =>
    rect(x, 210, 70, 80, color, 'rx="14" opacity="0.9"') + rect(x + 6, 196, 58, 18, '#8A6A55', 'rx="6"')).join('')
  + rect(0, 600, W, 300, '#D8A877') + rect(0, 600, W, 14, '#B98352')
  + [...Array(6)].map((_, i) => stroke(`M0 ${660 + i * 45} Q 600 ${640 + i * 45} 1200 ${668 + i * 45}`, '#C89466', 3)).join('')
  + scatter(5, 60, { x: 200, y: 640, w: 700, h: 200 }, (x, y, random) => circle(x, y, 3 + random() * 8, '#FFFFFF', 'opacity="0.55"'))
  + group('rotate(-12 420 760)', rect(250, 735, 340, 52, '#E3BC8A', 'rx="26"') + rect(200, 748, 70, 26, '#C89466', 'rx="13"') + rect(570, 748, 70, 26, '#C89466', 'rx="13"'))
  + path('M700 640 L1000 640 Q 990 760 850 770 Q 710 760 700 640 Z', '#FFFDF9') + rect(706, 668, 288, 18, '#4B8FC8')
  + apple(780, 628, 40) + apple(850, 612, 42, '#7DBE5A') + apple(925, 630, 38, '#E05A45')
  + path('M120 520 L280 520 L300 700 L100 700 Z', '#F3EFE6') + path('M120 520 L140 490 L260 490 L280 520 Z', '#E2DACB')
  + stroke('M200 560 L200 660 M200 590 l -22 -18 M200 590 l 22 -18 M200 620 l -22 -18 M200 620 l 22 -18', '#C89A5B', 6),
  { defs: linear('window', [[0, '#9ED3EE'], [1, '#EAF6F0']]) },
)

scenes.pie = () => {
  const strips = [-200, -120, -40, 40, 120, 200]
  const lattice = strips.map((d) => rect(600 + d - 17, 150, 34, 600, '#E2AE6C', 'rx="10"')).join('')
    + strips.map((d) => rect(300, 450 + d - 17, 600, 34, '#E7B676', 'rx="10"')).join('')
  return svg(
    rect(0, 0, W, H, 'url(#gingham)')
    + circle(612, 466, 338, '#000000', 'opacity="0.08"')
    + circle(600, 450, 335, '#FFFDF9') + circle(600, 450, 305, '#F4EFE8')
    + circle(600, 450, 272, '#D79A55') + circle(600, 450, 240, '#B5562F')
    + `<g clip-path="url(#inner)">${group('rotate(45 600 450)', lattice)}</g>`
    + [...Array(40)].map((_, i) => {
      const a = (i / 40) * Math.PI * 2
      return circle(600 + Math.cos(a) * 256, 450 + Math.sin(a) * 256, 18, '#CF8D49')
    }).join('')
    + apple(150, 760, 52, '#7DBE5A') + apple(250, 805, 46, '#8BC864')
    + group('rotate(18 1050 460)', rect(1035, 250, 30, 420, '#C9C2B8', 'rx="15"') + rect(1020, 200, 60, 80, '#C9C2B8', 'rx="10"')),
    {
      defs: '<pattern id="gingham" width="80" height="80" patternUnits="userSpaceOnUse">'
        + rect(0, 0, 80, 80, '#F6EADB') + rect(0, 0, 40, 80, '#E9B8A5', 'opacity="0.45"') + rect(0, 0, 80, 40, '#E9B8A5', 'opacity="0.45"')
        + '</pattern><clipPath id="inner"><circle cx="600" cy="450" r="240"/></clipPath>',
    },
  )
}

scenes.pancakes = () => {
  let stack = ''
  for (let i = 0; i < 6; i++) {
    const y = 690 - i * 50
    stack += ellipse(600, y + 14, 250, 58, '#C98A3E') + ellipse(600, y, 250, 56, '#E8B064')
  }
  return svg(
    rect(0, 0, W, 330, '#F6E8D2') + rect(820, 40, 300, 220, '#FFFDF9', 'rx="10"') + rect(840, 60, 260, 180, '#CFE9F5')
    + rect(0, 330, W, 570, '#EBC9A0')
    + [...Array(5)].map((_, i) => line(0, 400 + i * 110, W, 400 + i * 110, '#DDB589', 4)).join('')
    + ellipse(612, 740, 400, 96, '#000000', 'opacity="0.08"') + ellipse(600, 725, 395, 94, '#FFFDF9') + ellipse(600, 718, 340, 72, '#F2EAE0')
    + stack
    + path('M430 440 Q 600 400 770 440 Q 760 470 740 480 Q 735 540 725 545 Q 712 540 708 490 Q 640 505 560 492 Q 556 560 545 566 Q 532 560 530 487 Q 470 480 430 440 Z', '#B3631E', 'opacity="0.88"')
    + group('rotate(-10 600 420)', rect(560, 390, 90, 56, '#FFE9A0', 'rx="10"') + rect(560, 390, 90, 16, '#FFF4C8', 'rx="8"'))
    + [[300, 760], [340, 785], [880, 770], [920, 748], [860, 795], [520, 410], [690, 418]].map(([x, y]) => circle(x, y, 17, '#4B5FA8') + circle(x - 5, y - 5, 5, '#FFFFFF', 'opacity="0.5"')).join('')
    + [[260, 735], [950, 720]].map(([x, y]) => path(`M${x} ${y} q 26 -10 34 16 q -6 30 -34 36 q -28 -6 -34 -36 q 8 -26 34 -16 Z`, '#E3412F') + ellipse(x, y - 8, 16, 7, '#5FA35A')).join('')
    + stroke('M520 330 q -20 -30 0 -60 q 20 -30 0 -60', '#FFFFFF', 7, 'opacity="0.55"') + stroke('M640 320 q -20 -30 0 -60 q 20 -30 0 -60', '#FFFFFF', 7, 'opacity="0.55"'),
  )
}

scenes.treehouse = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + cloud(180, 140, 0.9) + cloud(980, 120, 1.1)
  + path('M0 720 Q 300 680 600 712 T 1200 700 L1200 900 L0 900 Z', '#8FC46C')
  + path('M480 900 Q 520 700 530 520 L 610 520 Q 620 700 680 900 Z', '#7B5233')
  + stroke('M560 470 Q 470 380 380 360', '#7B5233', 26) + stroke('M590 460 Q 690 370 800 350', '#7B5233', 24)
  + circle(360, 330, 120, '#4F8F4B') + circle(820, 320, 130, '#4F8F4B') + circle(470, 230, 140, '#5FA35A')
  + circle(700, 220, 150, '#5FA35A') + circle(590, 150, 140, '#6DB565') + circle(870, 230, 90, '#6DB565') + circle(300, 250, 80, '#6DB565')
  + rect(380, 488, 420, 26, '#A8713F', 'rx="6"')
  + rect(430, 350, 320, 140, '#D9A066') + [...Array(5)].map((_, i) => line(430, 378 + i * 26, 750, 378 + i * 26, '#C48A52', 3)).join('')
  + poly([[408, 356], [590, 248], [772, 356]], '#C7523A')
  + rect(470, 384, 90, 70, '#BFE3F2', 'rx="6"') + line(515, 384, 515, 454, '#FFFDF9', 6) + line(470, 419, 560, 419, '#FFFDF9', 6)
  + rect(620, 396, 70, 94, '#6B4A33', 'rx="30"')
  + line(588, 248, 588, 196, '#6B4A33', 4) + poly([[588, 198], [632, 212], [588, 226]], '#FFD166')
  + line(480, 514, 470, 780, '#B98352', 5) + line(540, 514, 530, 780, '#B98352', 5)
  + [...Array(9)].map((_, i) => line(479 - i * 1.1, 545 + i * 28, 539 - i * 1.1, 545 + i * 28, '#B98352', 6)).join('')
  + line(690, 514, 690, 552, '#8A6A55', 3) + line(760, 514, 760, 552, '#8A6A55', 3) + rect(670, 550, 110, 54, '#F6E3C1', 'rx="6"')
  + stroke('M690 570 l 20 0 m 10 0 l 30 0 M686 588 l 50 0', '#C7523A', 5),
  { defs: linear('sky', [[0, '#9ED3EE'], [1, '#EAF6F0']]) },
)

scenes.playground = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + sun(1030, 140, 58) + cloud(320, 120, 1) + cloud(680, 160, 0.7)
  + roundTree(110, 640, 120, ['#5FA35A', '#6DB565', '#7DBE5A']) + roundTree(1120, 630, 100, ['#5FA35A', '#6DB565', '#7DBE5A'])
  + rect(0, 620, W, 280, '#A9D27F')
  + rect(140, 760, 360, 100, '#F0D9A7', 'rx="10"') + rect(140, 760, 360, 100, 'none', 'rx="10" stroke="#B98352" stroke-width="12"')
  + line(300, 760, 330, 420, '#E35D4F', 12) + line(360, 760, 390, 420, '#E35D4F', 12)
  + [...Array(10)].map((_, i) => line(303 + i * 3, 730 - i * 32, 363 + i * 3, 730 - i * 32, '#E35D4F', 8)).join('')
  + rect(320, 410, 150, 22, '#E35D4F', 'rx="6"')
  + path('M440 420 Q 520 430 560 560 Q 600 700 720 740 L 760 770 L 700 790 Q 560 740 520 590 Q 490 470 420 440 Z', '#F2B33D')
  + line(820, 760, 900, 380, '#4B8FC8', 12) + line(960, 760, 900, 380, '#4B8FC8', 12)
  + line(1000, 760, 1080, 380, '#4B8FC8', 12) + line(1140, 760, 1080, 380, '#4B8FC8', 12)
  + line(890, 380, 1090, 380, '#4B8FC8', 14)
  + line(940, 386, 940, 600, '#8A6A55', 4) + line(990, 386, 990, 600, '#8A6A55', 4) + rect(926, 598, 78, 16, '#E35D4F', 'rx="6"')
  + line(1030, 386, 1020, 590, '#8A6A55', 4) + line(1078, 386, 1068, 590, '#8A6A55', 4) + rect(1006, 588, 78, 16, '#FFD166', 'rx="6"'),
  { defs: linear('sky', [[0, '#A7D9F2'], [1, '#F5FAEE']]) },
)

scenes.books = () => svg(
  rect(0, 0, W, H, 'url(#wall)')
  + rect(780, 90, 320, 260, '#FFFDF9', 'rx="10"') + rect(800, 110, 280, 220, '#2E3A66')
  + circle(1000, 180, 40, '#FFF1C1') + circle(1018, 168, 36, '#2E3A66')
  + scatter(13, 22, { x: 810, y: 120, w: 260, h: 200 }, (x, y, random) => circle(x, y, 1.5 + random() * 2.5, '#FFFFFF', 'opacity="0.9"'))
  + line(940, 110, 940, 330, '#FFFDF9', 8)
  + circle(250, 330, 260, 'url(#glow)')
  + rect(236, 300, 28, 330, '#8A6A55') + path('M150 300 L350 300 L300 180 L200 180 Z', '#F6A570')
  + rect(0, 640, W, 260, '#C98A5B') + rect(0, 640, W, 18, '#B47548')
  + rect(140, 660, 920, 180, '#E35D4F', 'rx="20" opacity="0.25"')
  + [['#4B8FC8', 520, 560, 300, 54], ['#F2B33D', 540, 506, 260, 54], ['#6DB565', 510, 452, 290, 54], ['#E35D4F', 550, 398, 250, 54]]
    .map(([color, x, y, w, h]) => rect(x, y, w, h, color, 'rx="8"') + rect(x + 14, y + 10, w - 28, 8, '#FFFDF9', 'opacity="0.6"')).join('')
  + path('M520 398 Q 600 360 680 386 Q 760 360 840 398 L 840 410 Q 760 380 680 400 Q 600 380 520 410 Z', '#FFFDF9')
  + path('M535 392 Q 600 368 676 388 M684 388 Q 760 368 826 392', 'none', 'stroke="#D5C7B3" stroke-width="3"')
  + circle(330, 540, 80, '#B07A4D') + circle(330, 440, 62, '#B07A4D')
  + circle(285, 392, 24, '#B07A4D') + circle(375, 392, 24, '#B07A4D') + circle(285, 392, 12, '#E8C29A') + circle(375, 392, 12, '#E8C29A')
  + ellipse(330, 462, 26, 20, '#E8C29A') + circle(330, 454, 8, '#3B2A20') + circle(308, 430, 6, '#3B2A20') + circle(352, 430, 6, '#3B2A20')
  + circle(260, 590, 30, '#B07A4D') + circle(400, 590, 30, '#B07A4D') + circle(330, 548, 40, '#E8C29A'),
  { defs: linear('wall', [[0, '#EBDCC7'], [1, '#E2CDB1']]) + radial('glow', [[0, '#FFE7A3', 0.75], [1, '#FFE7A3', 0]]) },
)

scenes.bike = () => {
  const wheel = (cx, cy) => circle(cx, cy, 112, 'none', 'stroke="#2D1B0E" stroke-width="16"')
    + circle(cx, cy, 100, 'none', 'stroke="#5A4636" stroke-width="3"')
    + [...Array(12)].map((_, i) => {
      const a = (i / 12) * Math.PI * 2
      return line(cx, cy, cx + Math.cos(a) * 98, cy + Math.sin(a) * 98, '#8A7A6B', 3)
    }).join('') + circle(cx, cy, 12, '#5A4636')
  const house = (x, w, h, color, roof) => rect(x, 520 - h, w, h, color)
    + poly([[x - 14, 520 - h], [x + w / 2, 520 - h - 70], [x + w + 14, 520 - h]], roof)
    + rect(x + w * 0.2, 520 - h + 40, w * 0.22, 50, '#FFF4D6') + rect(x + w * 0.58, 520 - h + 40, w * 0.22, 50, '#FFF4D6')
  return svg(
    rect(0, 0, W, H, 'url(#sky)')
    + cloud(240, 120, 0.9) + cloud(900, 100, 0.8)
    + house(40, 220, 220, '#E7C49A', '#C7523A') + roundTree(340, 520, 70) + house(420, 260, 260, '#D98F6B', '#8A5A3B')
    + roundTree(760, 520, 80) + house(840, 230, 200, '#9CBFD8', '#C7523A')
    + rect(0, 520, W, 60, '#D9D2C5') + rect(0, 580, W, 320, '#9AA3AA')
    + [...Array(7)].map((_, i) => rect(40 + i * 180, 760, 100, 14, '#FFFDF9', 'rx="7"')).join('')
    + wheel(420, 700) + wheel(800, 700)
    + stroke('M420 700 L580 700 L540 520 Z M580 700 L760 520 L540 520 M760 520 L800 700', '#E35D4F', 18)
    + line(540, 520, 528, 470, '#E35D4F', 14) + ellipse(520, 462, 46, 14, '#2D1B0E')
    + line(760, 520, 745, 450, '#E35D4F', 14) + stroke('M705 452 L790 444', '#2D1B0E', 14)
    + circle(580, 700, 26, '#5A4636') + line(580, 700, 610, 745, '#5A4636', 8),
    { defs: linear('sky', [[0, '#A9D8EE'], [1, '#F2F4E8']]) },
  )
}

scenes.school = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + cloud(200, 130, 0.9) + cloud(980, 110, 1)
  + rect(0, 640, W, 260, '#9CCB7A')
  + poly([[520, 640], [680, 640], [800, 900], [400, 900]], '#E9DCC5')
  + rect(300, 300, 600, 340, '#D9775B') + rect(300, 300, 600, 22, '#C2603F')
  + rect(530, 170, 140, 140, '#D9775B') + poly([[515, 172], [600, 100], [685, 172]], '#8A5A3B')
  + circle(600, 235, 42, '#FFFDF9') + line(600, 235, 600, 206, '#2D1B0E', 5) + line(600, 235, 622, 245, '#2D1B0E', 5)
  + [340, 430, 720, 810].flatMap((x) => [360, 470].map((y) => rect(x, y, 60, 76, '#BFE3F2', 'rx="6"') + line(x + 30, y, x + 30, y + 76, '#FFFDF9', 4))).join('')
  + path('M550 640 L550 540 Q 600 490 650 540 L650 640 Z', '#6B4A33')
  + roundTree(170, 650, 110) + roundTree(1040, 650, 120)
  + group('translate(900 610)', rect(0, 60, 190, 220, '#3E7CB1', 'rx="40"') + rect(30, 170, 130, 90, '#F2B33D', 'rx="24"')
    + stroke('M40 70 Q 95 -10 150 70', '#2F6593', 16) + rect(80, 196, 30, 12, '#FFFDF9', 'rx="6"')),
  { defs: linear('sky', [[0, '#B3DDF2'], [1, '#F2F7EC']]) },
)

const SHIRT = 'M130 800 Q 150 600 400 590 Q 650 600 670 800 Z'

function portrait({ background, shirt, skin, hair, front, extra = '' }) {
  return svg(
    rect(0, 0, 800, 800, background)
    + circle(400, 400, 330, '#FFFFFF', 'opacity="0.25"')
    + rect(360, 520, 80, 90, skin)
    + path(SHIRT, shirt)
    + hair
    + circle(232, 380, 34, skin) + circle(568, 380, 34, skin)
    + circle(400, 360, 172, skin)
    + front
    + ellipse(340, 380, 15, 19, '#3B2A20') + ellipse(460, 380, 15, 19, '#3B2A20')
    + circle(345, 373, 5, '#FFFFFF') + circle(465, 373, 5, '#FFFFFF')
    + stroke('M310 336 Q 340 322 368 334', '#5A3520', 7) + stroke('M432 334 Q 460 322 490 336', '#5A3520', 7)
    + circle(300, 430, 30, '#F28CA6', 'opacity="0.35"') + circle(500, 430, 30, '#F28CA6', 'opacity="0.35"')
    + extra,
    { w: 800, h: 800, defs: `<clipPath id="shirt"><path d="${SHIRT}"/></clipPath>` },
  )
}

scenes.emma = () => portrait({
  background: '#F9D3DC',
  shirt: '#FFD166',
  skin: '#F3C7A3',
  hair: circle(400, 330, 195, '#6B3E26') + circle(196, 430, 72, '#6B3E26') + circle(604, 430, 72, '#6B3E26')
    + circle(222, 372, 16, '#F28CA6') + circle(578, 372, 16, '#F28CA6'),
  front: path('M232 330 Q 250 170 400 168 Q 550 170 568 330 Q 520 250 400 262 Q 300 255 232 330 Z', '#6B3E26'),
  extra: stroke('M352 462 Q 400 502 448 462', '#8B3A2E', 10)
    + path('M180 800 Q 200 660 300 640 L 400 700 L 500 640 Q 600 660 620 800 Z', '#FFC33D')
    + path('M330 640 L400 700 L470 640 Q 400 610 330 640 Z', '#FFFDF9'),
})

scenes.leo = () => portrait({
  background: '#CFE6F7',
  shirt: '#6DB565',
  skin: '#F0C29C',
  hair: '',
  front: path('M230 340 Q 210 230 300 196 Q 330 150 390 178 Q 440 140 490 186 Q 570 196 572 300 Q 590 330 566 350 Q 540 270 470 262 Q 420 286 360 262 Q 300 262 262 300 Q 240 320 230 340 Z', '#C58D45'),
  extra: path('M346 452 Q 400 520 454 452 Z', '#FFFDF9', 'stroke="#8B3A2E" stroke-width="8" stroke-linejoin="round"')
    + [[338, 408], [352, 418], [366, 406], [434, 406], [448, 418], [462, 408], [392, 400], [408, 402]]
      .map(([x, y]) => circle(x, y, 4, '#C48A62')).join('')
    + `<g clip-path="url(#shirt)">${[0, 1, 2, 3, 4].map((i) => rect(100, 650 + i * 34, 600, 15, '#FFFDF9', 'opacity="0.85"')).join('')}</g>`,
})

scenes.sunset = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + sun(600, 600, 120, '#FFD27F', '#FFE3B0')
  + stroke('M260 220 q 14 -12 28 0 q 14 -12 28 0', '#5C3B5E', 4) + stroke('M330 260 q 10 -9 20 0 q 10 -9 20 0', '#5C3B5E', 4)
  + [[0, 120, 300], [110, 90, 230], [190, 130, 380], [310, 100, 260], [400, 150, 330], [540, 110, 220], [640, 140, 360], [770, 100, 280], [860, 130, 400], [980, 110, 300], [1080, 140, 250]]
    .map(([x, w, h]) => rect(x, 640 - h + 100, w, h, x % 220 < 110 ? '#4A3A5C' : '#5C4A70')
      + scatter(x + h, Math.floor(h / 35), { x: x + 12, y: 640 - h + 120, w: w - 34, h: h - 50 }, (wx, wy) => rect(Math.round(wx / 22) * 22, Math.round(wy / 34) * 34, 12, 16, '#FFD27F', 'opacity="0.85"'))).join('')
  + rect(0, 740, W, 160, '#3A2C3F')
  + rect(0, 700, W, 18, '#2D1B0E') + [...Array(16)].map((_, i) => rect(30 + i * 76, 716, 12, 184, '#2D1B0E')).join('')
  + group('translate(380 640)', rect(0, 0, 54, 60, '#E35D4F', 'rx="8"') + stroke('M54 14 q 26 0 26 22 q 0 20 -26 20', '#E35D4F', 8))
  + group('translate(470 646)', rect(0, 0, 50, 54, '#F2B33D', 'rx="8"') + stroke('M50 12 q 24 0 24 20 q 0 18 -24 18', '#F2B33D', 8))
  + stroke('M405 620 q -10 -20 0 -40 M495 626 q -10 -20 0 -40', '#FFFFFF', 4, 'opacity="0.6"'),
  { defs: linear('sky', [[0, '#7E5AA8'], [0.45, '#E46F6F'], [0.75, '#F9A26C'], [1, '#FCD29A']]) },
)

scenes.walk = () => svg(
  rect(0, 0, W, H, 'url(#sky)')
  + sun(880, 400, 90, '#FFE29A', '#FFF0C9')
  + path('M0 470 Q 300 400 600 450 T 1200 430 L1200 900 L0 900 Z', '#D6B26A')
  + roundTree(240, 470, 50, ['#8A9A5B', '#97A766', '#A4B472']) + roundTree(1010, 455, 42, ['#8A9A5B', '#97A766', '#A4B472'])
  + path('M0 560 Q 400 500 800 560 T 1200 540 L1200 900 L0 900 Z', '#B9A35E')
  + path('M0 680 Q 300 630 700 690 T 1200 670 L1200 900 L0 900 Z', '#9DB06A')
  + path('M520 900 Q 560 760 640 680 Q 700 620 650 560 Q 620 520 660 470 L 690 470 Q 660 520 700 560 Q 760 640 720 700 Q 660 790 720 900 Z', '#EEDCB3')
  + [...Array(8)].map((_, i) => rect(820 + i * 46, 640 - i * 20, 10, 70 - i * 4, '#7B5233')).join('')
  + stroke('M825 660 L1150 520', '#7B5233', 3)
  + group('translate(625 560)', circle(0, 0, 13, '#5B4636') + rect(-14, 12, 28, 52, '#5B4636', 'rx="12"') + line(-6, 60, -9, 92, '#5B4636', 9) + line(6, 60, 8, 92, '#5B4636', 9))
  + group('translate(660 566)', circle(0, 0, 12, '#5B4636') + path('M-15 12 L15 12 L20 58 L-20 58 Z', '#5B4636') + line(-6, 56, -8, 86, '#5B4636', 8) + line(6, 56, 8, 86, '#5B4636', 8))
  + line(641, 590, 646, 592, '#5B4636', 8),
  { defs: linear('sky', [[0, '#F9C784'], [0.6, '#FBE3B4'], [1, '#F7EBD0']]) },
)

scenes.cookies = () => {
  const cookie = (x, y, r, bite = false, seed = 1) =>
    circle(x + 6, y + 10, r, '#000000', 'opacity="0.08"') + circle(x, y, r, '#C98A3E') + circle(x, y, r - 9, '#D9A05B')
    + scatter(seed, 9, { x: x - r * 0.6, y: y - r * 0.6, w: r * 1.2, h: r * 1.2 }, (cx, cy, random) => ellipse(cx, cy, 9 + random() * 5, 7 + random() * 4, '#5A3520'))
    + (bite ? circle(x + r * 0.75, y - r * 0.55, r * 0.42, '#FFFDF9') : '')
  return svg(
    rect(0, 0, W, 360, '#F5E6D0') + rect(0, 360, W, 540, '#E8C9A1')
    + [...Array(5)].map((_, i) => line(0, 430 + i * 110, W, 430 + i * 110, '#DDB98E', 4)).join('')
    + ellipse(530, 660, 380, 120, '#000000', 'opacity="0.07"') + ellipse(520, 645, 375, 118, '#FFFDF9') + ellipse(520, 640, 320, 92, '#F2EAE0')
    + cookie(380, 600, 95, false, 3) + cookie(600, 590, 100, true, 5) + cookie(480, 700, 92, false, 7) + cookie(700, 690, 88, false, 9)
    + rect(880, 380, 170, 330, '#E7F2F8', 'rx="20" opacity="0.9"') + rect(892, 440, 146, 258, '#FFFFFF', 'rx="14"')
    + rect(900, 400, 18, 280, '#FFFFFF', 'rx="9" opacity="0.6"')
    + scatter(17, 24, { x: 200, y: 760, w: 700, h: 110 }, (x, y, random) => circle(x, y, 3 + random() * 5, '#C98A3E')),
  )
}

// ── Render ──────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })
for (const [name, draw] of Object.entries(scenes)) {
  const file = join(OUT_DIR, `${name}.webp`)
  const info = await sharp(Buffer.from(draw())).webp({ quality: 82, effort: 6 }).toFile(file)
  console.log(`✓ public/demo-media/${name}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} KB`)
}
