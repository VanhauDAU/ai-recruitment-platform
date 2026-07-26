import { useMutation } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'
import {
  JOB_REPORT_REASON_OPTIONS,
  submitJobReport,
} from '@/entities/job-report'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

export default function ReportJobModal({
  jobPublicId,
  jobTitle,
  onClose,
  onSubmitted,
  open,
}) {
  const [form] = Form.useForm()
  const mutation = useMutation({
    mutationFn: (payload) => submitJobReport(jobPublicId, payload),
    onSuccess: (report) => {
      message.success('Đã gửi báo cáo. Quản trị viên sẽ xem xét trước khi kết luận.')
      form.resetFields()
      onSubmitted?.(report)
      onClose()
    },
    onError: (error) => {
      const fields = ['reason', 'detail']
        .filter((name) => error?.response?.data?.[name])
        .map((name) => ({
          name,
          errors: [].concat(error.response.data[name]),
        }))
      if (fields.length) form.setFields(fields)
      else message.error(getApiErrorMessage(error, 'Không thể gửi báo cáo lúc này.'))
    },
  })
  const resetMutation = mutation.reset

  useEffect(() => {
    if (open) {
      form.resetFields()
      resetMutation()
    }
  }, [form, open, resetMutation])

  function handleClose() {
    if (mutation.isPending) return
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      centered
      closable={!mutation.isPending}
      destroyOnHidden
      footer={null}
      keyboard={!mutation.isPending}
      mask={{ closable: !mutation.isPending }}
      onCancel={handleClose}
      open={open}
      title={(
        <h2 className="m-0 text-center text-xl font-bold text-emerald-600 sm:text-2xl">
          Phản ánh tin tuyển dụng không chính xác
        </h2>
      )}
      width={600}
    >
      <p className="mx-auto mb-5 max-w-xl text-center text-sm leading-6 text-slate-600">
        Hãy tìm hiểu kỹ về nhà tuyển dụng và công việc bạn ứng tuyển. Nếu thấy
        thông tin không đúng, hãy gửi phản ánh để quản trị viên kiểm tra.
      </p>
      <p className="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        <strong className="mr-2 font-semibold text-slate-900">Tin tuyển dụng:</strong>
        <span className="break-words">{jobTitle}</span>
      </p>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate({
          reason: values.reason,
          detail: values.detail?.trim() || '',
        })}
        requiredMark="optional"
      >
        <Form.Item
          label="Lý do báo cáo"
          name="reason"
          rules={[{ required: true, message: 'Chọn lý do báo cáo.' }]}
        >
          <Select
            aria-label="Lý do báo cáo"
            options={JOB_REPORT_REASON_OPTIONS}
            placeholder="Chọn vấn đề bạn phát hiện"
            size="large"
          />
        </Form.Item>
        <Form.Item
          dependencies={['reason']}
          label="Mô tả chi tiết"
          name="detail"
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (getFieldValue('reason') !== 'other' || value?.trim()) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('Mô tả cụ thể khi chọn “Lý do khác”.'))
              },
            }),
          ]}
        >
          <Input.TextArea
            aria-label="Mô tả chi tiết"
            autoSize={{ minRows: 4, maxRows: 7 }}
            maxLength={1000}
            placeholder="Cung cấp thông tin giúp quản trị viên kiểm tra chính xác hơn."
            showCount
          />
        </Form.Item>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            className="min-h-11 w-full sm:w-auto"
            disabled={mutation.isPending}
            onClick={handleClose}
          >
            Hủy
          </Button>
          <Button
            className="min-h-11 w-full sm:w-auto"
            htmlType="submit"
            loading={mutation.isPending}
            type="primary"
          >
            Gửi báo cáo
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
