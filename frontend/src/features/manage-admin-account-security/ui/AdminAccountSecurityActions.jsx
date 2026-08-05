import {
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Form, Modal, Space } from 'antd'
import { useState } from 'react'
import {
  adminAccountKeys,
  changeAccountStatus,
  getAccountResourceHoldImpact,
  getAccountSessionsImpact,
  getAccountStatusImpact,
  releaseAccountResourceHolds,
  revokeAccountSessions,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { operationTitle } from '../model/status-operation'
import AccountStatusActionForm from './AccountStatusActionForm'
import AccountStatusImpactPreview from './AccountStatusImpactPreview'


export default function AdminAccountSecurityActions({
  account,
  allowStatus = true,
  allowBan = false,
  allowResourceRelease = false,
  allowSessions = true,
}) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [operation, setOperation] = useState(null)
  const [loading, setLoading] = useState(false)
  const requiresResourceReview = Boolean(
    account.status_enforcement?.requires_resource_review,
  )

  const close = () => {
    setOperation(null)
    form.resetFields()
  }

  const open = (next) => {
    form.resetFields()
    setOperation({
      ...next,
      beforeStatus: account.status,
      preview: null,
      reloaded: false,
    })
  }

  const impactRequest = async (current, values) => {
    if (current.kind === 'status') {
      return getAccountStatusImpact(account.public_id, {
        status: current.status,
        reason: values.reason,
        enforcement_evidence: values.enforcement_evidence || '',
        violation_category: values.violation_category || '',
      })
    }
    if (current.kind === 'resource-hold') {
      return getAccountResourceHoldImpact(account.public_id, {
        reason: values.reason,
        enforcement_evidence: values.enforcement_evidence,
      })
    }
    return getAccountSessionsImpact(account.public_id, values.reason)
  }

  const preview = async () => {
    setLoading(true)
    try {
      const values = await form.validateFields()
      const result = await impactRequest(operation, values)
      setOperation((current) => ({ ...current, ...values, preview: result }))
    } catch (error) {
      if (!error?.errorFields) {
        message.error(getApiErrorMessage(error, 'Không thể xem tác động.'))
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshStaleImpact = async () => {
    const values = {
      reason: operation.reason,
      enforcement_evidence: operation.enforcement_evidence || '',
      violation_category: operation.violation_category || '',
    }
    const refreshed = await impactRequest(operation, values)
    setOperation((current) => ({
      ...current,
      preview: refreshed,
      reloaded: true,
    }))
  }

  const confirm = async () => {
    setLoading(true)
    try {
      if (operation.kind === 'status') {
        await changeAccountStatus(
          account.public_id,
          {
            status: operation.status,
            reason: operation.reason,
            enforcement_evidence: operation.enforcement_evidence || '',
            violation_category: operation.violation_category || '',
          },
          operation.preview.impact_token,
        )
        message.success(`${operationTitle(operation)} thành công.`)
      } else if (operation.kind === 'resource-hold') {
        await releaseAccountResourceHolds(
          account.public_id,
          {
            reason: operation.reason,
            enforcement_evidence: operation.enforcement_evidence,
          },
          operation.preview.impact_token,
        )
        message.success('Đã gỡ policy hold. Tài khoản vẫn đang tạm khóa.')
      } else {
        await revokeAccountSessions(
          account.public_id,
          operation.reason,
          operation.preview.impact_token,
        )
        message.success('Đã thu hồi toàn bộ phiên đăng nhập.')
      }
      close()
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      if (error?.response?.status === 409) {
        message.warning('Dữ liệu đã thay đổi. Hệ thống đang tải lại tác động để bạn kiểm tra.')
        try {
          await refreshStaleImpact()
        } catch (refreshError) {
          setOperation((current) => ({ ...current, preview: null }))
          message.error(getApiErrorMessage(refreshError, 'Không thể tải lại tác động.'))
        }
      } else {
        message.error(getApiErrorMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }

  const requiresEvidence = operation?.kind === 'resource-hold'
    || operation?.status === 'banned'
    || operation?.beforeStatus === 'banned'

  return (
    <>
      <Space wrap>
        {allowStatus && account.status === 'active' && (
          <Button
            danger
            icon={<LockOutlined />}
            onClick={() => open({ kind: 'status', status: 'inactive' })}
          >
            Tạm khóa tài khoản
          </Button>
        )}
        {allowStatus && account.status === 'inactive' && (
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            disabled={requiresResourceReview}
            title={requiresResourceReview
              ? 'Cần rà soát và gỡ giữ tài nguyên trước khi mở lại.'
              : ''}
            onClick={() => open({ kind: 'status', status: 'active' })}
          >
            Mở lại tài khoản
          </Button>
        )}
        {allowBan && ['active', 'inactive'].includes(account.status) && (
          <Button
            danger
            type="primary"
            icon={<WarningOutlined />}
            onClick={() => open({ kind: 'status', status: 'banned' })}
          >
            Cấm tài khoản
          </Button>
        )}
        {allowBan && account.status === 'banned' && (
          <Button
            icon={<SafetyCertificateOutlined />}
            onClick={() => open({ kind: 'status', status: 'inactive' })}
          >
            Bắt đầu khôi phục
          </Button>
        )}
        {allowResourceRelease && account.status === 'inactive' && requiresResourceReview && (
          <Button
            icon={<SafetyCertificateOutlined />}
            onClick={() => open({ kind: 'resource-hold' })}
          >
            Rà soát & gỡ giữ tài nguyên
          </Button>
        )}
        {allowSessions && (
          <Button
            danger
            icon={<StopOutlined />}
            onClick={() => open({ kind: 'sessions' })}
          >
            Thu hồi mọi phiên
          </Button>
        )}
      </Space>
      <Modal
        open={Boolean(operation)}
        width={820}
        title={operationTitle(operation)}
        okText={operation?.preview ? operationTitle(operation) : 'Xem tác động trước'}
        cancelText="Hủy"
        confirmLoading={loading}
        okButtonProps={{
          danger: operation?.kind === 'sessions' || operation?.status !== 'active',
          disabled: Boolean(operation?.preview && !operation.preview.can_apply),
        }}
        onCancel={close}
        onOk={operation?.preview ? confirm : preview}
        destroyOnHidden
      >
        {operation?.preview ? (
          <AccountStatusImpactPreview account={account} operation={operation} />
        ) : (
          <AccountStatusActionForm
            account={account}
            form={form}
            operation={operation}
            requiresEvidence={requiresEvidence}
          />
        )}
      </Modal>
    </>
  )
}
