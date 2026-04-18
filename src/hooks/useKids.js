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

const ENCRYPTED_FIELDS = ['name']

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
          docs.map((d) => decryptFields(encryptionKey, d, ENCRYPTED_FIELDS))
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
    const encrypted = await encryptFields(encryptionKey, kid, ENCRYPTED_FIELDS)
    await addDoc(collection(db, 'children'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
    })
  }

  const updateKid = async (id, updates) => {
    const encrypted = await encryptFields(encryptionKey, updates, ENCRYPTED_FIELDS)
    await updateDoc(doc(db, 'children', id), encrypted)
  }

  const deleteKid = async (id) => {
    await deleteDoc(doc(db, 'children', id))
  }

  return { kids, loading, addKid, updateKid, deleteKid }
}
