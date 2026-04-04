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
  limit,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { encryptFields, decryptFields } from '../utils/encryption'

const ENCRYPTED_FIELDS = ['title', 'content', 'quote', 'location', 'authorName', 'category']

async function decryptMemory(key, data) {
  if (!key) return data
  return decryptFields(key, data, ENCRYPTED_FIELDS)
}

async function encryptMemoryData(key, data) {
  if (!key) return data
  return encryptFields(key, data, ENCRYPTED_FIELDS)
}

export function useMemories(familyId, encryptionKey) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'memories'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      const decrypted = await Promise.all(docs.map((d) => decryptMemory(encryptionKey, d)))
      setMemories(decrypted)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId, encryptionKey])

  const addMemory = async (memory) => {
    const encrypted = await encryptMemoryData(encryptionKey, memory)
    await addDoc(collection(db, 'memories'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
    })
  }

  const updateMemory = async (id, updates) => {
    const encrypted = await encryptMemoryData(encryptionKey, updates)
    await updateDoc(doc(db, 'memories', id), encrypted)
  }

  const deleteMemory = async (id) => {
    await deleteDoc(doc(db, 'memories', id))
  }

  const featuredMemory = memories.find((m) => m.featured)

  return { memories, featuredMemory, loading, addMemory, updateMemory, deleteMemory }
}

export function useMoments(familyId) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'moments'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc'),
      limit(10)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMoments(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId])

  const addMoment = async (moment) => {
    await addDoc(collection(db, 'moments'), {
      ...moment,
      familyId,
      date: serverTimestamp(),
    })
  }

  const updateMoment = async (id, updates) => {
    await updateDoc(doc(db, 'moments', id), updates)
  }

  const deleteMoment = async (id) => {
    await deleteDoc(doc(db, 'moments', id))
  }

  return { moments, loading, addMoment, updateMoment, deleteMoment }
}

export function useAllMoments(familyId) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'moments'),
      where('familyId', '==', familyId),
      orderBy('date', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setMoments(data)
      setLoading(false)
    })

    return unsubscribe
  }, [familyId])

  const updateMoment = async (id, updates) => {
    await updateDoc(doc(db, 'moments', id), updates)
  }

  const deleteMoment = async (id) => {
    await deleteDoc(doc(db, 'moments', id))
  }

  return { moments, loading, updateMoment, deleteMoment }
}
