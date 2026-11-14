import { ArrowLeftOutlined, EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Segmented, Skeleton, Switch, Tabs } from 'antd'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { adminCvPositions, getAdminCvPosition } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import CandidatePreviewPanel from './CandidatePreviewPanel'
import PositionFieldsEditor from './PositionFieldsEditor'
import SampleContentGrid from './SampleContentGrid'
import SectionPresetEditor from './SectionPresetEditor'

// Ba phần của CV dựng sẵn cho một vị trí; mỗi phần một dòng giải thích.
const PARTS = {
  sections: { label: 'Các mục', hint: 'Mục ứng viên thấy khi tạo CV cho vị trí này và thứ tự của chúng.' },
  fields: { label: 'Thông tin riêng', hint: 'Câu hỏi chỉ nghề này có (GitHub, kênh bán hàng…), in trong mục "Thông tin chuyên môn".' },
  samples: { label: 'Nội dung gợi ý', hint: 'Văn bản điền sẵn theo từng mức kinh nghiệm; ứng viên sửa lại thay vì viết từ đầu.' },
}

export default function AdminCvPositionDetail() {
  const { publicId } = useParams()
  const { user } = useSession()
  const access = useAdminAccess(user)
  const can = { manage: access.has('cv_template.manage'), publish: access.has('cv_template.publish'), generate: access.has('cv_content.generate_ai') }
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [pane, setPane] = useState('settings')
  const { data: profile, isLoading, isError } = useQuery({ queryKey: ['admin-cv-position', publicId], queryFn: () => getAdminCvPosition(publicId) })
  // Mọi thay đổi đã lưu làm mới bản xem thử.
  const refreshPreview = () => queryClient.invalidateQueries({ queryKey: ['admin-cv-position-preview'] })
  const save = useMutation({
    mutationFn: (payload) => adminCvPositions.update(publicId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin-cv-position', publicId], updated)
      queryClient.invalidateQueries({ queryKey: ['admin-cv-positions'] })
      refreshPreview()
      message.success('Đã lưu.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu.')),
  })
  const tab = params.get('tab') in PARTS ? params.get('tab') : 'sections'
  const part = (key, content) => ({ key, label: PARTS[key].label, children: <div className="space-y-3"><p className="text-sm text-slate-500">{PARTS[key].hint}</p>{content}</div> })
  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (isError) return <Alert type="error" showIcon message="Không tải được vị trí." />
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link to={adminPath('/cv/positions')}><Button size="small" type="text" icon={<ArrowLeftOutlined />}>Vị trí</Button></Link>
      <div className="order-3 min-w-0 basis-full sm:order-2 sm:basis-0 sm:flex-1">
        <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{profile.position_name}</h1>
        {profile.industry_name && <p className="text-xs text-slate-500">{profile.industry_name}</p>}
      </div>
      <label className="order-2 ml-auto flex items-center gap-2 text-sm text-slate-600 sm:order-3"><Switch size="small" checked={profile.is_active} disabled={!can.manage || save.isPending} onChange={(is_active) => save.mutate({ is_active })} />Ứng viên chọn được</label>
    </header>
    <div className="xl:hidden"><Segmented block value={pane} onChange={setPane} options={[{ value: 'settings', label: 'Thiết lập', icon: <SettingOutlined /> }, { value: 'preview', label: 'CV ứng viên nhận', icon: <EyeOutlined /> }]} /></div>
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
      <section className={`min-w-0 rounded-[13px] border border-slate-200 bg-white px-4 pb-4 shadow-sm ${pane === 'preview' ? 'hidden xl:block' : ''}`}>
        <Tabs activeKey={tab} onChange={(next) => setParams({ tab: next }, { replace: true })} items={[
          part('sections', <SectionPresetEditor key={profile.updated_at} profile={profile} canManage={can.manage} saving={save.isPending} onSave={save.mutate} />),
          part('fields', <PositionFieldsEditor positionPublicId={profile.position_public_id} canManage={can.manage} onChanged={refreshPreview} />),
          part('samples', <SampleContentGrid profile={profile} canManage={can.manage} canPublish={can.publish} canGenerate={can.generate} onChanged={refreshPreview} />),
        ]} />
      </section>
      <div className={`min-w-0 xl:sticky xl:top-[calc(var(--admin-topbar-height,72px)_+_1rem)] ${pane === 'settings' ? 'hidden xl:block' : ''}`}><CandidatePreviewPanel positionPublicId={profile.position_public_id} positionName={profile.position_name} /></div>
    </div>
  </div>
}
