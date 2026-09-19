import { useCallback, useEffect, useState } from 'react'
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { encryptJSON, decryptJSON } from '../utils/encryption'
import { deletePrintFile } from '../utils/printFileStore'
import { fetchOrderStatus, placeOrder } from '../utils/printApi'
import { STATUS, mapProviderStatus, printFileRelease } from '../utils/printOrderStatus'
import { devError } from '../utils/devLog'

/**
 * Print orders for one scrapbook: the record, the status, and the cleanup.
 *
 * The delivery address is encrypted the way every other piece of family content
 * is. It has to reach Peecho in the clear — they are posting a parcel to it —
 * but that is a value in flight through our own endpoint, not a value at rest
 * in a document that will outlive the order by years.
 */
export function usePrintOrders(scrapbookId) {
  const { user, familyId, encryptionKey } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // Derived rather than set from inside the effect: with nothing to subscribe
  // to there is nothing to wait for, and a synchronous setState in an effect
  // body costs a second render pass to say so.
  const canQuery = !!(familyId && scrapbookId && db)

  useEffect(() => {
    if (!canQuery) return undefined
    let cancelled = false

    const q = query(
      collection(db, 'printOrders'),
      where('familyId', '==', familyId),
      where('scrapbookId', '==', scrapbookId),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rows = await Promise.all(snapshot.docs.map(async (d) => {
        const data = { id: d.id, ...d.data() }
        if (encryptionKey && typeof data.address === 'string') {
          // A single unreadable address must not blank the whole list — the
          // order still happened and its status still matters.
          data.address = await decryptJSON(encryptionKey, data.address).catch(() => null)
        }
        return data
      }))
      // Decryption is asynchronous, so this can resolve after the hook has
      // moved on to another scrapbook — or gone away entirely.
      if (cancelled) return
      setOrders(rows)
      setLoading(false)
    }, (error) => {
      devError('Failed to load print orders', error)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [canQuery, familyId, scrapbookId, encryptionKey])

  /**
   * Delete an order's print file and note that it is gone.
   *
   * The note matters as much as the deletion: without it, every later pass
   * tries again against an object that no longer exists, and a log full of
   * expected failures is a log nobody reads.
   */
  const releasePrintFile = useCallback(async (order) => {
    if (!order?.printFilePath) return false
    const deleted = await deletePrintFile(order.printFilePath)
    if (!deleted) return false
    await updateDoc(doc(db, 'printOrders', order.id), {
      printFileDeletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((err) => devError('Failed to record print file deletion', err))
    return true
  }, [])

  /**
   * Record an order and hand it to the print network.
   *
   * The record is written first, deliberately. If the network call then fails,
   * there is still a row saying what was attempted and which print file it was
   * attempted with — which is what makes the file recoverable rather than
   * orphaned. The other order would leave an uploaded plaintext PDF in the
   * bucket with nothing in the database pointing at it.
   */
  const createOrder = useCallback(async ({
    fileUrl, printFilePath, offeringId, formatId, productId,
    quantity, pageCount, widthMm, heightMm, address, currency = 'EUR',
  }) => {
    if (!familyId || !scrapbookId) throw new Error('Missing family or scrapbook')

    const orderReference = `kaydo-${crypto.randomUUID().replace(/-/g, '')}`.slice(0, 40)

    const ref = await addDoc(collection(db, 'printOrders'), {
      familyId,
      scrapbookId,
      orderReference,
      provider: 'peecho',
      status: STATUS.PLACING,
      offeringId: offeringId ?? null,
      formatId,
      productId,
      quantity,
      pageCount,
      currency,
      printFilePath,
      printFileDeletedAt: null,
      address: encryptionKey ? await encryptJSON(encryptionKey, address) : address,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    try {
      const result = await placeOrder(user, {
        orderReference, offeringId, quantity, pageCount,
        widthMm, heightMm, currency, fileUrl, address,
      })
      await updateDoc(ref, {
        status: STATUS.PLACED,
        providerOrderId: result?.order?.id ? String(result.order.id) : null,
        updatedAt: serverTimestamp(),
      })
      return { id: ref.id, orderReference, ...result }
    } catch (err) {
      // A failed order's file will never be fetched, so it is exposure with no
      // purpose. Released straight away rather than waiting for the backstop.
      await updateDoc(ref, {
        status: STATUS.FAILED,
        failureCode: err?.code || 'unknown',
        updatedAt: serverTimestamp(),
      }).catch(() => {})
      await releasePrintFile({ id: ref.id, printFilePath, status: STATUS.FAILED })
      throw err
    }
  }, [familyId, scrapbookId, encryptionKey, user, releasePrintFile])

  /**
   * Ask the print network where an order got to, and act on the answer.
   *
   * This is also the app's own cleanup pass: whenever a status moves somewhere
   * that means the press is finished with the file, the file goes. The
   * scheduled function is the backstop for orders nobody ever looks at again.
   */
  const refreshStatus = useCallback(async (order) => {
    try {
      const { status: providerStatus } = await fetchOrderStatus(user, order.orderReference)
      const next = mapProviderStatus(providerStatus?.status || providerStatus?.state, order.status)

      if (next !== order.status) {
        await updateDoc(doc(db, 'printOrders', order.id), {
          status: next,
          updatedAt: serverTimestamp(),
        })
      }

      const { release } = printFileRelease({ ...order, status: next })
      if (release) await releasePrintFile({ ...order, status: next })

      return next
    } catch (err) {
      devError('Failed to refresh print order status', err)
      return order.status
    }
  }, [user, releasePrintFile])

  return { orders, loading: canQuery ? loading : false, createOrder, refreshStatus, releasePrintFile }
}

export default usePrintOrders
