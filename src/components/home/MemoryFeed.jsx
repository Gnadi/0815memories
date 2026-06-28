import { useTranslation } from 'react-i18next'
import MemoryCard from './MemoryCard'

export default function MemoryFeed({ memories, onEdit, onDelete }) {
  const { t } = useTranslation('home')
  if (memories.length === 0) {
    return (
      <section className="mb-8">
        <div className="bg-warm-white rounded-2xl p-8 text-center">
          <p className="text-bark-muted text-lg">{t('feed.empty.heading')}</p>
          <p className="text-bark-muted text-sm mt-1">
            {t('feed.empty.body')}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <div className="grid grid-cols-1 gap-6">
        {memories.map((memory) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  )
}
