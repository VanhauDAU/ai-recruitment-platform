import { DatePicker, Modal } from 'antd'

export default function JobLifecycleModal({
  action,
  deadline,
  earliestDeadline,
  latestDeadline,
  loading,
  onCancel,
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
      </div>
    </Modal>
  )
}
