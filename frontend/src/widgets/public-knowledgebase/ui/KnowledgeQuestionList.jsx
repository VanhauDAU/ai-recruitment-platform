import { RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { knowledgeArticlePath, knowledgeTypeLabel } from '@/entities/knowledgebase'

export default function KnowledgeQuestionList({ articles }) {
  return (
    <ul className="knowledge-question-list">
      {articles.map((article) => (
        <li key={article.public_id}>
          <Link to={knowledgeArticlePath(article)} className="knowledge-question">
            <span className="knowledge-question__content">
              <span className="knowledge-question__title">{article.title}</span>
              <span className="knowledge-question__meta">
                {knowledgeTypeLabel(article.article_type)}
                {article.excerpt ? ` · ${article.excerpt}` : ''}
              </span>
            </span>
            <RightOutlined className="knowledge-question__arrow" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
