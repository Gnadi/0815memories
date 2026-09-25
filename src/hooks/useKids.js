import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { encryptFields, decryptFields } from '../utils/encryption'

// birthTime ("04:17") and birthPlace (JSON: name, country, lat, lon, tz) feed
// the "Sky of your birth" map. Both are encrypted: together with the birthdate
// they say exactly when and where a child was born.
const ENCRYPTED_FIELDS = ['name', 'birthTime', 'birthPlace']

function parseBirthPlace(value) {
  if (!value || typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// A plain place object becomes a JSON string so encryptFields can encrypt it.
// Anything else — a string, or deleteField() — passes through untouched.
function serialize(kid) {
  const place = kid.birthPlace
  if (place && Object.getPrototypeOf(place) === Object.prototype) {
    return { ...kid, birthPlace: JSON.stringify(kid.birthPlace) }
  }
  return kid
}

export function useKids(familyId, encryptionKey) {
  const [kids, setKids] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'children'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'asc')
    )
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const decrypted = await Promise.all(
          docs.map(async (d) => {
            const kid = await decryptFields(encryptionKey, d, ENCRYPTED_FIELDS)
            return { ...kid, birthPlace: parseBirthPlace(kid.birthPlace) }
          })
        )
        setKids(decrypted)
        setLoading(false)
      },
      (err) => {
        if (import.meta.env.DEV) console.error('useKids snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, encryptionKey])

  const addKid = async (kid) => {
    const encrypted = await encryptFields(encryptionKey, serialize(kid), ENCRYPTED_FIELDS)
    await addDoc(collection(db, 'children'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
    })
  }

  const updateKid = async (id, updates) => {
    const encrypted = await encryptFields(encryptionKey, serialize(updates), ENCRYPTED_FIELDS)
    await updateDoc(doc(db, 'children', id), encrypted)
  }

  const deleteKid = async (id) => {
    await deleteDoc(doc(db, 'children', id))
  }

  return { kids, loading, addKid, updateKid, deleteKid }
}
