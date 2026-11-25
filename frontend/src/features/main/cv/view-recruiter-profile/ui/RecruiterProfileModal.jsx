import { useQuery } from '@tanstack/react-query'
import { Grid, Modal, Skeleton, Tabs } from 'antd'
import { ExtractedProfile } from '@/entities/application/job-fit'
import { FittedCvPreview, getCvOwnerView, UploadedCvPreview } from '@/entities/cv/cv'
import { m } from '@/shared/config/i18n'
import { getCvExtractedProfile } from '../api/recruiter-profile.api'
import './recruiter-profile.css'

const POLL_MS = 3000
const FAILED_COPY = {
  cv_text_unavailable: () => m.candidate_recruiter_profile_failed_scan(),
  cv_insufficient_content: () => m.candidate_recruiter_profile_failed_empty(),
}

function CvColumn({ cv }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cv', 'owner-view', cv.public_id],
    queryFn: () => getCvOwnerView(cv.public_id),
    enabled: cv.cv_type !== 'uploaded',
  })
  if (cv.cv_type === 'uploaded') {
    return <UploadedCvPreview publicId={cv.public_id} title={cv.title} className="rp-file" />
  }
  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (isError || !data) return <p className="rp-muted">{m.candidate_recruiter_profile_cv_failed()}</p>
  const { version } = data
  return (
    <FittedCvPreview
      document={{
        schema_version: version.schema_version,
        content_json: version.content_json,
        layout_json: version.layout_json,
        style_json: version.style_json,
      }}
      rendererKey={version.template_renderer_key}
      assets={version.assets}
    />
  )
}

function ProfileColumn({ cv }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cv', 'extracted-profile', cv.public_id],
    queryFn: () => getCvExtractedProfile(cv.public_id),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? POLL_MS : false),
  })
  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (isError) return <p className="rp-muted">{m.candidate_recruiter_profile_load_failed()}</p>
  if (data.status === 'pending') {
    return <p className="rp-muted">{m.candidate_recruiter_profile_pending()}</p>
  }
  if (data.status === 'failed') {
    return <p className="rp-muted">{FAILED_COPY[data.error_code]?.() || m.candidate_recruiter_profile_failed()}</p>
  }
  return (
    <>
      <ExtractedProfile profile={data.profile} />
      <p className="rp-note">{m.candidate_recruiter_profile_note()}</p>
    </>
  )
}

/** Hai cột: CV bên trái, hồ sơ trích xuất từ CV đó bên phải. Màn hẹp chuyển thành hai tab. */
export default function RecruiterProfileModal({ cv, onClose }) {
  const wide = Grid.useBreakpoint().lg
  return (
    <Modal open title={m.candidate_recruiter_profile_title({ title: cv.title })} onCancel={onClose} footer={null} width={1040} destroyOnHidden>
      {wide ? (
        <div className="rp-columns">
          <section aria-label="CV" className="rp-cv"><CvColumn cv={cv} /></section>
          <section aria-label={m.candidate_recruiter_profile_tab_profile()} className="rp-profile"><ProfileColumn cv={cv} /></section>
        </div>
      ) : (
        <Tabs
          items={[
            { key: 'profile', label: m.candidate_recruiter_profile_tab_profile(), children: <ProfileColumn cv={cv} /> },
            { key: 'cv', label: m.candidate_recruiter_profile_tab_cv(), children: <div className="rp-cv"><CvColumn cv={cv} /></div> },
          ]}
        />
      )}
    </Modal>
  )
}
