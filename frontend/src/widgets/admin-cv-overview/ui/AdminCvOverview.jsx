import { CheckCircleFilled, DollarOutlined, FileDoneOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton, Table, Tag } from 'antd'
import { Link } from 'react-router'
import { getAdminCvOverview } from '@/entities/cv-template'
import { adminPath } from '@/shared/config/portals'
import { AdminPanel, AdminStatCard } from '@/shared/ui/admin'

// Việc cần làm: mỗi dòng nói rõ việc và dẫn tới đúng trang xử lý; dòng bằng 0 không hiện.
const TODOS = [
  { key: 'samples_in_review', label: 'Bản AI viết chờ duyệt', hint: 'Đọc và duyệt để ứng viên dùng được', to: '/cv/positions?tab=review' },
  { key: 'positions_without_content', label: 'Vị trí chỉ có nội dung chung', hint: 'Ứng viên vẫn có nội dung; viết bản riêng sẽ sát nghề hơn', to: '/cv/positions' },
  { key: 'stale_template_drafts', label: 'Bản nháp mẫu quá 7 ngày', hint: 'Xuất bản hoặc bỏ', to: '/cv/templates' },
  { key: 'missing_thumbnails', label: 'Màu chưa có ảnh xem trước', hint: 'Ảnh tạo tự động sau khi xuất bản', to: '/cv/templates' },
  { key: 'failed_generations_7d', label: 'Lần AI viết bị lỗi (7 ngày)', hint: 'Mở vị trí và nhờ AI viết lại', to: '/cv/positions?tab=review' },
]

const percent = (value) => (value === null || value === undefined ? '—' : `${value}%`)

export default function AdminCvOverview() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-cv-overview'], queryFn: getAdminCvOverview })
  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (isError) return <Alert type="error" showIcon message="Không tải được số liệu Mẫu CV." />
  const todos = TODOS.filter((todo) => data.todos[todo.key] > 0)
  return <div className="space-y-4">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AdminStatCard icon={<FileTextOutlined />} label="Mẫu đang hiển thị" value={data.templates_published} tone="blue" />
      <AdminStatCard icon={<FileDoneOutlined />} label="CV tạo trong 7 ngày" value={data.cvs_created_7d} detail={`${data.cvs_created_30d} trong 30 ngày`} tone="green" />
      <AdminStatCard icon={<UploadOutlined />} label="Import thành công (30 ngày)" value={percent(data.import_success_rate_30d)} detail={`${data.cvs_uploaded_30d} CV tải lên`} tone="purple" />
      <AdminStatCard icon={<DollarOutlined />} label="Chi phí AI tháng này" value={`$${data.ai_cost_month_usd.toFixed(2)}`} detail="AI viết nội dung gợi ý" tone="orange" />
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <AdminPanel title="Việc cần làm">
        {todos.length === 0
          ? <p className="flex items-center gap-2 text-sm text-slate-500"><CheckCircleFilled className="!text-emerald-500" />Không có việc tồn đọng.</p>
          : <ul className="space-y-2">{todos.map((todo) => <li key={todo.key}><Link to={adminPath(todo.to)} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-emerald-400"><span className="min-w-0"><span className="block font-semibold text-slate-800">{todo.label}</span><span className="block text-xs text-slate-500">{todo.hint}</span></span><Tag color="orange" className="!mr-0">{data.todos[todo.key]}</Tag></Link></li>)}</ul>}
      </AdminPanel>
      <AdminPanel title="Mẫu được dùng nhiều" padded={false}>
        <Table size="small" rowKey="public_id" pagination={false} dataSource={data.top_templates} scroll={{ x: 420 }} columns={[
          { title: 'Mẫu', dataIndex: 'name', render: (name, row) => <Link to={adminPath(`/cv/templates/${row.public_id}`)}>{name}</Link> },
          { title: 'Lượt dùng', dataIndex: 'usage_count', align: 'right' },
          { title: 'CV mới (30 ngày)', dataIndex: 'cvs_30d', align: 'right' },
        ]} />
      </AdminPanel>
    </div>
  </div>
}
