// Bảng emoji Unicode tự dựng (không CDN, không thư viện): chỉ tải khi mở bảng.
import { m } from '@/shared/config/i18n'

// Tách theo grapheme để giữ nguyên emoji ghép (ZWJ, biến thể ️).
const split = (value) => (typeof Intl.Segmenter === 'function'
  ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map((part) => part.segment)
  : Array.from(value))

export const EMOJI_GROUPS = [
  {
    key: 'smileys',
    label: m.connect_emoji_smileys,
    emoji: '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😋😛😜🤪🤗🤭🤫🤔🤨😐😑😶😏😒🙄😬😌😔😴😷🥳😎🤓🧐😕😟🙁😮😲😳🥺😢😭😱😖😞😓😩😤😡',
  },
  {
    key: 'gestures',
    label: m.connect_emoji_gestures,
    emoji: '👍👎👌✌️🤞🤟🤘🤙👈👉👆👇☝️✋🤚🖐️👋🤝🙏👏🙌👐🤲💪✍️🫶🙋‍♂️🙋‍♀️🙆🙇',
  },
  {
    key: 'work',
    label: m.connect_emoji_work,
    emoji: '💼📁📂📄📝📌📎✏️🖊️📅📆⏰⌛📊📈📉💻🖥️⌨️🖨️📱☎️📞📧✉️📨🏢🎓🏆🥇🎯🚀💡🔍🔑🗂️🧾💰👨‍💻👩‍💻',
  },
  {
    key: 'symbols',
    label: m.connect_emoji_symbols,
    emoji: '❤️🧡💛💚💙💜🖤🤍💯✅☑️✔️❌❗❓⚠️⭐🌟✨🔥🎉🎊🎁💬💭👀🆗🆕🔔',
  },
  {
    key: 'nature',
    label: m.connect_emoji_nature,
    emoji: '☀️🌤️⛅🌧️🌈🌸🌻🌹🍀🌱☕🍵🍜🍕🍰🎂🍎🍉🥂🎈',
  },
].map((group) => ({ ...group, items: split(group.emoji) }))
