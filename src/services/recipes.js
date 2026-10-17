/**
 * Family recipes and the versions grown from them. A fork carries its parent's
 * id and its root's; a family recipe has neither.
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '../config/firestore'
import { db } from '../config/firebase'
import { decryptFields, decryptJSON, encryptFields, encryptJSON } from '../utils/encryption'
import { parseRichDoc } from '../utils/richText'
import { getFamilyDocument, subscribeDecrypted } from './decrypted'

const RECIPES = 'recipes'

/**
 * How a recipe's instructions were written, in `instructionsFormat`:
 *
 * - 'rich': the rich editor's document in `instructionsRich`, with a plain-text
 *   mirror in `instructions` for everything that only shows text (the NAS
 *   export, a client from before the editor).
 * - 'markdown': the Markdown source in `instructions`, read with
 *   src/utils/markdown.js.
 * - absent: a recipe from before either, plain text in `instructions`.
 *
 * The format says nothing about the recipe itself, so it is stored as it is.
 */
export const INSTRUCTION_FORMATS = ['rich', 'markdown']

// `instructionsRich` is a JSON string by the time it is encrypted, for the
// reason MEMORY_WRITE_FIELDS gives for `contentRich`: encryptFields skips a
// value that is not a string, and an object would be stored readable.
const ENCRYPTED_TEXT_FIELDS = ['title', 'description', 'instructions', 'instructionsRich', 'chefNote', 'forkReason', 'author']

async function encryptRecipe(key, data) {
  const input = { ...data }
  if (input.instructionsRich != null && typeof input.instructionsRich !== 'string') {
    input.instructionsRich = JSON.stringify(input.instructionsRich)
  }
  const result = await encryptFields(key, input, ENCRYPTED_TEXT_FIELDS)
  if (Array.isArray(result.ingredients)) {
    result.ingredients = await encryptJSON(key, result.ingredients)
  }
  return result
}

export async function decryptRecipe(key, data) {
  if (!key) return data
  const result = await decryptFields(key, data, ENCRYPTED_TEXT_FIELDS)
  if (result.instructionsRich != null) result.instructionsRich = parseRichDoc(result.instructionsRich)
  if (typeof result.ingredients === 'string') {
    result.ingredients = await decryptJSON(key, result.ingredients)
  }
  return result
}

/**
 * How many versions have grown from each family recipe, by root id — forks of
 * forks included, as the evolution tree shows them.
 *
 * Counted from the lineage the subscription below already holds, since every
 * fork carries its root's id. A count stored on the root would have to be kept
 * right by every fork and every delete; RecipeCard used to read one that
 * nothing wrote, so every card said 0.
 */
export function countForks(recipes) {
  const counts = new Map()
  for (const recipe of recipes) {
    if (recipe.parentId && recipe.rootId) counts.set(recipe.rootId, (counts.get(recipe.rootId) ?? 0) + 1)
  }
  return counts
}

/**
 * The family recipes, newest first, each with its `forkCount`.
 *
 * The query asks for every version and the roots are picked out here: a
 * `where('parentId', '==', null)` would need a composite index, and would
 * silently drop roots that have no parentId field at all. They are picked out
 * before decrypting, not after — every fork used to be decrypted in full,
 * ingredients and all, only to be thrown away.
 *
 * A viewer asks for the shared versions only. The rules refuse a viewer's query
 * that does not say so, and a shared recipe's forks are all shared, so the
 * counts come out the same as an admin's.
 */
export function subscribeRecipes(familyId, key, onData, onError, { viewer = false } = {}) {
  const constraints = [where('familyId', '==', familyId)]
  if (viewer) constraints.push(where('viewerVisible', '==', true))
  return subscribeDecrypted(
    query(collection(db, RECIPES), ...constraints, orderBy('createdAt', 'desc')),
    (all) => {
      const forkCounts = countForks(all)
      return Promise.all(all.filter((r) => !r.parentId).map(async (root) => ({
        ...(await decryptRecipe(key, root)),
        forkCount: forkCounts.get(root.id) ?? 0,
      })))
    },
    onData,
    onError,
  )
}

/** One version, a family recipe or a fork. */
export function getRecipe(familyId, key, id) {
  return getFamilyDocument(RECIPES, id, familyId, (data) => decryptRecipe(key, data))
}

function forksOf(familyId, rootId, { viewer = false } = {}) {
  const constraints = [where('familyId', '==', familyId), where('rootId', '==', rootId)]
  if (viewer) constraints.push(where('viewerVisible', '==', true))
  return query(collection(db, RECIPES), ...constraints)
}

/** A family recipe and every version grown from it, oldest year first. */
export async function getRecipeLineage(familyId, key, rootId, { viewer = false } = {}) {
  const [root, forksSnap] = await Promise.all([
    getRecipe(familyId, key, rootId),
    getDocs(forksOf(familyId, rootId, { viewer })),
  ])
  const forks = await Promise.all(
    forksSnap.docs.map((d) => decryptRecipe(key, { id: d.id, ...d.data() })),
  )
  const all = root ? [root, ...forks] : forks
  return all.sort((a, b) => (a.year || 0) - (b.year || 0))
}

export async function addRecipe(familyId, key, data) {
  const encrypted = await encryptRecipe(key, data)
  return addDoc(collection(db, RECIPES), {
    ...encrypted,
    familyId,
    createdAt: serverTimestamp(),
  })
}

/**
 * Shares a family recipe with the family's viewers, or stops sharing it — the
 * root and every version grown from it, in one batch. firestore.rules insists
 * that a fork carry its root's flag, so a batch that missed one would be
 * refused, but it cannot see a root that leaves forks behind: unsharing has to
 * reach every fork here, or the viewers keep reading them.
 */
export async function setRecipeViewerVisible(familyId, rootId, visible) {
  const batch = writeBatch(db)
  const forksSnap = await getDocs(forksOf(familyId, rootId))
  forksSnap.docs.forEach((d) => batch.update(d.ref, { viewerVisible: visible }))
  batch.update(doc(db, RECIPES, rootId), { viewerVisible: visible })
  await batch.commit()
}

/** A family recipe, with every version grown from it. */
export async function deleteRecipe(familyId, id) {
  const batch = writeBatch(db)
  const forksSnap = await getDocs(forksOf(familyId, id))
  forksSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, RECIPES, id))
  await batch.commit()
}
