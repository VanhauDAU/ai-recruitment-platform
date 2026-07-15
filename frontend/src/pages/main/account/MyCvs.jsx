import { CloudUploadOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { importCvFile } from '@/entities/cv'
import { useSiteSettings } from '@/entities/site-settings'
import { useMyCvsData } from './model/use-my-cvs-data'
import ArchivedCvCard from './ui/ArchivedCvCard'
import CvListSection from './ui/CvListSection'
import MyCvsBanner from './ui/MyCvsBanner'

export default function MyCvs() {
  const { siteName } = useSiteSettings()
  const navigate = useNavigate()
  const { builderCvs, uploadedCvs, archivedCvs, loading, refresh } = useMyCvsData()
  const fileInputRef = useRef(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importCvFile(file)
      message.success(`Đã tải lên tệp ${file.name} thành công.`)
      refresh()
    } catch {
      message.error('Không thể tải CV lên. Chỉ hỗ trợ tệp PDF hoặc DOCX.')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input for upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx"
        className="hidden"
      />

      <MyCvsBanner onCreateCv={() => navigate('/mau-cv')} onUploadCv={handleUploadClick} />

      <CvListSection
        title={`CV đã tạo trên ${siteName}`}
        action={{ label: '+ Tạo CV', onClick: () => navigate('/mau-cv') }}
        emptyIcon={<InboxOutlined className="text-3xl" />}
        emptyText="Chưa có CV nào được tạo."
        cvs={builderCvs}
        loading={loading}
        onRefresh={refresh}
      />

      <CvListSection
        title={`CV đã tải lên ${siteName}`}
        action={{ label: <><UploadOutlined /> Tải CV lên</>, onClick: handleUploadClick }}
        emptyIcon={<CloudUploadOutlined className="text-3xl" />}
        emptyText="Chưa có CV nào được tải lên."
        cvs={uploadedCvs}
        loading={loading}
        onRefresh={refresh}
      />

      {archivedCvs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 sm:text-[17px]">CV đã lưu trữ</h3>
            <span className="text-xs font-medium text-slate-500">Có thời hạn khôi phục</span>
          </div>
          <div className="mt-5 space-y-3">
            {archivedCvs.map((cv) => (
              <ArchivedCvCard key={cv.public_id} cv={cv} onRefresh={refresh} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
