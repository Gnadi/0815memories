/**
 * Seed the Firebase Emulator with realistic sample data for screenshots.
 *
 * The seeded family intentionally has NO `encryptionKeyJwk`, so the app runs in
 * plaintext mode (see src/utils/encryption.js + src/components/media/useDecryptedMedia.js):
 * every content field and media URL is read as-is. That lets us write plain text
 * and point media at local placeholder images under public/seed-media/.
 *
 * Run order:
 *   1) npx firebase-tools emulators:start   (Auth:9099, Firestore:8080)
 *   2) node scripts/seed-emulator.mjs
 *   3) VITE_USE_EMULATOR=true npm run dev
 *
 * Login for the seeded admin:  demo@kaydo.app / demo123456
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Point the Admin SDK at the local emulators BEFORE importing firebase-admin.
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

const admin = (await import('firebase-admin')).default

const PROJECT_ID = 'demo-kaydo'
admin.initializeApp({ projectId: PROJECT_ID })
const db = admin.firestore()
const auth = admin.auth()
const { Timestamp } = admin.firestore

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_MEDIA_DIR = join(__dirname, '..', 'public', 'seed-media')

const ADMIN_EMAIL = 'demo@kaydo.app'
const ADMIN_PASSWORD = 'demo123456'
const ADMIN_NAME = 'Sarah Bennett'
const FAMILY_NAME = 'The Bennett Family'
const FAMILY_SLUG = 'the-bennetts'

const ts = (isoDate) => Timestamp.fromDate(new Date(isoDate))

// ── Placeholder media ────────────────────────────────────────────────────────
// Generated locally with `sharp` (no network, license-clean): a soft two-tone
// gradient with a warm light spot + emoji glyph so each photo slot reads as a
// distinct, tasteful image inside the real app UI. Written to public/seed-media/
// and referenced by a root-relative URL the Vite dev server can serve.
const MEDIA = [
  { file: 'beach.jpg', a: '#7CC4E8', b: '#F3D9A4', glyph: '🏖️', w: 1000, h: 1000 },
  { file: 'mountains.jpg', a: '#9DB4C0', b: '#F4F1EC', glyph: '🏔️', w: 1000, h: 1000 },
  { file: 'birthday.jpg', a: '#F6A5C0', b: '#C9A7EB', glyph: '🎂', w: 1000, h: 1000 },
  { file: 'garden.jpg', a: '#8FCB6B', b: '#E8F3C9', glyph: '🌻', w: 1000, h: 1000 },
  { file: 'kitchen.jpg', a: '#E8A04A', b: '#FBEAD0', glyph: '🍎', w: 1000, h: 1000 },
  { file: 'picnic.jpg', a: '#A7CE6B', b: '#FBF0A8', glyph: '🧺', w: 1000, h: 1000 },
  { file: 'pie.jpg', a: '#D8964B', b: '#F6E3C5', glyph: '🥧', w: 1000, h: 750 },
  { file: 'pasta.jpg', a: '#D98A6A', b: '#F6E0D0', glyph: '🍝', w: 1000, h: 750 },
  { file: 'cookies.jpg', a: '#C99B6A', b: '#EFD9B8', glyph: '🍪', w: 1000, h: 750 },
  { file: 'kid-emma.jpg', a: '#F3B6C8', b: '#FCE9D0', glyph: '👧', w: 600, h: 600 },
  { file: 'kid-leo.jpg', a: '#9FC6E8', b: '#E7F0D8', glyph: '👦', w: 600, h: 600 },
  { file: 'moment-1.jpg', a: '#E8B05A', b: '#FBE7C7', glyph: '🥞', w: 600, h: 600 },
  { file: 'moment-2.jpg', a: '#8FCB8B', b: '#E3F1CF', glyph: '🛝', w: 600, h: 600 },
  { file: 'moment-3.jpg', a: '#C9A7EB', b: '#F3DDEA', glyph: '👨‍👩‍👧‍👦', w: 600, h: 600 },
  { file: 'scrap-1.jpg', a: '#7CC4E8', b: '#F3D9A4', glyph: '📸', w: 800, h: 800 },
  { file: 'scrap-2.jpg', a: '#F6A5C0', b: '#F7E7C8', glyph: '☀️', w: 800, h: 800 },
  { file: 'scrap-3.jpg', a: '#8FCB6B', b: '#E8F3C9', glyph: '🌊', w: 800, h: 800 },
  { file: 'scrap-4.jpg', a: '#A7CE6B', b: '#FBF0A8', glyph: '🌳', w: 800, h: 800 },
]

const url = (file) => `/seed-media/${file}`

async function exists(p) {
  try { await access(p); return true } catch { return false }
}

// Clean, photo-like gradient: a diagonal two-tone wash, a soft "sun" light spot,
// and a faint horizon band. No emoji/text — headless Chromium renders color emoji
// as black silhouettes, which looks like a glitch in the screenshots.
function gradientSvg({ a, b, w, h }) {
  const sunR = Math.round(Math.min(w, h) * 0.16)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stop-color="${a}"/>
        <stop offset="100%" stop-color="${b}"/>
      </linearGradient>
      <radialGradient id="sun" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
        <stop offset="70%" stop-color="#ffffff" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${Math.round(w * 0.72)}" cy="${Math.round(h * 0.28)}" r="${sunR}" fill="url(#sun)"/>
    <rect x="0" y="${Math.round(h * 0.66)}" width="${w}" height="${Math.round(h * 0.34)}" fill="${b}" opacity="0.28"/>
  </svg>`
}

async function generateMedia() {
  await mkdir(SEED_MEDIA_DIR, { recursive: true })
  for (const m of MEDIA) {
    const dest = join(SEED_MEDIA_DIR, m.file)
    if (await exists(dest)) continue
    const buf = await sharp(Buffer.from(gradientSvg(m))).jpeg({ quality: 86 }).toBuffer()
    await writeFile(dest, buf)
    console.log(`  ✎ ${m.file} (${buf.length} bytes)`)
  }
}

// ── Helpers to clear + add documents ─────────────────────────────────────────
async function clearCollection(name) {
  const snap = await db.collection(name).get()
  const batch = db.batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

async function main() {
  console.log('① Generating placeholder media …')
  await generateMedia()

  console.log('② Resetting emulator data …')
  for (const c of ['families', 'memories', 'moments', 'recipes', 'children', 'journals', 'scrapbooks', 'blackbox']) {
    await clearCollection(c)
  }
  try { await auth.deleteUser((await auth.getUserByEmail(ADMIN_EMAIL)).uid) } catch { /* none */ }

  console.log('③ Creating admin user …')
  const user = await auth.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    displayName: ADMIN_NAME,
    emailVerified: true,
  })
  const uid = user.uid

  console.log('④ Creating family (plaintext — no encryptionKeyJwk) …')
  const familyRef = await db.collection('families').add({
    adminUid: uid,
    adminUids: [uid],
    familyName: FAMILY_NAME,
    familySlug: FAMILY_SLUG,
    memoryCardStyle: 'modern',
    createdAt: ts('2023-01-01'),
  })
  const familyId = familyRef.id

  console.log('⑤ Seeding memories …')
  const memories = [
    {
      title: 'Summer at Monterey Bay', featured: true,
      content: 'Three days of tide pools, sandcastles and the kids refusing to leave the water. Grandpa finally beat everyone at beach volleyball.',
      quote: 'The best memories are made in flip-flops.',
      location: 'Monterey Bay, CA', authorName: 'Sarah', category: 'Travel',
      images: [url('beach.jpg'), url('picnic.jpg')], date: ts('2023-08-15'),
    },
    {
      title: 'First Snow Hike', content: 'We bundled up the whole crew and made it to the ridge just as the clouds broke. Hot cocoa never tasted so good.',
      quote: 'Cold hands, warm hearts.', location: 'Mount Tamalpais', authorName: 'David', category: 'Adventure',
      images: [url('mountains.jpg')], date: ts('2023-12-03'),
    },
    {
      title: "Emma's 6th Birthday", content: 'Unicorn cake, a backyard full of cousins, and exactly one very over-tired birthday girl by 8pm.',
      location: 'Home', authorName: 'Sarah', category: 'Celebration',
      images: [url('birthday.jpg')], date: ts('2024-04-22'),
    },
    {
      title: 'Sunday in the Garden', content: 'Leo planted his first tomatoes. He has already named all of them.',
      quote: 'Small hands, big dreams.', location: 'Backyard', authorName: 'Grandma Rose', category: 'Everyday',
      images: [url('garden.jpg')], date: ts('2024-06-09'),
    },
    {
      title: 'Cooking with Grandma', content: 'Passing down the apple pie recipe, flour everywhere, laughter even more.',
      location: 'Grandma\'s Kitchen', authorName: 'Sarah', category: 'Family',
      images: [url('kitchen.jpg'), url('pie.jpg')], date: ts('2024-11-28'),
    },
  ]
  for (const m of memories) {
    await db.collection('memories').add({ ...m, imageUrl: m.images[0], familyId, createdAt: Timestamp.now() })
  }

  console.log('⑥ Seeding moments …')
  const moments = [
    { caption: 'Morning pancakes 🥞', category: 'Everyday', location: 'Home', images: [url('moment-1.jpg')], date: ts('2024-12-01') },
    { caption: 'Park adventures', category: 'Kids', location: 'Golden Gate Park', images: [url('moment-2.jpg')], date: ts('2024-12-05') },
    { caption: 'Cousins reunited', category: 'Family', location: 'Grandma\'s', images: [url('moment-3.jpg')], date: ts('2024-12-09') },
    { caption: 'Beach throwback', category: 'Travel', location: 'Monterey', images: [url('beach.jpg')], date: ts('2024-12-12') },
    { caption: 'Garden harvest', category: 'Everyday', location: 'Backyard', images: [url('garden.jpg')], date: ts('2024-12-15') },
  ]
  for (const m of moments) {
    await db.collection('moments').add({ ...m, familyId, createdAt: Timestamp.now() })
  }

  console.log('⑦ Seeding children …')
  // Deterministic ids so the screenshot capture script can deep-link reliably.
  const emmaRef = db.collection('children').doc('child-emma')
  await emmaRef.set({
    name: 'Emma', birthdate: ts('2018-04-22'), profilePhoto: url('kid-emma.jpg'),
    familyId, createdAt: ts('2023-01-02'),
  })
  const leoRef = db.collection('children').doc('child-leo')
  await leoRef.set({
    name: 'Leo', birthdate: ts('2020-09-10'), profilePhoto: url('kid-leo.jpg'),
    familyId, createdAt: ts('2023-01-03'),
  })

  console.log('⑧ Seeding journal entries …')
  const journals = [
    { childId: emmaRef.id, title: 'First Day of School', volume: 'Volume 1', emotion: 'joy',
      content: 'You picked out your own backpack and insisted on walking in by yourself. We watched from the gate, so proud we could barely speak.',
      photos: [url('moment-2.jpg')], date: ts('2024-09-03') },
    { childId: emmaRef.id, title: 'Lost Your First Tooth', volume: 'Volume 1', emotion: 'love',
      content: 'It wobbled for a week and finally came out at dinner. The tooth fairy left a note in tiny handwriting.',
      photos: [], date: ts('2024-10-18') },
    { childId: leoRef.id, title: 'Learning to Ride', volume: 'Volume 1', emotion: 'pride',
      content: 'No training wheels! Three scraped knees and one enormous grin later, you rode the whole length of the street.',
      photos: [url('garden.jpg')], date: ts('2024-07-12') },
  ]
  for (const j of journals) {
    await db.collection('journals').add({ ...j, familyId, createdAt: Timestamp.now() })
  }

  console.log('⑨ Seeding recipe tree (root + 2 forks) …')
  const rootRef = db.collection('recipes').doc('recipe-root')
  await rootRef.set({
    title: "Grandma Rose's Apple Pie", author: 'Grandma Rose', year: 1978,
    description: 'The pie that started every Thanksgiving for four decades.',
    instructions: 'Peel and slice the apples. Toss with sugar and cinnamon. Fill the crust, dot with butter, and bake at 190°C for 50 minutes.',
    chefNote: 'Only Granny Smith apples — never the sweet ones.',
    ingredients: [
      { name: '6 Granny Smith apples', status: 'active' },
      { name: '1 cup sugar', status: 'active' },
      { name: '2 tsp cinnamon', status: 'active' },
      { name: 'Double pie crust', status: 'active' },
    ],
    parentId: null, rootId: null, image: url('pie.jpg'),
    familyId, createdAt: ts('2023-02-01'),
  })
  const rootId = rootRef.id
  const fork1 = await db.collection('recipes').add({
    title: "Mom's Apple Pie", author: 'Sarah', year: 2005,
    description: 'Sarah added a caramel drizzle and swapped in a touch of nutmeg.',
    instructions: 'Follow the original, then drizzle warm caramel over the top crust before serving.',
    chefNote: 'A pinch of sea salt on the caramel is the secret.', forkReason: 'Added caramel for the holidays.',
    ingredients: [
      { name: '6 Granny Smith apples', status: 'active' },
      { name: '1 cup sugar', status: 'active' },
      { name: '1 tsp cinnamon', status: 'modified' },
      { name: '1/2 tsp nutmeg', status: 'active' },
      { name: 'Caramel sauce', status: 'active' },
    ],
    changes: [
      { type: 'ADDED', ingredient: 'Caramel sauce', description: 'Drizzled over the top.' },
      { type: 'MODIFIED', ingredient: 'Cinnamon', description: 'Reduced and balanced with nutmeg.' },
    ],
    parentId: rootId, rootId, image: url('pie.jpg'),
    familyId, createdAt: ts('2023-02-02'),
  })
  await db.collection('recipes').add({
    title: "Emma's Mini Pies", author: 'Emma & Sarah', year: 2024,
    description: 'Hand-sized pies for little bakers — same filling, tiny crusts.',
    instructions: 'Use a muffin tin. Press in crust circles, fill, top with a pastry star, and bake 25 minutes.',
    forkReason: 'Made them kid-sized for the school bake sale.',
    ingredients: [
      { name: '6 Granny Smith apples', status: 'active' },
      { name: '3/4 cup sugar', status: 'modified' },
      { name: '1 tsp cinnamon', status: 'active' },
      { name: 'Muffin-tin crust circles', status: 'active' },
    ],
    changes: [{ type: 'MODIFIED', ingredient: 'Format', description: 'Single-serving mini pies.' }],
    parentId: fork1.id, rootId, image: url('cookies.jpg'),
    familyId, createdAt: ts('2024-03-15'),
  })

  console.log('⑩ Seeding scrapbook …')
  const scrapbookPages = [
    {
      id: 'page-1',
      backgroundColor: '#FDF6EC',
      elements: [
        { id: 'e1', type: 'text', text: 'SUMMER 2023', x: 40, y: 40, width: 720, height: 110,
          rotation: 0, zIndex: 1, fontSize: 84, fontWeight: 'bold', fontFamily: 'display', color: '#C25A2E', textAlign: 'center' },
        { id: 'e2', type: 'photo', url: url('scrap-1.jpg'), isSlot: false, x: 60, y: 180, width: 300, height: 340, rotation: -6, zIndex: 2, polaroid: true },
        { id: 'e3', type: 'photo', url: url('scrap-2.jpg'), isSlot: false, x: 420, y: 160, width: 300, height: 340, rotation: 5, zIndex: 3, polaroid: true },
        { id: 'e4', type: 'photo', url: url('scrap-3.jpg'), isSlot: false, x: 240, y: 320, width: 280, height: 300, rotation: -2, zIndex: 4, polaroid: true },
        { id: 'e5', type: 'text', text: 'the best days', x: 480, y: 470, width: 280, height: 80,
          rotation: 3, zIndex: 5, fontSize: 34, fontWeight: 'normal', fontFamily: 'serif', color: '#2D1B0E', textAlign: 'center' },
      ],
    },
    {
      id: 'page-2',
      backgroundColor: '#F0FFF4',
      elements: [
        { id: 'p2e1', type: 'photo', url: url('scrap-4.jpg'), isSlot: false, x: 40, y: 40, width: 720, height: 400, rotation: 0, zIndex: 1 },
        { id: 'p2e2', type: 'text', text: 'GARDEN DAYS', x: 40, y: 470, width: 720, height: 90,
          rotation: 0, zIndex: 2, fontSize: 72, fontWeight: 'bold', fontFamily: 'display', color: '#2D1B0E', textAlign: 'center' },
      ],
    },
  ]
  await db.collection('scrapbooks').doc('scrapbook-year').set({
    title: 'Our Family Year', pages: scrapbookPages,
    familyId, createdAt: ts('2024-01-10'), updatedAt: ts('2024-12-20'),
  })

  console.log('⑪ Seeding black box messages …')
  const blackbox = [
    { childId: emmaRef.id, title: "For Emma's 18th Birthday", triggerType: 'milestone', milestone: '18thBirthday',
      content: 'Dear Emma, if you are reading this you are all grown up. Know that from your very first breath you filled this house with light.',
      unlockDate: ts('2036-04-22') },
    { childId: leoRef.id, title: 'On Your Wedding Day', triggerType: 'milestone', milestone: 'wedding',
      content: 'Leo, whoever you have chosen, we already love them for loving you. Dance with your grandmother for us.',
      unlockDate: null },
    { childId: emmaRef.id, title: 'When You Graduate', triggerType: 'milestone', milestone: 'graduation',
      content: 'We are so proud of you. This is just the beginning.',
      unlockDate: ts('2036-06-15') },
  ]
  for (const b of blackbox) {
    await db.collection('blackbox').add({
      ...b, photos: [], isSealed: true, sealedAt: Timestamp.now(), familyId, createdAt: Timestamp.now(),
    })
  }

  console.log('\n✅ Seed complete.')
  console.log(`   Family:   ${FAMILY_NAME}  (slug: ${FAMILY_SLUG}, id: ${familyId})`)
  console.log(`   Admin:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
