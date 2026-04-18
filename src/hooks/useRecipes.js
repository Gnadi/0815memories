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
import { encryptFields, decryptFields, encryptJSON, decryptJSON } from '../utils/encryption'

const ENCRYPTED_TEXT_FIELDS = ['title', 'description', 'instructions', 'chefNote', 'forkReason', 'author']

async function encryptRecipe(key, data) {
  if (!key) return data
  const result = await encryptFields(key, data, ENCRYPTED_TEXT_FIELDS)
  if (result.ingredients != null && Array.isArray(result.ingredients)) {
    result.ingredients = await encryptJSON(key, result.ingredients)
  }
  return result
}

async function decryptRecipe(key, data) {
  if (!key) return data
  const result = await decryptFields(key, data, ENCRYPTED_TEXT_FIELDS)
  if (result.ingredients != null && typeof result.ingredients === 'string') {
    result.ingredients = await decryptJSON(key, result.ingredients)
  }
  return result
}

export function useRecipes(familyId, encryptionKey) {
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
      async (snapshot) => {
        const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        const decrypted = await Promise.all(all.map((d) => decryptRecipe(encryptionKey, d)))
        // Root recipes have no parentId (or parentId is null/undefined)
        setRecipes(decrypted.filter((r) => !r.parentId))
        setLoading(false)
      },
      (err) => {
        if (import.meta.env.DEV) console.error('useRecipes snapshot error:', err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [familyId, encryptionKey])

  const addRecipe = async (data) => {
    const encrypted = await encryptRecipe(encryptionKey, data)
    return await addDoc(collection(db, 'recipes'), {
      ...encrypted,
      familyId,
      createdAt: serverTimestamp(),
    })
  }

  const deleteRecipe = async (id) => {
    const batch = writeBatch(db)
    // Cascade-delete all forks in this lineage, scoped to this family
    const forksSnap = await getDocs(
      query(
        collection(db, 'recipes'),
        where('familyId', '==', familyId),
        where('rootId', '==', id)
      )
    )
    forksSnap.docs.forEach((d) => batch.delete(d.ref))
    // Delete the root itself
    batch.delete(doc(db, 'recipes', id))
    await batch.commit()
  }

  return { recipes, loading, addRecipe, deleteRecipe }
}

export function useRecipeLineage(rootId, familyId, encryptionKey) {
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
        let rootDoc = rootSnap.exists() ? { id: rootSnap.id, ...rootSnap.data() } : null
        // Verify familyId
        if (rootDoc && rootDoc.familyId !== familyId) rootDoc = null
        if (rootDoc) rootDoc = await decryptRecipe(encryptionKey, rootDoc)

        // Fetch all forks in this lineage, scoped to same family.
        const forksQuery = query(
          collection(db, 'recipes'),
          where('familyId', '==', familyId),
          where('rootId', '==', rootId)
        )
        const forksSnap = await getDocs(forksQuery)
        const forks = await Promise.all(
          forksSnap.docs.map(async (d) => decryptRecipe(encryptionKey, { id: d.id, ...d.data() }))
        )

        // Merge root + forks, sort by year
        const all = rootDoc ? [rootDoc, ...forks] : forks
        all.sort((a, b) => (a.year || 0) - (b.year || 0))
        setVersions(all)
      } catch (err) {
        if (import.meta.env.DEV) console.error('useRecipeLineage error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLineage()
  }, [rootId, familyId, encryptionKey])

  return { versions, loading }
}
