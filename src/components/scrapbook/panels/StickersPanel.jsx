import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const STICKER_GROUPS = {
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💖', '💝', '💗', '💓'],
  nature: ['🌸', '🌺', '🌻', '🌹', '🍃', '🌿', '🌈', '☁️', '⭐', '🌙', '🌞', '🦋'],
  events: ['🎂', '🎉', '🎊', '🎁', '🎈', '🎗️', '🏆', '🥇', '🎓', '💒', '🎠', '🎡'],
  family: ['🏠', '🏡', '🚗', '✈️', '🍕', '🍰', '🎶', '📸', '🌅', '🐾', '👶', '🐥'],
  fun: ['⭐', '✨', '💫', '🌟', '🔥', '🍀', '🦄', '🌺', '🍭', '🎪', '🎨', '🎭'],
}

// Scattered and tilted a little, so stickers added in a row do not stack
// exactly; newest on top. Out here because it is random: the React purity lint
// cannot tell that a function in the component body only ever runs on a click.
function stickerElement(emoji) {
  return {
    type: 'sticker',
    emoji,
    x: 100 + Math.random() * 500,
    y: 100 + Math.random() * 400,
    width: 80,
    height: 80,
    rotation: Math.round((Math.random() - 0.5) * 20),
    stickerSize: 56,
    zIndex: Date.now(),
  }
}

export default function StickersPanel({ onAddElement }) {
  const { t } = useTranslation('scrapbook')
  const [group, setGroup] = useState('hearts')

  const addSticker = (emoji) => onAddElement(stickerElement(emoji))

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
            {t(`stickers.groups.${g}`)}
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
            title={t('stickers.addSticker')}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
