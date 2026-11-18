import { Alert, Button, Modal, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { CvChoice } from '@/entities/cv/cv'
import { ProcvMascot } from '@/shared/ui/mascot'
import { analysisErrorCopy, isAnalysisActive, requestErrorCopy } from '../model/job-fit'
import { useJobFit } from '../model/use-job-fit'
import JobFitResult from './JobFitResult'
import './job-fit.css'

function formatTime(value) {
  return value
    ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : ''
}

function CvPicker({ cvs, loading, selectedId, onSelect, onAnalyze, busy }) {
  if (loading) return <Skeleton active paragraph={{ rows: 3 }} title={false} />
  if (!cvs.length) {
    return (
      <div className="jf-empty-state">
        <p>Bạn chưa có CV nào để so với tin này.</p>
        <Link to="/mau-cv" className="jf-link">Tạo CV</Link>
      </div>
    )
  }
  return (
    <div className="jf-picker">
      <p className="jf-subheading">Chọn CV để so với tin</p>
      <div className="jf-picker__list">
        {cvs.map((cv) => (
          <CvChoice key={cv.public_id} cv={cv} name="job-fit-cv" selected={cv.public_id === selectedId} onSelect={onSelect} />
        ))}
      </div>
      <Button type="primary" size="large" block disabled={!selectedId} loading={busy} onClick={() => onAnalyze(selectedId)}>
        Xem độ phù hợp
      </Button>
    </div>
  )
}

// Trạng thái thật từ backend: `queued` (chờ worker) hoặc `processing` (đang tính).
const PROGRESS_COPY = {
  queued: 'Đang xếp hàng, AI sẽ bắt đầu đọc CV ngay.',
  processing: 'AI đang đọc CV và so với từng yêu cầu của tin.',
}

function Progress({ status, cvTitle }) {
  return (
    <div className="jf-scan" role="status" aria-live="polite">
      <div className="jf-scan__stage" aria-hidden="true">
        <div className="jf-scan__doc">
          <i style={{ width: '62%' }} /><i /><i style={{ width: '80%' }} /><i style={{ width: '48%' }} /><i /><i style={{ width: '70%' }} />
          <span className="jf-scan__beam" />
        </div>
        <span className="jf-scan__mascot">
          <ProcvMascot blink emotion="thinking" float pose="checklist" size={76} talking />
        </span>
      </div>
      <div className="jf-scan__text">
        <p className="jf-scan__title">AI đang phân tích CV {cvTitle && <strong>{cvTitle}</strong>}</p>
        <p className="jf-scan__caption">{PROGRESS_COPY[status] || PROGRESS_COPY.processing}</p>
        <span className="jf-scan__bar" aria-hidden="true" />
      </div>
    </div>
  )
}

export default function JobFitDialog({ job, onClose, onApply }) {
  const fit = useJobFit(job.slug)
  const [picking, setPicking] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const { analysis } = fit
  const defaultCvId = fit.cvs.find((cv) => cv.is_default)?.public_id || fit.cvs[0]?.public_id
  const showPicker = picking || !analysis
  const succeeded = analysis?.status === 'succeeded'

  function analyze(cvPublicId) {
    setPicking(false)
    fit.analyze(cvPublicId)
  }

  return (
    <Modal open title="Độ phù hợp của CV với tin này" onCancel={onClose} footer={null} width={720} destroyOnHidden>
      <div className="jf-dialog">
        {showPicker ? (
          <CvPicker
            cvs={fit.cvs}
            loading={fit.cvsLoading}
            selectedId={selectedId || defaultCvId}
            onSelect={setSelectedId}
            onAnalyze={analyze}
            busy={fit.requesting}
          />
        ) : (
          <div className="jf-current">
            <span>
              CV <strong>{analysis.cv.title}</strong>
              {fit.isFromEarlier && succeeded && <span className="jf-muted"> (kết quả lần trước, {formatTime(analysis.completed_at)})</span>}
            </span>
            <Button type="link" onClick={() => setPicking(true)}>Đổi CV hoặc phân tích lại</Button>
          </div>
        )}

        {fit.requestError && <Alert type="error" showIcon message={requestErrorCopy(fit.requestError)} />}
        {!showPicker && isAnalysisActive(analysis) && <Progress status={analysis.status} cvTitle={analysis.cv?.title} />}
        {!showPicker && analysis?.status === 'failed' && (
          <Alert type="warning" showIcon message={analysisErrorCopy(analysis.error_code)} />
        )}
        {!showPicker && succeeded && (
          <>
            <JobFitResult result={analysis.result} />
            {onApply && (
              <div className="jf-actions">
                <Button type="primary" size="large" onClick={() => { onClose(); onApply() }}>Ứng tuyển tin này</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
