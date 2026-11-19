import { Checkbox, DatePicker, Modal } from 'antd'
import { m } from '@/shared/config/i18n'

// Reopening makes the job public again, so it asks for the same commitment as
// publishing. Extending a job that is already public does not.
export default function JobLifecycleModal({
  action,
  commitment,
  commitmentAccepted,
  deadline,
  earliestDeadline,
  latestDeadline,
  loading,
  onCancel,
  onCommitmentChange,
  onDeadlineChange,
  onSubmit,
}) {
  return (
    <Modal
      open={Boolean(action)}
      title={action === 'reopen' ? m.employer_job_lifecycle_reopen_title() : m.employer_job_lifecycle_extend_title()}
      okText={action === 'reopen' ? m.employer_job_header_reopen() : m.employer_job_list_extend()}
      cancelText={m.employer_job_form_cancel()}
      confirmLoading={loading}
      width={520}
      onCancel={onCancel}
      onOk={onSubmit}
    >
      <div className="space-y-4">
        <div>
          <label
            className="mb-1.5 block text-sm font-semibold text-slate-700"
            htmlFor="job-extension-deadline"
          >
            {m.employer_job_form_deadline()}
          </label>
          <DatePicker
            id="job-extension-deadline"
            className="!w-full"
            value={deadline}
            disabledDate={(current) => current && (
              current.isBefore(earliestDeadline, 'day')
              || current.isAfter(latestDeadline, 'day')
            )}
            format="DD/MM/YYYY"
            onChange={onDeadlineChange}
          />
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            {m.employer_job_lifecycle_latest({ date: latestDeadline.format('DD/MM/YYYY') })}
          </p>
        </div>
        {action === 'reopen' && (
          commitment ? (
            <Checkbox
              checked={commitmentAccepted}
              onChange={(event) => onCommitmentChange(event.target.checked)}
            >
              {commitment.text}
            </Checkbox>
          ) : (
            <p className="text-xs font-semibold text-red-600">
              {m.employer_job_lifecycle_commitment_failed()}
            </p>
          )
        )}
      </div>
    </Modal>
  )
}
