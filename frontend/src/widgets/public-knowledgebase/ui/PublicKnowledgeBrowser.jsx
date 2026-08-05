import {
  BookOutlined,
  BulbOutlined,
  CompassOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Empty, Pagination } from 'antd'
import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  KNOWLEDGE_ROOT,
  knowledgeCategoryPath,
} from '@/entities/knowledgebase'
import { KnowledgeSearchBox } from '@/features/search-knowledgebase'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import usePublicKnowledgebase from '../model/use-public-knowledgebase'
import KnowledgeCategorySidebar from './KnowledgeCategorySidebar'
import KnowledgeQuestionList from './KnowledgeQuestionList'
import { KnowledgeError, KnowledgeLoading, KnowledgeNotFound } from './KnowledgeStates'
import './public-knowledgebase.css'

const TYPE_FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'faq', label: 'Câu hỏi thường gặp' },
  { value: 'guide', label: 'Hướng dẫn' },
]

function groupArticles(articles, categories) {
  const groups = new Map()
  articles.forEach((article) => {
    const key = article.category.slug
    const category = categories.find((item) => item.slug === key) || article.category
    if (!groups.has(key)) groups.set(key, { category, articles: [] })
    groups.get(key).articles.push(article)
  })
  return Array.from(groups.values())
}

export default function PublicKnowledgeBrowser({ categorySlug }) {
  const state = usePublicKnowledgebase(categorySlug)
  const groups = useMemo(
    () => groupArticles(state.data.results || [], state.categories),
    [state.categories, state.data.results],
  )
  const canonicalPath = state.activeCategory
    ? knowledgeCategoryPath(state.activeCategory.slug)
    : KNOWLEDGE_ROOT
  const title = state.notFound
    ? 'Nội dung trợ giúp không tồn tại'
    : state.activeCategory?.name || 'Trung tâm trợ giúp'
  const description = state.activeCategory?.description
    || 'Tìm câu trả lời và hướng dẫn sử dụng ProCV dành cho ứng viên.'

  useDocumentMetadata({
    title,
    description,
    canonicalPath,
    robots: 'noindex, nofollow',
  })

  if (state.notFound) return <KnowledgeNotFound title="Chuyên mục trợ giúp không tồn tại" />

  return (
    <div className="knowledge-center">
      <KnowledgeHero search={state.search} statusText={state.statusText} />

      <div className="knowledge-shell">
        <KnowledgeCategorySidebar
          activeSlug={categorySlug}
          categories={state.categories}
          queryString={state.queryString}
        />

        <main className="knowledge-main" aria-busy={state.refreshing}>
          <nav className="knowledge-breadcrumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">›</span>
            {state.activeCategory ? (
              <>
                <Link to={KNOWLEDGE_ROOT}>Trung tâm trợ giúp</Link>
                <span aria-hidden="true">›</span>
                <span aria-current="page">{state.activeCategory.name}</span>
              </>
            ) : (
              <span aria-current="page">Trung tâm trợ giúp</span>
            )}
          </nav>

          <header className="knowledge-content-header">
            <div>
              <p className="knowledge-content-header__overline">
                {state.search.query ? 'Kết quả tìm kiếm' : 'Thư viện trợ giúp'}
              </p>
              <h2>
                {state.search.query
                  ? `Kết quả cho “${state.search.query}”`
                  : state.activeCategory?.name || 'Tìm hiểu theo từng chủ đề'}
              </h2>
              <p>{description}</p>
            </div>
            <span className="knowledge-result-count">
              {state.data.count || 0} nội dung
            </span>
          </header>

          <div className="knowledge-filter" aria-label="Lọc loại nội dung">
            {TYPE_FILTERS.map((item) => (
              <button
                key={item.value || 'all'}
                type="button"
                className={state.type === item.value ? 'is-active' : ''}
                aria-pressed={state.type === item.value}
                onClick={() => state.setType(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {!categorySlug && !state.search.query && !state.type && state.categories.length > 0 && (
            <section className="knowledge-topic-section" aria-labelledby="knowledge-topics-heading">
              <h2 id="knowledge-topics-heading" className="sr-only">Các chủ đề trợ giúp</h2>
              <div className="knowledge-topic-grid">
                {state.categories.map((category, index) => (
                  <Link
                    key={category.public_id}
                    to={knowledgeCategoryPath(category.slug)}
                    className="knowledge-topic-card"
                  >
                    <span className="knowledge-topic-card__icon">
                      {index % 4 === 0 && <CompassOutlined />}
                      {index % 4 === 1 && <SafetyCertificateOutlined />}
                      {index % 4 === 2 && <BulbOutlined />}
                      {index % 4 === 3 && <BookOutlined />}
                    </span>
                    <span className="knowledge-topic-card__copy">
                      <strong>{category.name}</strong>
                      <small>{category.article_count} nội dung</small>
                    </span>
                    <RightOutlined aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {state.loading ? (
            <KnowledgeLoading />
          ) : state.error ? (
            <KnowledgeError onRetry={state.retry} />
          ) : groups.length === 0 ? (
            <div className="knowledge-empty">
              <Empty
                description={state.search.query
                  ? 'Chưa tìm thấy câu trả lời phù hợp với từ khóa này.'
                  : 'Chuyên mục chưa có nội dung công khai.'}
              />
              {(state.search.query || state.type) && (
                <button type="button" onClick={state.resetFilters}>Xóa bộ lọc</button>
              )}
            </div>
          ) : (
            <div className={`knowledge-groups ${state.refreshing ? 'is-refreshing' : ''}`}>
              {groups.map((group) => (
                <section key={group.category.slug} className="knowledge-group" aria-labelledby={`knowledge-${group.category.slug}`}>
                  <div className="knowledge-group__heading">
                    <div>
                      <h2 id={`knowledge-${group.category.slug}`}>{group.category.name}</h2>
                      {!categorySlug && <p>{group.category.description}</p>}
                    </div>
                    {!categorySlug && (
                      <Link to={knowledgeCategoryPath(group.category.slug)}>
                        Xem chuyên mục <RightOutlined />
                      </Link>
                    )}
                  </div>
                  <KnowledgeQuestionList articles={group.articles} />
                </section>
              ))}
            </div>
          )}

          {state.data.count > state.pageSize && (
            <Pagination
              className="knowledge-pagination"
              current={state.page}
              pageSize={state.pageSize}
              total={state.data.count}
              showSizeChanger={false}
              onChange={state.setPage}
              aria-label="Phân trang nội dung trợ giúp"
            />
          )}
        </main>
      </div>
    </div>
  )
}

function KnowledgeHero({ search, statusText }) {
  return (
    <header className="knowledge-hero">
      <div className="knowledge-hero__glow knowledge-hero__glow--left" />
      <div className="knowledge-hero__glow knowledge-hero__glow--right" />
      <div className="knowledge-hero__inner">
        <span className="knowledge-hero__badge">TRUNG TÂM HỖ TRỢ PROCV</span>
        <h1>Chúng tôi có thể giúp gì cho bạn?</h1>
        <p>Tìm câu trả lời rõ ràng, từng bước và luôn được đội ngũ nội dung kiểm duyệt.</p>
        <KnowledgeSearchBox search={search} statusText={statusText} />
        {search.tooShort && (
          <p className="knowledge-search-hint">Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm.</p>
        )}
      </div>
    </header>
  )
}
