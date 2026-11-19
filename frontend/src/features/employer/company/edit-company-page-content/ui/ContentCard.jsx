import { Alert, Button, Form, Tag } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import { CONTENT_STATUS, contentCardId, contentSubmitOutcome } from '../model/content-form'
import { useCompanyContentSubmit } from '../model/use-company-content-submit'

const NO_FILES = {}
const hasFiles = (files) => Boolean(files.logo || files.cover || files.gallery?.length)

/**
 * Một nhóm nội dung của trang công ty với form riêng: chỉ gửi các khoá của
 * chính nhóm đó. `direct` là lưu đăng ngay (hậu kiểm); không thì gửi duyệt. `toSubmission(values)` trả `{ changes, files }`;
 * `errorName(path)` dịch đường dẫn lỗi của API sang tên trường của form (mặc
 * định giữ nguyên). Lỗi không gắn được vào trường nào hiện ở đầu thẻ.
 */
export default function ContentCard({
  card,
  title,
  description,
  status = 'empty',
  reviewNote,
  direct = false,
  readOnly,
  initialValues,
  toSubmission,
  errorName = (path) => path,
  children,
}) {
  const [form] = Form.useForm()
  const [dirty, setDirty] = useState(false)
  const [cardError, setCardError] = useState('')
  const submit = useCompanyContentSubmit()
  const [statusColor, statusLabel] = CONTENT_STATUS[status] || CONTENT_STATUS.empty
  const headingId = `${contentCardId(card)}-title`
  const actionLabel = direct ? m.employer_company_content_save() : m.employer_company_content_submit_review()

  async function finish(values) {
    const { changes, files = NO_FILES } = toSubmission(values)
    if (!Object.keys(changes).length && !hasFiles(files)) {
      setDirty(false)
      message.info(m.employer_company_content_no_changes())
      return
    }
    setCardError('')
    try {
      await submit.mutateAsync({ changes, files })
      setDirty(false)
      message.success(direct
        ? m.employer_company_content_saved_direct()
        : m.employer_company_content_saved_review())
    } catch (error) {
      const outcome = contentSubmitOutcome(error)
      if (outcome.kind !== 'invalid') {
        setCardError(outcome.message)
        return
      }
      const registered = new Set(form.getFieldsError().map(({ name }) => JSON.stringify(name)))
      const mapped = outcome.fields.map((field) => ({ ...field, name: errorName(field.name) }))
      form.setFields(mapped.filter(({ name }) => name && registered.has(JSON.stringify(name))))
      const loose = mapped.filter(({ name }) => !name || !registered.has(JSON.stringify(name)))
      setCardError(loose.flatMap(({ errors }) => errors).join(' ') || m.employer_company_content_check_fields())
    }
  }

  return (
    <section id={contentCardId(card)} aria-labelledby={headingId} className="company-content-card">
      <header className="company-content-card__header">
        <h3 id={headingId} className="company-content-card__title">{title}</h3>
        <Tag color={statusColor}>{statusLabel}</Tag>
      </header>
      {description && <p className="company-content-hint">{description}</p>}
      {status === 'changes_requested' && reviewNote && (
        <Alert showIcon type="warning" title={m.employer_company_content_review_note({ note: reviewNote })} />
      )}
      {cardError && <Alert showIcon type="error" title={cardError} />}
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={initialValues}
        disabled={readOnly || submit.isPending}
        onValuesChange={() => setDirty(true)}
        onFinish={finish}
      >
        {typeof children === 'function' ? children({ form, readOnly: readOnly || submit.isPending }) : children}
        {!readOnly && (
          <div className="company-content-card__actions">
            <Button type="primary" htmlType="submit" disabled={!dirty} loading={submit.isPending} aria-label={`${actionLabel} ${title}`}>
              {actionLabel}
            </Button>
          </div>
        )}
      </Form>
    </section>
  )
}
