// Starter template for the advanced (HTML/CSS) login-page editor. It doubles
// as documentation of what's allowed: marquee, inline styles, images, links,
// CSS animations. Scripts, forms, and iframes are stripped by the sanitizer.

export const DEFAULT_LOGIN_HTML = `<!-- Welcome to your custom login page! -->
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

export const DEFAULT_LOGIN_CSS = `.canvas {
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
