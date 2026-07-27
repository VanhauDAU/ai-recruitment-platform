import { EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Input, Table, Tag, Typography } from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  adminEmployerVerificationKeys,
  getAdminCompanyUpdateRequests,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'

function formatDate(value) {
  if (!value) return 'Chưa gửi'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function CompanyUpdateQueuePanel() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [queryText, setQueryText] = useState('')
  const search = useDeferredValue(queryText.trim())
  const params = useMemo(() => ({
    page,
    status: 'pending',
    ...(search ? { q: search } : {}),
  }), [page, search])
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.companyUpdates(params),
    queryFn: ({ signal }) => getAdminCompanyUpdateRequests(params, { signal }),
  })

  const changeSearch = (event) => {
    setQueryText(event.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="company-update-queue-filters">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Email người gửi, tên công ty hoặc MST"
          value={queryText}
          onChange={changeSearch}
        />
      </div>

      <Typography.Title level={5} className="!mb-2 !mt-0">
        Yêu cầu sửa thông tin công ty
      </Typography.Title>
      {query.isError && (
        <Alert
          showIcon
          type="error"
          title="Không thể tải yêu cầu sửa công ty"
          description={getApiErrorMessage(query.error)}
        />
      )}
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          size="small"
          loading={query.isLoading}
          dataSource={query.data?.results || []}
          scroll={{ x: 820 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: query.data?.count || 0,
            showSizeChanger: false,
            showTotal: (total) => `${total.toLocaleString('vi-VN')} yêu cầu`,
            onChange: setPage,
          }}
          columns={[
            {
              title: 'Công ty',
              key: 'company',
              render: (_, row) => (
                <div>
                  <Typography.Text strong className="!block">{row.company?.name}</Typography.Text>
                  <Typography.Text type="secondary" className="!text-xs">{row.company?.tax_code}</Typography.Text>
                </div>
              ),
            },
            { title: 'Người gửi', dataIndex: 'requested_by_email' },
            {
              title: 'Nội dung sửa',
              dataIndex: 'changes',
              render: (changes) => `${Object.keys(changes || {}).length} trường`,
            },
            {
              title: 'Mức độ',
              dataIndex: 'is_sensitive',
              render: (value) => <Tag color={value ? 'red' : 'blue'}>{value ? 'Pháp lý' : 'Thông thường'}</Tag>,
            },
            { title: 'Gửi gần nhất', dataIndex: 'updated_at', render: formatDate },
            {
              title: '',
              key: 'action',
              fixed: 'right',
              width: 120,
              render: (_, row) => (
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`${adminPath(`/accounts/${row.requested_by_public_id}`)}?tab=verification`)}
                >
                  Xử lý
                </Button>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
