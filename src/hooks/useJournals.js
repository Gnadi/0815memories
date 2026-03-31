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

export function useJournals(familyId, childId) {
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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setJournals(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId, childId])

  const addJournal = async (entry) => {
    await addDoc(collection(db, 'journals'), {
      ...entry,
      familyId,
      childId,
      createdAt: serverTimestamp(),
    })
  }

  const updateJournal = async (id, updates) => {
    await updateDoc(doc(db, 'journals', id), updates)
  }

  const deleteJournal = async (id) => {
    await deleteDoc(doc(db, 'journals', id))
  }

  return { journals, loading, addJournal, updateJournal, deleteJournal }
}

export function useAllJournals(familyId) {
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
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setJournals(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId])

  return { journals, loading }
}
