import { CopyOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Table, Tag, message } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import {
  closeEmployerJob,
  duplicateEmployerJob,
  getEmployerJobs,
  jobKeys,
} from '@/entities/job'

const STATUS = {
  draft: ['Nháp', 'default'],
  pending: ['Chờ duyệt', 'gold'],
  active: ['Đang tuyển', 'green'],
  closed: ['Đã đóng', 'default'],
  rejected: ['Từ chối', 'red'],
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const status = searchParams.get('status') || undefined
  const jobsQuery = useQuery({ queryKey: jobKeys.employerList({ status }), queryFn: () => getEmployerJobs({ status }) })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['jobs', 'employer-list'] })
  const closeMutation = useMutation({ mutationFn: closeEmployerJob, onSuccess: () => { invalidate(); message.success('Đã đóng tin.') } })
  const duplicateMutation = useMutation({ mutationFn: duplicateEmployerJob, onSuccess: () => { invalidate(); message.success('Đã tạo bản nháp sao chép.') } })
  const filters = [['', 'Tất cả'], ['draft', 'Nháp'], ['pending', 'Chờ duyệt'], ['active', 'Đang tuyển'], ['rejected', 'Từ chối'], ['expired', 'Hết hạn'], ['closed', 'Đã đóng']]
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-extrabold text-slate-900">Tin tuyển dụng</h1><p className="mt-1 text-sm text-slate-500">Chỉ bạn có thể xem và quản lý các tin mình đã tạo.</p></div><Button type="primary" icon={<PlusOutlined />}><Link to="/tuyendung/app/jobs/new">Đăng tin</Link></Button></div>
      <div className="flex flex-wrap gap-2">{filters.map(([value, label]) => <Button key={value} type={(status || '') === value ? 'primary' : 'default'} onClick={() => setSearchParams(value ? { status: value } : {})}>{label}</Button>)}</div>
      <Table rowKey="public_id" loading={jobsQuery.isLoading} dataSource={jobsQuery.data || []} pagination={false} scroll={{ x: 760 }} locale={{ emptyText: <Empty description="Chưa có tin tuyển dụng" /> }} columns={[
        { title: 'Tin tuyển dụng', dataIndex: 'title', render: (title, item) => <Link className="font-bold text-emerald-700" to={`/tuyendung/app/jobs/${item.public_id}`}>{title || 'Tin nháp chưa đặt tên'}</Link> },
        { title: 'Trạng thái', render: (_, item) => item.is_expired ? <Tag color="orange">Hết hạn</Tag> : <Tag color={STATUS[item.status]?.[1]}>{STATUS[item.status]?.[0] || item.status}</Tag> },
        { title: 'Hồ sơ', dataIndex: 'application_count', align: 'right', render: (count, item) => <Link to={`/tuyendung/app/applications?job=${item.public_id}`}>{count}</Link> },
        { title: 'Lượt xem', dataIndex: 'view_count', align: 'right' },
        { title: 'Thao tác', render: (_, item) => <div className="flex gap-1"><Button size="small" icon={<CopyOutlined />} loading={duplicateMutation.isPending} onClick={() => duplicateMutation.mutate(item.public_id)}>Sao chép</Button>{item.status === 'active' && !item.is_expired && <Button size="small" danger icon={<StopOutlined />} loading={closeMutation.isPending} onClick={() => closeMutation.mutate(item.public_id)}>Đóng</Button>}</div> },
      ]} />
    </section>
  )
}
