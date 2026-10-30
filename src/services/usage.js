/**
 * The app's own usage log for the friends-and-family phase.
 *
 * Write-only by design, like feedback: `firestore.rules` lets a family member
 * create a document here and nothing else. It is read server-side, with
 * scripts/usage-report.mjs. No third party is involved, and nothing is stored
 * on the device except the opt-out below.
 *
 * Deliberately *not* encrypted with the family key, for the reason feedback
 * isn't: it is addressed to whoever runs the app. That is also why an event
 * carries no content at all — see constants/usageEvents.js for the little it
 * does carry.
 *
 * Tracking must never get in the way of the app. A call returns at once, a
 * failed write is dropped, and a demo tab, a signed-out visitor or someone who
 * switched it off writes nothing.
 */
import { addDoc, collection, serverTimestamp, Timestamp } from '../config/firestore'
import { db } from '../config/firebase'
import { isDemoMode } from '../demo/demoMode'
import { devWarn } from '../utils/devLog'
import {
  buildUsageEvent,
  USAGE_LANGUAGE_MAX,
  USAGE_RETENTION_DAYS,
  USAGE_SESSION_MAX,
} from '../constants/usageEvents'

const OPT_OUT_KEY = 'kaydo_usage_optout'
const DAY_MS = 24 * 60 * 60 * 1000

// Events that happen before the session knows its family and role — a stale
// deploy's error screen, the install event — wait here, and go out once it
// does. Capped so a signed-out visitor cannot grow it.
const QUEUE_MAX = 20

let context = { familyId: null, role: null }
let queue = []
let sessionId = null
let sessionAnnounced = null

/** Whether this device switched usage statistics off in the settings. */
export function isUsageOptedOut() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export function setUsageOptedOut(optedOut) {
  try {
    if (optedOut) localStorage.setItem(OPT_OUT_KEY, '1')
    else localStorage.removeItem(OPT_OUT_KEY)
  } catch {
    // Storage can be blocked; the switch then lasts until the next load.
  }
  if (optedOut) queue = []
}

function newSessionId() {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return random.replace(/-/g, '').slice(0, USAGE_SESSION_MAX)
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function languageNow() {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : ''
  return (lang || 'en').slice(0, USAGE_LANGUAGE_MAX)
}

async function write(event) {
  await addDoc(collection(db, 'usageEvents'), {
    familyId: context.familyId,
    role: context.role,
    name: event.name,
    props: event.props,
    lang: languageNow(),
    standalone: isStandalone(),
    session: sessionId,
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + USAGE_RETENTION_DAYS * DAY_MS),
  })
}

function send(event) {
  write(event).catch((err) => devWarn('Usage event dropped:', err?.code, err?.message))
}

/**
 * Tell the log who is using the app. AuthContext calls this whenever the
 * session changes; signing out clears it.
 */
export function setUsageContext({ familyId, role }) {
  const ready = !!(familyId && (role === 'admin' || role === 'viewer'))
  context = ready ? { familyId, role } : { familyId: null, role: null }
  if (!ready) {
    // A different person may sign in next on this device.
    sessionAnnounced = null
    return
  }
  if (sessionAnnounced !== familyId) {
    sessionAnnounced = familyId
    sessionId = newSessionId()
    trackEvent('session_started')
  }
  const waiting = queue
  queue = []
  waiting.forEach((event) => trackEvent(event.name, event.props))
}

/**
 * Record that something happened. Fire and forget: nothing to await, nothing
 * thrown. `props` are short slug labels (constants/usageEvents.js).
 */
export function trackEvent(name, props) {
  try {
    if (!db || isDemoMode() || isUsageOptedOut()) return
    const built = buildUsageEvent(name, props)
    if (!built.ok) {
      devWarn('Usage event refused:', built.error)
      return
    }
    if (!context.familyId) {
      if (queue.length < QUEUE_MAX) queue.push(built.value)
      return
    }
    send(built.value)
  } catch (err) {
    devWarn('Usage event failed:', err?.message)
  }
}

// For tests: a clean slate.
export function resetUsageForTests() {
  context = { familyId: null, role: null }
  queue = []
  sessionId = null
  sessionAnnounced = null
}
