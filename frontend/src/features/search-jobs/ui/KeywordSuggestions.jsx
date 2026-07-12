import { SearchOutlined } from '@ant-design/icons'

function Highlight({ text, query }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return <span className="text-gray-500">{text}</span>
  return <><span className="text-gray-400">{text.slice(0, index)}</span><span className="font-semibold text-gray-800">{text.slice(index, index + query.length)}</span><span className="text-gray-400">{text.slice(index + query.length)}</span></>
}

export default function KeywordSuggestions({ keyword, onSelect, searchBy, suggestions }) {
  if (suggestions.length === 0) return null

  return <div className="mx-4 mt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Từ khóa gợi ý</p><ul>{suggestions.map((suggestion) => <li key={suggestion}><button type="button" onClick={() => onSelect(suggestion, searchBy)} className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-green-50"><SearchOutlined className="shrink-0 text-gray-300 group-hover:text-[var(--brand-primary)]" /><span className="truncate"><Highlight text={suggestion} query={keyword.trim()} /></span></button></li>)}</ul></div>
}
