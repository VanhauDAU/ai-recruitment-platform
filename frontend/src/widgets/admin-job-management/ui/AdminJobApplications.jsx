import { EyeOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Drawer, Empty, Input, Select, Table, Tag } from 'antd'
import { useMemo, useState } from 'react'
import {
  applicationKeys,
  getAdminJobApplicationPage,
  RECRUITER_APPLICATION_STATUSES,
  RECRUITER_APPLICATION_STATUS_LABELS,
} from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import AdminJobDisclosure from './AdminJobDisclosure'

const EMPTY_PAGE = { count: 0, results: [] }
const STATUS_COLORS = {
  submitted: 'blue',
  viewed: 'cyan',
  considering: 'gold',
  shortlisted: 'green',
  interviewed: 'purple',
  accepted: 'success',
  rejected: 'default',
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

function CandidateCell({ application }) {
  const name = application.candidate_name || application.candidate_email || 'Ứng viên'
  return (
    <div className="admin-job-candidate-cell">
      <span aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase('vi-VN')}</span>
      <span>
        <strong>{name}</strong>
        <small>{application.candidate_email}</small>
      </span>
    </div>
  )
}

function ApplicationDrawer({ application, onClose }) {
  return (
    <Drawer
      destroyOnHidden
      onClose={onClose}
      open={Boolean(application)}
      title="Chi tiết lượt ứng tuyển"
      width={520}
    >
      {application && (
        <div className="admin-job-application-drawer">
          <header>
            <CandidateCell application={application} />
            <Tag color={STATUS_COLORS[application.status]}>
              {application.status_label
                || RECRUITER_APPLICATION_STATUS_LABELS[application.status]
                || application.status}
            </Tag>
          </header>
          {application.candidate_account_restricted && (
            <Alert showIcon title="Tài khoản ứng viên đang bị hạn chế." type="warning" />
          )}
          <dl className="admin-job-detail-rows">
            <div><dt>Người liên hệ</dt><dd>{application.contact_name || '—'}</dd></div>
            <div><dt>Email nhận trao đổi</dt><dd>{application.contact_email || '—'}</dd></div>
            <div><dt>Điện thoại</dt><dd>{application.contact_phone || '—'}</dd></div>
            <div><dt>CV đã nộp</dt><dd>{application.submitted_cv_title || '—'}</dd></div>
            <div><dt>Nguồn ứng tuyển</dt><dd>{application.source_label || application.source || '—'}</dd></div>
            <div><dt>Thời gian ứng tuyển</dt><dd>{formatDateTime(application.applied_at)}</dd></div>
            <div>
              <dt>Địa điểm ưu tiên</dt>
              <dd>{application.preferred_locations?.map((item) => item.name).join(', ') || '—'}</dd>
            </div>
          </dl>
          <section className="admin-job-application-letter">
            <h4>Thư ứng tuyển</h4>
            <p>{application.cover_letter || 'Ứng viên không gửi thư giới thiệu.'}</p>
          </section>
          <p className="admin-job-application-consent">
            Dữ liệu cá nhân: {application.data_processing_consent ? 'đã đồng ý xử lý' : 'chưa ghi nhận đồng ý'}
            {' · '}Phân tích AI: {application.allow_ai_analysis ? 'được phép' : 'không được phép'}
          </p>
        </div>
      )}
    </Drawer>
  )
}

export default function AdminJobApplications({
  job,
  openSection,
  onToggle,
  canViewApplications,
}) {
  const open = openSection === 'applications'
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [ordering, setOrdering] = useState('newest')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 450)
  const params = useMemo(() => ({
    page,
    page_size: 8,
    ordering,
    ...(debouncedKeyword ? { q: debouncedKeyword } : {}),
    ...(status ? { status } : {}),
  }), [debouncedKeyword, ordering, page, status])
  const query = useQuery({
    enabled: open && canViewApplications,
    queryKey: applicationKeys.adminJobList(job.public_id, params),
    queryFn: ({ signal }) => getAdminJobApplicationPage(job.public_id, params, { signal }),
  })
  const pageData = query.data || EMPTY_PAGE

  function updateKeyword(event) {
    setKeyword(event.target.value)
    setPage(1)
  }

  return (
    <>
      <AdminJobDisclosure
        badge={`${job.application_count || 0} lượt`}
        description="Hồ sơ, thông tin liên hệ và trạng thái tuyển dụng"
        icon={<TeamOutlined />}
        onToggle={onToggle}
        open={open}
        sectionKey="applications"
        title="Ứng viên đã ứng tuyển"
      >
        {!canViewApplications ? (
          <Alert
            showIcon
            title="Cần quyền xem dữ liệu liên hệ nhạy cảm để mở danh sách ứng viên."
            type="info"
          />
        ) : (
          <>
            <div className="admin-job-application-filters">
              <Input
                allowClear
                aria-label="Tìm ứng viên đã ứng tuyển"
                onChange={updateKeyword}
                placeholder="Tên, email, điện thoại hoặc CV"
                prefix={<SearchOutlined />}
                value={keyword}
              />
              <Select
                aria-label="Lọc trạng thái ứng tuyển"
                onChange={(value) => { setStatus(value); setPage(1) }}
                options={[
                  { value: '', label: 'Mọi trạng thái' },
                  ...RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label })),
                ]}
                value={status}
              />
              <Select
                aria-label="Sắp xếp ứng viên"
                onChange={(value) => { setOrdering(value); setPage(1) }}
                options={[
                  { value: 'newest', label: 'Mới ứng tuyển' },
                  { value: 'oldest', label: 'Ứng tuyển lâu nhất' },
                  { value: 'name', label: 'Tên ứng viên' },
                  { value: 'status', label: 'Trạng thái' },
                ]}
                value={ordering}
              />
            </div>
            {query.isError ? (
              <Alert
                action={<Button onClick={() => query.refetch()}>Thử lại</Button>}
                description={getApiErrorMessage(query.error)}
                showIcon
                title="Không thể tải danh sách ứng viên"
                type="error"
              />
            ) : (
              <Table
                columns={[
                  { title: 'Ứng viên', render: (_, item) => <CandidateCell application={item} /> },
                  { title: 'CV đã nộp', dataIndex: 'submitted_cv_title' },
                  {
                    title: 'Trạng thái',
                    render: (_, item) => (
                      <Tag color={STATUS_COLORS[item.status]}>
                        {item.status_label || RECRUITER_APPLICATION_STATUS_LABELS[item.status] || item.status}
                      </Tag>
                    ),
                  },
                  { title: 'Ứng tuyển lúc', dataIndex: 'applied_at', render: formatDateTime },
                  {
                    align: 'right',
                    key: 'action',
                    render: (_, item) => (
                      <Button icon={<EyeOutlined />} onClick={() => setSelected(item)} size="small">
                        Xem
                      </Button>
                    ),
                  },
                ]}
                dataSource={pageData.results || []}
                loading={query.isLoading}
                locale={{ emptyText: <Empty description="Chưa có hồ sơ phù hợp" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                pagination={{
                  current: page,
                  onChange: setPage,
                  pageSize: 8,
                  showSizeChanger: false,
                  total: pageData.count || 0,
                }}
                rowKey="public_id"
                scroll={{ x: 820 }}
              />
            )}
          </>
        )}
      </AdminJobDisclosure>
      <ApplicationDrawer application={selected} onClose={() => setSelected(null)} />
    </>
  )
}
