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
  getAdminKnowledgeCategories,
  knowledgeTypeLabel,
} from '@/entities/knowledgebase'
import { useSession } from '@/entities/session'
import { KnowledgeCategoryManager } from '@/features/manage-knowledge-categories'
import { adminPath } from '@/shared/config/portals'
import { knowledgeListParams, updateKnowledgeListParams } from '../model/list-filters'
import './admin-knowledgebase-management.css'

const ORDER_BY_COLUMN = {
  order: 'order',
  title: 'title',
  updated_at: 'updated_at',
  review_due_at: 'review_due_at',
}

export default function AdminKnowledgeBaseManagement() {
  const navigate = useNavigate()
  const { user } = useSession()
  const access = useAdminAccess(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') || '')
  const params = useMemo(() => knowledgeListParams(searchParams), [searchParams])
  const categoriesQuery = useQuery({ queryKey: adminKnowledgeKeys.categories, queryFn: getAdminKnowledgeCategories })
  const articlesQuery = useQuery({
    queryKey: adminKnowledgeKeys.articles(params),
    queryFn: ({ signal }) => getAdminKnowledgeArticles(params, { signal }),
  })
  const rows = articlesQuery.data?.results || []
  const update = (patch) => setSearchParams(updateKnowledgeListParams(searchParams, patch))
  const latestCounts = rows.reduce((result, article) => {
    const status = article.latest_revision?.status
    if (status === 'IN_REVIEW') result.review += 1
    if (article.published_revision_number) result.published += 1
    if (article.review_due_at && new Date(article.review_due_at) < new Date()) result.overdue += 1
    return result
  }, { published: 0, review: 0, overdue: 0 })

  const columns = [
    {
      title: 'Nội dung',
      dataIndex: 'title',
      key: 'title',
      sorter: true,
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
      render: (_, article) => (
        <div className="knowledge-table-category">
          <strong>{article.category.name}</strong>
          <span>{knowledgeTypeLabel(article.article_type)}</span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, article) => {
        const revision = KNOWLEDGE_REVISION_STATUS[article.latest_revision?.status]
        const lifecycle = KNOWLEDGE_LIFECYCLE_STATUS[article.lifecycle_state]
        return (
          <Space direction="vertical" size={2}>
            <Tag color={revision?.color}>{revision?.label || 'Chưa có revision'}</Tag>
            <Tag bordered={false} color={lifecycle?.color}>{lifecycle?.label}</Tag>
          </Space>
        )
      },
    },
    {
      title: 'Rà soát',
      dataIndex: 'review_due_at',
      key: 'review_due_at',
      sorter: true,
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
      <section className="admin-knowledgebase__hero">
        <div>
          <span className="admin-knowledgebase__eyebrow"><BookOutlined /> Knowledge operations</span>
          <h1>Trung tâm FAQ & hướng dẫn</h1>
          <p>Biên tập, kiểm duyệt và giữ nội dung trợ giúp luôn chính xác trong một quy trình có lịch sử rõ ràng.</p>
        </div>
        <Space wrap>
          <Button icon={<FolderOpenOutlined />} onClick={() => setCategoryOpen(true)}>Quản lý chuyên mục</Button>
          {access.has('knowledgebase.manage') && <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(adminPath('/knowledgebase/new'))}>Tạo bài viết</Button>}
        </Space>
      </section>

      <section className="admin-knowledgebase__metrics" aria-label="Tổng quan nội dung">
        <Card><div className="metric-icon metric-icon--blue"><BookOutlined /></div><div><span>Tổng bài viết</span><strong>{(articlesQuery.data?.count || 0).toLocaleString('vi-VN')}</strong><small>Theo bộ lọc hiện tại</small></div></Card>
        <Card><div className="metric-icon metric-icon--green"><CheckCircleOutlined /></div><div><span>Đã công khai</span><strong>{latestCounts.published}</strong><small>Trên trang đang xem</small></div></Card>
        <Card><div className="metric-icon metric-icon--amber"><ClockCircleOutlined /></div><div><span>Chờ duyệt</span><strong>{latestCounts.review}</strong><small>Cần người duyệt xử lý</small></div></Card>
        <Card><div className="metric-icon metric-icon--red"><WarningOutlined /></div><div><span>Quá hạn rà soát</span><strong>{latestCounts.overdue}</strong><small>Trên trang đang xem</small></div></Card>
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
              onChange={(pagination, _, sorter) => {
                const column = ORDER_BY_COLUMN[sorter.field || sorter.columnKey]
                const ordering = column ? `${sorter.order === 'descend' ? '-' : ''}${column}` : undefined
                update({ page: pagination.current, page_size: pagination.pageSize, ordering })
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
