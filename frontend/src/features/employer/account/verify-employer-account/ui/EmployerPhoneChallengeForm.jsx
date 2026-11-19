import {
  LoadingOutlined,
  LockOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { Alert, Button, Form, Input, Modal } from 'antd'
import { isVietnameseMobile } from '../model/vietnamese-mobile'
import { m } from '@/shared/config/i18n'

const ACTIVE_DISPATCH_STATES = new Set(['queued', 'dispatching', 'retry_pending'])

function ChallengeStatus({ challenge, error }) {
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={m.employer_account_phone_status_failed_title()}
        description={m.employer_account_phone_status_failed_desc()}
      />
    )
  }
  if (!challenge) return null
  if (ACTIVE_DISPATCH_STATES.has(challenge.status)) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<LoadingOutlined spin />}
        message={m.employer_account_phone_sending_title()}
        description={m.employer_account_phone_sending_desc()}
      />
    )
  }
  if (challenge.status === 'sent') {
    return (
      <Alert
        type="success"
        showIcon
        message={m.employer_account_phone_sent_title()}
        description={m.employer_account_phone_sent_desc()}
      />
    )
  }
  if (challenge.status === 'verified') {
    return <Alert type="success" showIcon message={m.employer_account_phone_request_verified()} />
  }
  return (
    <Alert
      type="error"
      showIcon
      message={m.employer_account_phone_unusable_title()}
      description={m.employer_account_phone_unusable_desc()}
    />
  )
}

export default function EmployerPhoneChallengeForm({
  form,
  passwordForm,
  flowMode,
  initialPhone,
  phoneValue,
  validPhone,
  challenge,
  challengeError,
  canVerify,
  passwordOpen,
  sendPending,
  verifyPending,
  onOpenPassword,
  onClosePassword,
  onSubmitPassword,
  onVerify,
  onClearChallenge,
}) {
  const otpSent = Boolean(challenge?.public_id)
  return (
    <>
      <Form
        form={form}
        layout="vertical"
        className="mt-5"
        initialValues={{ phone: initialPhone }}
        onFinish={() => {
          if (otpSent && canVerify) onVerify(form.getFieldsValue())
          else if (!otpSent && validPhone) onOpenPassword()
        }}
      >
        {!otpSent ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Form.Item
              name="phone"
              className="mb-0 flex-1"
              rules={[
                { required: true, message: m.employer_account_phone_required() },
                {
                  validator: (_, value) => (
                    isVietnameseMobile(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error(m.employer_account_phone_invalid()))
                  ),
                },
              ]}
            >
              <Input
                size="large"
                prefix={<PhoneOutlined className="text-slate-400" />}
                inputMode="tel"
                placeholder="0912 345 678"
                autoComplete="tel"
                disabled={flowMode === 'reverify'}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              disabled={!validPhone}
              className="sm:w-40"
            >
              {m.employer_account_phone_send_code()}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ChallengeStatus challenge={challenge} error={challengeError} />
            <Form.Item
              name="code"
              label={m.employer_account_phone_code_label()}
              rules={[
                { required: true, message: m.employer_account_phone_code_required() },
                { pattern: /^\d{6}$/, message: m.employer_account_phone_code_digits() },
              ]}
            >
              <Input
                size="large"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                disabled={!canVerify}
              />
            </Form.Item>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                disabled={!canVerify}
                loading={verifyPending}
              >
                {m.employer_account_phone_confirm_code()}
              </Button>
              <Button size="large" onClick={onOpenPassword} loading={sendPending}>
                {m.employer_account_phone_resend()}
              </Button>
              {flowMode !== 'reverify' && (
                <Button type="link" onClick={onClearChallenge}>
                  {m.employer_account_phone_change()}
                </Button>
              )}
            </div>
          </div>
        )}
      </Form>

      <Modal
        title={m.employer_account_phone_password_title()}
        open={passwordOpen}
        onOk={onSubmitPassword}
        onCancel={onClosePassword}
        okText={m.employer_account_phone_password_ok()}
        cancelText={m.employer_account_docs_cancel()}
        confirmLoading={sendPending}
        destroyOnHidden
      >
        <p className="mb-4 text-sm leading-6 text-slate-500">
          {m.employer_account_phone_password_desc_before()}<b>{phoneValue}</b>{m.employer_account_phone_password_desc_after()}
        </p>
        <Form form={passwordForm} layout="vertical" onFinish={onSubmitPassword}>
          <Form.Item
            name="password"
            label={m.employer_account_phone_password_label()}
            rules={[{ required: true, message: m.employer_account_phone_password_required() }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined className="text-slate-400" />}
              placeholder={m.account_auth_password()}
              autoComplete="current-password"
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
