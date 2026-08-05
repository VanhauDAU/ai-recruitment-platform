import { SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useState } from 'react'
import IdentityRecoveryModal from './IdentityRecoveryModal'

export default function ResetAccountMfaButton({
  account,
  disabled = false,
  disabledReason = '',
  onSuccess,
  publicId,
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip title={disabled ? disabledReason : 'Đặt lại toàn bộ phương thức MFA'}>
        <span>
          <Button
            danger
            icon={<SafetyCertificateOutlined />}
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            Đặt lại MFA
          </Button>
        </span>
      </Tooltip>
      <IdentityRecoveryModal
        account={account}
        kind="mfa"
        open={open}
        publicId={publicId}
        onSuccess={onSuccess}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
