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

const ENCRYPTED_FIELDS = ['content']

export function useBlackBox(familyId, encryptionKey) {
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'blackbox'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const decrypted = await Promise.all(
          docs.map((d) => decryptFields(encryptionKey, d, ENCRYPTED_FIELDS))
        )
        setBoxes(decrypted)
        setLoading(false)
      },
      (err) => {
        console.error('useBlackBox snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, encryptionKey])

  const addBox = async (box) => {
    const encrypted = await encryptFields(encryptionKey, box, ENCRYPTED_FIELDS)
    await addDoc(collection(db, 'blackbox'), {
      ...encrypted,
      familyId,
      isSealed: true,
      sealedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
  }

  const updateBox = async (id, updates) => {
    const encrypted = await encryptFields(encryptionKey, updates, ENCRYPTED_FIELDS)
    await updateDoc(doc(db, 'blackbox', id), encrypted)
  }

  const deleteBox = async (id) => {
    await deleteDoc(doc(db, 'blackbox', id))
  }

  return { boxes, loading, addBox, updateBox, deleteBox }
}

export function isUnlocked(box) {
  if (box.triggerType === 'legacy') return false
  if (!box.unlockDate) return false
  const unlock = box.unlockDate.toDate ? box.unlockDate.toDate() : new Date(box.unlockDate)
  return unlock <= new Date()
}
