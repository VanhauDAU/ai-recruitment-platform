import { RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { knowledgeArticlePath } from '@/entities/knowledgebase'
import { knowledgeMatchRanges } from '../lib/knowledge-text'

function HighlightedText({ text, query }) {
  const ranges = knowledgeMatchRanges(text, query)
  if (!ranges.length) return text

  const parts = []
  let cursor = 0
  ranges.forEach(([start, end]) => {
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(<mark key={`${start}-${end}`}>{text.slice(start, end)}</mark>)
    cursor = end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export default function KnowledgeQuestionList({ articles, query = '' }) {
  const showExcerpt = Boolean(query.trim())
  return (
    <ul className="knowledge-question-list">
      {articles.map((article) => (
        <li key={article.public_id}>
          <Link to={knowledgeArticlePath(article)} className="knowledge-question">
            <span className="knowledge-question__content">
              <span className="knowledge-question__title">
                <HighlightedText text={article.title} query={query} />
              </span>
              {showExcerpt && article.excerpt && (
                <span className="knowledge-question__excerpt" title={article.excerpt}>
                  <HighlightedText text={article.excerpt} query={query} />
                </span>
              )}
            </span>
            <RightOutlined className="knowledge-question__arrow" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
