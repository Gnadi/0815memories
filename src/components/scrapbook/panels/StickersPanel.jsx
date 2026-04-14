import { useState } from 'react'

const STICKER_GROUPS = {
  Hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💖', '💝', '💗', '💓'],
  Nature: ['🌸', '🌺', '🌻', '🌹', '🍃', '🌿', '🌈', '☁️', '⭐', '🌙', '🌞', '🦋'],
  Events: ['🎂', '🎉', '🎊', '🎁', '🎈', '🎗️', '🏆', '🥇', '🎓', '💒', '🎠', '🎡'],
  Family: ['🏠', '🏡', '🚗', '✈️', '🍕', '🍰', '🎶', '📸', '🌅', '🐾', '👶', '🐥'],
  Fun: ['⭐', '✨', '💫', '🌟', '🔥', '🍀', '🦄', '🌺', '🍭', '🎪', '🎨', '🎭'],
}

export default function StickersPanel({ onAddElement }) {
  const [group, setGroup] = useState('Hearts')

  const addSticker = (emoji) => {
    onAddElement({
      type: 'sticker',
      emoji,
      x: 100 + Math.random() * 500,
      y: 100 + Math.random() * 400,
      width: 80,
      height: 80,
      rotation: Math.round((Math.random() - 0.5) * 20),
      stickerSize: 56,
      zIndex: Date.now(),
    })
  }

  return (
    <div className="p-3">
      <div className="flex gap-1 flex-wrap mb-3">
        {Object.keys(STICKER_GROUPS).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              group === g ? 'bg-kaydo text-white' : 'bg-cream text-bark-light hover:bg-cream-dark'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {STICKER_GROUPS[group].map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => addSticker(emoji)}
            className="text-2xl aspect-square flex items-center justify-center rounded-xl hover:bg-cream transition-colors active:scale-90"
            title="Add sticker"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
