/* The demo family's in-memory database stands in for Firestore in a demo tab,
   behind config/firestore.js. The app's hooks run against it unchanged, so it
   has to answer the way Firestore does where the app can tell the difference:
   which documents a query returns and in what order, what a write stores, when
   a listener is called, and which documents the time locks keep shut. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { createDemoDatabase } from '../demo/demoDatabase'

const UID = 'visitor'
const PARTNER = 'partner'
const DB = { demo: true }

const ts = (iso) => Timestamp.fromDate(new Date(iso))
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(documents = []) {
  return createDemoDatabase({ documents, uid: UID })
}

const ids = (snapshot) => snapshot.docs.map((d) => d.id)

describe('demo database: references', () => {
  it('builds collection and document paths, subcollections included', () => {
    const fs = setup()
    expect(fs.collection(DB, 'memories').path).toBe('memories')
    expect(fs.doc(DB, 'families', 'f1').path).toBe('families/f1')
    expect(fs.collection(DB, 'families', 'f1', 'admins').path).toBe('families/f1/admins')
    expect(fs.doc(DB, 'families', 'f1', 'admins', 'u1').path).toBe('families/f1/admins/u1')
    expect(fs.doc(fs.collection(DB, 'families'), 'f1').path).toBe('families/f1')
    expect(fs.collection(fs.doc(DB, 'families', 'f1'), 'invites').path).toBe('families/f1/invites')
  })

  it('gives a document with no id a fresh one', () => {
    const fs = setup()
    const a = fs.doc(fs.collection(DB, 'blackbox'))
    const b = fs.doc(fs.collection(DB, 'blackbox'))
    expect(a.id).toMatch(/^[A-Za-z0-9]{20}$/)
    expect(a.id).not.toBe(b.id)
    expect(a.parent.path).toBe('blackbox')
  })

  it('refuses a path of the wrong kind', () => {
    const fs = setup()
    expect(() => fs.collection(DB, 'families', 'f1')).toThrow()
    expect(() => fs.doc(DB, 'families')).toThrow()
  })
})

describe('demo database: queries', () => {
  const documents = [
    ['memories/a', { familyId: 'f1', date: ts('2024-03-01'), title: 'A', tags: ['beach'] }],
    ['memories/b', { familyId: 'f1', date: ts('2023-08-15'), title: 'B', tags: ['snow'] }],
    ['memories/c', { familyId: 'f1', date: ts('2024-11-28'), title: 'C' }],
    ['memories/d', { familyId: 'f2', date: ts('2024-05-05'), title: 'D' }],
    // No date: Firestore leaves it out of anything ordered or filtered by date.
    ['memories/e', { familyId: 'f1', title: 'E' }],
    ['families/f1/admins/u1', { email: 'a@example.com' }],
  ]

  it('filters, orders and limits like Firestore', async () => {
    const fs = setup(documents)
    const q = fs.query(
      fs.collection(DB, 'memories'),
      fs.where('familyId', '==', 'f1'),
      fs.orderBy('date', 'desc'),
      fs.limit(2),
    )
    expect(ids(await fs.getDocs(q))).toEqual(['c', 'a'])
  })

  it('leaves documents without the ordered field out', async () => {
    const fs = setup(documents)
    const q = fs.query(fs.collection(DB, 'memories'), fs.where('familyId', '==', 'f1'), fs.orderBy('date'))
    expect(ids(await fs.getDocs(q))).toEqual(['b', 'a', 'c'])
  })

  it('matches range filters on values of the same type only', async () => {
    const fs = setup(documents)
    const q = fs.query(
      fs.collection(DB, 'memories'),
      fs.where('date', '>=', ts('2024-01-01')),
      fs.where('date', '<', ts('2024-06-01')),
    )
    expect(ids(await fs.getDocs(q))).toEqual(['a', 'd'])
  })

  it('knows array-contains, in and !=', async () => {
    const fs = setup(documents)
    const memories = fs.collection(DB, 'memories')
    expect(ids(await fs.getDocs(fs.query(memories, fs.where('tags', 'array-contains', 'snow'))))).toEqual(['b'])
    expect(ids(await fs.getDocs(fs.query(memories, fs.where('title', 'in', ['A', 'D']))))).toEqual(['a', 'd'])
    expect(ids(await fs.getDocs(fs.query(memories, fs.where('familyId', '!=', 'f1'))))).toEqual(['d'])
  })

  it('only returns documents of the collection asked for', async () => {
    const fs = setup(documents)
    expect(ids(await fs.getDocs(fs.collection(DB, 'families', 'f1', 'admins')))).toEqual(['u1'])
    expect((await fs.getDocs(fs.collection(DB, 'families'))).empty).toBe(true)
  })

  it('pages with startAfter a snapshot', async () => {
    const fs = setup(documents)
    const ordered = fs.query(fs.collection(DB, 'memories'), fs.orderBy('date'), fs.limit(2))
    const first = await fs.getDocs(ordered)
    expect(ids(first)).toEqual(['b', 'a'])
    const next = await fs.getDocs(fs.query(ordered, fs.startAfter(first.docs[1])))
    expect(ids(next)).toEqual(['d', 'c'])
  })

  it('counts', async () => {
    const fs = setup(documents)
    const q = fs.query(fs.collection(DB, 'memories'), fs.where('familyId', '==', 'f1'))
    expect((await fs.getCountFromServer(q)).data().count).toBe(4)
  })

  it('throws on an operator it does not know rather than answer wrongly', async () => {
    const fs = setup(documents)
    const q = fs.query(fs.collection(DB, 'memories'), fs.where('title', 'like', 'A'))
    await expect(fs.getDocs(q)).rejects.toThrow(/like/)
  })
})

describe('demo database: writes', () => {
  it('stores Dates and server timestamps as Timestamps', async () => {
    const fs = setup()
    const ref = await fs.addDoc(fs.collection(DB, 'moments'), {
      caption: 'Pancakes',
      date: new Date('2024-12-01T08:00:00Z'),
      createdAt: fs.serverTimestamp(),
    })
    const data = (await fs.getDoc(ref)).data()
    expect(data.date).toBeInstanceOf(Timestamp)
    expect(data.date.toDate().toISOString()).toBe('2024-12-01T08:00:00.000Z')
    expect(data.createdAt).toBeInstanceOf(Timestamp)
  })

  it('replaces on set, merges maps on set with merge', async () => {
    const fs = setup([['families/f1', { familyName: 'Bennett', design: { color: 'red', font: 'serif' } }]])
    const ref = fs.doc(DB, 'families', 'f1')

    await fs.setDoc(ref, { design: { color: 'blue' }, slug: 'bennetts' }, { merge: true })
    expect((await fs.getDoc(ref)).data()).toEqual({
      familyName: 'Bennett',
      design: { color: 'blue', font: 'serif' },
      slug: 'bennetts',
    })

    await fs.setDoc(ref, { familyName: 'Other' })
    expect((await fs.getDoc(ref)).data()).toEqual({ familyName: 'Other' })
  })

  it('updates field paths and applies field values', async () => {
    const fs = setup([['ourYearChapters/c1', { keepsakes: { quote: 'q' }, submittedBy: ['a'], old: 1 }]])
    const ref = fs.doc(DB, 'ourYearChapters', 'c1')
    await fs.updateDoc(ref, {
      'keepsakes.song': 'Harvest Moon',
      submittedBy: fs.arrayUnion('a', 'b'),
      old: fs.deleteField(),
    })
    expect((await fs.getDoc(ref)).data()).toEqual({
      keepsakes: { quote: 'q', song: 'Harvest Moon' },
      submittedBy: ['a', 'b'],
    })
    await fs.updateDoc(ref, 'submittedBy', fs.arrayRemove('a'))
    expect((await fs.getDoc(ref)).get('submittedBy')).toEqual(['b'])
  })

  it('refuses what Firestore refuses', async () => {
    const fs = setup()
    await expect(fs.updateDoc(fs.doc(DB, 'memories', 'missing'), { title: 'x' }))
      .rejects.toMatchObject({ code: 'not-found' })
    await expect(fs.setDoc(fs.doc(DB, 'memories', 'm'), { title: undefined }))
      .rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('hands every reader its own copy', async () => {
    const fs = setup([['memories/a', { images: ['/a.webp'] }]])
    const ref = fs.doc(DB, 'memories', 'a')
    const first = (await fs.getDoc(ref)).data()
    first.images.push('/b.webp')
    expect((await fs.getDoc(ref)).data().images).toEqual(['/a.webp'])
  })

  it('applies a batch all at once, or not at all', async () => {
    const fs = setup()
    const failing = fs.writeBatch(DB)
    failing.set(fs.doc(DB, 'collages', 'x'), { title: 'Summer' })
    failing.update(fs.doc(DB, 'highlights', 'missing'), { title: 'Reel' })
    await expect(failing.commit()).rejects.toMatchObject({ code: 'not-found' })
    expect((await fs.getDoc(fs.doc(DB, 'collages', 'x'))).exists()).toBe(false)

    const batch = fs.writeBatch(DB)
    batch.set(fs.doc(DB, 'collages', 'x'), { title: 'Summer' })
    batch.set(fs.doc(DB, 'highlights', 'y'), { title: 'Reel' })
    await batch.commit()
    expect((await fs.getDoc(fs.doc(DB, 'collages', 'x'))).exists()).toBe(true)
    expect((await fs.getDoc(fs.doc(DB, 'highlights', 'y'))).exists()).toBe(true)
  })

  it('runs a transaction against what is stored', async () => {
    const fs = setup([['counters/c', { value: 1 }]])
    const ref = fs.doc(DB, 'counters', 'c')
    const result = await fs.runTransaction(DB, async (tx) => {
      const snap = await tx.get(ref)
      tx.update(ref, { value: snap.data().value + 1 })
      return 'done'
    })
    expect(result).toBe('done')
    expect((await fs.getDoc(ref)).get('value')).toBe(2)
  })
})

describe('demo database: listeners', () => {
  afterEach(() => vi.useRealTimers())

  it('answers asynchronously, then again whenever the answer changes', async () => {
    const fs = setup([['children/emma', { familyId: 'f1', name: 'Emma', createdAt: ts('2023-01-02') }]])
    const q = fs.query(fs.collection(DB, 'children'), fs.where('familyId', '==', 'f1'), fs.orderBy('createdAt'))
    const seen = []
    const unsubscribe = fs.onSnapshot(q, (snap) => seen.push(snap.docs.map((d) => d.data().name)))
    expect(seen).toEqual([])

    await flush()
    expect(seen).toEqual([['Emma']])

    await fs.addDoc(fs.collection(DB, 'children'), { familyId: 'f1', name: 'Leo', createdAt: ts('2023-01-03') })
    await flush()
    expect(seen).toEqual([['Emma'], ['Emma', 'Leo']])

    // A write the query does not see changes nothing for it.
    await fs.addDoc(fs.collection(DB, 'children'), { familyId: 'f2', name: 'Other', createdAt: ts('2023-01-04') })
    await flush()
    expect(seen).toHaveLength(2)

    unsubscribe()
    await fs.addDoc(fs.collection(DB, 'children'), { familyId: 'f1', name: 'Mia', createdAt: ts('2023-01-05') })
    await flush()
    expect(seen).toHaveLength(2)
  })

  it('takes an observer, and listen options in front of it', async () => {
    const fs = setup([['families/f1', { familyName: 'Bennett' }]])
    const next = vi.fn()
    fs.onSnapshot(fs.doc(DB, 'families', 'f1'), { includeMetadataChanges: false }, { next })
    await flush()
    expect(next).toHaveBeenCalledTimes(1)
    expect(next.mock.calls[0][0].data()).toEqual({ familyName: 'Bennett' })
  })

  it('reports a document that does not exist as such', async () => {
    const fs = setup()
    const next = vi.fn()
    fs.onSnapshot(fs.doc(DB, 'ourYearEntries', 'c1_reflection_visitor'), next)
    await flush()
    expect(next.mock.calls[0][0].exists()).toBe(false)
  })
})

describe('demo database: the time locks from firestore.rules', () => {
  const NOW = new Date('2026-06-01T12:00:00Z')
  const past = ts('2026-01-01')
  const future = ts('2030-01-01')

  afterEach(() => vi.useRealTimers())

  function lockedSetup() {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    return setup([
      ['blackbox/open', { familyId: 'f1', unlockDate: past }],
      ['blackboxContent/open', { familyId: 'f1', message: 'Opened' }],
      ['blackbox/sealed', { familyId: 'f1', unlockDate: future }],
      ['blackboxContent/sealed', { familyId: 'f1', message: 'Not yet' }],
      ['blackbox/undated', { familyId: 'f1', unlockDate: null }],
      ['blackboxContent/undated', { familyId: 'f1', message: 'Never' }],
      ['ourYearLetters/opened', { participantUids: [UID, PARTNER], sealedAt: past, openAt: past, sections: {} }],
      ['ourYearLetters/sealed', { participantUids: [UID, PARTNER], sealedAt: past, openAt: future, sections: {} }],
      ['ourYearLetters/draft', { participantUids: [UID, PARTNER], sealedAt: null, sections: {} }],
      ['ourYearEntries/c1_quiz_visitor', { participantUids: [UID, PARTNER], authorUid: UID, revealed: false }],
      ['ourYearEntries/c1_quiz_partner', { participantUids: [UID, PARTNER], authorUid: PARTNER, revealed: false }],
      ['ourYearEntries/c0_quiz_partner', { participantUids: [UID, PARTNER], authorUid: PARTNER, revealed: true }],
    ])
  }

  it('keeps a capsule letter shut until its unlock date', async () => {
    const fs = lockedSetup()
    expect((await fs.getDoc(fs.doc(DB, 'blackboxContent', 'open'))).get('message')).toBe('Opened')
    await expect(fs.getDoc(fs.doc(DB, 'blackboxContent', 'sealed'))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(fs.getDoc(fs.doc(DB, 'blackboxContent', 'undated'))).rejects.toMatchObject({ code: 'permission-denied' })
    // Absent content reads as absent, which is how a pre-split capsule is told apart.
    expect((await fs.getDoc(fs.doc(DB, 'blackboxContent', 'none'))).exists()).toBe(false)
  })

  it('keeps a sealed letter to the future shut until it opens', async () => {
    const fs = lockedSetup()
    expect((await fs.getDoc(fs.doc(DB, 'ourYearLetters', 'opened'))).exists()).toBe(true)
    expect((await fs.getDoc(fs.doc(DB, 'ourYearLetters', 'draft'))).exists()).toBe(true)
    await expect(fs.getDoc(fs.doc(DB, 'ourYearLetters', 'sealed'))).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it("hides the partner's answers until they are revealed", async () => {
    const fs = lockedSetup()
    expect((await fs.getDoc(fs.doc(DB, 'ourYearEntries', 'c1_quiz_visitor'))).exists()).toBe(true)
    expect((await fs.getDoc(fs.doc(DB, 'ourYearEntries', 'c0_quiz_partner'))).exists()).toBe(true)
    await expect(fs.getDoc(fs.doc(DB, 'ourYearEntries', 'c1_quiz_partner'))).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('ends a listener that is refused, with the error', async () => {
    const fs = lockedSetup()
    const next = vi.fn()
    const error = vi.fn()
    fs.onSnapshot(fs.doc(DB, 'ourYearLetters', 'sealed'), next, error)
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
    expect(next).not.toHaveBeenCalled()
    expect(error.mock.calls[0][0].code).toBe('permission-denied')
  })

  it('refuses a whole query when one result is locked', async () => {
    const fs = lockedSetup()
    const all = fs.collection(DB, 'ourYearEntries')
    await expect(fs.getDocs(all)).rejects.toMatchObject({ code: 'permission-denied' })
    const own = fs.query(all, fs.where('authorUid', '==', UID))
    expect(ids(await fs.getDocs(own))).toEqual(['c1_quiz_visitor'])
  })
})
