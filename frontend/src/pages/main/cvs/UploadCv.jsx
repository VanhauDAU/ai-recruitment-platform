import { CloudUploadOutlined, FileDoneOutlined, FolderOpenOutlined, LockOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { getMyCvs } from '@/entities/cv'
import { useSiteSettings } from '@/entities/site-settings'
import { UploadCvForm } from '@/features/upload-cv'
import UploadCvSuccess from './ui/UploadCvSuccess'

const BENEFITS = [
  { icon: FolderOpenOutlined, tone: 'bg-emerald-50 text-[#00b14f]', title: 'Luôn sẵn trong tài khoản', text: 'Xem bản gốc và quản lý CV của bạn ở mọi thiết bị.' },
  { icon: TeamOutlined, tone: 'bg-orange-50 text-orange-500', title: 'Để nhà tuyển dụng tìm thấy bạn', text: 'Bật "Cho phép NTD tìm kiếm" trên CV để nhà tuyển dụng chủ động kết nối.' },
  { icon: FileDoneOutlined, tone: 'bg-blue-50 text-blue-600', title: 'Chuyển thành CV online', text: 'Chọn một mẫu, hệ thống chuyển nội dung CV của bạn sang mẫu chuẩn ATS.' },
  { icon: LockOutlined, tone: 'bg-red-50 text-red-500', title: 'Riêng tư và an toàn', text: 'Tệp được kiểm tra an toàn; chỉ bạn xem được bản gốc của CV.' },
]

export default function UploadCv() {
  const { siteName, settings } = useSiteSettings()
  const [uploaded, setUploaded] = useState(false)
  const { data: cvs } = useQuery({ queryKey: ['my-cvs', 'upload-limit'], queryFn: getMyCvs })
  const maxCvs = Number(settings.candidate_max_cvs) || 0
  const limitReached = maxCvs > 0 && (cvs?.length || 0) >= maxCvs

  if (uploaded) return <UploadCvSuccess siteName={siteName} />

  return (
    <div className="bg-slate-100 px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl bg-white shadow-sm">
        <header className="flex items-center justify-between gap-4 bg-gradient-to-r from-[#0d5c3a] to-[#137a4e] px-6 py-6 text-white md:px-8">
          <div>
            <h1 className="text-lg font-bold md:text-xl">Tải CV lên để cơ hội việc làm tự tìm đến bạn</h1>
            <p className="mt-1 text-sm text-emerald-100">Rút ngắn thời gian tìm được công việc phù hợp với bạn.</p>
          </div>
          <CloudUploadOutlined className="hidden text-6xl text-emerald-300 sm:block" />
        </header>

        <div className="space-y-6 px-5 py-6 md:px-8">
          <p className="text-sm leading-6 text-slate-600">
            Đã có sẵn CV? Chỉ cần tải lên để lưu trữ, cho nhà tuyển dụng tìm thấy và chuyển nhanh sang CV online trên {siteName}.
          </p>
          {limitReached && (
            <Alert
              type="warning"
              showIcon
              title={`Hiện tại tài khoản của bạn chỉ hỗ trợ tạo ${maxCvs} CV!`}
              description={<>Hãy xóa bớt CV không dùng trong <Link to="/tai-khoan/cv-cua-toi">CV của tôi</Link> để tải CV mới.</>}
            />
          )}
          <UploadCvForm disabled={limitReached} onUploaded={() => setUploaded(true)} />

          <div className="grid gap-4 border-t border-slate-200 pt-6 md:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, tone, title, text }) => (
              <div key={title} className="rounded-xl border border-slate-200 p-5 text-center">
                <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl ${tone}`}><Icon /></span>
                <h2 className="mt-3 font-bold text-slate-800">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
