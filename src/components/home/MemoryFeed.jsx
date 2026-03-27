import MemoryCard from './MemoryCard'

export default function MemoryFeed({ memories, onEdit, onDelete }) {
  if (memories.length === 0) {
    return (
      <section className="mb-8">
        <div className="bg-warm-white rounded-2xl p-8 text-center">
          <p className="text-bark-muted text-lg">No memories yet.</p>
          <p className="text-bark-muted text-sm mt-1">
            Post your first memory to start filling the living room!
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
