import { MailOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useState } from 'react'
import IdentityRecoveryModal from './IdentityRecoveryModal'

export default function ChangeAccountEmailButton({
  account,
  disabled = false,
  disabledReason = '',
  onSuccess,
  publicId,
  type = 'default',
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip title={disabled ? disabledReason : 'Khôi phục email đăng nhập'}>
        <span>
          <Button
            type={type}
            icon={type === 'link' ? null : <MailOutlined />}
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            Đổi email đăng nhập
          </Button>
        </span>
      </Tooltip>
      <IdentityRecoveryModal
        account={account}
        open={open}
        publicId={publicId}
        onSuccess={onSuccess}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
