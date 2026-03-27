/**
 * One-time seed script to initialize the app settings in Firestore.
 * Run: node scripts/seed.cjs
 *
 * Prerequisites:
 * 1. Place your Firebase service account JSON at scripts/serviceAccount.json
 *    (this file is gitignored — never commit it!)
 * 2. Set INNER_CIRCLE_PASSWORD env var or enter it at the prompt.
 *
 * Usage:
 *   INNER_CIRCLE_PASSWORD="your-family-password" node scripts/seed.cjs
 */

const admin = require('firebase-admin')
const bcrypt = require('bcryptjs')
const path = require('path')
const readline = require('readline')

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccount.json')

async function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, answer => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  // Load service account
  let serviceAccount
  try {
    serviceAccount = require(SERVICE_ACCOUNT_PATH)
  } catch {
    console.error('\n❌  Could not find scripts/serviceAccount.json')
    console.error('   Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key')
    process.exit(1)
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  const db = admin.firestore()

  // Get password
  let password = process.env.INNER_CIRCLE_PASSWORD
  if (!password) {
    password = await prompt('Enter inner circle password (min 6 chars): ')
  }

  if (!password || password.length < 6) {
    console.error('❌  Password must be at least 6 characters.')
    process.exit(1)
  }

  console.log('\n⏳  Hashing password (this takes a moment)…')
  const hash = await bcrypt.hash(password, 12)

  const appName = process.env.APP_NAME || 'Our Hearth'

  await db.collection('settings').doc('app').set({
    innerCirclePasswordHash: hash,
    appName,
    heroImage: '',
  }, { merge: true })

  console.log(`\n✅  settings/app document written successfully.`)
  console.log(`    App name: ${appName}`)
  console.log(`    Password hash stored (never shown again).`)
  console.log(`\n    Share the password "${password}" with your family — they'll use it to log in.\n`)

  process.exit(0)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
