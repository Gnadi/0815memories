import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import { addRecipe, deleteRecipe, getRecipeLineage, subscribeRecipes } from '../services/recipes'

export function useRecipes(familyId, encryptionKey) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    return subscribeRecipes(familyId, encryptionKey, (list) => {
      setRecipes(list)
      setLoading(false)
    }, (err) => {
      if (import.meta.env.DEV) console.error('useRecipes snapshot error:', err)
      setLoading(false)
    })
  }, [familyId, encryptionKey])

  return {
    recipes,
    loading,
    addRecipe: (data) => addRecipe(familyId, encryptionKey, data),
    deleteRecipe: (id) => deleteRecipe(familyId, id),
  }
}

export function useRecipeLineage(rootId, familyId, encryptionKey) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rootId || !familyId || !db) {
      setLoading(false)
      return
    }

    getRecipeLineage(familyId, encryptionKey, rootId)
      .then(setVersions)
      .catch((err) => {
        if (import.meta.env.DEV) console.error('useRecipeLineage error:', err)
      })
      .finally(() => setLoading(false))
  }, [rootId, familyId, encryptionKey])

  return { versions, loading }
}
