import { App, Button, Form, Input, Modal } from 'antd'
import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { submitFeedback } from '../api/submit-feedback.api'
import { useAuth } from '@/features/auth'
import { useSiteSettings } from '@/entities/site-settings'

// Chủ đề góp ý — khớp Feedback.Category ở backend.
const FEEDBACK_TOPICS = [
  { value: 'ui_ux', label: 'Giao diện, trải nghiệm' },
  { value: 'feature', label: 'Tính năng sản phẩm' },
  { value: 'job_quality', label: 'Chất lượng tin tuyển dụng' },
  { value: 'account', label: 'Tài khoản & bảo mật' },
  { value: 'performance', label: 'Tốc độ, hiệu năng' },
  { value: 'other', label: 'Khác' },
]

// Mức hài lòng — khớp Feedback.Satisfaction ở backend.
const SATISFACTIONS = [
  { value: 'very_unsatisfied', emoji: '😖', label: 'Rất tệ' },
  { value: 'unsatisfied', emoji: '🙁', label: 'Tệ' },
  { value: 'neutral', emoji: '😐', label: 'Bình thường' },
  { value: 'satisfied', emoji: '🙂', label: 'Tốt' },
  { value: 'very_satisfied', emoji: '😍', label: 'Tuyệt vời' },
]

// Form góp ý sản phẩm (mở từ cụm nút nổi). Chủ đề + mức hài lòng là state
// ngoài AntD Form (UI dạng chip/emoji) nên validate chủ đề thủ công.
export default function FeedbackModal({ open, onClose }) {
  const { message } = App.useApp()
  const { isAuthenticated } = useAuth()
  const { siteName } = useSiteSettings()
  const [topic, setTopic] = useState(null)
  const [topicError, setTopicError] = useState(false)
  const [satisfaction, setSatisfaction] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  // Mỗi lần mở lại là một lượt góp ý mới, không giữ nháp cũ.
  useEffect(() => {
    if (!open) return
    setTopic(null)
    setTopicError(false)
    setSatisfaction(null)
    form.resetFields()
  }, [open, form])

  async function handleFeedback(values) {
    if (!topic) {
      setTopicError(true)
      return
    }
    setSubmitting(true)
    try {
      await submitFeedback({
        category: topic,
        content: values.content,
        satisfaction: satisfaction || '',
        phone: values.phone || '',
        email: values.email || '',
        page_url: window.location.pathname,
      })
      message.success('Cảm ơn bạn đã góp ý! Chúng tôi sẽ xem xét sớm nhất.')
      onClose()
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Gửi góp ý thất bại, vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onCancel={onClose} title={null} footer={null} centered width={780} destroyOnHidden>
      <div className="pt-1">
        <h3 className="text-xl font-extrabold text-gray-900">Góp ý sản phẩm</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
          Phản hồi của bạn rất quan trọng, {siteName} mong nhận được nhiều góp ý từ bạn để cải thiện sản phẩm tốt hơn.
        </p>
      </div>

      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleFeedback} className="!mt-5">
        {/* Chủ đề: pill chọn trực tiếp, không dropdown */}
        <div className="mb-5">
          <p className="mb-2.5 text-sm font-semibold text-gray-800">
            Chủ đề cần góp ý <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TOPICS.map((option) => {
              const active = topic === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setTopic(option.value); setTopicError(false) }}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-[var(--brand-primary)] text-white shadow-sm shadow-emerald-600/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-[var(--brand-primary)]'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {topicError && <p className="mt-1.5 text-xs text-red-500">Vui lòng chọn chủ đề góp ý.</p>}
        </div>

        <Form.Item
          name="content"
          label={<span className="text-sm font-semibold text-gray-800">Mô tả góp ý <span className="text-red-500">*</span></span>}
          rules={[
            { required: true, message: 'Vui lòng nhập mô tả góp ý.' },
            { min: 10, message: 'Mô tả góp ý cần ít nhất 10 ký tự.' },
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={2000}
            showCount
            placeholder={`Mô tả góp ý của bạn giúp ${siteName} cải tiến sản phẩm, hỗ trợ bạn tốt hơn`}
          />
        </Form.Item>

        {/* Mức hài lòng: mặt cười tròn chọn 1 */}
        <div className="mb-6">
          <p className="mb-3 text-sm font-semibold text-gray-800">Bạn có hài lòng với {siteName} không?</p>
          <div className="flex items-start justify-between gap-1 sm:justify-around">
            {SATISFACTIONS.map((option) => {
              const active = satisfaction === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSatisfaction(active ? null : option.value)}
                  className="group flex cursor-pointer flex-col items-center gap-1.5"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-all duration-200 group-hover:scale-110 ${
                      active
                        ? 'bg-[var(--brand-primary)] shadow-md shadow-emerald-600/30 ring-2 ring-emerald-200'
                        : 'bg-gray-100 grayscale group-hover:bg-emerald-50 group-hover:grayscale-0'
                    }`}
                  >
                    {option.emoji}
                  </span>
                  <span className={`text-[11px] transition ${active ? 'font-semibold text-[var(--brand-primary)]' : 'text-gray-500'}`}>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {!isAuthenticated && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Form.Item name="phone" label={<span className="text-sm font-semibold text-gray-800">Số điện thoại</span>} className="!mb-0">
                <Input placeholder="Số điện thoại (không bắt buộc)" />
              </Form.Item>
              <Form.Item name="email" label={<span className="text-sm font-semibold text-gray-800">Email</span>} className="!mb-0" rules={[{ type: 'email', message: 'Email không hợp lệ.' }]}>
                <Input placeholder="Email (không bắt buộc)" />
              </Form.Item>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {siteName} sẽ phản hồi tới số điện thoại hoặc email bạn nhập trong vòng 24h (không kể Thứ 7, Chủ nhật, ngày lễ).
            </p>
          </>
        )}

        <div className="mt-6 flex gap-3">
          <Button size="large" className="!px-6" onClick={onClose}>Huỷ</Button>
          <Button size="large" type="primary" htmlType="submit" loading={submitting} className="flex-1">Gửi phản hồi</Button>
        </div>
      </Form>
    </Modal>
  )
}
