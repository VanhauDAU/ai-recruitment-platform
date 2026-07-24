import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Select, Space, Table, Tag, Typography } from 'antd'
import {
  consultationLeadKeys,
  getAdminConsultationLeads,
  updateAdminConsultationLead,
} from '@/entities/consultation-lead'
import { message } from '@/shared/lib/toast'

const PAGE_SIZE = 20

export default function AdminConsultationLeads() {
  const [status, setStatus] = useState('new')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const leadsQuery = useQuery({
    queryKey: consultationLeadKeys.adminList({ status, page }),
    queryFn: ({ signal }) => getAdminConsultationLeads(
      { ...(status ? { status } : {}), page },
      { signal },
    ),
    placeholderData: (previousData) => previousData,
  })
  const response = leadsQuery.data
  const data = response?.results || (Array.isArray(response) ? response : [])
  const total = response?.count ?? data.length
  const contactMutation = useMutation({
    mutationFn: ({ id }) => updateAdminConsultationLead(id, { status: 'contacted' }),
    onSuccess: () => {
      message.success('Đã đánh dấu lead là đã liên hệ.')
      if (status === 'new' && data.length === 1 && page > 1) {
        setPage(page - 1)
        return queryClient.invalidateQueries({
          queryKey: consultationLeadKeys.adminLists,
          refetchType: 'none',
        })
      }
      return queryClient.invalidateQueries({ queryKey: consultationLeadKeys.adminLists })
    },
    onError: () => {
      message.error('Không thể cập nhật trạng thái lead.')
    },
  })

  useEffect(() => {
    if (leadsQuery.isError) message.error('Không thể tải danh sách yêu cầu tư vấn.')
  }, [leadsQuery.error, leadsQuery.isError])

  const updatingId = contactMutation.isPending ? contactMutation.variables?.id : null

  const columns = [
    { title: 'Khách hàng', dataIndex: 'full_name', width: 170, render: (value, row) => <div><strong>{value}</strong><div className="text-xs text-slate-500">{row.company_name || '—'}</div></div> },
    { title: 'Liên hệ', width: 210, render: (_, row) => <div><a href={`tel:${row.phone}`}>{row.phone}</a><div><a href={`mailto:${row.email}`} className="text-xs">{row.email}</a></div></div> },
    { title: 'Tỉnh/TP', dataIndex: 'province', width: 130, render: (value) => value || '—' },
    { title: 'Nhu cầu', dataIndex: 'need_label', width: 190 },
    { title: 'Ghi chú', dataIndex: 'note', width: 260, render: (value) => value || '—' },
    { title: 'Nguồn', dataIndex: 'source_page', width: 150, render: (value) => value || '—' },
    { title: 'Ngày gửi', dataIndex: 'created_at', width: 160, render: (value) => new Date(value).toLocaleString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', fixed: 'right', width: 130, render: (value) => <Tag color={value === 'new' ? 'orange' : 'green'}>{value === 'new' ? 'Mới' : 'Đã liên hệ'}</Tag> },
    { title: 'Thao tác', fixed: 'right', width: 130, render: (_, row) => row.status === 'new' ? <Button size="small" type="primary" loading={updatingId === row.id} disabled={contactMutation.isPending && updatingId !== row.id} onClick={() => contactMutation.mutate({ id: row.id })}>Đã liên hệ</Button> : '—' },
  ]

  return (
    <div>
      <Typography.Title level={2}>Yêu cầu tư vấn</Typography.Title>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><Typography.Paragraph type="secondary" className="!mb-0">Theo dõi lead gửi từ các trang marketing nhà tuyển dụng.</Typography.Paragraph><Space><span>Trạng thái</span><Select value={status} onChange={(nextStatus) => { setStatus(nextStatus); setPage(1) }} className="w-40" options={[{ value: 'new', label: 'Mới' }, { value: 'contacted', label: 'Đã liên hệ' }, { value: '', label: 'Tất cả' }]} /></Space></div>
      <div className="overflow-x-auto"><Table rowKey="id" loading={leadsQuery.isFetching} dataSource={data} columns={columns} scroll={{ x: 1500 }} pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }} /></div>
    </div>
  )
}
