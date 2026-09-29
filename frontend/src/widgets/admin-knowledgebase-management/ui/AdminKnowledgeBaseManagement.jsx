import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Empty, Input, Select, Space, Spin, Table, Tag, Tooltip } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import {
  KNOWLEDGE_ARTICLE_TYPES,
  KNOWLEDGE_LIFECYCLE_STATUS,
  KNOWLEDGE_REVISION_STATUS,
  adminKnowledgeKeys,
  formatKnowledgeDate,
  getAdminKnowledgeArticles,
  getAdminKnowledgeArticleSummary,
  getAdminKnowledgeCategories,
  knowledgeTypeLabel,
} from '@/entities/knowledgebase'
import { useSession } from '@/entities/session'
import { KnowledgeCategoryManager } from '@/features/manage-knowledge-categories'
import { adminPath } from '@/shared/config/portals'
import { AdminDataActions, AdminStatCard } from '@/shared/ui/admin'
import {
  knowledgeListParams,
  knowledgeSummaryParams,
  updateKnowledgeListParams,
} from '../model/list-filters'
import './admin-knowledgebase-management.css'

const ORDER_BY_COLUMN = {
  category: 'category',
  revision_status: 'revision_status',
  lifecycle_state: 'lifecycle_state',
  order: 'order',
  title: 'title',
  updated_at: 'updated_at',
  review_due_at: 'review_due_at',
}

const DEFAULT_ORDERING = 'order'

function controlledSortOrder(ordering, column) {
  if (ordering.replace(/^-/, '') !== column) return null
  return ordering.startsWith('-') ? 'descend' : 'ascend'
}

export default function AdminKnowledgeBaseManagement() {
  const navigate = useNavigate()
  const { user } = useSession()
  const access = useAdminAccess(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') || '')
  const params = useMemo(() => knowledgeListParams(searchParams), [searchParams])
  const summaryParams = useMemo(() => knowledgeSummaryParams(params), [params])
  const categoriesQuery = useQuery({ queryKey: adminKnowledgeKeys.categories, queryFn: getAdminKnowledgeCategories })
  const articlesQuery = useQuery({
    queryKey: adminKnowledgeKeys.articles(params),
    queryFn: ({ signal }) => getAdminKnowledgeArticles(params, { signal }),
  })
  const summaryQuery = useQuery({
    queryKey: adminKnowledgeKeys.summary(summaryParams),
    queryFn: ({ signal }) => getAdminKnowledgeArticleSummary(summaryParams, { signal }),
  })
  const rows = articlesQuery.data?.results || []
  const update = (patch) => setSearchParams(updateKnowledgeListParams(searchParams, patch))
  const ordering = params.ordering || DEFAULT_ORDERING
  const metric = (key) => (
    summaryQuery.data ? Number(summaryQuery.data[key] || 0).toLocaleString('vi-VN') : '—'
  )

  const columns = [
    {
      title: 'Nội dung',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
      sortOrder: controlledSortOrder(ordering, 'title'),
      width: '36%',
      render: (title, article) => (
        <div className="knowledge-table-title">
          <button type="button" onClick={() => navigate(adminPath(`/knowledgebase/${article.public_id}`))}>{title || 'Chưa có tiêu đề'}</button>
          <span>/{article.category.slug}/{article.slug}</span>
        </div>
      ),
    },
    {
      title: 'Phân loại',
      key: 'category',
      sorter: true,
      sortOrder: controlledSortOrder(ordering, 'category'),
      render: (_, article) => (
        <div className="knowledge-table-category">
          <strong>{article.category.name}</strong>
          <span>{knowledgeTypeLabel(article.article_type)}</span>
        </div>
      ),
    },
    {
      title: 'Biên tập',
      key: 'revision_status',
      sorter: true,
      sortOrder: controlledSortOrder(ordering, 'revision_status'),
      render: (_, article) => {
        const revision = KNOWLEDGE_REVISION_STATUS[article.latest_revision?.status]
        return <Tag color={revision?.color}>{revision?.label || 'Chưa có revision'}</Tag>
      },
    },
    {
      title: 'Vòng đời',
      dataIndex: 'lifecycle_state',
      key: 'lifecycle_state',
      sorter: true,
      sortOrder: controlledSortOrder(ordering, 'lifecycle_state'),
      render: (value) => {
        const lifecycle = KNOWLEDGE_LIFECYCLE_STATUS[value]
        return <Tag bordered={false} color={lifecycle?.color}>{lifecycle?.label}</Tag>
      },
    },
    {
      title: 'Rà soát',
      dataIndex: 'review_due_at',
      key: 'review_due_at',
      sorter: true,
      sortOrder: controlledSortOrder(ordering, 'review_due_at'),
      render: (value) => {
        const overdue = value && new Date(value) < new Date()
        return <span className={overdue ? 'knowledge-due knowledge-due--overdue' : 'knowledge-due'}>{overdue && <WarningOutlined />} {formatKnowledgeDate(value)}</span>
      },
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updated_at',
      key: 'updated_at',
      sorter: true,
      sortOrder: controlledSortOrder(ordering, 'updated_at'),
      render: (value) => formatKnowledgeDate(value),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 54,
      render: (_, article) => <Tooltip title="Mở không gian biên tập"><Button aria-label={`Mở ${article.title}`} type="text" icon={<EditOutlined />} onClick={() => navigate(adminPath(`/knowledgebase/${article.public_id}`))} /></Tooltip>,
    },
  ]

  return (
    <div className="admin-knowledgebase">
      <section className="admin-list-toolbar" data-print-hide="true">
        <p className="admin-list-toolbar__summary">
          <strong>{(articlesQuery.data?.count || 0).toLocaleString('vi-VN')}</strong>
          {' '}nội dung phù hợp · thao tác xuất áp dụng cho trang hiện tại
        </p>
        <Space wrap>
          <AdminDataActions
            compact
            columns={[
              { key: 'public_id', label: 'Mã nội dung' },
              { key: 'title', label: 'Tiêu đề' },
              { label: 'Chuyên mục', value: (row) => row.category?.name },
              { label: 'Loại', value: (row) => knowledgeTypeLabel(row.article_type) },
              { key: 'lifecycle_state', label: 'Vòng đời' },
              { label: 'Revision mới nhất', value: (row) => row.latest_revision?.status },
              { key: 'review_due_at', label: 'Hạn rà soát' },
              { key: 'updated_at', label: 'Cập nhật lúc' },
            ]}
            exportLabel="CSV trang này"
            exportScopeLabel={`Xuất ${rows.length} nội dung của trang ${params.page || 1}`}
            filename={`noi-dung-tro-giup-trang-${params.page || 1}`}
            onRefresh={() => Promise.all([
              articlesQuery.refetch(),
              categoriesQuery.refetch(),
              summaryQuery.refetch(),
            ])}
            refreshing={articlesQuery.isFetching || categoriesQuery.isFetching || summaryQuery.isFetching}
            rows={rows}
          />
          <Button icon={<FolderOpenOutlined />} onClick={() => setCategoryOpen(true)}>Quản lý chuyên mục</Button>
          {access.has('knowledgebase.manage') && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(adminPath('/knowledgebase/new'))}>Tạo bài viết</Button>}
        </Space>
      </section>

      <section className="admin-knowledgebase__metrics" aria-label="Tổng quan nội dung">
        <AdminStatCard icon={<BookOutlined />} label="Tổng bài viết" value={metric('total')} detail="Theo toàn bộ kết quả phù hợp" />
        <AdminStatCard icon={<CheckCircleOutlined />} label="Đã công khai" value={metric('published')} detail="Theo toàn bộ kết quả phù hợp" tone="green" />
        <AdminStatCard
          active={params.revision_status === 'IN_REVIEW'}
          detail="Cần người duyệt xử lý"
          icon={<ClockCircleOutlined />}
          label="Chờ duyệt"
          onClick={() => update({ revision_status: 'IN_REVIEW' })}
          tone="amber"
          value={metric('in_review')}
        />
        <AdminStatCard
          active={params.review_due === 'overdue'}
          detail="Theo toàn bộ kết quả phù hợp"
          icon={<WarningOutlined />}
          label="Quá hạn rà soát"
          onClick={() => update({ review_due: 'overdue' })}
          tone="red"
          value={metric('overdue')}
        />
      </section>

      <Card className="admin-knowledgebase__workspace">
        <div className="knowledge-filterbar">
          <Input.Search
            allowClear
            aria-label="Tìm FAQ hoặc hướng dẫn"
            className="knowledge-filterbar__search"
            enterButton={<SearchOutlined />}
            placeholder="Tìm tiêu đề hoặc nội dung…"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onSearch={(value) => update({ q: value.trim() })}
          />
          <Select allowClear placeholder="Tất cả chuyên mục" value={params.category} options={(categoriesQuery.data || []).map((item) => ({ value: item.slug, label: item.name }))} onChange={(value) => update({ category: value })} />
          <Select allowClear placeholder="FAQ & hướng dẫn" value={params.type} options={KNOWLEDGE_ARTICLE_TYPES} onChange={(value) => update({ type: value })} />
          <Select
            allowClear
            aria-label="Lọc vòng đời nội dung"
            placeholder="Vòng đời"
            value={params.lifecycle}
            options={Object.entries(KNOWLEDGE_LIFECYCLE_STATUS).map(([value, item]) => ({ value, label: item.label }))}
            onChange={(value) => update({ lifecycle: value })}
          />
          <Select allowClear placeholder="Trạng thái revision" value={params.revision_status} options={Object.entries(KNOWLEDGE_REVISION_STATUS).map(([value, item]) => ({ value, label: item.label }))} onChange={(value) => update({ revision_status: value })} />
          <Select allowClear placeholder="Chu kỳ rà soát" value={params.review_due} options={[{ value: 'overdue', label: 'Đã quá hạn' }, { value: 'due_soon', label: 'Sắp đến hạn' }]} onChange={(value) => update({ review_due: value })} />
          {searchParams.size > 0 && <Button onClick={() => { setSearchDraft(''); setSearchParams({}) }}>Xóa lọc</Button>}
        </div>

        {articlesQuery.isError ? (
          <Empty description="Không thể tải danh sách"><Button onClick={() => articlesQuery.refetch()}>Thử lại</Button></Empty>
        ) : (
          <Spin spinning={articlesQuery.isLoading}>
            <Table
              rowKey="public_id"
              columns={columns}
              dataSource={rows}
              scroll={{ x: 1100 }}
              locale={{ emptyText: <Empty description="Không có nội dung phù hợp" /> }}
              pagination={{
                current: Number(params.page || 1),
                pageSize: Number(params.page_size || 20),
                total: articlesQuery.data?.count || 0,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 40, 60],
                showTotal: (total) => `${total} bài viết`,
              }}
              showSorterTooltip={{ target: 'sorter-icon' }}
              onChange={(pagination, _, sorter, extra) => {
                const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
                const column = ORDER_BY_COLUMN[activeSorter.field || activeSorter.columnKey]
                const nextOrdering = activeSorter.order && column
                  ? `${activeSorter.order === 'descend' ? '-' : ''}${column}`
                  : undefined
                update({
                  page: extra.action === 'sort' ? 1 : pagination.current,
                  page_size: pagination.pageSize,
                  ordering: nextOrdering,
                })
              }}
            />
          </Spin>
        )}
      </Card>

      <KnowledgeCategoryManager
        open={categoryOpen}
        canManage={access.has('knowledgebase.manage')}
        canPublish={access.has('knowledgebase.publish')}
        onClose={() => setCategoryOpen(false)}
      />
    </div>
  )
}
