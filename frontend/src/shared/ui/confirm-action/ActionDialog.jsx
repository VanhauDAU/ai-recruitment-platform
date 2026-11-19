import { Button, Modal } from 'antd'
import './action-dialog.css'
import { m } from '@/shared/config/i18n'

/**
 * Dialog for an admin action that collects input (reason, evidence) and/or
 * shows its impact before confirming. Binary yes/no prompts keep using
 * ConfirmActionModal; this one owns the layout every processing dialog shares:
 * title + target, scrolling body, "Hủy" + a verb-labelled primary button,
 * Ctrl/⌘+Enter to submit and a bottom sheet below 640px.
 */
export default function ActionDialog({
  cancelLabel = m.common_action_cancel(),
  children,
  loading = false,
  onCancel,
  onSubmit,
  open,
  submitDisabled = false,
  submitLabel,
  target,
  title,
  tone = 'default',
  width = 560,
}) {
  const submit = () => {
    if (!loading && !submitDisabled) onSubmit?.()
  }
  const onKeyDown = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <Modal
      centered
      className="action-dialog"
      rootClassName="action-dialog-root"
      closable={{ 'aria-label': m.common_dialog_close(), disabled: loading }}
      destroyOnHidden
      footer={null}
      keyboard={!loading}
      mask={{ closable: false }}
      onCancel={() => !loading && onCancel?.()}
      open={open}
      title={(
        <div className="action-dialog__head">
          <h2 className="action-dialog__title">{title}</h2>
          {target && <p className="action-dialog__target">{target}</p>}
        </div>
      )}
      width={width}
    >
      <div className="action-dialog__body" onKeyDown={onKeyDown}>{children}</div>
      <div className="action-dialog__footer">
        <span className="action-dialog__hint" aria-hidden="true">{m.common_dialog_submit_hint()}</span>
        <Button disabled={loading} onClick={onCancel}>{cancelLabel}</Button>
        <Button
          danger={tone === 'danger'}
          disabled={submitDisabled}
          loading={loading}
          onClick={submit}
          type="primary"
        >
          {submitLabel}
        </Button>
      </div>
    </Modal>
  )
}
