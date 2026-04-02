import { useState, useRef } from 'react'
import { Image, Smile, Type, LayoutGrid, Upload, Loader2, Palette, X } from 'lucide-react'

const STICKER_GROUPS = {
  Hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤', '💖', '💝', '💗', '💓'],
  Nature: ['🌸', '🌺', '🌻', '🌹', '🍃', '🌿', '🌈', '☁️', '⭐', '🌙', '🌞', '🦋'],
  Events: ['🎂', '🎉', '🎊', '🎁', '🎈', '🎗️', '🏆', '🥇', '🎓', '💒', '🎠', '🎡'],
  Family: ['🏠', '🏡', '🚗', '✈️', '🍕', '🍰', '🎶', '📸', '🌅', '🐾', '👶', '🐥'],
  Fun: ['⭐', '✨', '💫', '🌟', '🔥', '🍀', '🦄', '🌺', '🍭', '🎪', '🎨', '🎭'],
}

const LAYOUT_PRESETS = [
  {
    id: 'blank',
    label: 'Blank',
    preview: '⬜',
    elements: [],
  },
  {
    id: 'polaroid-scatter',
    label: 'Polaroid Scatter',
    preview: '📸',
    elements: [
      { type: 'photo', x: 60, y: 40, width: 280, height: 320, rotation: -8, polaroid: true, zIndex: 1 },
      { type: 'photo', x: 340, y: 70, width: 260, height: 300, rotation: 5, polaroid: true, zIndex: 2 },
      { type: 'photo', x: 190, y: 280, width: 240, height: 280, rotation: -3, polaroid: true, zIndex: 3 },
    ],
  },
  {
    id: 'two-col',
    label: '2 Column',
    preview: '⬛⬛',
    elements: [
      { type: 'photo', x: 20, y: 20, width: 370, height: 560, rotation: 0, zIndex: 1 },
      { type: 'photo', x: 410, y: 20, width: 370, height: 560, rotation: 0, zIndex: 2 },
    ],
  },
  {
    id: 'strip',
    label: 'Strip',
    preview: '▪▪▪',
    elements: [
      { type: 'photo', x: 20, y: 180, width: 240, height: 240, rotation: 0, zIndex: 1 },
      { type: 'photo', x: 280, y: 180, width: 240, height: 240, rotation: 0, zIndex: 2 },
      { type: 'photo', x: 540, y: 180, width: 240, height: 240, rotation: 0, zIndex: 3 },
    ],
  },
  {
    id: 'full-bleed',
    label: 'Full Bleed',
    preview: '🖼️',
    elements: [
      { type: 'photo', x: 0, y: 0, width: 800, height: 600, rotation: 0, zIndex: 1 },
    ],
  },
  {
    id: 'photo-quote',
    label: 'Photo + Quote',
    preview: '📷✍️',
    elements: [
      { type: 'photo', x: 20, y: 20, width: 380, height: 560, rotation: 0, zIndex: 1 },
      {
        type: 'text',
        x: 430,
        y: 180,
        width: 350,
        height: 240,
        rotation: 0,
        zIndex: 2,
        text: 'Every moment is a treasure we keep forever.',
        fontSize: 28,
        color: '#2D1B0E',
        fontFamily: 'serif',
        fontWeight: 'normal',
        textAlign: 'center',
      },
    ],
  },
]

const BG_COLORS = [
  '#FDF6EC', '#FFFDF9', '#F5E6D0', '#FFF5F5', '#F0FFF4',
  '#EFF6FF', '#FAF5FF', '#FEFCE8', '#F8F8F8', '#2D1B0E',
  '#C25A2E', '#3B5E8A', '#4A7C59', '#7B3F6E',
]

const TEXT_PRESETS = [
  { label: 'Heading', fontSize: 36, fontWeight: 'bold', fontFamily: 'serif', color: '#2D1B0E', textAlign: 'center' },
  { label: 'Quote', fontSize: 24, fontWeight: 'normal', fontFamily: 'serif', color: '#C25A2E', textAlign: 'center' },
  { label: 'Caption', fontSize: 14, fontWeight: 'normal', fontFamily: 'sans', color: '#7A6A5E', textAlign: 'center' },
  { label: 'Date', fontSize: 16, fontWeight: 'bold', fontFamily: 'mono', color: '#2D1B0E', textAlign: 'left' },
  { label: 'Body', fontSize: 18, fontWeight: 'normal', fontFamily: 'sans', color: '#2D1B0E', textAlign: 'left' },
]

const TABS = [
  { id: 'photos', icon: Image, label: 'Photos' },
  { id: 'stickers', icon: Smile, label: 'Stickers' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'layouts', icon: LayoutGrid, label: 'Layouts' },
  { id: 'background', icon: Palette, label: 'BG' },
]

export default function EditorSidebar({ onAddElement, onApplyLayout, onChangeBackground, isMobile, onClose, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'photos')
  const [stickerGroup, setStickerGroup] = useState('Hearts')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const uploadPhoto = async (file) => {
    setUploading(true)
    try {
      const res = await fetch('/api/cloudinary-sign')
      const { timestamp, signature, folder, apiKey } = await res.json()
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo'
      const form = new FormData()
      form.append('file', file)
      form.append('api_key', apiKey)
      form.append('timestamp', timestamp)
      form.append('signature', signature)
      form.append('folder', folder)
      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form,
      })
      const data = await upRes.json()
      if (data.secure_url) {
        onAddElement({
          type: 'photo',
          url: data.secure_url,
          x: 60,
          y: 60,
          width: 300,
          height: 240,
          rotation: 0,
          polaroid: false,
          caption: '',
          zIndex: Date.now(),
        })
      }
    } catch (err) {
      console.error('Upload error', err)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadPhoto(file)
    e.target.value = ''
  }

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

  const addTextBox = (preset) => {
    onAddElement({
      type: 'text',
      text: preset.label === 'Quote' ? '"Your beautiful memory goes here"' : preset.label,
      x: 200,
      y: 200,
      width: 300,
      height: 120,
      rotation: 0,
      ...preset,
      zIndex: Date.now(),
    })
  }

  const applyLayout = (layout) => {
    if (layout.elements.length === 0 || confirm('Replace current page with this layout? Existing elements will be removed.')) {
      onApplyLayout(layout.elements.map((el) => ({ ...el, id: crypto.randomUUID() })))
    }
  }

  return (
    <div className={`flex flex-col ${isMobile ? 'h-full' : 'w-64 h-full border-r border-cream-dark'} bg-warm-white`}>
      {/* Mobile close button */}
      {isMobile && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-sm font-semibold text-bark">Library</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-cream">
            <X className="w-5 h-5 text-bark-muted" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-cream-dark overflow-x-auto hide-scrollbar">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === id
                ? 'text-hearth border-b-2 border-hearth'
                : 'text-bark-muted hover:text-bark'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-3">

        {/* Photos tab */}
        {activeTab === 'photos' && (
          <div className="space-y-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-cream-dark hover:border-hearth hover:bg-hearth/5 text-sm text-bark-light hover:text-hearth transition-colors"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            <p className="text-xs text-bark-muted text-center">Upload a photo to add it to the canvas</p>

            {/* Polaroid variant button */}
            <div className="mt-2">
              <p className="text-xs font-medium text-bark-muted mb-2">Photo Styles</p>
              <div className="grid grid-cols-2 gap-2">
                {[false, true].map((polaroid) => (
                  <button
                    key={String(polaroid)}
                    onClick={() => fileInputRef.current?.click()}
                    className="relative p-2 rounded-lg border border-cream-dark hover:border-hearth bg-cream text-xs text-bark-muted hover:text-hearth transition-colors text-center"
                    title={polaroid ? 'Upload as polaroid' : 'Upload as photo'}
                  >
                    {polaroid ? (
                      <div className="bg-white border border-gray-200 shadow p-1 pb-4 mx-auto w-12 h-14 flex items-center justify-center mb-1">
                        <div className="w-8 h-8 bg-cream-dark rounded-sm" />
                      </div>
                    ) : (
                      <div className="bg-cream-dark rounded mx-auto w-12 h-12 mb-1" />
                    )}
                    {polaroid ? 'Polaroid' : 'Regular'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stickers tab */}
        {activeTab === 'stickers' && (
          <div>
            {/* Group selector */}
            <div className="flex gap-1 flex-wrap mb-3">
              {Object.keys(STICKER_GROUPS).map((g) => (
                <button
                  key={g}
                  onClick={() => setStickerGroup(g)}
                  className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    stickerGroup === g ? 'bg-hearth text-white' : 'bg-cream text-bark-light hover:bg-cream-dark'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div className="grid grid-cols-4 gap-1">
              {STICKER_GROUPS[stickerGroup].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => addSticker(emoji)}
                  className="text-2xl aspect-square flex items-center justify-center rounded-xl hover:bg-cream transition-colors active:scale-90"
                  title="Add sticker"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text tab */}
        {activeTab === 'text' && (
          <div className="space-y-2">
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => addTextBox(preset)}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-cream hover:bg-cream-dark transition-colors"
              >
                <span
                  style={{
                    fontSize: Math.min(preset.fontSize, 20),
                    fontWeight: preset.fontWeight,
                    color: preset.color,
                    fontFamily: preset.fontFamily === 'serif' ? 'Georgia, serif' : preset.fontFamily === 'mono' ? 'monospace' : 'system-ui',
                  }}
                >
                  {preset.label}
                </span>
                <p className="text-[10px] text-bark-muted mt-0.5">{preset.fontSize}px · {preset.fontFamily}</p>
              </button>
            ))}
          </div>
        )}

        {/* Layouts tab */}
        {activeTab === 'layouts' && (
          <div className="grid grid-cols-2 gap-2">
            {LAYOUT_PRESETS.map((layout) => (
              <button
                key={layout.id}
                onClick={() => applyLayout(layout)}
                className="aspect-[4/3] rounded-xl border border-cream-dark hover:border-hearth bg-cream hover:bg-hearth/5 transition-colors flex flex-col items-center justify-center gap-1"
              >
                <span className="text-xl">{layout.preview}</span>
                <span className="text-[10px] text-bark-muted font-medium">{layout.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Background tab */}
        {activeTab === 'background' && (
          <div>
            <p className="text-xs font-medium text-bark-muted mb-2">Color</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onChangeBackground({ backgroundColor: color })}
                  className="aspect-square rounded-lg border-2 border-cream-dark hover:border-hearth transition-colors shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <p className="text-xs font-medium text-bark-muted mb-2">Pattern</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'none', label: 'None' },
                { id: 'dots', label: 'Dots' },
                { id: 'grid', label: 'Grid' },
                { id: 'lines', label: 'Lines' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onChangeBackground({ backgroundPattern: id })}
                  className="py-2 rounded-xl border border-cream-dark hover:border-hearth bg-cream hover:bg-hearth/5 text-xs text-bark-light hover:text-hearth transition-colors font-medium"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
