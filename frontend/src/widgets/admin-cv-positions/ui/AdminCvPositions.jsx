import { DownloadOutlined, MoreOutlined, RightOutlined, RobotOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dropdown, Input, Progress, Select, Table, Tabs, Tag } from 'antd'
import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { adminCvPositions, adminCvSamples, exportAdminCvPositions, getAdminCvCoverage, importAdminCvPositions } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { AdminPanel } from '@/shared/ui/admin'
import { TOTAL_VARIANTS, coverageSummary } from '../model/catalog'
import GenerateSamplesModal from './GenerateSamplesModal'
import ReviewQueue from './ReviewQueue'

function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = Object.assign(globalThis.document.createElement('a'), { href: url, download: filename })
  link.click()
  URL.revokeObjectURL(url)
}

// Nội dung gợi ý của một vị trí bằng chữ: bao nhiêu bản riêng, còn lại dùng bản chung.
function ContentStatus({ coverage }) {
  const { own, pending } = coverageSummary(coverage)
  return <div className="min-w-44">
    <div className="flex items-center gap-2 text-xs"><Progress percent={Math.round((own * 100) / TOTAL_VARIANTS)} showInfo={false} size="small" className="!m-0 w-16" /><span className="whitespace-nowrap text-slate-700">{own === 0 ? 'Dùng bản chung' : `${own}/${TOTAL_VARIANTS} bản riêng`}</span></div>
    {pending > 0 && <Tag color="gold" className="!mt-1">{pending} bản chưa xuất bản</Tag>}
  </div>
}

export default function AdminCvPositions() {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const can = { manage: access.has('cv_template.manage'), publish: access.has('cv_template.publish'), generate: access.has('cv_content.generate_ai') }
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [generating, setGenerating] = useState(false)
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState()
  const fileInput = useRef(null)
  const positions = useQuery({ queryKey: ['admin-cv-positions'], queryFn: () => adminCvPositions.list() })
  const coverage = useQuery({ queryKey: ['admin-cv-coverage'], queryFn: getAdminCvCoverage })
  const review = useQuery({ queryKey: ['admin-cv-samples', 'in_review'], queryFn: () => adminCvSamples.list({ status: 'in_review' }) })
  const refresh = () => ['admin-cv-positions', 'admin-cv-coverage', 'admin-cv-samples'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  const importJson = useMutation({
    mutationFn: async (file) => importAdminCvPositions(JSON.parse(await file.text())),
    onSuccess: (result) => { refresh(); message.success(`Đã nhập ${result.positions} vị trí, ${result.samples} nội dung gợi ý (bản nháp).`) },
    onError: (error) => message.error(error instanceof SyntaxError ? 'Tệp không phải JSON hợp lệ.' : getApiErrorMessage(error, 'Không thể nhập tệp.')),
  })
  const rows = useMemo(() => {
    const coverageById = Object.fromEntries((coverage.data?.results || []).map((row) => [row.position_public_id, row.coverage]))
    const term = search.trim().toLocaleLowerCase('vi')
    return (positions.data || [])
      .map((row) => ({ ...row, coverage: coverageById[row.position_public_id] }))
      .filter((row) => (!term || row.position_name.toLocaleLowerCase('vi').includes(term)) && (!industry || row.industry_name === industry))
      .sort((left, right) => `${left.industry_name}${left.position_name}`.localeCompare(`${right.industry_name}${right.position_name}`, 'vi'))
  }, [positions.data, coverage.data, search, industry])
  const industries = [...new Set((positions.data || []).map((row) => row.industry_name).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'vi'))
  const tab = params.get('tab') === 'review' ? 'review' : 'positions'
  const moreItems = [
    { key: 'export', icon: <DownloadOutlined />, label: 'Xuất cấu hình (JSON)', onClick: async () => downloadJson(await exportAdminCvPositions(), 'cv-positions.json') },
    ...(can.manage ? [{ key: 'import', icon: <UploadOutlined />, label: 'Nhập cấu hình (JSON)', onClick: () => fileInput.current?.click() }] : []),
  ]

  const list = <AdminPanel padded={false}>
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
      <Input allowClear prefix={<SearchOutlined className="text-slate-400" />} placeholder="Tìm vị trí" onChange={(event) => setSearch(event.target.value)} className="!w-full sm:!w-56" />
      <Select allowClear showSearch placeholder="Mọi ngành" value={industry} onChange={setIndustry} options={industries.map((name) => ({ value: name, label: name }))} className="w-full sm:w-48" />
      <span className="flex gap-2 sm:ml-auto">
        {can.generate && <Button type="primary" icon={<RobotOutlined />} onClick={() => setGenerating(true)}>Nhờ AI viết nội dung</Button>}
        <Dropdown menu={{ items: moreItems }} trigger={['click']}><Button icon={<MoreOutlined />} aria-label="Thao tác khác" /></Dropdown>
        <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => { if (event.target.files[0]) importJson.mutate(event.target.files[0]); event.target.value = '' }} />
      </span>
    </div>
    <Table size="middle" rowKey="position_public_id" loading={positions.isLoading} dataSource={rows} pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }} scroll={{ x: 640 }} columns={[
      { title: 'Vị trí', dataIndex: 'position_name', render: (name, row) => <Link to={adminPath(`/cv/positions/${row.public_id}`)}><span className="block font-semibold">{name}</span><span className="block text-xs !text-slate-500">{row.industry_name}</span></Link> },
      { title: 'Các mục', dataIndex: 'section_preset', render: (preset) => (preset?.length ? `Đã chọn ${preset.length} mục` : <span className="text-slate-400">Mặc định</span>), responsive: ['lg'] },
      { title: 'Thông tin riêng', dataIndex: 'field_count', render: (count) => (count ? `${count} câu hỏi` : <span className="text-slate-400">Chưa có</span>), responsive: ['md'] },
      { title: 'Nội dung gợi ý', dataIndex: 'coverage', render: (value) => <ContentStatus coverage={value} /> },
      { title: 'Ứng viên chọn được', dataIndex: 'is_active', render: (active) => (active ? <Tag color="green">Có</Tag> : <Tag>Đang ẩn</Tag>), responsive: ['lg'] },
      { title: '', width: 120, render: (_, row) => <Link to={adminPath(`/cv/positions/${row.public_id}`)}><Button size="small">Thiết lập <RightOutlined /></Button></Link> },
    ]} />
  </AdminPanel>

  return <div className="space-y-3">
    <Tabs activeKey={tab} onChange={(next) => setParams(next === 'review' ? { tab: next } : {}, { replace: true })} items={[
      { key: 'positions', label: 'Danh sách vị trí', children: list },
      { key: 'review', label: <span>Bản AI chờ duyệt {review.data?.length > 0 && <Tag color="purple" className="!ml-1 !mr-0">{review.data.length}</Tag>}</span>, children: <ReviewQueue canPublish={can.publish} canManage={can.manage} canGenerate={can.generate} /> },
    ]} />
    {generating && <GenerateSamplesModal open positions={positions.data || []} onClose={() => setGenerating(false)} onFinished={refresh} />}
  </div>
}
