import { BankOutlined, EditOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Button, Image, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  changeEmployerCompanyUpdateRequestLifecycle,
  employerProfileKeys,
  getEmployerCompanyUpdateRequests,
} from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import CompanyForm from './CompanyForm'
import CodeBadge from '@/shared/ui/code-badge/CodeBadge'
import { getIntlLocale, m } from '@/shared/config/i18n'

const UPDATE_REQUEST_STATUS = {
  pending: ['processing', m.employer_company_update_status_pending()],
  submitted: ['processing', m.employer_company_update_status_submitted()],
  in_review: ['processing', m.employer_company_request_in_review()],
  changes_requested: ['warning', m.employer_company_update_status_changes_requested()],
  approved: ['success', m.employer_company_update_status_approved()],
  rejected: ['error', m.employer_company_update_status_rejected()],
  withdrawn: ['default', m.employer_company_update_status_withdrawn()],
  cancelled: ['default', m.employer_company_update_status_cancelled()],
}

const DOCUMENT_LABELS = {
  business_registration: m.employer_company_doc_business_registration(),
  trade_name_proof: m.employer_company_doc_trade_name_proof(),
  authorization_letter: m.employer_company_doc_authorization_letter(),
  identity_document: m.employer_company_doc_identity_document(),
}

export default function LinkedCompanyPanel({ profile, catalogs, industries, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const queryClient = useQueryClient()
  const company = profile.company
  const owner = profile.company_role === 'owner'
  const canRequestUpdate = Boolean(company)
  const mineQuery = useQuery({
    queryKey: employerProfileKeys.companyUpdateRequestList('mine'),
    queryFn: () => getEmployerCompanyUpdateRequests({ scope: 'mine' }),
    enabled: canRequestUpdate,
  })
  const mineRequests = mineQuery.data || []
  const latestRequest = mineRequests[0]
  const activeRequest = mineRequests.find((item) => (
    ['pending', 'submitted', 'in_review', 'changes_requested'].includes(item.status)
  ))
  const editableRequest = activeRequest && activeRequest.status !== 'in_review'
    ? activeRequest
    : null
  const documentsRequiringAction = (editableRequest?.documents || []).filter((document) => (
    document.is_current && ['changes_requested', 'rejected'].includes(document.status)
  ))
  const hasDocumentAction = documentsRequiringAction.length > 0
  const [defaultRequestStatusColor, defaultRequestStatusText] = UPDATE_REQUEST_STATUS[latestRequest?.status] || []
  const requestStatusColor = hasDocumentAction ? 'warning' : defaultRequestStatusColor
  const requestStatusText = hasDocumentAction ? m.employer_company_update_needs_documents() : defaultRequestStatusText
  const requestQueryHasError = mineQuery.isError
  const requestQueryFetching = mineQuery.isFetching
  const closeMutation = useMutation({
    mutationFn: ({ request, action }) => changeEmployerCompanyUpdateRequestLifecycle(
      request.public_id,
      action,
      { lock_version: request.lock_version },
    ),
    onSuccess: async () => {
      message.success(m.employer_company_request_withdrawn())
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: employerProfileKeys.companyUpdateRequestList('mine'),
          exact: true,
        }),
        onRefresh?.(),
      ])
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_company_update_withdraw_failed())),
  })
  const writeLocked = requestQueryHasError
    || !mineQuery.isSuccess
    || requestQueryFetching
    || closeMutation.isPending

  const retryRequestQuery = () => mineQuery.refetch()

  const requestError = requestQueryHasError && (
    <Alert
      type="error"
      showIcon
      title={m.employer_company_update_load_error()}
      description={m.employer_company_update_load_error_hint()}
      action={<Button loading={requestQueryFetching} onClick={retryRequestQuery}>{m.employer_company_retry()}</Button>}
    />
  )

  if (editing) {
    return (
      <div className="linked-company-panel">
        {requestError}
        <CompanyForm
          company={company}
          pendingRequest={editableRequest}
          catalogs={catalogs}
          industries={industries}
          canManageMedia={owner}
          disabled={writeLocked}
          onCompleted={async () => { setEditing(false); await onRefresh() }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const latestSubmittedAt = formatDateTime(latestRequest?.submitted_at)
  const rejectionReason = latestRequest?.status === 'rejected'
    ? latestRequest.rejection_reason
      || latestRequest.review_note
      || m.employer_company_update_no_reason()
    : ''

  return (
    <div className="linked-company-panel">
      {requestError}

      <section className="company-update-request" aria-label={m.employer_company_update_mine()} aria-busy={mineQuery.isLoading || undefined}>
        {mineQuery.isLoading ? (
          <Skeleton className="company-update-request__skeleton" active paragraph={{ rows: 1 }} />
        ) : (
          <>
            <div>
              <h2>{m.employer_company_update_mine()}</h2>
              {mineQuery.isError && <p>{m.employer_company_update_status_unknown()}</p>}
              {!mineQuery.isError && latestSubmittedAt && <p>{m.employer_company_update_last_sent({ date: latestSubmittedAt })}</p>}
              {!mineQuery.isError && rejectionReason && (
                <p className="company-update-request__rejection">{m.employer_company_update_rejection({ reason: rejectionReason })}</p>
              )}
            </div>
            {!mineQuery.isError && canRequestUpdate && (
              <div className="company-update-request__actions">
                {requestStatusText && <Tag color={requestStatusColor}>{requestStatusText}</Tag>}
                <Button
                  type="link"
                  disabled={writeLocked || activeRequest?.status === 'in_review'}
                  aria-label={
                    hasDocumentAction
                      ? m.employer_company_update_add_documents()
                      : activeRequest?.status === 'in_review'
                        ? m.employer_company_request_in_review()
                        : undefined
                  }
                  icon={hasDocumentAction ? <UploadOutlined /> : <EditOutlined />}
                  onClick={() => setEditing(true)}
                >
                  {hasDocumentAction
                    ? m.employer_company_update_add_documents()
                    : editableRequest
                      ? activeRequest.status === 'changes_requested'
                        ? m.employer_company_update_edit_resubmit()
                        : m.employer_company_update_edit_request()
                      : activeRequest?.status === 'in_review'
                        ? m.employer_company_request_in_review()
                        : m.employer_company_update_create_request()}
                </Button>
                {activeRequest?.allowed_actions?.includes('withdraw') && (
                  <ConfirmAction
                    title={m.employer_company_request_withdraw_title()}
                    description={(
                      <>
                        {m.employer_company_update_withdraw_confirm()}
                        <br />
                        {m.employer_company_update_withdraw_hint()}
                      </>
                    )}
                    confirmText={m.employer_company_request_withdraw()}
                    cancelText={m.employer_company_close()}
                    danger
                    onConfirm={() => closeMutation.mutateAsync({
                      request: activeRequest,
                      action: 'withdraw',
                    })}
                  >
                    <Button type="link" danger disabled={writeLocked}>
                      {m.employer_company_request_withdraw()}
                    </Button>
                  </ConfirmAction>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {hasDocumentAction && (
        <Alert
          className="company-update-document-request"
          type="warning"
          showIcon
          title={m.employer_company_update_documents_requested()}
          description={(
            <div className="company-update-document-request__content">
              <ul>
                {documentsRequiringAction.map((document) => (
                  <li key={document.public_id || document.id}>
                    <strong>{document.doc_type_label || DOCUMENT_LABELS[document.doc_type] || document.doc_type}</strong>
                    <span>{document.review_note || m.employer_company_update_document_default_note()}</span>
                  </li>
                ))}
              </ul>
              <Button type="primary" disabled={writeLocked} aria-label={m.employer_company_update_add_documents_now()} icon={<UploadOutlined />} onClick={() => setEditing(true)}>
                {m.employer_company_update_add_documents_now()}
              </Button>
            </div>
          )}
        />
      )}

      <section className="linked-company-card">
        <header className="linked-company-card__header">
          <Avatar shape="square" size={60} src={company.logo_url || undefined} icon={<BankOutlined />} className="linked-company-card__logo" />
          <div className="min-w-0">
            <div className="linked-company-card__name"><h2>{company.company_name}</h2></div>
            <p>{company.address || m.employer_company_address_unknown()} <span aria-hidden="true">|</span> {company.company_size ? m.employer_company_size_employees({ size: company.company_size }) : m.employer_company_size_unknown()}</p>
            <p className="linked-company-card__fixed-note">{m.employer_company_linked_fixed_note()}</p>
            <Link to={employerAppPath('/company-page')} className="company-setting-link">{m.employer_company_customize_public_page()}</Link>
          </div>
        </header>

        <dl className="linked-company-details">
          {company.code && <Detail label={m.ui_code_company()}><CodeBadge code={company.code} /></Detail>}
          <Detail label={m.employer_company_tax_code()} value={company.tax_code} />
          <Detail label="Website" value={company.has_no_website ? m.employer_company_no_website() : company.website_url} link={!company.has_no_website} />
          <Detail label={m.employer_company_industries()} value={(company.industries_detail || []).map((item) => item.name).join(', ')} />
          <Detail label={m.employer_company_primary_industry()} value={(company.industries_detail || []).find((item) => item.is_primary)?.name} />
          <Detail label={m.employer_company_markets()} value={formatValue(company.markets)} />
          <Detail label={m.employer_company_target_customers()} value={formatValue(company.target_customers)} />
          <Detail label={m.employer_company_size()} value={company.company_size ? m.employer_company_size_employees({ size: company.company_size }) : ''} />
          <Detail label="Email" value={company.email} />
          <Detail label={m.employer_company_phone()} value={company.phone} />
          <Detail label={m.employer_company_address()} value={company.address} />
          <Detail label={m.employer_company_description()} html={company.description} />
          <Detail label={m.employer_company_employee_benefits()} html={company.employee_benefits} />
          <Detail label={m.employer_company_images()} value={company.images?.length ? null : ''}>
            {company.images?.length > 0 && <div className="linked-company-gallery">{company.images.map((item) => <Image key={item.id} src={item.image_url} alt={m.employer_company_image_alt()} />)}</div>}
          </Detail>
        </dl>
      </section>
    </div>
  )
}

function Detail({ label, value, link = false, html, children }) {
  const content = children || (html
    ? <div className="company-rich-output" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
    : link && value ? <a href={value} target="_blank" rel="noreferrer" className="company-setting-link"><LinkOutlined /> {value}</a>
      : value || '--')
  return <div className="linked-company-details__row"><dt>{label}:</dt><dd>{content}</dd></div>
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '--'
  return value || '--'
}

function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(getIntlLocale(), { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
