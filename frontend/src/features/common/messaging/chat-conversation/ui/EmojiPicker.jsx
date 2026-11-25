import { useState } from 'react'
import { EMOJI_GROUPS } from '../lib/emoji-data'

/** Lazy panel of common emoji; `onPick(emoji)` inserts it at the caret. */
export default function EmojiPicker({ onPick }) {
  const [groupKey, setGroupKey] = useState(EMOJI_GROUPS[0].key)
  const group = EMOJI_GROUPS.find((item) => item.key === groupKey) || EMOJI_GROUPS[0]
  return (
    <div className="pc-emoji">
      <div className="pc-emoji__tabs" role="tablist">
        {EMOJI_GROUPS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === groupKey}
            aria-label={item.label()}
            title={item.label()}
            onClick={() => setGroupKey(item.key)}
            className={`pc-emoji__tab${item.key === groupKey ? ' pc-emoji__tab--active' : ''}`}
          >
            {item.items[0]}
          </button>
        ))}
      </div>
      <div className="pc-emoji__grid" role="tabpanel" aria-label={group.label()}>
        {group.items.map((emoji) => (
          <button key={emoji} type="button" className="pc-emoji__item" onClick={() => onPick(emoji)}>{emoji}</button>
        ))}
      </div>
    </div>
  )
}
