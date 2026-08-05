import { Link } from 'react-router'
import {
  knowledgeArticlePath,
  knowledgeCategoryPath,
} from '@/entities/knowledgebase'

export default function KnowledgeCategorySidebar({
  activeSlug,
  categories,
  currentArticle,
  relatedArticles = [],
}) {
  return (
    <aside className="knowledge-sidebar" aria-label="Chuyên mục trợ giúp">
      <nav className="knowledge-sidebar__card" aria-label="Chuyên mục trợ giúp">
        <p className="knowledge-sidebar__eyebrow">Chuyên mục</p>
        {categories.map((category) => (
          <Link
            key={category.public_id}
            to={knowledgeCategoryPath(category.slug)}
            className={`knowledge-sidebar__item ${activeSlug === category.slug ? 'is-active' : ''}`}
            aria-current={activeSlug === category.slug ? 'page' : undefined}
          >
            <span className="knowledge-sidebar__label">{category.name}</span>
          </Link>
        ))}
      </nav>

      {currentArticle && (
        <nav className="knowledge-sidebar__card knowledge-sidebar__questions" aria-label="Bài trong chuyên mục">
          <p className="knowledge-sidebar__eyebrow">Trong chuyên mục này</p>
          <Link
            to={knowledgeArticlePath(currentArticle)}
            className="knowledge-sidebar__question is-current"
            aria-current="page"
          >
            {currentArticle.title}
          </Link>
          {relatedArticles.map((article) => (
            <Link
              key={article.public_id}
              to={knowledgeArticlePath(article)}
              className="knowledge-sidebar__question"
            >
              {article.title}
            </Link>
          ))}
        </nav>
      )}
    </aside>
  )
}
