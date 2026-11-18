import { CopyOutlined, MailOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Form, Input, Modal, Select, Skeleton, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import useReviewLinks from '../model/use-review-links'

const EXPIRY_OPTIONS = [3, 7, 14, 30].map((days) => ({ value: days, label: `${days} ngày` }))
const STATUS_TAGS = {
  active: ['green', 'Đang mở'],
  expired: ['default', 'Hết hạn'],
  revoked: ['red', 'Đã thu hồi'],
}

function mailtoLink({ url, candidateName, jobTitle }) {
  const subject = `Nhờ đánh giá hồ sơ ${candidateName} — ${jobTitle}`
  const body = `Nhờ anh/chị xem và cho ý kiến về hồ sơ ứng viên vị trí ${jobTitle}:\n${url}\n\nLink chỉ dùng cho người nhận và sẽ hết hạn.`
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Invite a hiring manager (no account needed) to review this application.
 * `disabledReason` explains why this application cannot be shared.
 */
export default function ShareApplicationReviewButton({ publicId, candidateName, jobTitle, disabledReason = '' }) {
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState(null)
  const [form] = Form.useForm()
  const { linksQuery, createMutation, revokeMutation } = useReviewLinks(publicId, { enabled: open })
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const links = linksQuery.data || []

  async function create(values) {
    const result = await createMutation.mutateAsync(values)
    setCreated(result)
    form.resetFields(['reviewer_name', 'message'])
  }

  async function copy(url) {
    try {
      await navigator.clipboard.writeText(url)
      message.success('Đã sao chép link.')
    } catch {
      message.error('Không sao chép được, hãy chọn và sao chép thủ công.')
    }
  }

  function revoke(link) {
    requestConfirmation({
      title: 'Thu hồi link đánh giá',
      description: `${link.reviewer_name} sẽ không mở được hồ sơ này nữa. Phiếu đã gửi (nếu có) vẫn được giữ lại.`,
      confirmText: 'Thu hồi',
      danger: true,
      onConfirm: () => revokeMutation.mutateAsync(link.public_id),
    })
  }

  return (
    <>
      <Tooltip title={disabledReason}>
        <Button size="small" icon={<ShareAltOutlined />} disabled={!publicId || Boolean(disabledReason)} onClick={() => setOpen(true)}>
          Mời đánh giá
        </Button>
      </Tooltip>
      <Modal
        open={open}
        title="Mời người khác đánh giá hồ sơ"
        footer={null}
        width={560}
        destroyOnHidden
        onCancel={() => {
          setOpen(false)
          setCreated(null)
        }}
      >
        <p className="text-xs leading-5 text-slate-500">
          Người nhận không cần tài khoản. Họ chỉ xem CV đã ẩn ảnh, email, số điện thoại, địa chỉ và gửi lại một phiếu đánh giá.
        </p>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={create} initialValues={{ expires_in_days: 7 }} className="!mt-3">
          <Form.Item name="reviewer_name" label="Người nhận" rules={[{ required: true, whitespace: true, message: 'Nhập tên người nhận.' }]}>
            <Input maxLength={120} placeholder="Ví dụ: Anh Minh — Trưởng phòng kỹ thuật" />
          </Form.Item>
          <Form.Item name="message" label="Lời nhắn (không bắt buộc)">
            <Input.TextArea maxLength={1000} rows={2} placeholder="Nhờ anh xem giúp kinh nghiệm SQL của bạn này" />
          </Form.Item>
          <Form.Item name="expires_in_days" label="Hiệu lực">
            <Select options={EXPIRY_OPTIONS} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending} block>Tạo link</Button>
        </Form>

        {created && (
          <Alert
            showIcon
            type="success"
            className="!mt-4"
            title={`Link cho ${created.link.reviewer_name}`}
            description={(
              <div className="space-y-2">
                <Input readOnly value={created.url} onFocus={(event) => event.target.select()} />
                <div className="flex flex-wrap gap-2">
                  <Button size="small" icon={<CopyOutlined />} onClick={() => copy(created.url)}>Sao chép link</Button>
                  <Button size="small" icon={<MailOutlined />} href={mailtoLink({ url: created.url, candidateName, jobTitle })}>Gửi qua email</Button>
                </div>
                <p className="text-[11px] text-slate-500">Link chỉ hiển thị một lần. Nếu làm mất, hãy tạo link mới.</p>
              </div>
            )}
          />
        )}

        <h3 className="mt-5 text-sm font-bold text-slate-800">Các link đã tạo</h3>
        {linksQuery.isPending && <Skeleton active paragraph={{ rows: 2 }} />}
        {!linksQuery.isPending && links.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa mời ai" />}
        <ul className="mt-2 space-y-2">
          {links.map((link) => {
            const [color, label] = STATUS_TAGS[link.status] || STATUS_TAGS.expired
            return (
              <li key={link.public_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{link.reviewer_name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Hết hạn {formatDateTime(link.expires_at)} · Đã mở {link.open_count} lần{link.has_review ? ' · Đã gửi phiếu' : ''}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <Tag color={color}>{label}</Tag>
                  {link.status === 'active' && <Button size="small" danger onClick={() => revoke(link)}>Thu hồi</Button>}
                </span>
              </li>
            )
          })}
        </ul>
        {confirmationModal}
      </Modal>
    </>
  )
}
