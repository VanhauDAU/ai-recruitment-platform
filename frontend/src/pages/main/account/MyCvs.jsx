import { CloudUploadOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { message } from 'antd'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { importCvFile } from '@/entities/cv'
import { useSiteSettings } from '@/entities/site-settings'
import { useMyCvsData } from './model/use-my-cvs-data'
import CvListSection from './ui/CvListSection'
import MyCvsBanner from './ui/MyCvsBanner'

export default function MyCvs() {
  const { siteName } = useSiteSettings()
  const navigate = useNavigate()
  const { builderCvs, uploadedCvs, loading, refresh } = useMyCvsData()
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
    </div>
  )
}
