import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Select, Skeleton } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  adminKnowledgeKeys,
  getAdminKnowledgeArticles,
  getAdminKnowledgeArticleSummary,
  getAdminKnowledgeCategories,
  KNOWLEDGE_ARTICLE_TYPES,
  knowledgeTypeLabel,
} from '@/entities/content/knowledgebase'
import { KnowledgeCategoryManager } from '@/features/admin/content/manage-knowledge-categories'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { adminPath } from '@/shared/config/portals'
import { AdminDataActions } from '@/shared/ui/admin'
import WorkspaceListFooter from '@/shared/ui/workspace-list/WorkspaceListFooter'
import WorkspaceQuickFilters from '@/shared/ui/workspace-list/WorkspaceQuickFilters'
import WorkspaceSortHeader from '@/shared/ui/workspace-list/WorkspaceSortHeader'
import WorkspaceStatusTiles from '@/shared/ui/workspace-list/WorkspaceStatusTiles'
import {
  activeKnowledgeView,
  knowledgeListParams,
  knowledgeSummaryParams,
  knowledgeViewPatch,
  updateKnowledgeListParams,
} from '../model/list-filters'
import KnowledgeListRow from './KnowledgeListRow'
import '@/shared/ui/workspace-list/workspace-list.css'
import '@/shared/ui/workspace-list/workspace-table.css'
import './admin-knowledgebase-management.css'

const DEFAULT_ORDERING = 'order'
const PAGE_SIZES = [10, 20, 40, 60]
const formatCount = (value) => Number(value || 0).toLocaleString(getIntlLocale())

const TILES = [
  { value: 'all', label: m.admin_knowledge_list_tile_all(), metric: 'total', icon: <BookOutlined /> },
  { value: 'published', label: m.admin_knowledge_list_tile_published(), metric: 'published', icon: <CheckCircleOutlined /> },
  { value: 'drafts', label: m.admin_knowledge_list_tile_drafts(), metric: 'drafts', icon: <ClockCircleOutlined /> },
  { value: 'overdue', label: m.admin_knowledge_list_tile_overdue(), metric: 'overdue', icon: <WarningOutlined /> },
]
// Chips: [value, label, tone, filter key, filter value].
const CHIPS = [
  ['due_soon', m.admin_knowledge_list_chip_due_soon(), 'amber', 'review_due', 'due_soon'],
  ['archived', m.admin_knowledge_list_chip_archived(), 'slate', 'lifecycle', 'ARCHIVED'],
]
// [ordering field, header, ascending first]; null field = not sortable.
const COLUMNS = [
  ['title', m.admin_knowledge_list_col_article(), true],
  ['category', m.admin_knowledge_list_col_category(), true],
  ['revision_status', m.admin_knowledge_list_col_status(), true],
  ['review_due_at', m.admin_knowledge_list_col_review(), true],
  ['updated_at', m.admin_knowledge_list_col_updated(), false],
  [null, m.admin_knowledge_list_col_actions()],
]

export default function AdminKnowledgeBaseManagement() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categoryOpen, setCategoryOpen] = useState(false)
  const params = useMemo(() => knowledgeListParams(searchParams), [searchParams])
  const [searchInput, setSearchInput] = useState(params.q || '')
  const summaryParams = useMemo(() => knowledgeSummaryParams(params), [params])
  const categoriesQuery = useQuery({ queryKey: adminKnowledgeKeys.categories, queryFn: getAdminKnowledgeCategories })
  const articlesQuery = useQuery({
    queryKey: adminKnowledgeKeys.articles(params),
    queryFn: ({ signal }) => getAdminKnowledgeArticles(params, { signal }),
    // Keep the rows on screen while the next page, filter or order loads.
    placeholderData: keepPreviousData,
  })
  const summaryQuery = useQuery({
    queryKey: adminKnowledgeKeys.summary(summaryParams),
    queryFn: ({ signal }) => getAdminKnowledgeArticleSummary(summaryParams, { signal }),
  })
  const rows = articlesQuery.data?.results || []
  const count = articlesQuery.data?.count || 0
  const page = Number(params.page || 1)
  const pageSize = Number(params.page_size || 20)
  const ordering = params.ordering || DEFAULT_ORDERING
  const update = (patch) => setSearchParams(updateKnowledgeListParams(searchParams, patch))
  const openArticle = (article) => navigate(adminPath(`/tro-giup/${article.public_id}`))
  const quickValue = CHIPS.find(([, , , key, value]) => params[key] === value)?.[0] || ''

  useEffect(() => setSearchInput(params.q || ''), [params.q])

  useEffect(() => {
    const normalized = searchInput.trim()
    if (normalized === (params.q || '')) return undefined
    const timeoutId = window.setTimeout(() => {
      setSearchParams(updateKnowledgeListParams(searchParams, { q: normalized }), { replace: true })
    }, 400)
    return () => window.clearTimeout(timeoutId)
  }, [params.q, searchInput, searchParams, setSearchParams])

  function chooseChip(value) {
    const patch = Object.fromEntries(CHIPS.map(([, , , key]) => [key, undefined]))
    const chip = CHIPS.find(([chipValue]) => chipValue === value)
    if (chip) patch[chip[3]] = chip[4]
    update(patch)
  }

  return (
    <div className="wt-page">
      <div className="akl-tiles">
        <WorkspaceStatusTiles
          ariaLabel={m.admin_knowledge_list_tiles_aria()}
          value={activeKnowledgeView(params)}
          onChange={(view) => update(knowledgeViewPatch(view))}
          items={TILES.map((tile) => ({
            ...tile,
            key: tile.value,
            count: summaryQuery.data ? formatCount(summaryQuery.data[tile.metric]) : undefined,
          }))}
        />
      </div>

      <div className="wt-table wt-table--compact akl-table">
        <div className="wt-toolbar">
          <WorkspaceQuickFilters
            label={m.admin_knowledge_list_quick_label()}
            ariaLabel={m.admin_knowledge_list_quick_aria()}
            items={CHIPS.map(([value, label, chipTone]) => ({ value, label, tone: chipTone }))}
            value={quickValue}
            onChange={chooseChip}
            clearLabel={m.admin_knowledge_list_clear_filters()}
            onClear={searchParams.size > 0 ? () => { setSearchInput(''); setSearchParams({}) } : undefined}
          />
          <div className="wt-filters">
            <Select
              aria-label={m.admin_knowledge_list_category_aria()}
              value={params.category || ''}
              options={[
                { value: '', label: m.admin_knowledge_list_category_all() },
                ...(categoriesQuery.data || []).map((item) => ({ value: item.slug, label: item.name })),
              ]}
              onChange={(value) => update({ category: value })}
            />
            <Select
              aria-label={m.admin_knowledge_list_type_aria()}
              value={params.type || ''}
              options={[{ value: '', label: m.admin_knowledge_list_type_all() }, ...KNOWLEDGE_ARTICLE_TYPES]}
              onChange={(value) => update({ type: value })}
            />
            <Input
              allowClear
              type="search"
              className="wt-filters__search"
              aria-label={m.admin_knowledge_list_search_aria()}
              prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
              placeholder={m.admin_knowledge_list_search_placeholder()}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <div className="wt-filters__extra">
              <AdminDataActions
                iconOnly
                columns={[
                  { key: 'public_id', label: m.admin_knowledge_list_csv_code() },
                  { key: 'title', label: m.admin_knowledge_list_csv_title() },
                  { label: m.admin_knowledge_list_col_category(), value: (row) => row.category?.name },
                  { label: m.admin_knowledge_list_csv_type(), value: (row) => knowledgeTypeLabel(row.article_type) },
                  { key: 'lifecycle_state', label: m.admin_knowledge_list_csv_lifecycle() },
                  { label: m.admin_knowledge_list_csv_revision(), value: (row) => row.latest_revision?.status },
                  { key: 'review_due_at', label: m.admin_knowledge_list_csv_review() },
                  { key: 'updated_at', label: m.admin_knowledge_list_csv_updated() },
                ]}
                exportLabel={m.admin_knowledge_list_export_label()}
                exportScopeLabel={m.admin_knowledge_list_export_scope({ count: rows.length, page })}
                filename={`noi-dung-tro-giup-trang-${page}`}
                onRefresh={() => Promise.all([articlesQuery.refetch(), categoriesQuery.refetch(), summaryQuery.refetch()])}
                refreshing={articlesQuery.isFetching || categoriesQuery.isFetching || summaryQuery.isFetching}
                rows={rows}
              />
              <Button
                icon={<FolderOpenOutlined />}
                title={m.admin_knowledge_list_manage_categories()}
                data-print-hide="true"
                onClick={() => setCategoryOpen(true)}
              >
                {m.admin_knowledge_list_categories()}
              </Button>
            </div>
          </div>
        </div>

        <div className="wt-head">
          {COLUMNS.map(([field, label, ascendingFirst]) => (
            <span key={label}>
              {field ? (
                <WorkspaceSortHeader
                  field={field}
                  ordering={ordering}
                  defaultOrdering={DEFAULT_ORDERING}
                  ascendingFirst={ascendingFirst}
                  onSort={(value) => update({ ordering: value === DEFAULT_ORDERING ? undefined : value })}
                >
                  {label}
                </WorkspaceSortHeader>
              ) : label}
            </span>
          ))}
        </div>

        {articlesQuery.isError && (
          <div className="p-3">
            <Alert
              action={<Button onClick={() => articlesQuery.refetch()}>{m.admin_knowledge_list_retry()}</Button>}
              showIcon
              title={m.admin_knowledge_list_load_error()}
              type="error"
            />
          </div>
        )}

        {articlesQuery.isLoading ? (
          <div aria-label={m.admin_knowledge_list_loading_aria()}>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="wt-row">
                <Skeleton active title={{ width: '45%' }} paragraph={{ rows: 1 }} className="akl-skeleton" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 && !articlesQuery.isError ? (
          <div className="wt-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.admin_knowledge_list_empty()} />
          </div>
        ) : (
          <div aria-busy={articlesQuery.isFetching} className={`transition-opacity ${articlesQuery.isPlaceholderData ? 'opacity-60' : ''}`}>
            {rows.map((article) => <KnowledgeListRow key={article.public_id} article={article} onOpen={openArticle} />)}
          </div>
        )}
      </div>

      {count > 0 && (
        <WorkspaceListFooter
          summary={m.admin_knowledge_list_range({
            first: (page - 1) * pageSize + 1,
            last: Math.min(page * pageSize, count),
            total: formatCount(count),
          })}
          page={page}
          pageSize={pageSize}
          total={count}
          pageSizeOptions={PAGE_SIZES}
          onChange={(nextPage) => update({ page: nextPage })}
          onPageSizeChange={(size) => update({ page_size: size === 20 ? undefined : size })}
        />
      )}

      <KnowledgeCategoryManager open={categoryOpen} onClose={() => setCategoryOpen(false)} />
    </div>
  )
}
