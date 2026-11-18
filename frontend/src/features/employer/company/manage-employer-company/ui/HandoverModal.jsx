import { SwapOutlined } from '@ant-design/icons'
import { Alert, Modal, Select } from 'antd'
import { useState } from 'react'

/**
 * Hand one person's jobs and campaigns (with every application) to a verified
 * member. `source` is a member card or a former member row.
 */
export default function HandoverModal({ source, members, busy, onConfirm, onClose }) {
  const [target, setTarget] = useState()
  const candidates = members.filter((member) => member.can_receive_jobs && member.member_id !== source?.member_id)
  const summary = source && [
    `${source.job_count} tin tuyển dụng (${source.active_job_count} đang tuyển)`,
    source.unanswered_application_count && `${source.unanswered_application_count} hồ sơ chờ phản hồi`,
    source.open_campaign_count && `${source.open_campaign_count} chiến dịch đang mở`,
  ].filter(Boolean).join(', ')

  return (
    <Modal
      open={Boolean(source)}
      title={<span><SwapOutlined /> Giao tin của {source?.display_name}</span>}
      okText="Giao tin"
      cancelText="Đóng"
      okButtonProps={{ disabled: !target, loading: busy }}
      onOk={() => onConfirm(source, target)}
      onCancel={onClose}
      afterClose={() => setTarget(undefined)}
      destroyOnHidden
    >
      <Alert
        className="mb-3"
        type="info"
        showIcon
        title={`Sẽ chuyển: ${summary}.`}
        description="Người nhận tiếp tục xử lý toàn bộ hồ sơ ứng tuyển và lịch sử của các tin này. Tin đang tuyển vẫn hiển thị bình thường."
      />
      <Select
        className="w-full"
        aria-label="Chọn người nhận tin tuyển dụng"
        placeholder="Chọn thành viên đã xác thực"
        value={target}
        onChange={setTarget}
        notFoundContent="Chưa có thành viên nào đã xác thực tài khoản"
        options={candidates.map((member) => ({
          value: member.member_id,
          label: [member.display_name, member.role_label, member.position_title].filter(Boolean).join(' · '),
        }))}
      />
    </Modal>
  )
}
