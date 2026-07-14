import { Alert, Button, Input, Modal, Select, Spin, message } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { submitJobApplication } from '@/entities/application'
import { getCv, getCvVersions, getMyCvs } from '@/entities/cv'

function versionLabel(version) {
  return `Phiên bản ${version.version_number}${version.version_kind === 'published' ? ' (đã publish)' : ''}`
}

export default function ApplyForJobModal({ open, onClose, onSubmitted, jobPublicId, jobTitle }) {
  const [cvs, setCvs] = useState([])
  const [selectedCvId, setSelectedCvId] = useState()
  const [cvDetail, setCvDetail] = useState(null)
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState()
  const [coverLetter, setCoverLetter] = useState('')
  const [loadingCvs, setLoadingCvs] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let active = true
    setLoadingCvs(true)
    setError('')
    getMyCvs()
      .then((items) => {
        if (!active) return
        setCvs(items)
        const initial = items.find((cv) => cv.is_default) || items[0]
        setSelectedCvId(initial?.public_id)
      })
      .catch(() => {
        if (active) setError('Không thể tải danh sách CV. Vui lòng thử lại.')
      })
      .finally(() => {
        if (active) setLoadingCvs(false)
      })
    return () => { active = false }
  }, [open])

  useEffect(() => {
    if (!open || !selectedCvId) return undefined
    let active = true
    setLoadingVersions(true)
    setCvDetail(null)
    setVersions([])
    setSelectedVersionId(undefined)
    Promise.all([getCv(selectedCvId), getCvVersions(selectedCvId)])
      .then(([cv, availableVersions]) => {
        if (!active) return
        setCvDetail(cv)
        setVersions(availableVersions)
        setSelectedVersionId(
          cv.published_version_public_id || cv.latest_version_public_id || availableVersions[0]?.public_id,
        )
      })
      .catch(() => {
        if (active) setError('Không thể tải các phiên bản CV để ứng tuyển.')
      })
      .finally(() => {
        if (active) setLoadingVersions(false)
      })
    return () => { active = false }
  }, [open, selectedCvId])

  async function submit() {
    if (!selectedCvId || !selectedVersionId) return
    setSubmitting(true)
    setError('')
    try {
      await submitJobApplication({
        jobPublicId,
        cvPublicId: selectedCvId,
        versionPublicId: selectedVersionId,
        coverLetter: coverLetter.trim(),
      })
      message.success('Đã gửi hồ sơ ứng tuyển.')
      onSubmitted?.()
      onClose()
    } catch (requestError) {
      const detail = requestError?.response?.data?.detail
      const fieldError = Object.values(requestError?.response?.data || {})
        .find((value) => Array.isArray(value) && value.length > 0)
      setError(detail || fieldError?.[0] || 'Không thể gửi hồ sơ ứng tuyển. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={jobTitle ? `Ứng tuyển: ${jobTitle}` : 'Ứng tuyển công việc'}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="submit" type="primary" loading={submitting} disabled={!selectedCvId || !selectedVersionId} onClick={submit}>
          Xác nhận ứng tuyển
        </Button>,
      ]}
    >
      <div className="space-y-4 py-2">
        <p className="text-sm text-slate-600">Chọn CV và phiên bản đã lưu. Nhà tuyển dụng chỉ xem snapshot bất biến của phiên bản bạn xác nhận.</p>
        {error && <Alert type="error" showIcon title={error} />}
        {loadingCvs ? <Spin /> : (
          <label className="block text-sm font-medium text-slate-700">
            CV ứng tuyển
            <Select
              aria-label="CV ứng tuyển"
              className="mt-1 w-full"
              value={selectedCvId}
              onChange={setSelectedCvId}
              options={cvs.map((cv) => ({ value: cv.public_id, label: `${cv.title}${cv.is_default ? ' (CV chính)' : ''}` }))}
              placeholder="Chọn CV"
            />
          </label>
        )}
        {selectedCvId && (loadingVersions ? <Spin /> : (
          <label className="block text-sm font-medium text-slate-700">
            Phiên bản đã lưu
            <Select
              aria-label="Phiên bản CV ứng tuyển"
              className="mt-1 w-full"
              value={selectedVersionId}
              onChange={setSelectedVersionId}
              options={versions.map((version) => ({ value: version.public_id, label: versionLabel(version) }))}
              placeholder="Chọn phiên bản CV"
            />
          </label>
        ))}
        {cvDetail && !cvDetail.published_version_public_id && (
          <Alert
            type="warning"
            showIcon
            title="CV này chưa được publish"
            description={<span>Bạn vẫn có thể gửi phiên bản đã lưu đang chọn. Nếu cần tạo phiên bản mới từ bản nháp, hãy <Link to={`/cvs/${selectedCvId}/edit`}>mở trang chỉnh sửa và lưu phiên bản</Link> trước khi ứng tuyển.</span>}
          />
        )}
        {!loadingCvs && cvs.length === 0 && <Alert type="info" showIcon title="Bạn chưa có CV để ứng tuyển." />}
        <label className="block text-sm font-medium text-slate-700">
          Thư giới thiệu <span className="font-normal text-slate-400">(không bắt buộc)</span>
          <Input.TextArea
            aria-label="Thư giới thiệu"
            className="mt-1"
            value={coverLetter}
            onChange={(event) => setCoverLetter(event.target.value)}
            maxLength={10000}
            rows={4}
          />
        </label>
      </div>
    </Modal>
  )
}
