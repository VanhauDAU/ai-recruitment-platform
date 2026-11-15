import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Modal, Skeleton, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getRecruiterVisibility, updateRecruiterVisibility } from '@/entities/candidate-preferences'
import { cvApiErrorMessage, getMyCvs, setCvRecruiterSearchable } from '@/entities/cv'
import { message } from '@/shared/lib/toast'
import { CONSENT_QUERY_KEY } from '../model/use-cv-recruiter-search'

const CV_TYPE_LABELS = { builder: 'CV online', uploaded: 'CV tải lên' }

function formatUpdatedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Chọn những CV cho NTD tìm thấy, cùng sự đồng ý ở mức hồ sơ, trong một lần lưu. */
export default function RecruiterSearchListModal({ open, onClose }) {
  const queryClient = useQueryClient()
  const cvsQuery = useQuery({ queryKey: ['my-cvs', 'recruiter-searchable'], queryFn: getMyCvs, enabled: open })
  const consentQuery = useQuery({ queryKey: CONSENT_QUERY_KEY, queryFn: getRecruiterVisibility, enabled: open })
  const [selected, setSelected] = useState({})
  const [consented, setConsented] = useState(false)
  const [saving, setSaving] = useState(false)
  const cvs = cvsQuery.data || []

  // Mỗi lần mở popup bắt đầu lại từ trạng thái đã lưu.
  useEffect(() => {
    if (!open || !cvsQuery.data || !consentQuery.data) return
    setSelected(Object.fromEntries(cvsQuery.data.map((cv) => [cv.public_id, Boolean(cv.recruiter_searchable)])))
    setConsented(Boolean(consentQuery.data.enabled))
  }, [open, cvsQuery.data, consentQuery.data])

  const anySelected = Object.values(selected).some(Boolean)
  const loading = cvsQuery.isLoading || consentQuery.isLoading

  async function save() {
    setSaving(true)
    try {
      if (consented !== Boolean(consentQuery.data?.enabled)) {
        const saved = await updateRecruiterVisibility({
          enabled: consented,
          confirmed: consented,
          policy_version: consentQuery.data?.policy_version || 'v1',
          source: 'cv_search_list',
          source_path: window.location.pathname,
        })
        queryClient.setQueryData(CONSENT_QUERY_KEY, saved)
      }
      const changed = cvs.filter((cv) => Boolean(cv.recruiter_searchable) !== selected[cv.public_id])
      await Promise.all(changed.map((cv) => setCvRecruiterSearchable(cv.public_id, selected[cv.public_id])))
      await queryClient.invalidateQueries({ queryKey: ['my-cvs'] })
      message.success('Đã cập nhật danh sách CV cho phép NTD tìm kiếm.')
      onClose()
    } catch (error) {
      message.error(cvApiErrorMessage(error, 'Không thể lưu thay đổi lúc này.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Chọn CV bật cho phép NTD tìm kiếm"
      onCancel={onClose}
      width={620}
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Checkbox checked={consented} onChange={(event) => setConsented(event.target.checked)} className="text-left">
            Tôi đồng ý cho phép NTD tìm kiếm hồ sơ của tôi
          </Checkbox>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Hủy</Button>
            <Button
              type="primary"
              loading={saving}
              disabled={loading || (anySelected && !consented)}
              onClick={save}
              className="!bg-[#00b14f] disabled:!bg-slate-200"
            >
              Lưu
            </Button>
          </div>
        </div>
      )}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : cvs.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Bạn chưa có CV nào.</p>
      ) : (
        <ul className="space-y-3">
          {cvs.map((cv) => (
            <li key={cv.public_id} className="flex items-start gap-3">
              <Switch
                aria-label={`Cho phép NTD tìm kiếm ${cv.title}`}
                checked={Boolean(selected[cv.public_id])}
                onChange={(checked) => setSelected((current) => ({ ...current, [cv.public_id]: checked }))}
                className={selected[cv.public_id] ? '!bg-[#00b14f]' : ''}
              />
              <div className="min-w-0">
                <Link
                  to={`/cvs/${cv.public_id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-bold !text-slate-800 hover:!text-[#00b14f]"
                >
                  {cv.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {CV_TYPE_LABELS[cv.cv_type] || 'CV'} <span className="mx-1 text-slate-300">|</span> Cập nhật {formatUpdatedAt(cv.updated_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-xs italic leading-5 text-slate-500">
        * Khi tắt cho phép tìm kiếm, NTD sẽ không thể tìm thấy và chủ động kết nối với bạn qua CV đó.
        {anySelected && !consented && ' Hãy tick đồng ý bên dưới để lưu các CV đang bật.'}
      </p>
    </Modal>
  )
}
