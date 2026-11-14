import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Radio, Select } from 'antd'
import { useEffect } from 'react'
import { COMPANY_REPORT_REASON_OPTIONS, submitCompanyReport } from '@/entities/company-report'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const DETAIL_MAX_LENGTH = 2000
const OTHER_DETAIL_MIN_LENGTH = 10

// Lỗi của một ô là mảng thông báo dưới tên ô đó.
function fieldErrors(error) {
  const data = error?.response?.data
  return ['reason', 'section_key', 'detail']
    .filter((name) => Array.isArray(data?.[name]))
    .map((name) => ({ name, errors: data[name] }))
}

// Máy chủ từ chối cả báo cáo (`{"detail": "<chuỗi>"}`), điển hình là ứng viên
// còn một báo cáo đang chờ xử lý cho chính công ty này: hiện ở đầu form.
function isRejected(error) {
  return error?.response?.status === 400 && fieldErrors(error).length === 0
}

export default function ReportCompanyModal({ company, sections = [], open, onClose }) {
  const [form] = Form.useForm()
  const mutation = useMutation({
    mutationFn: (payload) => submitCompanyReport(company.public_id, payload),
    onSuccess: () => {
      message.success('Đã gửi báo cáo. Quản trị viên sẽ xem xét trước khi kết luận.')
      onClose()
    },
    onError: (error) => {
      const fields = fieldErrors(error)
      if (fields.length) form.setFields(fields)
      else if (!isRejected(error)) message.error(getApiErrorMessage(error, 'Không thể gửi báo cáo lúc này.'))
    },
  })
  const resetMutation = mutation.reset

  useEffect(() => {
    if (open) {
      form.resetFields()
      resetMutation()
    }
  }, [form, open, resetMutation])

  function close() {
    if (!mutation.isPending) onClose()
  }

  return (
    <Modal
      centered
      closable={!mutation.isPending}
      destroyOnHidden
      footer={null}
      keyboard={!mutation.isPending}
      mask={{ closable: !mutation.isPending }}
      onCancel={close}
      open={open}
      title={<h2 className="m-0 text-lg font-bold text-slate-900">Báo cáo thông tin công ty</h2>}
      width={560}
    >
      <p className="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        <strong className="mr-2 font-semibold text-slate-900">Công ty:</strong>
        <span className="break-words">{company.name}</span>
      </p>
      {isRejected(mutation.error) && (
        <Alert
          className="mb-4"
          showIcon
          type="warning"
          title={getApiErrorMessage(mutation.error, 'Bạn đã báo cáo công ty này và báo cáo đang chờ xử lý.')}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={(values) => mutation.mutate({
          reason: values.reason,
          section_key: values.section_key || '',
          detail: values.detail?.trim() || '',
        })}
      >
        <Form.Item label="Lý do báo cáo" name="reason" rules={[{ required: true, message: 'Chọn lý do báo cáo.' }]}>
          <Radio.Group vertical options={COMPANY_REPORT_REASON_OPTIONS} />
        </Form.Item>
        {sections.length > 0 && (
          <Form.Item label="Phần thông tin liên quan" name="section_key">
            <Select
              allowClear
              aria-label="Phần thông tin liên quan"
              options={sections.map(({ key, title }) => ({ value: key, label: title }))}
              placeholder="Không chọn phần cụ thể"
            />
          </Form.Item>
        )}
        <Form.Item
          dependencies={['reason']}
          label="Mô tả chi tiết"
          name="detail"
          rules={[({ getFieldValue }) => ({
            validator(_, value) {
              return getFieldValue('reason') !== 'other' || (value || '').trim().length >= OTHER_DETAIL_MIN_LENGTH
                ? Promise.resolve()
                : Promise.reject(new Error(`Mô tả ít nhất ${OTHER_DETAIL_MIN_LENGTH} ký tự khi chọn “Lý do khác”.`))
            },
          })]}
        >
          <Input.TextArea
            aria-label="Mô tả chi tiết"
            autoSize={{ minRows: 4, maxRows: 7 }}
            maxLength={DETAIL_MAX_LENGTH}
            placeholder="Nêu thông tin chưa đúng và căn cứ để quản trị viên kiểm tra."
            showCount
          />
        </Form.Item>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button className="min-h-11 w-full sm:w-auto" disabled={mutation.isPending} onClick={close}>
            Hủy
          </Button>
          <Button className="min-h-11 w-full sm:w-auto" htmlType="submit" loading={mutation.isPending} type="primary">
            Gửi báo cáo
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
