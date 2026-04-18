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

export function useJournals(familyId, childId, encryptionKey) {
  const [journals, setJournals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !childId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'journals'),
      where('familyId', '==', familyId),
      where('childId', '==', childId),
      orderBy('date', 'desc')
    )
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const decrypted = await Promise.all(
          docs.map((d) => decryptFields(encryptionKey, d, ENCRYPTED_FIELDS))
        )
        setJournals(decrypted)
        setLoading(false)
      },
      (err) => {
        if (import.meta.env.DEV) console.error('useJournals snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, childId, encryptionKey])

  const addJournal = async (entry) => {
    const encrypted = await encryptFields(encryptionKey, entry, ENCRYPTED_FIELDS)
    await addDoc(collection(db, 'journals'), {
      ...encrypted,
      familyId,
      childId,
      createdAt: serverTimestamp(),
    })
  }

  const updateJournal = async (id, updates) => {
    const encrypted = await encryptFields(encryptionKey, updates, ENCRYPTED_FIELDS)
    await updateDoc(doc(db, 'journals', id), encrypted)
  }

  const deleteJournal = async (id) => {
    await deleteDoc(doc(db, 'journals', id))
  }

  return { journals, loading, addJournal, updateJournal, deleteJournal }
}

export function useAllJournals(familyId, encryptionKey) {
  const [journals, setJournals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'journals'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc')
    )
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const decrypted = await Promise.all(
          docs.map((d) => decryptFields(encryptionKey, d, ENCRYPTED_FIELDS))
        )
        setJournals(decrypted)
        setLoading(false)
      },
      (err) => {
        if (import.meta.env.DEV) console.error('useAllJournals snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, encryptionKey])

  return { journals, loading }
}
