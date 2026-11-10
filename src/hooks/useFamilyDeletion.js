import { useEffect, useState } from 'react'
import { db } from '../config/firebase'
import { subscribeFamily } from '../services/family'
import { scheduledDeletion } from '../services/familyDeletion'

/**
 * Whether the family is scheduled for deletion, live: the settings and the
 * home page both say so, and the owner's request has to show up on the other
 * admins' devices without a reload.
 *
 * @returns {{ loading: boolean, deleteOn: Date|null, ownerUid: string|null, familyName: string }}
 */
export function useFamilyDeletion(familyId) {
  const [state, setState] = useState({ loading: true, deleteOn: null, ownerUid: null, familyName: '' })

  useEffect(() => {
    if (!familyId || !db) return
    return subscribeFamily(
      familyId,
      (family) => setState({
        loading: false,
        deleteOn: scheduledDeletion(family),
        ownerUid: family?.adminUid || null,
        familyName: family?.familyName || '',
      }),
      () => setState((current) => ({ ...current, loading: false })),
    )
  }, [familyId])

  return state
}
