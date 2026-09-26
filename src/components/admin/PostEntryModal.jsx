import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMemoryWriter, useMomentWriter, useEntryConverter } from '../../hooks/useMemories'
import PostMemoryModal from './PostMemoryModal'
import PostMomentModal from './PostMomentModal'

/**
 * The memory and moment post modals behind one "Memory / Moment" switch.
 *
 * `type` is what the caller opened ('memory' or 'moment'), and `entry` the
 * existing document when editing. While the switch sits on that type, this is
 * exactly the caller's modal and `onSave` is the caller's handler. Flipped to
 * the other type, the other modal opens pre-filled from the form, and saving it
 * either creates a new entry of that type or, when editing, converts the entry:
 * the new document replaces the old one. `onConverted(type, id)` reports that.
 *
 * The remaining props (`defaults`, `initialFiles`) go to the memory modal.
 */
export default function PostEntryModal({ type, entry, onClose, onSave, onConverted, ...rest }) {
  const { familyId, encryptionKey } = useAuth()
  const { addMemory } = useMemoryWriter(familyId, encryptionKey)
  const { addMoment } = useMomentWriter(familyId)
  const { convertMemoryToMoment, convertMomentToMemory } = useEntryConverter(familyId, encryptionKey)

  // The type on screen, and the form handed over by the last switch.
  const [current, setCurrent] = useState(type)
  const [draft, setDraft] = useState(null)

  const switchTo = (nextType) => (nextDraft) => {
    setDraft(nextDraft)
    setCurrent(nextType)
  }

  const isOriginal = current === type
  const converting = !isOriginal && !!entry?.id

  // Back on the original type while editing, the entry itself is shown again —
  // a draft carries no id and would turn the edit into a second copy.
  const shared = {
    draft: isOriginal && entry ? undefined : draft || undefined,
    converting,
    onClose,
  }

  if (current === 'memory') {
    const handleSave = isOriginal
      ? onSave
      : converting
        ? async (data) => {
            // Not folded into `onConverted?.(...)`: optional chaining skips the
            // arguments too, so the conversion would never run without a callback.
            const id = await convertMomentToMemory(entry.id, data)
            onConverted?.('memory', id)
          }
        : addMemory
    // `rest` is only for the first opening: once a draft exists it already holds
    // the uploaded `initialFiles`, and passing them again would upload them twice.
    return (
      <PostMemoryModal
        key="memory"
        {...(draft ? {} : rest)}
        {...shared}
        memory={isOriginal ? entry : undefined}
        onSave={handleSave}
        onSwitchType={switchTo('moment')}
      />
    )
  }

  const handleSave = isOriginal
    ? onSave
    : converting
      ? async (data) => {
          const id = await convertMemoryToMoment(entry.id, data, entry.date)
          onConverted?.('moment', id)
        }
      : addMoment
  return (
    <PostMomentModal
      key="moment"
      {...shared}
      moment={isOriginal ? entry : undefined}
      onSave={handleSave}
      onSwitchType={switchTo('memory')}
    />
  )
}
