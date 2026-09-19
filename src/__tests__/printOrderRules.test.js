/**
 * Security-rule tests for print orders.
 *
 * A print order records money spent and a real person's home address. The
 * address is encrypted, but the row still says which family ordered what and
 * which print file it used, and the rules are what keep that within the family.
 *
 * Two of these test something the plain family scoping does not cover: that an
 * order cannot be moved to another family or repointed at another provider
 * record after the fact, and that orders cannot be deleted at all.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OTHER_ADMIN = 'uid-other-admin'

// Stands in for encryptJSON() output — the address never lands here in the clear.
const CIPHERTEXT = 'kJ8xQ2hZbGxvV29ybGRUaGlzSXNCYXNlNjQ='

let testEnv

const order = (overrides = {}) => ({
  familyId: FAMILY,
  scrapbookId: 'book-1',
  orderReference: 'kaydo-abc123def456',
  provider: 'peecho',
  status: 'placed',
  quantity: 1,
  pageCount: 24,
  printFilePath: 'printFiles/family-1/book-1/uuid.pdf',
  printFileDeletedAt: null,
  address: CIPHERTEXT,
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-01T10:00:00Z'),
  ...overrides,
})

describe.skipIf(!EMULATOR)('Print order security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-kaydo-print-order-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'families', FAMILY), { adminUid: ADMIN, adminUids: [ADMIN], familyName: 'One' })
      await setDoc(doc(db, 'families', OTHER_FAMILY), { adminUid: OTHER_ADMIN, adminUids: [OTHER_ADMIN], familyName: 'Two' })
      await setDoc(doc(db, 'printOrders', 'order-1'), order())
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore()
  const asOtherAdmin = () => testEnv.authenticatedContext(OTHER_ADMIN).firestore()
  const asViewer = () => testEnv.authenticatedContext('uid-viewer', { familyId: FAMILY, role: 'viewer' }).firestore()
  const asVisitor = () => testEnv.unauthenticatedContext().firestore()

  it('lets the family admin read their own orders', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'printOrders', 'order-1')))
  })

  it('lets the family admin record a new order', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'printOrders', 'order-2'), order()))
  })

  it('lets the family admin advance the status and note the file is gone', async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), 'printOrders', 'order-1'), {
      status: 'shipped',
      printFileDeletedAt: new Date(),
    }))
  })

  it('hides orders from another family’s admin', async () => {
    await assertFails(getDoc(doc(asOtherAdmin(), 'printOrders', 'order-1')))
    await assertFails(updateDoc(doc(asOtherAdmin(), 'printOrders', 'order-1'), { status: 'cancelled' }))
  })

  it('refuses another family’s admin creating an order against our family', async () => {
    await assertFails(setDoc(doc(asOtherAdmin(), 'printOrders', 'order-3'), order()))
  })

  it('hides orders from a viewer, who cannot place one either', async () => {
    await assertFails(getDoc(doc(asViewer(), 'printOrders', 'order-1')))
    await assertFails(setDoc(doc(asViewer(), 'printOrders', 'order-4'), order()))
  })

  it('hides orders from a signed-out visitor', async () => {
    await assertFails(getDoc(doc(asVisitor(), 'printOrders', 'order-1')))
    await assertFails(setDoc(doc(asVisitor(), 'printOrders', 'order-5'), order()))
  })

  it('refuses an order for a family that does not exist', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'printOrders', 'order-6'), order({ familyId: 'no-such-family' })))
  })

  it('refuses moving an existing order to another family', async () => {
    // Otherwise an order — and the print file path on it — could be adopted by
    // whoever can write to the row.
    await assertFails(updateDoc(doc(asAdmin(), 'printOrders', 'order-1'), { familyId: OTHER_FAMILY }))
  })

  it('refuses repointing an order at a different provider record', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'printOrders', 'order-1'), { orderReference: 'kaydo-somethingelse' }))
  })

  it('refuses backdating an order', async () => {
    // createdAt is what the cleanup sweep ages an order out on; moving it
    // forward would keep a plaintext print file alive indefinitely.
    await assertFails(updateDoc(doc(asAdmin(), 'printOrders', 'order-1'), { createdAt: new Date() }))
  })

  it('refuses deleting an order, even by its own family', async () => {
    // Orders are a record of money spent and goods shipped. They are kept.
    await assertFails(deleteDoc(doc(asAdmin(), 'printOrders', 'order-1')))
  })
})
