import { useQuery } from '@tanstack/react-query'
import { Alert, Modal, Radio, Skeleton } from 'antd'
import { useState } from 'react'
import { getMyCvs } from '@/entities/cv'

/** Pick another CV for an application the recruiter has not answered yet. */
export default function ReplaceApplicationCvModal({ open, currentCvId, saving, onCancel, onSubmit }) {
  const cvsQuery = useQuery({ queryKey: ['my-cvs'], queryFn: getMyCvs, enabled: open })
  const [selectedId, setSelectedId] = useState()
  const cvs = (cvsQuery.data || []).filter((cv) => cv.latest_version_public_id)
  const selected = cvs.find((cv) => cv.public_id === (selectedId ?? currentCvId))
  const ready = Boolean(selected && selected.application_ready !== false)

  return (
    <Modal
      open={open}
      title="Đổi CV đã nộp"
      okText="Nộp CV này"
      cancelText="Hủy"
      okButtonProps={{ disabled: !ready, loading: saving }}
      onOk={() => onSubmit({ cvPublicId: selected.public_id, versionPublicId: selected.latest_version_public_id })}
      onCancel={onCancel}
      destroyOnHidden
    >
      <p className="mb-3 text-sm text-slate-600">
        Nhà tuyển dụng sẽ thấy hồ sơ của bạn như một hồ sơ mới với CV vừa chọn.
      </p>
      {cvsQuery.isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
        <Radio.Group
          className="flex w-full flex-col gap-2"
          value={selected?.public_id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {cvs.map((cv) => (
            <Radio key={cv.public_id} value={cv.public_id} disabled={cv.application_ready === false}>
              <span className="font-medium text-slate-700">{cv.title}</span>
              {cv.application_ready === false && (
                <span className="ml-2 text-xs text-red-600">Chưa đủ thông tin để ứng tuyển</span>
              )}
            </Radio>
          ))}
        </Radio.Group>
      )}
      {!cvsQuery.isLoading && !cvs.length && <Alert type="info" showIcon title="Bạn chưa có CV nào để nộp." />}
    </Modal>
  )
}
