import { Checkbox, DatePicker, Modal } from 'antd'

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
      title={action === 'reopen' ? 'Mở lại tin tuyển dụng' : 'Gia hạn tin tuyển dụng'}
      okText={action === 'reopen' ? 'Mở lại tin' : 'Gia hạn'}
      cancelText="Hủy"
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
            Hạn nhận hồ sơ
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
            Có thể chọn đến {latestDeadline.format('DD/MM/YYYY')}.
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
              Chưa tải được nội dung cam kết đăng tin. Tải lại trang để mở lại tin.
            </p>
          )
        )}
      </div>
    </Modal>
  )
}
