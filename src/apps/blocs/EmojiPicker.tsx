import { useState } from 'react'

export const ICON_COLORS = [
  'transparent', '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#e2e8f0'
]

export const EMOJIS = [
  '▦','📄','📝','📓','✅','⭐','🔥','💡','📌','🗂️','🧠','🎯','🚀','🌱','🏠','📚',
  '🎨','🔒','❤️','🐰','🌙','⚡','🧩','☕','🍀','🌊','⛰️','🎵','🎮','💻','📷','🔧','🧪',
  '🏆','🎁','🛒','✈️','🚗','⏰','🔔','💬','📊','🗺️','🧭','🔍','💰','📈','🗓️','📌','🖊️',
  '🧲','🛠️','🪄','👑','🎭','🎪','🧸','🪁','🛸','🌵','🍄','🐝','🦊','🐙','🦄','🍉','🥑'
]

export default function EmojiPicker({
  currentColor,
  onPick,
  onClear
}: {
  currentColor?: string | null
  onPick: (emoji: string, color: string) => void
  onClear: () => void
}) {
  const [color, setColor] = useState(currentColor ?? 'transparent')
  return (
    <div className="emoji-pop">
      <div className="emoji-colors">
        {ICON_COLORS.map((c) => (
          <button
            key={c}
            className={`emoji-color${color === c ? ' active' : ''}`}
            style={c === 'transparent' ? { background: 'repeating-conic-gradient(#475569 0% 25%, transparent 0% 50%)', backgroundSize: '8px 8px' } : { backgroundColor: c }}
            title={c === 'transparent' ? 'Sans fond' : c}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className="emoji-grid">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => onPick(e, color)}>
            {e}
          </button>
        ))}
      </div>
      <button className="emoji-clear" onClick={onClear}>
        ✕ Retirer l’icône
      </button>
    </div>
  )
}
