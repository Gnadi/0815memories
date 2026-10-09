/**
 * Every Firestore call the app makes, through one module, so that the demo
 * can answer them instead of Firebase.
 *
 * Kaydo has no service layer: hooks, pages and components query Firestore
 * directly, so this is the one place all of those queries pass. Outside the
 * demo each export is the SDK's own function, called as it is. In a demo tab
 * (demo/demoMode.js) they go to the in-memory database demo/index.js installs
 * here — see demo/demoDatabase.js.
 *
 * eslint.config.js refuses `firebase/firestore` imports anywhere else in
 * src/. A function the app starts to need is added here and to the demo
 * database, with a test there, or the demo breaks on that feature.
 */
import {
  addDoc as sdkAddDoc,
  arrayRemove as sdkArrayRemove,
  arrayUnion as sdkArrayUnion,
  collection as sdkCollection,
  deleteDoc as sdkDeleteDoc,
  deleteField as sdkDeleteField,
  doc as sdkDoc,
  getCountFromServer as sdkGetCountFromServer,
  getDoc as sdkGetDoc,
  getDocs as sdkGetDocs,
  limit as sdkLimit,
  onSnapshot as sdkOnSnapshot,
  orderBy as sdkOrderBy,
  query as sdkQuery,
  runTransaction as sdkRunTransaction,
  serverTimestamp as sdkServerTimestamp,
  setDoc as sdkSetDoc,
  startAfter as sdkStartAfter,
  updateDoc as sdkUpdateDoc,
  where as sdkWhere,
  writeBatch as sdkWriteBatch,
} from 'firebase/firestore'
import { isDemoMode } from '../demo/demoMode'

// The demo stores real Timestamps, so there is only the one class.
export { Timestamp } from 'firebase/firestore'

// Decided once per page load, as config/firebase.js decides it.
const DEMO_TAB = isDemoMode()

let demoDatabase = null

/**
 * Send every call below to the demo's database. AuthContext waits for this
 * before it reports anyone signed in, so no page queries ahead of it.
 */
export function installDemoDatabase(database) {
  demoDatabase = database
}

// The demo's function, or null for the SDK's. A demo tab never falls through
// to the SDK: a query ahead of the demo database, or one it cannot answer,
// fails here instead of reaching for Firestore.
function demo(name) {
  if (demoDatabase) {
    if (!demoDatabase[name]) throw new Error(`The demo database has no ${name}()`)
    return demoDatabase[name]
  }
  if (DEMO_TAB) throw new Error(`Firestore ${name}() was called before the demo database was installed`)
  return null
}

// Each SDK function is looked up when it is called, never when this module
// loads: unit tests replace firebase/firestore with mocks that define only
// what the code under test uses.
export const addDoc = (...args) => (demo('addDoc') ?? sdkAddDoc)(...args)
export const arrayRemove = (...args) => (demo('arrayRemove') ?? sdkArrayRemove)(...args)
export const arrayUnion = (...args) => (demo('arrayUnion') ?? sdkArrayUnion)(...args)
export const collection = (...args) => (demo('collection') ?? sdkCollection)(...args)
export const deleteDoc = (...args) => (demo('deleteDoc') ?? sdkDeleteDoc)(...args)
export const deleteField = (...args) => (demo('deleteField') ?? sdkDeleteField)(...args)
export const doc = (...args) => (demo('doc') ?? sdkDoc)(...args)
export const getCountFromServer = (...args) => (demo('getCountFromServer') ?? sdkGetCountFromServer)(...args)
export const getDoc = (...args) => (demo('getDoc') ?? sdkGetDoc)(...args)
export const getDocs = (...args) => (demo('getDocs') ?? sdkGetDocs)(...args)
export const limit = (...args) => (demo('limit') ?? sdkLimit)(...args)
export const onSnapshot = (...args) => (demo('onSnapshot') ?? sdkOnSnapshot)(...args)
export const orderBy = (...args) => (demo('orderBy') ?? sdkOrderBy)(...args)
export const query = (...args) => (demo('query') ?? sdkQuery)(...args)
export const runTransaction = (...args) => (demo('runTransaction') ?? sdkRunTransaction)(...args)
export const serverTimestamp = (...args) => (demo('serverTimestamp') ?? sdkServerTimestamp)(...args)
export const setDoc = (...args) => (demo('setDoc') ?? sdkSetDoc)(...args)
export const startAfter = (...args) => (demo('startAfter') ?? sdkStartAfter)(...args)
export const updateDoc = (...args) => (demo('updateDoc') ?? sdkUpdateDoc)(...args)
export const where = (...args) => (demo('where') ?? sdkWhere)(...args)
export const writeBatch = (...args) => (demo('writeBatch') ?? sdkWriteBatch)(...args)
