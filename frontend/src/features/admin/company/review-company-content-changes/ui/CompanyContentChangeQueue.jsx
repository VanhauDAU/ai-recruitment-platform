import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Empty, Form, Input, Modal, Segmented, Table, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  adminCompanyKeys,
  getAdminCompanyContentChanges,
  markAdminCompanyContentChangesReviewed,
  revertAdminCompanyContentChange,
} from '@/entities/company/admin-company'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import ContentChangeDiff from './ContentChangeDiff'
import './content-change-queue.css'
import { formatDateTime } from '@/shared/lib/date-time'

const EMPTY_PAGE = { count: 0, results: [] }
const PAGE_SIZE = 20
const SECTION_LABELS = {
  hero: 'Đầu trang',
  about: 'Giới thiệu',
  benefits: 'Phúc lợi',
  culture: 'Văn hoá',
  gallery: 'Thư viện ảnh',
  video: 'Video',
  social_links: 'Mạng xã hội',
  offices: 'Văn phòng',
}
const STATUS_TAGS = {
  unreviewed: ['gold', 'Chưa xem'],
  reviewed: ['green', 'Đã xem'],
  reverted: ['red', 'Đã hoàn tác'],
}
const STATUS_OPTIONS = [
  { value: 'unreviewed', label: 'Chưa xem' },
  { value: 'reverted', label: 'Đã hoàn tác' },
  { value: 'reviewed', label: 'Đã xem' },
  { value: 'all', label: 'Tất cả' },
]

const formatDate = (value) => formatDateTime(value, { dateStyle: 'medium' })

function RevertModal({ change, loading, onCancel, onSubmit }) {
  const [form] = Form.useForm()
  return (
    <Modal
      open={Boolean(change)}
      title="Hoàn tác thay đổi nội dung"
      okText="Hoàn tác"
      okButtonProps={{ danger: true }}
      cancelText="Hủy"
      confirmLoading={loading}
      destroyOnHidden
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields()
        await onSubmit({ reason: values.reason.trim(), requireReview: Boolean(values.require_review) })
      }}
    >
      <p className="content-change-queue__meta">
        Trang của {change?.company.name} trở lại nội dung trước thay đổi. Người sửa nhận thông báo kèm lý do.
      </p>
      <Form form={form} layout="vertical" preserve={false} className="mt-3">
        <Form.Item
          name="reason"
          label="Lý do"
          rules={[{ required: true, whitespace: true, min: 10, message: 'Nhập lý do từ 10 ký tự để nhà tuyển dụng biết cần sửa gì.' }]}
        >
          <Input.TextArea autoFocus rows={3} maxLength={500} showCount />
        </Form.Item>
        {!change?.company.content_review_required && (
          <Form.Item name="require_review" valuePropName="checked" className="mb-0">
            <Checkbox>Bật duyệt trước: các lần sửa sau của công ty phải chờ duyệt</Checkbox>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

/**
 * Hậu kiểm nội dung trang công ty: nhà tuyển dụng đăng ngay, quản trị viên xem
 * lại theo lô, đánh dấu đã xem hoặc hoàn tác kèm lý do. `companyPublicId` lọc
 * theo một công ty.
 */
export default function CompanyContentChangeQueue({ companyPublicId }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('unreviewed')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [reverting, setReverting] = useState(null)
  const params = {
    page,
    status,
    ...(search && { q: search }),
    ...(companyPublicId && { company: companyPublicId }),
  }
  const query = useQuery({
    queryKey: adminCompanyKeys.contentChanges(params),
    queryFn: ({ signal }) => getAdminCompanyContentChanges(params, { signal }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminCompanyKeys.all })
  const markReviewed = useMutation({
    mutationFn: markAdminCompanyContentChangesReviewed,
    onSuccess: ({ count }) => {
      setSelected([])
      message.success(`Đã đánh dấu ${count} thay đổi là đã xem.`)
      refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể đánh dấu đã xem.')),
  })
  const revert = useMutation({
    mutationFn: (values) => revertAdminCompanyContentChange(reverting.public_id, values),
    onSuccess: () => {
      message.success('Đã hoàn tác và thông báo cho nhà tuyển dụng.')
      setReverting(null)
      setSelected((ids) => ids.filter((id) => id !== reverting.public_id))
      refresh()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể hoàn tác thay đổi.')),
  })
  const data = query.data || EMPTY_PAGE
  const unreviewed = status === 'unreviewed'

  const columns = [
    !companyPublicId && {
      title: 'Công ty',
      key: 'company',
      render: (_, row) => (
        <span className="content-change-queue__company">
          <Link className="!text-[var(--brand-primary-hover)]" to={adminPath(`/companies/${row.company.public_id}?tab=public-page`)}>
            {row.company.name}
          </Link>
          {row.company.content_review_required && <Tag color="orange">Duyệt trước</Tag>}
        </span>
      ),
    },
    {
      title: 'Khối đã sửa',
      key: 'sections',
      render: (_, row) => row.sections.map((section) => <Tag key={section}>{SECTION_LABELS[section] || section}</Tag>),
    },
    {
      title: 'Người sửa',
      key: 'actor',
      render: (_, row) => (
        <>
          <div className="truncate">{row.actor_email}</div>
          <div className="content-change-queue__meta">{formatDate(row.created_at)}</div>
        </>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_, row) => {
        const [color, label] = STATUS_TAGS[row.status] || ['default', row.status_label]
        return (
          <>
            <Tag color={color}>{label}</Tag>
            {row.review_note && <div className="content-change-queue__meta">{row.review_note}</div>}
          </>
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, row) => row.status === 'unreviewed' && (
        <span className="flex gap-2">
          <Button size="small" loading={markReviewed.isPending && markReviewed.variables?.includes(row.public_id)} onClick={() => markReviewed.mutate([row.public_id])}>
            Đã xem
          </Button>
          <Button size="small" danger onClick={() => setReverting(row)}>Hoàn tác</Button>
        </span>
      ),
    },
  ].filter(Boolean)

  return (
    <>
      <div className="content-change-queue__toolbar">
        <Segmented
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => { setStatus(value); setPage(1); setSelected([]) }}
        />
        <Input.Search
          allowClear
          className="content-change-queue__search"
          placeholder="Tên công ty hoặc email người sửa"
          aria-label="Tìm thay đổi nội dung"
          onSearch={(value) => { setSearch(value.trim()); setPage(1) }}
        />
        {unreviewed && (
          <Button
            type="primary"
            disabled={!selected.length}
            loading={markReviewed.isPending && markReviewed.variables?.length > 1}
            onClick={() => markReviewed.mutate(selected)}
          >
            {selected.length ? `Đánh dấu đã xem (${selected.length})` : 'Đánh dấu đã xem'}
          </Button>
        )}
      </div>
      {query.isError && (
        <Alert className="mb-3" showIcon type="error" title="Không tải được thay đổi nội dung" description={getApiErrorMessage(query.error)} />
      )}
      <Table
        rowKey="public_id"
        size="small"
        loading={query.isLoading}
        dataSource={data.results}
        columns={columns}
        scroll={{ x: 760 }}
        rowSelection={unreviewed ? { selectedRowKeys: selected, onChange: setSelected } : undefined}
        expandable={{ expandedRowRender: (row) => <ContentChangeDiff fields={row.changed_fields} /> }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={unreviewed ? 'Không còn thay đổi nào chờ xem' : 'Không có thay đổi nào'} /> }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total: data.count, showSizeChanger: false, onChange: setPage }}
      />
      <RevertModal
        change={reverting}
        loading={revert.isPending}
        onCancel={() => { if (!revert.isPending) setReverting(null) }}
        // Lỗi đã báo bằng toast; modal giữ nguyên để sửa lý do hoặc đóng.
        onSubmit={(values) => revert.mutateAsync(values).catch(() => {})}
      />
    </>
  )
}
