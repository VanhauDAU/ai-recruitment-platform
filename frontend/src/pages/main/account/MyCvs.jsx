import { UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router'
import { useSiteSettings } from '@/entities/site-settings'
import { EnableCvSearchBanner } from '@/features/update-recruiter-visibility'
import { useMyCvsData } from './model/use-my-cvs-data'
import CvListSection from './ui/CvListSection'

export default function MyCvs() {
  const { siteName } = useSiteSettings()
  const navigate = useNavigate()
  const { builderCvs, uploadedCvs, loading, refresh } = useMyCvsData()
  // CV mới nhất chưa bật tìm việc; ẩn khối khi mọi CV đã bật.
  const cvToPromote = [...builderCvs, ...uploadedCvs]
    .filter((cv) => !cv.recruiter_searchable)
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0]

  return (
    <div className="space-y-6">
      {cvToPromote && <EnableCvSearchBanner key={cvToPromote.public_id} cv={cvToPromote} />}

      <CvListSection
        title={`CV đã tạo trên ${siteName}`}
        action={{ label: '+ Tạo CV', onClick: () => navigate('/mau-cv') }}
        emptyText="Chưa có CV nào được tạo."
        cvs={builderCvs}
        loading={loading}
        onRefresh={refresh}
      />

      <CvListSection
        title={`CV đã tải lên ${siteName}`}
        action={{ label: <><UploadOutlined /> Tải CV lên</>, onClick: () => navigate('/tai-cv-len') }}
        emptyText="Chưa có CV nào được tải lên."
        cvs={uploadedCvs}
        loading={loading}
        onRefresh={refresh}
      />
    </div>
  )
}
