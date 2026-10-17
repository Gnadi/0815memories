import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import { addRecipe, deleteRecipe, getRecipeLineage, setRecipeViewerVisible, subscribeRecipes } from '../services/recipes'

export function useRecipes(familyId, encryptionKey, { viewer = false } = {}) {
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
    }, { viewer })
  }, [familyId, encryptionKey, viewer])

  return {
    recipes,
    loading,
    addRecipe: (data) => addRecipe(familyId, encryptionKey, data),
    deleteRecipe: (id) => deleteRecipe(familyId, id),
  }
}

export function useRecipeLineage(rootId, familyId, encryptionKey, { viewer = false } = {}) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rootId || !familyId || !db) {
      setLoading(false)
      return
    }

    getRecipeLineage(familyId, encryptionKey, rootId, { viewer })
      .then(setVersions)
      .catch((err) => {
        if (import.meta.env.DEV) console.error('useRecipeLineage error:', err)
      })
      .finally(() => setLoading(false))
  }, [rootId, familyId, encryptionKey, viewer])

  // Every version carries the flag, the root's included, so changing it is
  // mirrored onto all of them here as well as in the database.
  const setViewerVisible = async (visible) => {
    await setRecipeViewerVisible(familyId, rootId, visible)
    setVersions((list) => list.map((v) => ({ ...v, viewerVisible: visible })))
  }

  return { versions, loading, setViewerVisible }
}
