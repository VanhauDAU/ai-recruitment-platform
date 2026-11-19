import { CopyOutlined, MailOutlined, ShareAltOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Form, Input, Modal, Select, Skeleton, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { m } from '@/shared/config/i18n'
import useReviewLinks from '../model/use-review-links'

const EXPIRY_OPTIONS = [3, 7, 14, 30].map((days) => ({ value: days, label: m.employer_workspace_days({ count: days }) }))
const STATUS_TAGS = {
  active: ['green', m.employer_workspace_share_status_active()],
  expired: ['default', m.employer_workspace_share_status_expired()],
  revoked: ['red', m.employer_workspace_share_status_revoked()],
}

function mailtoLink({ url, candidateName, jobTitle }) {
  const subject = m.employer_workspace_share_mail_subject({ candidateName, jobTitle })
  const body = m.employer_workspace_share_mail_body({ jobTitle, url })
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
      message.success(m.employer_workspace_share_copied())
    } catch {
      message.error(m.employer_workspace_share_copy_failed())
    }
  }

  function revoke(link) {
    requestConfirmation({
      title: m.employer_workspace_share_revoke_title(),
      description: m.employer_workspace_share_revoke_description({ name: link.reviewer_name }),
      confirmText: m.employer_workspace_share_revoke(),
      danger: true,
      onConfirm: () => revokeMutation.mutateAsync(link.public_id),
    })
  }

  return (
    <>
      <Tooltip title={disabledReason}>
        <Button size="small" icon={<ShareAltOutlined />} disabled={!publicId || Boolean(disabledReason)} onClick={() => setOpen(true)}>
          {m.employer_workspace_share_invite()}
        </Button>
      </Tooltip>
      <Modal
        open={open}
        title={m.employer_workspace_share_modal_title()}
        footer={null}
        width={560}
        destroyOnHidden
        onCancel={() => {
          setOpen(false)
          setCreated(null)
        }}
      >
        <p className="text-xs leading-5 text-slate-500">
          {m.employer_workspace_share_intro()}
        </p>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={create} initialValues={{ expires_in_days: 7 }} className="!mt-3">
          <Form.Item name="reviewer_name" label={m.employer_workspace_share_recipient()} rules={[{ required: true, whitespace: true, message: m.employer_workspace_share_recipient_required() }]}>
            <Input maxLength={120} placeholder={m.employer_workspace_share_recipient_placeholder()} />
          </Form.Item>
          <Form.Item name="message" label={m.employer_workspace_share_note()}>
            <Input.TextArea maxLength={1000} rows={2} placeholder={m.employer_workspace_share_note_placeholder()} />
          </Form.Item>
          <Form.Item name="expires_in_days" label={m.employer_workspace_share_validity()}>
            <Select options={EXPIRY_OPTIONS} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending} block>{m.employer_workspace_share_create()}</Button>
        </Form>

        {created && (
          <Alert
            showIcon
            type="success"
            className="!mt-4"
            title={m.employer_workspace_share_link_for({ name: created.link.reviewer_name })}
            description={(
              <div className="space-y-2">
                <Input readOnly value={created.url} onFocus={(event) => event.target.select()} />
                <div className="flex flex-wrap gap-2">
                  <Button size="small" icon={<CopyOutlined />} onClick={() => copy(created.url)}>{m.employer_workspace_share_copy_link()}</Button>
                  <Button size="small" icon={<MailOutlined />} href={mailtoLink({ url: created.url, candidateName, jobTitle })}>{m.employer_workspace_share_send_email()}</Button>
                </div>
                <p className="text-[11px] text-slate-500">{m.employer_workspace_share_shown_once()}</p>
              </div>
            )}
          />
        )}

        <h3 className="mt-5 text-sm font-bold text-slate-800">{m.employer_workspace_share_created_links()}</h3>
        {linksQuery.isPending && <Skeleton active paragraph={{ rows: 2 }} />}
        {!linksQuery.isPending && links.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_share_no_invites()} />}
        <ul className="mt-2 space-y-2">
          {links.map((link) => {
            const [color, label] = STATUS_TAGS[link.status] || STATUS_TAGS.expired
            return (
              <li key={link.public_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{link.reviewer_name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {m.employer_workspace_expires_on({ date: formatDateTime(link.expires_at) })} · {m.employer_workspace_share_open_count({ count: link.open_count })}{link.has_review ? ` · ${m.employer_workspace_share_reviewed()}` : ''}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <Tag color={color}>{label}</Tag>
                  {link.status === 'active' && <Button size="small" danger onClick={() => revoke(link)}>{m.employer_workspace_share_revoke()}</Button>}
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
