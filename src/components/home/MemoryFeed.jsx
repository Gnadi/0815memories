import { useTranslation } from 'react-i18next'
import MemoryCard from './MemoryCard'
import useMediaQuery from '../../hooks/useMediaQuery'

// Wide enough for two columns of cards that are still close to the ~44rem the
// single-column feed shows them at, so photos don't shrink into thumbnails.
const WIDE_FEED_QUERY = '(min-width: 88rem)'

// Cards lift on hover so the whole card reads as clickable. They become
// positioned and rise above their neighbours while hovered: the lift creates a
// stacking context, and an open admin menu must not slide under the next card.
const COLUMN_CLASS =
  'flex flex-col lg:[&>*]:relative lg:[&>*]:transition-[translate,rotate,box-shadow] lg:[&>*]:duration-200 lg:[&>*:hover]:z-10 lg:[&>*:hover]:-translate-y-1'

export default function MemoryFeed({ memories, onEdit, onDelete }) {
  const { t } = useTranslation('home')
  // Splitting in JS rather than hiding one of two layouts with a breakpoint:
  // a hidden copy would still mount and decrypt every card's photos.
  const wide = useMediaQuery(WIDE_FEED_QUERY)

  if (memories.length === 0) {
    return (
      <section className="mb-8 mx-auto w-full max-w-[44rem]">
        <div className="bg-warm-white rounded-2xl p-8 text-center">
          <p className="text-bark-muted text-lg">{t('feed.empty.heading')}</p>
          <p className="text-bark-muted text-sm mt-1">
            {t('feed.empty.body')}
          </p>
        </div>
      </section>
    )
  }

  const renderCard = (memory) => (
    <MemoryCard
      key={memory.id}
      memory={memory}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )

  if (!wide) {
    return (
      <section className="mb-8 mx-auto w-full max-w-[44rem]">
        <div className={`${COLUMN_CLASS} gap-6`}>
          {memories.map(renderCard)}
        </div>
      </section>
    )
  }

  // Newest first, alternating left and right, with the right column dropped
  // half a card so the feed zigzags down the page like a pinboard while still
  // reading in date order.
  const left = memories.filter((_, i) => i % 2 === 0)
  const right = memories.filter((_, i) => i % 2 === 1)

  return (
    <section className="mb-8 grid grid-cols-2 gap-10 items-start">
      <div className={`${COLUMN_CLASS} gap-10`}>{left.map(renderCard)}</div>
      <div className={`${COLUMN_CLASS} gap-10 pt-40`}>{right.map(renderCard)}</div>
    </section>
  )
}
