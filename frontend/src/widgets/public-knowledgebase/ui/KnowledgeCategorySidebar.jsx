import { BookOutlined, HomeOutlined, RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import {
  KNOWLEDGE_ROOT,
  knowledgeArticlePath,
  knowledgeCategoryPath,
} from '@/entities/knowledgebase'

function withQuery(path, queryString) {
  return queryString ? `${path}?${queryString}` : path
}

export default function KnowledgeCategorySidebar({
  activeSlug,
  categories,
  queryString = '',
  currentArticle,
  relatedArticles = [],
}) {
  return (
    <aside className="knowledge-sidebar" aria-label="Chuyên mục trợ giúp">
      <nav className="knowledge-sidebar__card" aria-label="Chuyên mục trợ giúp">
        <p className="knowledge-sidebar__eyebrow">Khám phá nội dung</p>
        <Link
          to={withQuery(KNOWLEDGE_ROOT, queryString)}
          className={`knowledge-sidebar__item ${!activeSlug ? 'is-active' : ''}`}
          aria-current={!activeSlug ? 'page' : undefined}
        >
          <span className="knowledge-sidebar__icon"><HomeOutlined aria-hidden="true" /></span>
          <span className="knowledge-sidebar__label">Tất cả chủ đề</span>
          <RightOutlined className="knowledge-sidebar__arrow" aria-hidden="true" />
        </Link>
        {categories.map((category) => (
          <Link
            key={category.public_id}
            to={withQuery(knowledgeCategoryPath(category.slug), queryString)}
            className={`knowledge-sidebar__item ${activeSlug === category.slug ? 'is-active' : ''}`}
            aria-current={activeSlug === category.slug ? 'page' : undefined}
          >
            <span className="knowledge-sidebar__icon"><BookOutlined aria-hidden="true" /></span>
            <span className="knowledge-sidebar__label">
              {category.name}
              <small>{category.article_count} bài viết</small>
            </span>
            <RightOutlined className="knowledge-sidebar__arrow" aria-hidden="true" />
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
