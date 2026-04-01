import { useState, useEffect } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export function useRecipes(familyId) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'recipes'),
      where('familyId', '==', familyId),
      where('rootId', '==', null),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setRecipes(data)
        setLoading(false)
      },
      (err) => {
        console.error('useRecipes snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId])

  const addRecipe = async (data) => {
    return await addDoc(collection(db, 'recipes'), {
      ...data,
      familyId,
      createdAt: serverTimestamp(),
    })
  }

  const deleteRecipe = async (id) => {
    await deleteDoc(doc(db, 'recipes', id))
  }

  return { recipes, loading, addRecipe, deleteRecipe }
}

export function useRecipeLineage(rootId, familyId) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rootId || !familyId || !db) {
      setLoading(false)
      return
    }

    const fetchLineage = async () => {
      try {
        // Fetch the root recipe
        const rootSnap = await getDoc(doc(db, 'recipes', rootId))
        const rootDoc = rootSnap.exists() ? { id: rootSnap.id, ...rootSnap.data() } : null

        // Fetch all forks in this lineage
        const forksQuery = query(
          collection(db, 'recipes'),
          where('rootId', '==', rootId),
          orderBy('year', 'asc')
        )
        const forksSnap = await getDocs(forksQuery)
        const forks = forksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

        // Merge root + forks, sort by year
        const all = rootDoc ? [rootDoc, ...forks] : forks
        all.sort((a, b) => (a.year || 0) - (b.year || 0))
        setVersions(all)
      } catch (err) {
        console.error('useRecipeLineage error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLineage()
  }, [rootId, familyId])

  return { versions, loading }
}
