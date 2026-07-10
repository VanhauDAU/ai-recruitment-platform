import {
  CloseOutlined,
  CommentOutlined,
  CustomerServiceOutlined,
  HeartFilled,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { App, Badge, Button, Form, Input, Modal, Tooltip } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../../api/errorMessage'
import { submitFeedback } from '../../api/siteService'
import { useAuth } from '../../hooks/useAuth'
import { useSavedJobs } from '../../hooks/useSavedJobs'
import { useSiteSettings } from '../../hooks/useSiteSettings'

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

export default function FloatingActions() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { settings, siteName } = useSiteSettings()
  const { items } = useSavedJobs()
  const [supportOpen, setSupportOpen] = useState(false)
  const [wantOpen, setWantOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [topic, setTopic] = useState(null)
  const [topicError, setTopicError] = useState(false)
  const [satisfaction, setSatisfaction] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const zaloUrl = settings.contact_zalo_url
  const hotline = settings.hotline

  function openZalo() {
    if (!zaloUrl) {
      message.info('Kênh Zalo chưa được cấu hình.')
      return
    }
    window.open(zaloUrl, '_blank', 'noreferrer')
  }

  function openFeedback() {
    setWantOpen(false)
    setTopic(null)
    setTopicError(false)
    setSatisfaction(null)
    form.resetFields()
    setFeedbackOpen(true)
  }

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
      setFeedbackOpen(false)
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Gửi góp ý thất bại, vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const supportItems = [
    { key: 'safety', icon: <SafetyOutlined />, label: 'Hướng dẫn tìm việc an toàn', required: true, onClick: () => message.info('Nội dung sẽ sớm ra mắt.') },
    { key: 'faq', icon: <QuestionCircleOutlined />, label: 'Các câu hỏi thường gặp', onClick: () => message.info('Nội dung sẽ sớm ra mắt.') },
    { key: 'zalo', icon: <MessageOutlined />, label: 'Hỗ trợ qua Zalo', onClick: openZalo },
    {
      key: 'contact',
      icon: <PhoneOutlined />,
      label: `Liên hệ ${siteName}`,
      onClick: () => (hotline ? (window.location.href = `tel:${String(hotline).replace(/\s/g, '')}`) : message.info('Hotline chưa được cấu hình.')),
    },
  ]

  return (
    <>
      <div className="fixed bottom-5 right-4 z-30 flex flex-col items-end gap-2.5 md:bottom-8 md:right-6">
        <Tooltip title="Việc làm đã lưu" placement="left">
          <Badge count={items.length} size="small" offset={[-4, 4]}>
            <button
              type="button"
              aria-label="Việc làm đã lưu"
              onClick={() => { setSupportOpen(false); navigate('/viec-lam-da-luu') }}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-lg text-rose-500 shadow-lg shadow-gray-500/15 transition hover:-translate-y-0.5 hover:border-rose-300"
            >
              <HeartFilled />
            </button>
          </Badge>
        </Tooltip>

        <button
          type="button"
          onClick={() => setWantOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white py-2.5 pl-3 pr-4 text-sm font-semibold text-gray-700 shadow-lg shadow-gray-500/15 transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
        >
          <CommentOutlined className="text-base" />
          Góp ý
        </button>

        {/* Bọc riêng nút Hỗ trợ trong 1 khối `relative` để panel neo `absolute`
            đúng ngay phía trên nút này (mép phải trùng mép phải nút), thay vì
            xếp chung hàng với cả cụm 3 nút — nếu không panel (rộng 300px) sẽ
            mở ra phía trên toàn bộ cụm nút hẹp hơn, trông như lệch/nổi bên trái. */}
        <div className="relative">
          {supportOpen && (
            <div
              className="absolute bottom-[calc(100%+12px)] right-0 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-500/15"
              style={{ animation: 'supportPanelIn 0.18s ease both' }}
            >
              <style>{`
                @keyframes supportPanelIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
              `}</style>
              <div className="flex items-start gap-3 bg-gradient-to-br from-[#053a2c] to-[var(--brand-primary)] p-4 text-white">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl">
                  <CustomerServiceOutlined />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Trung tâm hỗ trợ ứng viên</p>
                  <p className="mt-0.5 text-xs text-emerald-50">{siteName} thường phản hồi trong vòng 24h</p>
                </div>
                <button type="button" aria-label="Đóng" onClick={() => setSupportOpen(false)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white/80 hover:bg-white/15">
                  <CloseOutlined className="text-xs" />
                </button>
              </div>

              <div className="p-2">
                {supportItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-emerald-50/60"
                  >
                    <span className="text-base text-[var(--brand-primary)]">{item.icon}</span>
                    <span className="flex-1 text-sm font-medium text-gray-700">
                      {item.label}
                      {item.required && <span className="text-red-500"> *</span>}
                    </span>
                    <RightOutlined className="text-[10px] text-gray-300 transition group-hover:text-[var(--brand-primary)]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSupportOpen((open) => !open)}
            className={`flex cursor-pointer items-center gap-2 rounded-full py-2.5 pl-3 pr-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:-translate-y-0.5 ${
              supportOpen ? 'bg-[var(--brand-primary-hover)]' : 'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)]'
            }`}
          >
            <CustomerServiceOutlined className="text-base" />
            Hỗ trợ
          </button>
        </div>
      </div>

      {/* ── Modal giữa màn hình "Bạn muốn?" (từ nút Góp ý) ── */}
      <Modal open={wantOpen} onCancel={() => setWantOpen(false)} footer={null} centered width={560} title={null}>
        <div className="pt-2">
          <h3 className="text-center text-xl font-extrabold text-gray-900">Bạn muốn?</h3>
          <p className="mt-1 text-center text-sm text-gray-500">Chọn cách bạn muốn kết nối với {siteName}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={openFeedback}
              className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 p-6 text-center transition hover:-translate-y-0.5 hover:border-[var(--brand-primary)] hover:bg-emerald-50/40 hover:shadow-lg hover:shadow-emerald-600/10"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl text-[var(--brand-primary)] transition group-hover:scale-105">
                <MailOutlined />
              </span>
              <span className="text-base font-bold text-gray-900">Góp ý sản phẩm</span>
              <span className="text-sm leading-snug text-gray-500">Chia sẻ ý kiến, đề xuất và nhận xét về sản phẩm</span>
            </button>

            <button
              type="button"
              onClick={() => { setWantOpen(false); openZalo() }}
              className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 p-6 text-center transition hover:-translate-y-0.5 hover:border-[#0068ff] hover:bg-blue-50/40 hover:shadow-lg hover:shadow-blue-600/10"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-lg font-extrabold text-[#0068ff] transition group-hover:scale-105">
                Zalo
              </span>
              <span className="text-base font-bold text-gray-900">Chat Zalo để được hỗ trợ</span>
              <span className="text-sm leading-snug text-gray-500">Yêu cầu hỗ trợ liên quan đến sản phẩm hoặc dịch vụ</span>
            </button>
          </div>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs leading-snug text-emerald-800">
            <span className="text-sm">ℹ️</span>
            <span>Bạn đang gửi góp ý/yêu cầu hỗ trợ tới {siteName} — Nền tảng kết nối Ứng viên và Nhà tuyển dụng. Nhà tuyển dụng sẽ không đọc được góp ý này.</span>
          </p>
        </div>
      </Modal>

      {/* ── Form góp ý sản phẩm ── */}
      <Modal open={feedbackOpen} onCancel={() => setFeedbackOpen(false)} title={null} footer={null} centered width={780} destroyOnHidden>
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
            <Button size="large" className="!px-6" onClick={() => setFeedbackOpen(false)}>Huỷ</Button>
            <Button size="large" type="primary" htmlType="submit" loading={submitting} className="flex-1">Gửi phản hồi</Button>
          </div>
        </Form>
      </Modal>
    </>
  )
}
