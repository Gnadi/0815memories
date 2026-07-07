// Starter templates for the advanced (HTML/CSS) login-page editor. They double
// as documentation of what's allowed: marquee, inline styles, images, links,
// CSS animations. Scripts, forms, and iframes are stripped by the sanitizer.
//
// Every template targets `.canvas` (the shadow-root styling hook) and keeps
// bottom padding on its page wrapper so the floating sign-in button never
// covers content. `swatch` is a CSS background for the picker preview.

const RETRO_HTML = `<!-- Welcome to your custom login page! -->
<!-- Visitors sign in via the floating button at the bottom of the page. -->
<!-- Tip: upload images below and paste their URLs like this: -->
<!-- <img src="https://res.cloudinary.com/..." width="200"> -->

<div class="page">
  <marquee behavior="scroll" scrollamount="6" class="banner">
    ✨🌟 Welcome to our family page 🌟✨ Sign in below to see our memories! ✨
  </marquee>

  <h1 class="rainbow">Our Family</h1>
  <p class="tagline">~ est. whenever mom says ~</p>

  <div class="top8">
    <div class="friend">👨</div>
    <div class="friend">👩</div>
    <div class="friend">👧</div>
    <div class="friend">👦</div>
    <div class="friend">👵</div>
    <div class="friend">👴</div>
    <div class="friend">🐕</div>
    <div class="friend">🐈</div>
  </div>
  <p class="top8-label">★ Our Top 8 ★</p>

  <div class="counter">
    You are visitor <code>#000042</code>
  </div>

  <p class="footer-note">
    This page is best viewed in Netscape Navigator 4.0 &#128521;
  </p>
</div>
`

const RETRO_CSS = `.canvas {
  min-height: 100%;
  background: linear-gradient(180deg, #1a0533, #4b0f6e 60%, #1a0533);
  background-attachment: fixed;
  color: #ffe9ff;
  font-family: 'Comic Sans MS', 'Comic Sans', cursive;
  text-align: center;
}

.page {
  max-width: 720px;
  margin: 0 auto;
  /* bottom padding leaves room for the floating sign-in button */
  padding: 24px 16px 90px;
}

.banner {
  background: #000;
  color: #39ff14;
  border: 3px ridge #ff00ff;
  padding: 6px 0;
  font-weight: bold;
}

.rainbow {
  font-size: 2.6rem;
  margin: 24px 0 4px;
  animation: rainbow 3s linear infinite;
}

@keyframes rainbow {
  0%   { color: #ff5e5e; }
  25%  { color: #ffd25e; }
  50%  { color: #5eff8a; }
  75%  { color: #5ec8ff; }
  100% { color: #ff5e5e; }
}

.tagline {
  font-style: italic;
  opacity: 0.8;
}

.top8 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  max-width: 360px;
  margin: 28px auto 6px;
}

.friend {
  font-size: 2rem;
  background: rgba(255, 255, 255, 0.12);
  border: 2px dashed #ff8ae2;
  border-radius: 8px;
  padding: 12px 0;
}

.top8-label {
  color: #ff8ae2;
  letter-spacing: 2px;
}

.counter {
  display: inline-block;
  margin-top: 24px;
  background: #000;
  border: 2px inset #888;
  padding: 4px 12px;
  font-family: 'Courier New', monospace;
  color: #39ff14;
}

.footer-note {
  margin-top: 32px;
  font-size: 0.8rem;
  opacity: 0.6;
}
`

const SPACE_HTML = `<!-- A cosmic welcome page. Edit any text to make it yours! -->

<div class="page">
  <div class="sky">
    <span class="star s1">✦</span>
    <span class="star s2">✧</span>
    <span class="star s3">✦</span>
    <span class="star s4">✧</span>
    <span class="star s5">✦</span>
    <span class="star s6">✧</span>
  </div>

  <p class="ufo">🛸</p>

  <h1 class="title">Greetings, Earthlings!</h1>
  <p class="subtitle">Enter the secret code to dock at our home base.</p>

  <div class="planets">
    <span>🪐</span>
    <span>🌍</span>
    <span>🌕</span>
  </div>

  <p class="transmission">· · · incoming transmission from the mothership · · ·</p>
</div>
`

const SPACE_CSS = `.canvas {
  min-height: 100%;
  background: linear-gradient(180deg, #0b0d2a, #3b1d60);
  background-attachment: fixed;
  color: #e8e6ff;
  font-family: 'Courier New', Courier, monospace;
  text-align: center;
}

.page {
  position: relative;
  max-width: 720px;
  margin: 0 auto;
  /* bottom padding leaves room for the floating sign-in button */
  padding: 48px 16px 110px;
}

.sky {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.star {
  position: absolute;
  color: #ffd76a;
  animation: twinkle 2.4s ease-in-out infinite;
}

.s1 { top: 8%;  left: 12%; font-size: 1.4rem; }
.s2 { top: 18%; left: 82%; font-size: 1rem;   animation-delay: 0.4s; }
.s3 { top: 42%; left: 6%;  font-size: 1.1rem; animation-delay: 0.8s; }
.s4 { top: 60%; left: 90%; font-size: 1.5rem; animation-delay: 1.2s; }
.s5 { top: 78%; left: 20%; font-size: 1rem;   animation-delay: 1.6s; }
.s6 { top: 86%; left: 70%; font-size: 1.3rem; animation-delay: 2s; }

@keyframes twinkle {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50%      { opacity: 1;    transform: scale(1.15); }
}

.ufo {
  font-size: 3rem;
  margin: 0;
  animation: hover 3.5s ease-in-out infinite;
}

@keyframes hover {
  0%, 100% { transform: translateY(0) rotate(-4deg); }
  50%      { transform: translateY(-14px) rotate(4deg); }
}

.title {
  font-size: 2.4rem;
  letter-spacing: 1px;
  margin: 18px 0 8px;
  text-shadow: 0 0 18px rgba(142, 123, 255, 0.8);
}

.subtitle {
  font-size: 1rem;
  opacity: 0.85;
  margin: 0 0 32px;
}

.planets {
  font-size: 2.2rem;
  display: flex;
  justify-content: center;
  gap: 28px;
}

.planets span {
  animation: drift 6s ease-in-out infinite;
}

.planets span:nth-child(2) { animation-delay: 1.5s; }
.planets span:nth-child(3) { animation-delay: 3s; }

@keyframes drift {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
}

.transmission {
  margin-top: 40px;
  font-size: 0.8rem;
  letter-spacing: 2px;
  color: #8e7bff;
  animation: twinkle 3s ease-in-out infinite;
}
`

const GARDEN_HTML = `<!-- A blooming garden welcome. Edit any text to make it yours! -->

<div class="page">
  <p class="butterfly">🦋</p>

  <h1 class="title">Welcome to our garden</h1>
  <p class="subtitle">Where our family memories grow.</p>

  <div class="hedge">
    <span>🌷</span>
    <span>🌼</span>
    <span>🌸</span>
    <span>🌻</span>
    <span>🌺</span>
  </div>

  <div class="sign">
    Please water the plants<br>and sign in below 🌱
  </div>
</div>
`

const GARDEN_CSS = `.canvas {
  min-height: 100%;
  background: linear-gradient(160deg, #d4f5c9, #7fd8a8);
  background-attachment: fixed;
  color: #1f4d2e;
  font-family: Georgia, 'Times New Roman', serif;
  text-align: center;
}

.page {
  max-width: 720px;
  margin: 0 auto;
  /* bottom padding leaves room for the floating sign-in button */
  padding: 44px 16px 110px;
}

.butterfly {
  font-size: 2.6rem;
  margin: 0;
  animation: flutter 5s ease-in-out infinite;
}

@keyframes flutter {
  0%, 100% { transform: translate(0, 0) rotate(-6deg); }
  25%      { transform: translate(18px, -12px) rotate(8deg); }
  50%      { transform: translate(-6px, -20px) rotate(-4deg); }
  75%      { transform: translate(-16px, -8px) rotate(6deg); }
}

.title {
  font-size: 2.4rem;
  font-style: italic;
  margin: 16px 0 6px;
}

.subtitle {
  font-size: 1.05rem;
  opacity: 0.8;
  margin: 0 0 36px;
}

.hedge {
  display: flex;
  justify-content: center;
  gap: 18px;
  font-size: 2.2rem;
}

.hedge span {
  animation: sway 4s ease-in-out infinite;
  transform-origin: bottom center;
}

.hedge span:nth-child(2n) { animation-delay: 1s; }
.hedge span:nth-child(3n) { animation-delay: 2s; }

@keyframes sway {
  0%, 100% { transform: rotate(-5deg); }
  50%      { transform: rotate(5deg); }
}

.sign {
  display: inline-block;
  margin-top: 40px;
  background: #8a5a33;
  color: #fdf6e3;
  border: 3px solid #6e4426;
  border-radius: 10px;
  padding: 12px 22px;
  font-size: 0.95rem;
  line-height: 1.5;
  box-shadow: 0 6px 0 #6e4426;
}
`

const ARCADE_HTML = `<!-- An 8-bit arcade lobby. Edit any text to make it yours! -->

<div class="page">
  <p class="coin">🕹️</p>

  <h1 class="title">Our Family</h1>
  <p class="press-start">▶ PRESS START TO SIGN IN ◀</p>

  <div class="scores">
    <p class="scores-head">★ HIGH SCORES ★</p>
    <div class="row"><span>1UP · MOM</span><span>999999</span></div>
    <div class="row"><span>2UP · DAD</span><span>420690</span></div>
    <div class="row"><span>3UP · KIDS</span><span>313370</span></div>
  </div>

  <p class="insert">INSERT COIN · CREDIT 01</p>
</div>
`

const ARCADE_CSS = `.canvas {
  min-height: 100%;
  background: #050510;
  color: #e8fdf5;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  text-align: center;
}

.page {
  max-width: 720px;
  margin: 0 auto;
  /* bottom padding leaves room for the floating sign-in button */
  padding: 44px 16px 110px;
}

.coin {
  font-size: 3rem;
  margin: 0 0 8px;
}

.title {
  font-size: 2.6rem;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #39ff14;
  margin: 0 0 14px;
  animation: neon 2s ease-in-out infinite;
}

@keyframes neon {
  0%, 100% { text-shadow: 0 0 6px #39ff14, 0 0 24px #39ff14; }
  50%      { text-shadow: 0 0 2px #39ff14, 0 0 10px #39ff14; }
}

.press-start {
  color: #ffde59;
  letter-spacing: 2px;
  animation: blink 1.2s steps(2, start) infinite;
}

@keyframes blink {
  0%, 49%  { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.scores {
  max-width: 340px;
  margin: 36px auto 0;
  border: 3px double #ff2ec4;
  padding: 14px 18px 18px;
}

.scores-head {
  color: #ff2ec4;
  letter-spacing: 3px;
  margin: 0 0 12px;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.9rem;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.25);
}

.row:last-child {
  border-bottom: 0;
}

.insert {
  margin-top: 36px;
  font-size: 0.8rem;
  letter-spacing: 3px;
  color: #5ec8ff;
}
`

const ELEGANT_HTML = `<!-- A quiet, elegant welcome. Edit any text to make it yours! -->

<div class="page">
  <p class="monogram">F</p>
  <div class="rule"></div>

  <h1 class="title">Our Family Memories</h1>
  <p class="subtitle">A private collection of the moments we treasure.</p>

  <div class="rule"></div>
  <p class="note">Kindly sign in below to enter.</p>
</div>
`

const ELEGANT_CSS = `.canvas {
  min-height: 100%;
  background: linear-gradient(180deg, #fdfbf5, #f3ecdd);
  color: #4a4237;
  font-family: Georgia, 'Times New Roman', serif;
  text-align: center;
}

.page {
  max-width: 560px;
  margin: 0 auto;
  /* bottom padding leaves room for the floating sign-in button */
  padding: 64px 20px 120px;
}

.monogram {
  width: 74px;
  height: 74px;
  line-height: 70px;
  margin: 0 auto 28px;
  border: 1px solid #c9a86a;
  border-radius: 50%;
  font-size: 2.2rem;
  color: #a8874e;
}

.rule {
  width: 120px;
  height: 1px;
  margin: 0 auto;
  background: #c9a86a;
}

.title {
  font-size: 2.1rem;
  font-weight: normal;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin: 30px 0 12px;
}

.subtitle {
  font-style: italic;
  font-size: 1.05rem;
  color: #8a7f6e;
  margin: 0 0 30px;
}

.note {
  margin-top: 26px;
  font-size: 0.85rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #a8874e;
}
`

const SCRAPBOOK_HTML = `<!-- A hand-made scrapbook page. Edit any text to make it yours! -->

<div class="page">
  <h1 class="title">Our little scrapbook</h1>
  <p class="tagline">glued together with love (and actual glue)</p>

  <div class="photos">
    <div class="polaroid p1">
      <div class="shot">🏖️</div>
      <p class="caption">summer '24</p>
    </div>
    <div class="polaroid p2">
      <div class="shot">🎂</div>
      <p class="caption">birthday chaos</p>
    </div>
    <div class="polaroid p3">
      <div class="shot">⛄</div>
      <p class="caption">first snow</p>
    </div>
  </div>

  <p class="doodle">✎ sign in below to flip through the pages ✂</p>
</div>
`

const SCRAPBOOK_CSS = `.canvas {
  min-height: 100%;
  background:
    repeating-linear-gradient(180deg, transparent 0, transparent 30px, rgba(120, 150, 190, 0.18) 31px),
    #fbf4e4;
  color: #5b4a3a;
  font-family: 'Comic Sans MS', 'Comic Sans', cursive;
  text-align: center;
}

.page {
  max-width: 720px;
  margin: 0 auto;
  /* bottom padding leaves room for the floating sign-in button */
  padding: 40px 16px 110px;
}

.title {
  font-size: 2.3rem;
  margin: 0 0 4px;
}

.tagline {
  font-style: italic;
  opacity: 0.75;
  margin: 0 0 36px;
}

.photos {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 20px;
}

.polaroid {
  position: relative;
  background: #fff;
  padding: 10px 10px 4px;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
}

.polaroid::before {
  /* washi-tape strip */
  content: '';
  position: absolute;
  top: -10px;
  left: 50%;
  width: 64px;
  height: 18px;
  transform: translateX(-50%) rotate(-3deg);
  background: rgba(255, 180, 120, 0.6);
}

.p1 { transform: rotate(-4deg); }
.p2 { transform: rotate(2deg); }
.p3 { transform: rotate(5deg); }

.shot {
  width: 110px;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  background: linear-gradient(150deg, #cfe8ff, #ffe3c9);
}

.caption {
  margin: 8px 0 6px;
  font-size: 0.85rem;
}

.doodle {
  margin-top: 44px;
  font-size: 1rem;
  color: #a86a4e;
}
`

export const LOGIN_STARTER_TEMPLATES = [
  {
    key: 'retro',
    swatch: 'linear-gradient(180deg, #1a0533, #4b0f6e)',
    html: RETRO_HTML,
    css: RETRO_CSS,
  },
  {
    key: 'space',
    swatch: 'linear-gradient(180deg, #0b0d2a, #3b1d60)',
    html: SPACE_HTML,
    css: SPACE_CSS,
  },
  {
    key: 'garden',
    swatch: 'linear-gradient(160deg, #d4f5c9, #7fd8a8)',
    html: GARDEN_HTML,
    css: GARDEN_CSS,
  },
  {
    key: 'arcade',
    swatch: 'linear-gradient(180deg, #050510, #16163a)',
    html: ARCADE_HTML,
    css: ARCADE_CSS,
  },
  {
    key: 'elegant',
    swatch: 'linear-gradient(180deg, #fdfbf5, #e8ddc4)',
    html: ELEGANT_HTML,
    css: ELEGANT_CSS,
  },
  {
    key: 'scrapbook',
    swatch: 'linear-gradient(180deg, #fbf4e4, #f3d9b8)',
    html: SCRAPBOOK_HTML,
    css: SCRAPBOOK_CSS,
  },
]
