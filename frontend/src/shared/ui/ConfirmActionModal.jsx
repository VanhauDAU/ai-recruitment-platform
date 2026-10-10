import { CloseOutlined } from '@ant-design/icons'
import { Button, Modal, theme } from 'antd'

export default function ConfirmActionModal({
  cancelText = 'Đóng',
  children,
  className = '',
  confirmDisabled = false,
  confirmLoading = false,
  confirmText = 'Xác nhận',
  danger = false,
  description,
  onCancel,
  onConfirm,
  onDismiss,
  open,
  title,
}) {
  const { token } = theme.useToken()
  const cancel = onCancel || onDismiss
  const dismiss = onDismiss || onCancel

  return (
    <Modal
      centered
      className={`confirm-action-modal !max-w-[calc(100vw-24px)] ${className}`}
      closable={{
        'aria-label': 'Đóng hộp thoại',
        closeIcon: <CloseOutlined aria-hidden="true" />,
        disabled: confirmLoading,
      }}
      destroyOnHidden
      footer={null}
      keyboard={!confirmLoading}
      mask={{ closable: !confirmLoading }}
      onCancel={dismiss}
      open={open}
      styles={{
        body: { background: token.colorBgElevated },
        close: {
          alignItems: 'center',
          background: token.colorFillTertiary,
          borderRadius: '50%',
          color: token.colorTextQuaternary,
          display: 'flex',
          height: 32,
          insetInlineEnd: 12,
          justifyContent: 'center',
          top: 12,
          width: 32,
        },
        content: {
          background: token.colorBgElevated,
          borderRadius: 12,
          boxShadow: token.boxShadowSecondary,
          overflow: 'hidden',
          padding: 0,
        },
        header: {
          background: token.colorBgElevated,
          margin: 0,
          padding: '20px 24px 0',
        },
      }}
      title={<h2 className="min-w-0 px-9 text-center text-lg font-bold leading-7" style={{ color: token.colorTextHeading }}>{title}</h2>}
      width={432}
    >
      <div className="px-4 pb-5 pt-6 sm:px-6 sm:pb-6">
        <div className="break-words text-center text-sm leading-5" style={{ color: token.colorTextSecondary }}>
          {description ?? children}
        </div>
        <div className="mt-7 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 min-[380px]:gap-4">
          <Button
            autoFocus
            className="!h-10 !rounded-md !font-medium"
            color="default"
            disabled={confirmLoading}
            onClick={cancel}
            variant="filled"
          >
            {cancelText}
          </Button>
          <Button
            className="!h-10 !rounded-md !font-medium"
            color={danger ? 'danger' : 'primary'}
            disabled={confirmDisabled || confirmLoading}
            loading={confirmLoading}
            onClick={onConfirm}
            variant="filled"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
