/**
 * Every Firestore call the app makes, through one module.
 *
 * Kaydo has no service layer: hooks, pages and components query Firestore
 * directly. This is the one place all of those queries pass, so whatever has
 * to decide how they are answered can decide it here.
 *
 * eslint.config.js refuses `firebase/firestore` imports anywhere else in
 * src/. A function the app starts to need is added to this list.
 */
export {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
