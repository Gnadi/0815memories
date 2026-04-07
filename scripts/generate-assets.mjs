/**
 * Generates PWA icons and OG image from SVG sources using sharp.
 * Run once: node scripts/generate-assets.mjs
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

mkdirSync(join(root, 'public/icons'), { recursive: true })

// ─── Kaydo logo mark SVG (scaled to target size via viewBox) ─────────────────
function makeIconSvg(size) {
  const r = Math.round(size * 0.18)
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${r}" fill="#FDF6EC"/>
  <line x1="50" y1="8" x2="8" y2="38" stroke="#C25A2E" stroke-width="8" stroke-linecap="round"/>
  <line x1="8" y1="38" x2="8" y2="90" stroke="#C25A2E" stroke-width="8" stroke-linecap="round"/>
  <line x1="8" y1="62" x2="37" y2="38" stroke="#C25A2E" stroke-width="7" stroke-linecap="round"/>
  <line x1="8" y1="62" x2="44" y2="90" stroke="#C25A2E" stroke-width="7" stroke-linecap="round"/>
  <path d="M 35 90 L 35 57 Q 35 12 60 12 Q 90 12 90 56 L 90 90" stroke="#8B9E7E" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="60" cy="36" r="7" fill="#F5E6C8"/>
</svg>`)
}

// ─── PWA icons ────────────────────────────────────────────────────────────────
for (const size of [192, 512]) {
  await sharp(makeIconSvg(size))
    .png()
    .toFile(join(root, `public/icons/pwa-${size}x${size}.png`))
  console.log(`✓ public/icons/pwa-${size}x${size}.png`)
}

// Apple touch icon 180×180
await sharp(makeIconSvg(180))
  .png()
  .toFile(join(root, 'public/icons/apple-touch-icon.png'))
console.log('✓ public/icons/apple-touch-icon.png')

// ─── OG Image 1200×630 ────────────────────────────────────────────────────────
const ogSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- Background -->
  <rect width="1200" height="630" fill="#FDF6EC"/>

  <!-- Subtle warm border -->
  <rect x="0" y="0" width="1200" height="8" fill="#C25A2E"/>
  <rect x="0" y="622" width="1200" height="8" fill="#C25A2E"/>

  <!-- Kaydo logo mark centred-left -->
  <svg x="120" y="195" width="240" height="240" viewBox="0 0 100 100">
    <line x1="50" y1="8" x2="8" y2="38" stroke="#C25A2E" stroke-width="8" stroke-linecap="round"/>
    <line x1="8" y1="38" x2="8" y2="90" stroke="#C25A2E" stroke-width="8" stroke-linecap="round"/>
    <line x1="8" y1="62" x2="37" y2="38" stroke="#C25A2E" stroke-width="7" stroke-linecap="round"/>
    <line x1="8" y1="62" x2="44" y2="90" stroke="#C25A2E" stroke-width="7" stroke-linecap="round"/>
    <path d="M 35 90 L 35 57 Q 35 12 60 12 Q 90 12 90 56 L 90 90" stroke="#8B9E7E" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="60" cy="36" r="7" fill="#F5E6C8"/>
  </svg>

  <!-- Brand name -->
  <text x="420" y="265" font-family="Georgia, serif" font-size="80" font-weight="700" fill="#2D1B0E">Kaydo</text>

  <!-- Tagline -->
  <text x="420" y="340" font-family="system-ui, sans-serif" font-size="34" fill="#7A6A5E">Your Private Digital Home</text>

  <!-- Feature pills -->
  <rect x="420" y="380" width="220" height="44" rx="22" fill="#C25A2E" opacity="0.12"/>
  <text x="530" y="408" font-family="system-ui, sans-serif" font-size="18" fill="#C25A2E" text-anchor="middle">Encrypted</text>

  <rect x="658" y="380" width="180" height="44" rx="22" fill="#C25A2E" opacity="0.12"/>
  <text x="748" y="408" font-family="system-ui, sans-serif" font-size="18" fill="#C25A2E" text-anchor="middle">No Ads</text>

  <rect x="854" y="380" width="230" height="44" rx="22" fill="#C25A2E" opacity="0.12"/>
  <text x="969" y="408" font-family="system-ui, sans-serif" font-size="18" fill="#C25A2E" text-anchor="middle">No AI Training</text>

  <!-- URL -->
  <text x="420" y="480" font-family="system-ui, sans-serif" font-size="26" fill="#B8A99C">kaydo.app</text>
</svg>`)

await sharp(ogSvg)
  .png()
  .toFile(join(root, 'public/og-image.png'))
console.log('✓ public/og-image.png')

console.log('\nAll assets generated successfully.')
