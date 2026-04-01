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

export function useBlackBox(familyId) {
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
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setBoxes(data)
        setLoading(false)
      },
      (err) => {
        console.error('useBlackBox snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId])

  const addBox = async (box) => {
    await addDoc(collection(db, 'blackbox'), {
      ...box,
      familyId,
      isSealed: true,
      sealedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
  }

  const updateBox = async (id, updates) => {
    await updateDoc(doc(db, 'blackbox', id), updates)
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
