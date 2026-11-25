import { DownOutlined, KeyOutlined, LockOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Table } from 'antd'
import { useEffect, useState } from 'react'
import {
  ACCOUNT_STATUS_LABELS,
  adminAccountKeys,
  formatAdminDate,
  getAdminAccountSessions,
  resendAdminAccountVerification,
} from '@/entities/account/admin-account'
import { useAccountSecurityOperations } from '@/features/admin/account/manage-admin-account-security'
import { ChangeAccountEmailButton, IdentityRecoveryGuide } from '@/features/admin/account/recover-account-identity'
import { SendAccountPasswordResetButton } from '@/features/admin/account/send-account-password-reset'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'

const STATUS_TONES = { active: 'good', inactive: 'warn', banned: 'bad', pending: 'muted' }

const SESSION_COLUMNS = [
  {
    title: m.admin_security_col_device(),
    dataIndex: 'device_label',
    render: (value, row) => (
      <span className="acc-sec__device">
        <strong>{value || m.admin_security_unknown_device()}</strong>
        <span>{[row.portal, row.auth_method].filter(Boolean).join(' · ')}</span>
      </span>
    ),
  },
  { title: 'IP', dataIndex: 'ip_address', render: (value) => value || '—' },
  { title: m.admin_security_col_last_seen(), dataIndex: 'last_seen_at', render: (value) => formatAdminDate(value) },
  {
    title: m.admin_security_col_status(),
    key: 'status',
    render: (_, row) => (
      <span className="acc-sec__state">
        <span className={`acc-sec__dot is-${row.revoked_at ? 'muted' : 'good'}`} aria-hidden="true" />
        {row.revoked_at ? m.admin_security_session_revoked() : m.admin_security_session_active()}
      </span>
    ),
  },
]

function StatusItem({ tone, children }) {
  return (
    <li className="acc-sec__item">
      <span className={`acc-sec__dot is-${tone}`} aria-hidden="true" />
      {children}
    </li>
  )
}

/** Một tình huống: tên, một câu giải thích, nút cần bấm và (tuỳ chọn) một lối phụ ở chân thẻ. */
function CaseCard({ icon, title, description, actions, footer, tone = 'default' }) {
  return (
    <article className={`acc-sec__case is-${tone}`}>
      <span className="acc-sec__case-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="acc-sec__case-actions">{actions}</div>
      {footer && <div className="acc-sec__case-foot">{footer}</div>}
    </article>
  )
}

// Thẻ thứ ba đổi theo trạng thái: đang hoạt động thì xử lý vi phạm, đang khóa thì mở lại, bị cấm thì khôi phục.
function statusCase(available, start) {
  if (available.suspend) {
    return {
      icon: <WarningOutlined />, tone: 'danger',
      title: m.admin_security_case_violation_title(),
      description: m.admin_security_case_violation_desc(),
      actions: (
        <>
          <Button danger aria-label={m.admin_security_action_suspend_label()} onClick={start.suspend}>{m.admin_security_action_suspend()}</Button>
          {available.ban && <Button danger aria-label={m.admin_security_action_ban_label()} onClick={start.ban}>{m.admin_security_action_ban()}</Button>}
        </>
      ),
    }
  }
  if (available.reactivate) {
    return {
      icon: <LockOutlined />,
      title: m.admin_security_case_suspended_title(),
      description: available.reactivateBlocked ? m.admin_security_case_suspended_review_desc() : m.admin_security_case_suspended_desc(),
      actions: (
        <>
          {available.resourceHold && <Button type="primary" onClick={start.resourceHold}>{m.admin_security_action_review()}</Button>}
          <Button type={available.resourceHold ? 'default' : 'primary'} disabled={available.reactivateBlocked} onClick={start.reactivate}>
            {m.admin_security_action_reactivate()}
          </Button>
          {available.ban && <Button danger aria-label={m.admin_security_action_ban_label()} onClick={start.ban}>{m.admin_security_action_ban()}</Button>}
        </>
      ),
    }
  }
  if (available.unban) {
    return {
      icon: <StopOutlined />, tone: 'danger',
      title: m.admin_security_case_banned_title(),
      description: m.admin_security_case_banned_desc(),
      actions: <Button type="primary" onClick={start.unban}>{m.admin_security_action_unban()}</Button>,
    }
  }
  return null
}

/**
 * Tab "Bảo mật": một dòng tình trạng, rồi các thẻ xử lý theo tình huống (mỗi thẻ đúng nút cần bấm).
 * Tiến trình khôi phục chỉ hiện khi đang khôi phục; danh sách phiên thu gọn, chỉ tải khi mở.
 */
export default function AccountSecurityPanel({ publicId, account, isSuperuser }) {
  const [recoveryProgress, setRecoveryProgress] = useState({ emailCompleted: false, passwordResetSent: false })
  const [sending, setSending] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const sessions = useQuery({
    queryKey: adminAccountKeys.sessions(publicId),
    queryFn: ({ signal }) => getAdminAccountSessions(publicId, { signal }),
    enabled: sessionsOpen,
  })
  // Chi tiết tài khoản admin chỉ superuser mở được (backend), nên mọi tài khoản ở đây đều được đổi trạng thái.
  const { available, start, dialog } = useAccountSecurityOperations({
    account,
    allowBan: isSuperuser,
    allowResourceRelease: isSuperuser,
  })
  useEffect(() => {
    setRecoveryProgress({ emailCompleted: false, passwordResetSent: false })
    setSessionsOpen(false)
  }, [publicId])

  const recoveryStarted = recoveryProgress.emailCompleted || (
    account.email_verified === false && account.has_usable_password === false
  )
  const sendVerification = async () => {
    setSending(true)
    try {
      await resendAdminAccountVerification(publicId)
      message.success(m.admin_security_verification_scheduled())
    } catch (error) {
      message.error(getApiErrorMessage(error))
    } finally {
      setSending(false)
    }
  }
  const status = statusCase(available, start)
  const sessionCount = account.active_session_count || 0

  return (
    <div className="account-detail-stack acc-sec">
      <ul className="admin-panel acc-sec__bar" aria-label={m.admin_security_status_title()}>
        <StatusItem tone={STATUS_TONES[account.status]}>{ACCOUNT_STATUS_LABELS[account.status] || account.status}</StatusItem>
        <StatusItem tone={account.email_verified ? 'good' : 'warn'}>
          {account.email_verified ? m.admin_security_email_verified() : m.admin_security_email_unverified()}
          {!account.email_verified && (
            <Button
              type="link"
              size="small"
              className="acc-sec__inline"
              aria-label={m.admin_security_verify_action_label()}
              loading={sending}
              onClick={sendVerification}
            >
              {m.admin_security_verify_action()}
            </Button>
          )}
        </StatusItem>
        <StatusItem tone={account.has_usable_password ? 'good' : 'muted'}>
          {account.has_usable_password ? m.admin_security_password_set() : m.admin_security_password_none()}
        </StatusItem>
        <StatusItem tone={sessionCount ? 'good' : 'muted'}>{m.admin_security_sessions_open({ count: sessionCount })}</StatusItem>
      </ul>

      <IdentityRecoveryGuide
        account={account}
        emailCompleted={recoveryProgress.emailCompleted}
        passwordResetSent={recoveryProgress.passwordResetSent}
        passwordResetAction={recoveryStarted ? (
          <SendAccountPasswordResetButton
            account={account}
            publicId={publicId}
            accountEmail={account.email}
            type="primary"
            disabled={account.status !== 'active'}
            disabledReason={m.admin_security_reopen_before_reset()}
            onSuccess={() => setRecoveryProgress((current) => ({ ...current, passwordResetSent: true }))}
          />
        ) : null}
      />

      <section className="acc-sec__cases-wrap" aria-labelledby="acc-sec-cases">
        <h2 id="acc-sec-cases" className="acc-sec__heading">{m.admin_security_cases_title()}</h2>
        <div className="acc-sec__cases">
          {!recoveryStarted && (
            <CaseCard
              icon={<KeyOutlined />}
              title={m.admin_security_case_access_title()}
              description={m.admin_security_case_access_desc()}
              actions={(
                <SendAccountPasswordResetButton
                  account={account}
                  publicId={publicId}
                  accountEmail={account.email}
                  label={m.admin_security_case_access_action()}
                  disabled={account.status !== 'active'}
                  disabledReason={m.admin_security_reopen_before_reset()}
                />
              )}
              footer={(
                <>
                  {m.admin_security_case_access_lost_email()}
                  <ChangeAccountEmailButton
                    account={account}
                    publicId={publicId}
                    type="link"
                    disabled={account.status === 'pending'}
                    disabledReason={m.admin_security_pending_invitation()}
                    onSuccess={() => setRecoveryProgress({ emailCompleted: true, passwordResetSent: false })}
                  />
                </>
              )}
            />
          )}
          <CaseCard
            icon={<StopOutlined />}
            title={m.admin_security_case_compromised_title()}
            description={m.admin_security_case_compromised_desc()}
            actions={<Button onClick={start.sessions}>{m.admin_security_case_compromised_action()}</Button>}
          />
          {status && <CaseCard {...status} />}
        </div>
      </section>

      <section className={`admin-panel acc-sec__fold ${sessionsOpen ? 'is-open' : ''}`}>
        <h2 className="acc-sec__fold-title">
          <button
            type="button"
            aria-expanded={sessionsOpen}
            aria-controls="acc-sec-sessions"
            onClick={() => setSessionsOpen((value) => !value)}
          >
            <span>{m.admin_security_sessions_title()}</span>
            <span className="acc-sec__count">{sessionCount}</span>
            <DownOutlined aria-hidden="true" className="acc-sec__chevron" />
          </button>
        </h2>
        <div id="acc-sec-sessions" className="acc-sec__fold-panel" inert={!sessionsOpen}>
          <div className="acc-sec__fold-clip">
            {sessionsOpen && (
              <Table
                className="acc-sec__sessions"
                rowKey="id"
                size="middle"
                loading={sessions.isLoading}
                dataSource={sessions.data || []}
                pagination={false}
                scroll={{ x: 600 }}
                columns={SESSION_COLUMNS}
                locale={{ emptyText: m.admin_security_sessions_empty() }}
              />
            )}
          </div>
        </div>
      </section>
      {dialog}
    </div>
  )
}
