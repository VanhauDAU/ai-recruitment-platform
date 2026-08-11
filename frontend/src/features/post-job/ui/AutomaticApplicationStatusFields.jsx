import { MailOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Form, Input, Select, Switch } from 'antd'

const DEADLINE_OPTIONS = [
  { value: 14, label: '2 tuần' },
  { value: 21, label: '3 tuần' },
  { value: 28, label: '4 tuần' },
  { value: 42, label: '6 tuần' },
  { value: 56, label: '8 tuần' },
]

export default function AutomaticApplicationStatusFields() {
  const form = Form.useFormInstance()
  const enabled = Form.useWatch('auto_reject_stale_applications', form)

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="automatic-application-status-title">
      <header className="flex gap-3 bg-slate-50 px-4 py-4 sm:px-5">
        <ThunderboltOutlined className="mt-0.5 text-lg text-emerald-600" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="automatic-application-status-title" className="m-0 text-base font-extrabold text-slate-900">
              Tự động cập nhật trạng thái hồ sơ
            </h3>
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Mới</span>
          </div>
          <p className="mb-0 mt-1 text-sm leading-6 text-emerald-700">
            Tự động xử lý hồ sơ tồn đọng, giúp bạn tập trung vào ứng viên tiềm năng thay vì quản lý thủ công tất cả hồ sơ ứng tuyển.
          </p>
        </div>
      </header>

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="m-0 min-w-0 flex-1 text-sm leading-6 text-slate-700">
            Nếu bạn chưa cập nhật trạng thái, hồ sơ tự động chuyển sang <strong>“Không đạt”</strong> sau
          </p>
          <Form.Item name="auto_reject_after_days" noStyle>
            <Select
              aria-label="Thời hạn tự động chuyển hồ sơ"
              className="w-full sm:!w-28"
              disabled={!enabled}
              options={DEADLINE_OPTIONS}
            />
          </Form.Item>
          <Form.Item name="auto_reject_stale_applications" valuePropName="checked" noStyle>
            <Switch aria-label="Bật tự động cập nhật trạng thái hồ sơ" />
          </Form.Item>
        </div>
        <p className="m-0 text-sm text-slate-500">
          Bạn sẽ nhận được email nhắc trước 3 ngày khi hồ sơ đến thời hạn trên.
        </p>

        <div className="border-t border-slate-200 pt-5">
          <h4 className="m-0 text-sm font-bold text-slate-800">Email thông báo cho ứng viên</h4>
          <p className="mb-0 mt-1 text-sm leading-6 text-slate-500">
            Email chỉ được gửi 3 ngày sau khi hồ sơ tự chuyển sang “Không đạt”. Trong thời gian này, bạn vẫn có thể đổi lại trạng thái hồ sơ.
          </p>
          <Form.Item
            className="!mb-0 !mt-4"
            name="auto_rejection_email_body"
            label={<span className="inline-flex items-center gap-2"><MailOutlined /> Nội dung email từ chối</span>}
            dependencies={['auto_reject_stale_applications']}
            rules={[{
              validator(_, value) {
                if (!form.getFieldValue('auto_reject_stale_applications') || value?.trim()) return Promise.resolve()
                return Promise.reject(new Error('Nhập nội dung email thông báo cho ứng viên.'))
              },
            }]}
          >
            <Input.TextArea
              aria-label="Nội dung email từ chối"
              autoSize={{ minRows: 6, maxRows: 10 }}
              disabled={!enabled}
              maxLength={1000}
              showCount
            />
          </Form.Item>
          <p className="mb-0 mt-2 text-xs leading-5 text-slate-400">
            Có thể dùng các biến: {'{job_title}'}, {'{company_name}'} và {'{auto_reject_weeks}'}.
          </p>
        </div>
      </div>
    </section>
  )
}
