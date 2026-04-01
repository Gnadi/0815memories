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
  writeBatch,
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

    // Query all recipes for the family, filter root recipes client-side.
    // Avoids a composite index requirement for rootId == null.
    const q = query(
      collection(db, 'recipes'),
      where('familyId', '==', familyId),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        // Root recipes have no parentId (or parentId is null/undefined)
        setRecipes(all.filter((r) => !r.parentId))
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
    const batch = writeBatch(db)
    // Cascade-delete all forks in this lineage
    const forksSnap = await getDocs(
      query(collection(db, 'recipes'), where('rootId', '==', id))
    )
    forksSnap.docs.forEach((d) => batch.delete(d.ref))
    // Delete the root itself
    batch.delete(doc(db, 'recipes', id))
    await batch.commit()
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

        // Fetch all forks in this lineage, scoped to same family.
        // No orderBy here — client-side sort below avoids needing a new composite index.
        const forksQuery = query(
          collection(db, 'recipes'),
          where('familyId', '==', familyId),
          where('rootId', '==', rootId)
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
