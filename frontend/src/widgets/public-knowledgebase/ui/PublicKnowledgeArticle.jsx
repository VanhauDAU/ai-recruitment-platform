import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import {
  KNOWLEDGE_ROOT,
  KnowledgeArticleContent,
  formatKnowledgeDate,
  knowledgeArticlePath,
  knowledgeCategoryPath,
  knowledgeTypeLabel,
} from '@/entities/knowledgebase'
import { useSiteSettings } from '@/entities/site-settings'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import usePublicKnowledgeArticle from '../model/use-public-knowledge-article'
import KnowledgeCategorySidebar from './KnowledgeCategorySidebar'
import KnowledgeQuestionList from './KnowledgeQuestionList'
import { KnowledgeError, KnowledgeLoading, KnowledgeNotFound } from './KnowledgeStates'
import './public-knowledgebase.css'

function absolute(path) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).href
}

export default function PublicKnowledgeArticle({ categorySlug, articleSlug }) {
  const { settings } = useSiteSettings()
  const state = usePublicKnowledgeArticle(categorySlug, articleSlug)
  const article = state.article
  const canonicalPath = article
    ? knowledgeArticlePath(article)
    : `${KNOWLEDGE_ROOT}/${categorySlug}/${articleSlug}`
  const structuredData = article ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: article.title,
        description: article.seo_description || article.excerpt,
        datePublished: article.published_at,
        dateModified: article.updated_at,
        inLanguage: 'vi-VN',
        mainEntityOfPage: absolute(canonicalPath),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: absolute('/') },
          { '@type': 'ListItem', position: 2, name: 'Trung tâm trợ giúp', item: absolute(KNOWLEDGE_ROOT) },
          { '@type': 'ListItem', position: 3, name: article.category.name, item: absolute(knowledgeCategoryPath(article.category.slug)) },
          { '@type': 'ListItem', position: 4, name: article.title, item: absolute(canonicalPath) },
        ],
      },
    ],
  } : undefined
  const allowIndex = Boolean(article)
    && settings.knowledgebase_public_enabled === true
    && settings.knowledgebase_search_index_enabled === true
    && settings.seo_robots_index !== false

  useDocumentMetadata({
    title: article?.seo_title || article?.title || (state.notFound ? 'Nội dung trợ giúp không tồn tại' : 'Trung tâm trợ giúp'),
    description: article?.seo_description || article?.excerpt || 'Hướng dẫn sử dụng ProCV dành cho ứng viên.',
    canonicalPath,
    pageType: article ? 'article' : 'website',
    robots: allowIndex ? 'index, follow' : 'noindex, nofollow',
    structuredData,
  })

  if (state.loading) {
    return (
      <div className="knowledge-center knowledge-center--detail">
        <DetailTopBar />
        <div className="knowledge-shell"><KnowledgeLoading /></div>
      </div>
    )
  }
  if (state.error && !state.notFound) return <KnowledgeError onRetry={state.retry} />
  if (state.notFound || !article) return <KnowledgeNotFound />

  return (
    <div className="knowledge-center knowledge-center--detail">
      <DetailTopBar />
      <div className="knowledge-shell knowledge-shell--detail">
        <KnowledgeCategorySidebar
          activeSlug={article.category.slug}
          categories={state.categories}
          currentArticle={article}
          relatedArticles={article.related_articles}
        />

        <main className="knowledge-article-main">
          <nav className="knowledge-breadcrumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span aria-hidden="true">›</span>
            <Link to={KNOWLEDGE_ROOT}>Trung tâm trợ giúp</Link>
            <span aria-hidden="true">›</span>
            <Link to={knowledgeCategoryPath(article.category.slug)}>{article.category.name}</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{article.title}</span>
          </nav>

          <article className="knowledge-article-card">
            <header className="knowledge-article-header">
              <span className="knowledge-article-type">
                {knowledgeTypeLabel(article.article_type)}
              </span>
              <h1>{article.title}</h1>
              <p>
                <ClockCircleOutlined aria-hidden="true" />
                Cập nhật ngày {formatKnowledgeDate(article.updated_at)}
              </p>
            </header>
            <KnowledgeArticleContent html={article.body} className="knowledge-article-body" />
          </article>

          {(article.previous_article || article.next_article) && (
            <nav className="knowledge-article-navigation" aria-label="Bài viết trước và sau">
              {article.previous_article ? (
                <ArticleNavigationLink article={article.previous_article} direction="previous" />
              ) : <span />}
              {article.next_article && (
                <ArticleNavigationLink article={article.next_article} direction="next" />
              )}
            </nav>
          )}

          {article.related_articles.length > 0 && (
            <section className="knowledge-related" aria-labelledby="knowledge-related-heading">
              <div className="knowledge-group__heading">
                <div>
                  <p className="knowledge-content-header__overline">Đọc tiếp</p>
                  <h2 id="knowledge-related-heading">Nội dung liên quan</h2>
                </div>
              </div>
              <KnowledgeQuestionList articles={article.related_articles} />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function DetailTopBar() {
  return (
    <header className="knowledge-detail-topbar">
      <div>
        <div>
          <span>TRUNG TÂM TRỢ GIÚP</span>
          <strong>Câu trả lời rõ ràng cho hành trình nghề nghiệp của bạn</strong>
        </div>
        <Link to={KNOWLEDGE_ROOT}>
          <SearchOutlined aria-hidden="true" />
          Tìm nội dung khác
        </Link>
      </div>
    </header>
  )
}

function ArticleNavigationLink({ article, direction }) {
  const previous = direction === 'previous'
  return (
    <Link to={knowledgeArticlePath(article)} className={previous ? '' : 'is-next'}>
      {previous && <ArrowLeftOutlined aria-hidden="true" />}
      <span>
        <small>{previous ? 'Bài trước' : 'Bài tiếp theo'}</small>
        <strong>{article.title}</strong>
      </span>
      {!previous && <ArrowRightOutlined aria-hidden="true" />}
    </Link>
  )
}
