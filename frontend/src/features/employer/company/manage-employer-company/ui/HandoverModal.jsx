import { SwapOutlined } from '@ant-design/icons'
import { Alert, Modal, Select } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'

/**
 * Hand one person's jobs and campaigns (with every application) to a verified
 * member. `source` is a member card or a former member row.
 */
export default function HandoverModal({ source, members, busy, onConfirm, onClose }) {
  const [target, setTarget] = useState()
  const candidates = members.filter((member) => member.can_receive_jobs && member.member_id !== source?.member_id)
  const summary = source && [
    m.employer_company_handover_jobs({ count: source.job_count, active: source.active_job_count }),
    source.unanswered_application_count && m.employer_company_handover_unanswered({ count: source.unanswered_application_count }),
    source.open_campaign_count && m.employer_company_handover_campaigns({ count: source.open_campaign_count }),
  ].filter(Boolean).join(', ')

  return (
    <Modal
      open={Boolean(source)}
      title={<span><SwapOutlined /> {m.employer_company_handover_title({ name: source?.display_name })}</span>}
      okText={m.employer_company_handover_ok()}
      cancelText={m.employer_company_close()}
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
        title={m.employer_company_handover_summary({ summary })}
        description={m.employer_company_handover_description()}
      />
      <Select
        className="w-full"
        aria-label={m.employer_company_handover_select_label()}
        placeholder={m.employer_company_handover_select_placeholder()}
        value={target}
        onChange={setTarget}
        notFoundContent={m.employer_company_handover_no_members()}
        options={candidates.map((member) => ({
          value: member.member_id,
          label: [member.display_name, member.role_label, member.position_title].filter(Boolean).join(' · '),
        }))}
      />
    </Modal>
  )
}
