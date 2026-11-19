import { CheckCircleOutlined, GlobalOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Input, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import {
  createEmployerCompanyDomainClaim,
  domainClaimAllows,
  domainClaimStatusPresentation,
  employerProfileKeys,
  formatDomainClaimDate,
  getEmployerCompanyDomainClaims,
  getEmployerProfile,
  requestEmployerCompanyDomainManualReview,
  rotateEmployerCompanyDomainClaim,
  verifyEmployerCompanyDomainClaim,
} from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import DomainClaimDnsValue from './DomainClaimDnsValue'
import { m } from '@/shared/config/i18n'

function withoutChallengeSecret(claim) {
  if (!claim) return claim
  const { txt_value: _txtValue, ...safeClaim } = claim
  return safeClaim
}

function DomainClaimCard({ claim, challenge, busy, onVerify, onRotate, onManualReview }) {
  const [manualOpen, setManualOpen] = useState(false)
  const [reason, setReason] = useState('')
  const status = domainClaimStatusPresentation(claim)
  const canVerify = domainClaimAllows(claim, 'verify')
  const canRotate = domainClaimAllows(claim, 'rotate')
  const canRequestManual = domainClaimAllows(claim, 'request_manual_review')
  const txtValue = challenge?.txt_value

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value)
      message.success(m.employer_account_domain_copied({ label }))
    } catch {
      message.error(m.employer_account_domain_copy_failed({ label }))
    }
  }

  async function submitManualReview() {
    const normalizedReason = reason.trim()
    if (normalizedReason.length < 10) {
      message.error(m.employer_account_domain_reason_too_short())
      return
    }
    await onManualReview(claim, normalizedReason)
    setReason('')
    setManualOpen(false)
  }

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900">
            <GlobalOutlined className="shrink-0 text-emerald-600" />
            <span className="break-all">{claim.domain}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {m.employer_account_domain_method_label()} {claim.method === 'admin_manual'
              ? m.employer_account_domain_method_admin()
              : claim.method === 'legacy_inferred' ? m.employer_account_domain_method_legacy() : 'DNS TXT'}
          </p>
        </div>
        <Tag color={status.color} className="w-fit shrink-0">{status.label}</Tag>
      </div>

      {claim.status === 'verified' && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm leading-5 text-emerald-800">
          <CheckCircleOutlined className="mt-0.5 shrink-0" />
          <span>
            {m.employer_account_domain_verified_notice()}
            {claim.next_check_at && m.employer_account_domain_next_check({ date: formatDomainClaimDate(claim.next_check_at) })}
          </span>
        </div>
      )}

      {claim.method === 'dns_txt' && claim.txt_name && claim.status !== 'verified' && (
        <div className="mt-4 space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 sm:p-4">
          <p className="text-sm leading-6 text-slate-700">
            {m.employer_account_domain_txt_intro_before()}<strong>TXT</strong>{m.employer_account_domain_txt_intro_after()}
          </p>
          <DomainClaimDnsValue label={m.employer_account_domain_record_name()} value={claim.txt_name} onCopy={copy} />
          {txtValue ? (
            <DomainClaimDnsValue label={m.employer_account_domain_txt_value()} value={txtValue} onCopy={copy} />
          ) : (
            <Alert
              type="info"
              showIcon
              title={m.employer_account_domain_txt_once_title()}
              description={m.employer_account_domain_txt_once_desc()}
            />
          )}
          {claim.challenge_expires_at && (
            <p className="text-xs text-slate-500">
              {m.employer_account_domain_code_expires()} {formatDomainClaimDate(claim.challenge_expires_at)}
            </p>
          )}
        </div>
      )}

      {claim.grace_expires_at && (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          title={m.employer_account_domain_grace_title()}
          description={m.employer_account_domain_grace_desc({ date: formatDomainClaimDate(claim.grace_expires_at) })}
        />
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canVerify && (
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            aria-label={m.employer_account_domain_check_dns()}
            loading={busy}
            onClick={() => onVerify(claim)}
            className="w-full sm:w-auto"
          >
            {m.employer_account_domain_check_dns()}
          </Button>
        )}
        {canRotate && (
          <ConfirmAction
            title={m.employer_account_domain_rotate_title()}
            description={m.employer_account_domain_rotate_desc()}
            confirmText={m.employer_account_domain_rotate_confirm()}
            cancelText={m.employer_account_domain_close()}
            onConfirm={() => onRotate(claim)}
            onConfirmError={(error) => message.error(getApiErrorMessage(error, m.employer_account_domain_rotate_failed()))}
          >
            <Button
              icon={<ReloadOutlined />}
              aria-label={m.employer_account_domain_rotate_txt()}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              {m.employer_account_domain_rotate_txt()}
            </Button>
          </ConfirmAction>
        )}
        {canRequestManual && !manualOpen && (
          <Button disabled={busy} onClick={() => setManualOpen(true)} className="w-full sm:w-auto">
            {m.employer_account_domain_request_manual()}
          </Button>
        )}
      </div>

      {manualOpen && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <label htmlFor={`domain-manual-reason-${claim.public_id}`} className="text-sm font-semibold text-slate-800">
            {m.employer_account_domain_manual_reason_label()}
          </label>
          <Input.TextArea
            id={`domain-manual-reason-${claim.public_id}`}
            className="mt-2"
            value={reason}
            maxLength={1000}
            showCount
            autoSize={{ minRows: 3, maxRows: 6 }}
            placeholder={m.employer_account_domain_manual_reason_placeholder()}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} onClick={() => { setManualOpen(false); setReason('') }}>{m.employer_account_domain_close()}</Button>
            <Button type="primary" loading={busy} onClick={submitManualReview}>{m.employer_account_domain_send_request()}</Button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function EmployerCompanyDomainVerification({ className = '', companyLinked }) {
  const queryClient = useQueryClient()
  const [challenges, setChallenges] = useState({})
  const profileQuery = useQuery({
    queryKey: employerProfileKeys.profile,
    queryFn: getEmployerProfile,
    enabled: companyLinked == null,
  })
  const hasCompany = companyLinked ?? Boolean(profileQuery.data?.company)
  const claimsQuery = useQuery({
    queryKey: employerProfileKeys.companyDomainClaims,
    queryFn: getEmployerCompanyDomainClaims,
    enabled: hasCompany,
  })

  const updateClaim = (claim) => {
    if (claim?.txt_value) {
      setChallenges((current) => ({ ...current, [claim.public_id]: claim }))
    }
    queryClient.setQueryData(employerProfileKeys.companyDomainClaims, (current = []) => {
      const safeClaim = withoutChallengeSecret(claim)
      const exists = current.some((item) => item.public_id === safeClaim.public_id)
      return exists
        ? current.map((item) => item.public_id === safeClaim.public_id ? safeClaim : item)
        : [safeClaim, ...current]
    })
  }
  const mutationOptions = (successMessage) => ({
    onSuccess: async (claim) => {
      updateClaim(claim)
      message.success(successMessage)
      await queryClient.invalidateQueries({ queryKey: employerProfileKeys.profile })
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_domain_update_failed())),
  })
  const createMutation = useMutation({
    mutationFn: createEmployerCompanyDomainClaim,
    ...mutationOptions(m.employer_account_domain_created()),
  })
  const verifyMutation = useMutation({
    mutationFn: (claim) => verifyEmployerCompanyDomainClaim(claim.public_id),
    ...mutationOptions(m.employer_account_domain_checked()),
  })
  const rotateMutation = useMutation({
    mutationFn: (claim) => rotateEmployerCompanyDomainClaim(claim.public_id, claim.lock_version),
    ...mutationOptions(m.employer_account_domain_rotated()),
  })
  const manualMutation = useMutation({
    mutationFn: ({ claim, reason }) => requestEmployerCompanyDomainManualReview(
      claim.public_id,
      { lockVersion: claim.lock_version, reason },
    ),
    ...mutationOptions(m.employer_account_domain_manual_sent()),
  })
  const busy = createMutation.isPending
    || verifyMutation.isPending
    || rotateMutation.isPending
    || manualMutation.isPending
  const claims = claimsQuery.data || []
  const canCreateClaim = hasCompany && claimsQuery.isSuccess && claims.length === 0

  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <GlobalOutlined className="text-emerald-600" /> {m.employer_account_domain_title()}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            {m.employer_account_domain_subtitle()}
          </p>
        </div>
        {canCreateClaim && (
          <Button
            type="primary"
            disabled={busy}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="w-full shrink-0 sm:w-auto"
          >
            {m.employer_account_domain_create_code()}
          </Button>
        )}
      </div>

      {profileQuery.isError && companyLinked == null && (
        <Alert className="mt-5" type="error" showIcon title={m.employer_account_domain_company_load_failed()} />
      )}
      {!profileQuery.isLoading && !hasCompany && (
        <Alert
          className="mt-5"
          type="info"
          showIcon
          title={m.employer_account_domain_no_company_title()}
          description={m.employer_account_domain_no_company_desc()}
        />
      )}
      {hasCompany && claimsQuery.isLoading && <Skeleton className="mt-5" active paragraph={{ rows: 4 }} />}
      {claimsQuery.isError && (
        <Alert
          className="mt-5"
          type="error"
          showIcon
          title={m.employer_account_domain_claims_load_failed()}
          description={m.employer_account_domain_claims_locked()}
          action={<Button onClick={() => claimsQuery.refetch()}>{m.employer_account_domain_retry()}</Button>}
        />
      )}
      {claimsQuery.isSuccess && claims.length === 0 && (
        <Alert
          className="mt-5"
          type="info"
          showIcon
          title={m.employer_account_domain_empty_title()}
          description={m.employer_account_domain_empty_desc()}
        />
      )}
      {claimsQuery.isSuccess && claims.length > 0 && (
        <div className="mt-5 grid min-w-0 gap-4">
          {claims.map((claim) => (
            <DomainClaimCard
              key={claim.public_id}
              claim={claim}
              challenge={challenges[claim.public_id]}
              busy={busy}
              onVerify={(item) => verifyMutation.mutate(item)}
              onRotate={(item) => rotateMutation.mutateAsync(item)}
              onManualReview={(item, reason) => manualMutation.mutateAsync({ claim: item, reason })}
            />
          ))}
        </div>
      )}
    </section>
  )
}
