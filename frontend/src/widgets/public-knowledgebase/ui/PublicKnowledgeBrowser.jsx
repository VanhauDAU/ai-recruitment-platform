import { SearchOutlined } from '@ant-design/icons'
import { Empty, Pagination } from 'antd'
import { useMemo, useState } from 'react'
import {
  KNOWLEDGE_ROOT,
  knowledgeCategoryPath,
} from '@/entities/knowledgebase'
import { useSiteSettings } from '@/entities/site-settings'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import { foldKnowledgeText } from '../lib/knowledge-text'
import usePublicKnowledgebase from '../model/use-public-knowledgebase'
import KnowledgeCategorySidebar from './KnowledgeCategorySidebar'
import KnowledgeQuestionList from './KnowledgeQuestionList'
import { KnowledgeError, KnowledgeLoading, KnowledgeNotFound } from './KnowledgeStates'
import './public-knowledgebase.css'

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
  const [filter, setFilter] = useState('')
  const { settings } = useSiteSettings()
  const state = usePublicKnowledgebase(categorySlug)
  const groups = useMemo(
    () => groupArticles(state.data.results || [], state.categories),
    [state.categories, state.data.results],
  )
  const visibleGroups = useMemo(() => {
    const query = foldKnowledgeText(filter.trim())
    if (!query) return groups
    return groups
      .map((group) => ({
        ...group,
        articles: group.articles.filter((article) => (
          foldKnowledgeText(`${article.title} ${article.excerpt || ''}`).includes(query)
        )),
      }))
      .filter((group) => group.articles.length > 0)
  }, [filter, groups])
  const canonicalPath = state.activeCategory
    ? knowledgeCategoryPath(state.activeCategory.slug)
    : KNOWLEDGE_ROOT
  const title = state.notFound
    ? 'Nội dung trợ giúp không tồn tại'
    : state.activeCategory?.name || 'Câu hỏi thường gặp'
  const description = state.activeCategory?.description
    || 'Giải đáp những câu hỏi thường gặp khi sử dụng ProCV.'
  const allowIndex = !state.notFound
    && !state.hasIndexingParameters
    && settings.knowledgebase_public_enabled === true
    && settings.knowledgebase_search_index_enabled === true
    && settings.seo_robots_index !== false

  useDocumentMetadata({
    title,
    description,
    canonicalPath,
    robots: allowIndex ? 'index, follow' : 'noindex, nofollow',
  })

  if (state.notFound) return <KnowledgeNotFound title="Chuyên mục trợ giúp không tồn tại" />

  return (
    <div className="knowledge-center">
      <div className="knowledge-shell knowledge-shell--browser">
        <KnowledgeCategorySidebar
          activeSlug={categorySlug}
          categories={state.categories}
        />

        <main className="knowledge-main" aria-busy={state.refreshing}>
          <header className="knowledge-page-header">
            <h1>{state.activeCategory?.name || 'Câu hỏi thường gặp'}</h1>
            <p>{description}</p>
          </header>

          <label className="knowledge-question-filter">
            <SearchOutlined aria-hidden="true" />
            <input
              type="search"
              value={filter}
              aria-label="Tìm trong danh sách câu hỏi"
              placeholder="Tìm câu hỏi…"
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>

          {state.loading ? (
            <KnowledgeLoading />
          ) : state.error ? (
            <KnowledgeError onRetry={state.retry} />
          ) : visibleGroups.length === 0 ? (
            <div className="knowledge-empty">
              <Empty description={filter ? 'Không tìm thấy câu hỏi phù hợp.' : 'Chuyên mục chưa có câu hỏi công khai.'} />
            </div>
          ) : (
            <div className={`knowledge-groups ${state.refreshing ? 'is-refreshing' : ''}`}>
              {visibleGroups.map((group) => (
                <section
                  key={group.category.slug}
                  className="knowledge-group"
                  aria-labelledby={`knowledge-${group.category.slug}`}
                >
                  {!categorySlug && (
                    <div className="knowledge-group__heading">
                      <h2 id={`knowledge-${group.category.slug}`}>
                        {group.category.name}
                      </h2>
                    </div>
                  )}
                  {categorySlug && (
                    <h2 id={`knowledge-${group.category.slug}`} className="sr-only">
                      {group.category.name}
                    </h2>
                  )}
                  <KnowledgeQuestionList articles={group.articles} query={filter} />
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
              aria-label="Phân trang câu hỏi thường gặp"
            />
          )}
        </main>
      </div>
    </div>
  )
}
